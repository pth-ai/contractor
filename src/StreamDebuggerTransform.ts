import {Transform, TransformCallback} from "stream";
import {Logger} from "useful";

export class StreamDebuggerTransform extends Transform {
    private name: string;
    private terminateStream: boolean;
    private logger?: Logger;

    constructor(name: string, terminateStream: boolean = false, logger?: Logger) {
        super({objectMode: true});
        this.name = name;
        this.terminateStream = terminateStream;
        this.logger = logger;
    }

    _transform(chunk: any, encoding: string, callback: TransformCallback) {
        (this.logger?.debug ?? console.debug)(`[${this.name}] passing data [${JSON.stringify(chunk)}]`);
        if (!this.terminateStream) {
            this.push(chunk);
        }
        callback();
    }
}
