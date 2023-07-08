import {Transform, TransformCallback} from "stream";

export class SimpleStreamTransform<IN, OUT> extends Transform {
    private transformer: (input: IN) => OUT;

    constructor(transformer: (input: IN) => OUT) {
        super({objectMode: true});
        this.transformer = transformer;
    }

    _transform(chunk: IN, encoding: string, callback: TransformCallback) {
        this.push(this.transformer(chunk));
        callback();
    }
}