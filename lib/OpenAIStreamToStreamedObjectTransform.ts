import {Transform, TransformCallback} from "stream";
import {ValidateFunction} from "ajv";
import {OpenAIStreamObject} from "./OpenAIStreamTransform";
import {assertIsDefined, truthy} from "./utils";
import * as JSON5 from './json5';
import {Logger} from "./Logger";

export interface StreamedObject<T> {
    stream: T;
    functionName?: string;
}

/**
 * this class transforms a stream of {OpenAIStreamObject} to {StreamedObject<T>>}
 */
export class OpenAIStreamToStreamedObjectTransform extends Transform {
    private jsonStream: string;
    // mapping of object type to validation function
    private readonly validateFunction: ValidateFunction<any> | Map<string, ValidateFunction<any>>;
    // mapping of object type to healpath
    private readonly healPath: string[] | Map<string, string[]>;
    private logger?: Logger;
    private objectTypeByFunctionName?: string;

    constructor(validateFunction: ValidateFunction<any> | Map<string, ValidateFunction<any>>,
                healPath: string[] | Map<string, string[]>,
                logger?: Logger,
                private typeValueAttribute: string = "type",
                private validatoinValueAttribute?: string) {
        super({objectMode: true});
        this.validateFunction = validateFunction;
        this.healPath = healPath;
        this.logger = logger;
        this.jsonStream = "";
    }

    _transform(chunk: any, encoding: string, callback: TransformCallback) {
        // Transform the data to uppercase
        const incoming = chunk as OpenAIStreamObject[];
        if (!Array.isArray(incoming)) {
            return callback(new Error(`ObjectStreamTransform was expecting array, instead got [${JSON.stringify(incoming)}]`))
        }

        truthy(incoming.at(0)?.functionName, _ => this.objectTypeByFunctionName = _);

        this.jsonStream += incoming.map(_ => _.chunk).join('');
        try {
            const healedObject = JSON5.parse(this.jsonStream, undefined, (error, stack, root) => {
                let _healPath: string[] = [];
                if (Array.isArray(this.healPath)) {
                    _healPath = this.healPath;
                } else {
                    this.objectTypeByFunctionName = this.objectTypeByFunctionName
                        || (root?.hasOwnProperty(this.typeValueAttribute) ? root[this.typeValueAttribute] as string : undefined);

                    if (this.objectTypeByFunctionName) {
                        // if healpath not provided for this type just return what ever works (if validation passes)
                        _healPath = this.healPath.get(this.objectTypeByFunctionName) ?? [];
                    } else if (!!this.objectTypeByFunctionName) {
                        this.logger?.error(`warning: object type not mapped [${this.objectTypeByFunctionName}]`, error);
                    }
                }

                if (error.message.includes(`invalid character '`)) {
                    return {type: 'skip-char'};
                }

                if (error.message.includes('invalid end of input') && stack.length > _healPath.length) {
                    const healKey = _healPath.at(-1);
                    if (healKey) {
                        assertIsDefined(healKey);
                        const healStackPath = stack[_healPath.length - 1]
                        if (healStackPath?.hasOwnProperty(healKey)) {
                            if (healStackPath[healKey] === stack[_healPath.length]) {
                                if (Array.isArray(healStackPath[healKey])) {
                                    healStackPath[healKey].pop()
                                }
                            }
                        }
                        return {type: 'return-healed', value: root}
                    }
                }
            });

            const validationFunction = (this.validateFunction instanceof Map
                ? (this.objectTypeByFunctionName ? this.validateFunction.get(this.objectTypeByFunctionName) : undefined)
                : this.validateFunction)
            if (!validationFunction) {
                return callback(new Error(`did not find suitable validation function [${this.objectTypeByFunctionName}]`))
            } else {
                const validated = validationFunction(
                    this.validatoinValueAttribute
                        ? healedObject[this.validatoinValueAttribute]
                        : healedObject);

                if (validated) {
                    this.push(JSON.stringify({
                        functionName: this.objectTypeByFunctionName,
                        stream: healedObject,
                    }) + '\n');
                }
            }
            callback();
        } catch (err: any) {
            if (err.message?.includes('invalid end of input')) {
                // ignore while streaming...
                callback();
            } else {
                this.logger?.error('error caught', err);
                callback(new Error('caught error:' + err.message));
            }
        }
    }
}
