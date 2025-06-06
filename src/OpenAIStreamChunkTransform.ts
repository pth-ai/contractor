import {Transform, TransformCallback} from "stream";

import {ChatCompletionChunk} from "openai/resources/chat/completions";
import {Logger} from "useful";

import {OpenAIStreamObject} from "./OpenAIStreamObject";

/**
 * extracts object from OpenAI lines format ("data: ...")
 *  transforms this into {OpenAIStreamObject}
 **/
export class OpenAIStreamChunkTransform extends Transform {
    private functionName?: string = undefined;

    constructor(_logger?: Logger, _logMetaData?: object) {
        super({objectMode: true});
    }

    _transform(chunk: ChatCompletionChunk, _encoding: string, callback: TransformCallback) {
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
