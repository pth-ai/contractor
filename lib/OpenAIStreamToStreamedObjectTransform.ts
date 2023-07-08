import {Transform, TransformCallback} from "stream";
import {ValidateFunction} from "ajv";
import {OpenAIStreamObject} from "./OpenAIStreamTransform";
import {assertIsDefined} from "./utils";
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

    constructor(validateFunction: ValidateFunction<any> | Map<string, ValidateFunction<any>>,
                healPath: string[] | Map<string, string[]>,
                logger?: Logger) {
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
        const objectTypeByFunctionName = incoming.at(0)?.functionName;

        this.jsonStream += incoming.map(_ => _.chunk).join('');
        try {
            const healedObject = JSON5.parse(this.jsonStream, undefined, (error, stack, root) => {
                let _healPath: string[] = [];
                if (Array.isArray(this.healPath)) {
                    _healPath = this.healPath;
                } else {
                    const rootType = objectTypeByFunctionName || (root.hasOwnProperty('type') ? root.type as string : undefined);
                    if (rootType) {
                        // if healpath not provided for this type just return what ever works (if validation passes)
                        _healPath = this.healPath.get(rootType) ?? [];
                    } else {
                        callback(new Error(`object type not mapped [${rootType}]`))
                    }
                }
                if (error.message.includes('invalid end of input') && stack.length > _healPath.length) {
                    const healKey = _healPath.at(-1);
                    assertIsDefined(healKey);
                    const healStackPath = stack[_healPath.length - 1]
                    if (healStackPath.hasOwnProperty(healKey)) {
                        if (healStackPath[healKey] === stack[_healPath.length]) {
                            if (Array.isArray(healStackPath[healKey])) {
                                healStackPath[healKey].pop()
                            }
                        }
                    }
                    return root
                }
            });
            const validationFunction = (this.validateFunction instanceof Map
                ? (objectTypeByFunctionName ? this.validateFunction.get(objectTypeByFunctionName) : undefined)
                : this.validateFunction)
            if (!validationFunction) {
                return callback(new Error(`did not find suitable validation function [${objectTypeByFunctionName}]`))
            } else {
                const validated = validationFunction(healedObject);
                if (validated) {
                    this.push(JSON.stringify({
                        functionName: objectTypeByFunctionName,
                        stream: healedObject,
                    }) + '\n');
                }
            }

        } catch (_ignore) {
        } finally {
            callback();
        }
    }
}