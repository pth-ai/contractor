import {Transform, TransformCallback} from "stream";
import {Logger} from "useful";
import {OpenAIStreamObject} from "./OpenAIStreamObject";

/**
 * this class transforms a stream of {OpenAIStreamObject} to {StreamedObject<T>>}
 */
export class OpenAIStreamToStreamedHealedTransform extends Transform {
    private streamStr: string;
    private logger?: Logger;
    private healer: (streamStr: string) => (string | undefined);

    constructor(healer: (streamStr: string) => string | undefined,
                logger?: Logger) {
        super({objectMode: true});
        this.logger = logger;
        this.streamStr = "";
        this.healer = healer;
    }

    _transform(chunk: any, encoding: string, callback: TransformCallback) {
        // Transform the data to uppercase
        const incoming = chunk as OpenAIStreamObject[];
        if (!Array.isArray(incoming)) {
            return callback(new Error(`OpenAIStreamToStreamedHealedTransform was expecting array, instead got [${Array.isArray(incoming) || typeof incoming}][${JSON.stringify(incoming)}]`))
        }

        this.streamStr += incoming.map(_ => _.chunk).join('');

        try {
            const healedStr = this.healer(this.streamStr)
            if (healedStr) {
                this.push(JSON.stringify({
                    stream: healedStr,
                }) + '\n');
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
