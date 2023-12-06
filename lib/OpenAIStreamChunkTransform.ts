import {Transform, TransformCallback} from "stream";

import {Logger} from "./Logger";
import {ChatCompletionChunk} from "openai/resources/chat/completions";

export interface OpenAIStreamObject {
    functionName?: string;
    chunk: string;
}

/**
 * extracts object from OpenAI lines format ("data: ...")
 *  transforms this into {OpenAIStreamObject}
 **/
export class OpenAIStreamChunkTransform extends Transform {
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

    _transform(chunk: ChatCompletionChunk, encoding: string, callback: TransformCallback) {
        try {
            const funcName = chunk.choices[0]?.delta?.function_call?.name;
            if (funcName) {
                this.functionName = funcName;
            }
            const content = chunk.choices[0]?.delta?.content ?? chunk.choices[0]?.delta?.function_call?.arguments;
            if (content) {
                this.push({
                    functionName: this.functionName,
                    chunk: content || ''
                } as OpenAIStreamObject);
            }
        } catch (error: any) {
            // sometimes OpenAI sends us only partial json..
            return callback(new Error('error processing response, please try again'));
        }

        // Call the callback to indicate that the transformation is complete
        callback();
    }
}
