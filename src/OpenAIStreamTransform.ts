import {Transform, TransformCallback} from "stream";
import * as JSON5 from './json5';
import {Logger} from "useful";

export interface OpenAIStreamObject {
    functionName?: string;
    chunk: string;
}

/**
 * extracts object from OpenAI lines format ("data: ...")
 *  transforms this into {OpenAIStreamObject}
 **/
export class OpenAIStreamTransform extends Transform {
    private functionName?: string = undefined;

    // sometimes a non-complete chunk of the steam comes.. we keep it here for the next drop to prepend to..
    private partialChunk: string | undefined = undefined;
    private logger?: Logger;
    private readonly logMetaData?: object;

    constructor(logger?: Logger, logMetaData?: object) {
        super({objectMode: true});
        this.logger = logger;
        this.logMetaData = logMetaData;
    }

    _transform(chunk: any, encoding: string, callback: TransformCallback) {
        // Transform the data to uppercase
        let processChunk = chunk.toString();
        if (this.partialChunk) {
            processChunk = this.partialChunk + processChunk;
            this.partialChunk = undefined;
        }
        const payloads = processChunk.toString().split("\n\n");
        for (const payload of payloads) {
            if (payload.trim() === 'data: [DONE]') {
                // the chat stream is done..
            } else if (payload.startsWith("data:")) {
                const data = payload.replaceAll(/(\n)?^data:\s*/g, ''); // in case there's multiline data event

                try {
                    const delta = JSON5.parse(data.trim());
                    const funcName = delta.choices[0]?.delta?.function_call?.name;
                    if (funcName) {
                        this.functionName = funcName;
                    }
                    const content = delta.choices[0]?.delta?.content ?? delta.choices[0]?.delta?.function_call?.arguments;
                    if (content) {
                        this.push({
                            functionName: this.functionName,
                            chunk: content || ''
                        } as OpenAIStreamObject);
                    }
                } catch (error: any) {
                    // sometimes OpenAI sends us only partial json..
                    if (error.toString().trim().includes('invalid end of input') || error.toString().trim().includes(`Cannot read properties of undefined (reading '0')`)) {
                        this.partialChunk = chunk;
                        return callback();
                    } else {
                        this.logger?.error(`Error with JSON5.parse payload=[${payload}].\n${error}`, error, this.logMetaData)
                        return callback(new Error('error processing response, please try again'));
                    }
                }
            }
        }

        // Call the callback to indicate that the transformation is complete
        callback();
    }
}
