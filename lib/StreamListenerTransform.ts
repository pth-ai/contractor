import {Transform, TransformCallback} from "stream";

/**
 *
 */
export class StreamListener<T> extends Transform {
    private consumer: (input: T) => void;

    constructor(consumer: (input: T) => void) {
        super({objectMode: true});
        this.consumer = consumer;
    }

    _transform(chunk: T, encoding: string, callback: TransformCallback) {
        this.consumer(chunk);
        this.push(chunk);
        callback();
    }
}