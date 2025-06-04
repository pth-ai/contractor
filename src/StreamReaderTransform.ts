import {Transform} from "stream";

export class StreamReaderTransform<T> extends Transform {
    private consumer: (input: T) => void;

    constructor(consumer: (input: T) => void) {
        super({objectMode: true});
        this.consumer = consumer;
    }

    _transform(chunk: T, _encoding: string, callback: Function) {
        this.consumer(chunk);
        this.push(chunk);
        callback();
    }
}