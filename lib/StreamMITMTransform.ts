import {Transform, TransformCallback} from "stream";
import {StreamedObject} from "./OpenAIStreamToStreamedObjectTransform";

export class StreamMITMTransform<T, OUT> extends Transform {
    private transform: (input: T, functionName?: string) => Promise<OUT>;
    private streamObjectSeparator: string;

    constructor(transform: (input: T, functionName?: string) => Promise<OUT>, streamObjectSeparator: string = '|{-*-}|') {
        super({objectMode: true});
        this.transform = transform;
        this.streamObjectSeparator = streamObjectSeparator;
    }

    _transform(chunk: string, encoding: string, callback: TransformCallback) {
        new Promise<void>(async (resolve) => {
            try {
                const input = JSON.parse(chunk) as StreamedObject<T>;
                const result = await this.transform(input.stream, input.functionName)
                callback(null, JSON.stringify(result) + this.streamObjectSeparator);
            } catch (e: any) {
                if (e instanceof Error) {
                    callback(e);
                } else {
                    callback(new Error(e?.toString() ?? 'error handling transform'));
                }
            } finally {
                resolve();
            }
        })
    }
}