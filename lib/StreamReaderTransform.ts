import {Transform} from "stream";

export class StreamReader<T> extends Transform {
    private consumer: (input: T) => void;

    constructor(consumer: (input: T) => void) {
        super({objectMode: true});
        this.consumer = consumer;
    }

    _transform(chunk: T, encoding: string, callback: Function) {
        this.consumer(chunk);
        this.push(chunk);
        callback();
    }
}