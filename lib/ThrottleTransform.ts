
import {Logging} from "./Logging";
import {Transform, TransformCallback} from "stream";

export type ThrottledTransformOptions = {
    name: string;
    windowSize: number;
    flushDebounceTimeMs: number;
    maxIdleTimeoutMs: number;
};

export type WriteTo = <T>(itemsOrError: T[] | Error) => Promise<void>;

const logger = new Logging('ThrottledTransform');
const enableDebugLog = process.env.NODE_ENV === 'test';

export class ThrottledTransform<T> extends Transform {

    private queue: T[];
    private options: ThrottledTransformOptions;
    private flushDebounceTimer: NodeJS.Timeout | null = null;
    private maxTimeoutTimer: NodeJS.Timeout | null = null;
    private writeTo?: (itemsOrError: T[] | Error) => Promise<void>;

    constructor(options: ThrottledTransformOptions, writeTo?: WriteTo) {
        super({objectMode: true});
        this.writeTo = writeTo;
        this.queue = [];
        this.options = options;
    }

    _transform(chunk: T, encoding: string, callback: TransformCallback) {
        logger.debug('_transform called', {name: this.options.name}, enableDebugLog);
        this.queue.push(chunk);

        if (this.queue.length >= this.options.windowSize) {
            this.flushQueue('windowSize');
        } else {
            if (!this.flushDebounceTimer) {
                logger.debug(`_transform setting debounce t=${this.options.flushDebounceTimeMs}`, {name: this.options.name}, enableDebugLog);
                this.flushDebounceTimer = setTimeout(() => this.flushQueue('flushDebounceTime'), this.options.flushDebounceTimeMs);
            }

            this.cleanMaxTimeout(true);
        }

        callback();
    }

    _flush(callback: Function) {
        logger.debug('_flush called', {name: this.options.name}, enableDebugLog);
        if (this.queue.length > 0) {
            this.flushQueue('_flush');
        }
        callback();
    }

    private cleanMaxTimeout = (scheduleNext: boolean = false) => {
        if (this.maxTimeoutTimer) {
            clearTimeout(this.maxTimeoutTimer);
            this.maxTimeoutTimer = null;
        }

        if (scheduleNext) {
            this.maxTimeoutTimer = setTimeout(() => this.flushQueue('maxTimeout', true, 'max timeout reached'), this.options.maxIdleTimeoutMs);
        }
    }
    private cleanDebounceTimer = () => {
        if (this.flushDebounceTimer) {
            clearTimeout(this.flushDebounceTimer);
            this.flushDebounceTimer = null;
        }
    }

    private flushQueue(reason: 'windowSize' | 'flushDebounceTime' | '_flush' | 'maxTimeout', forceEnd = false, errorMessage?: string) {
        logger.debug(`flushQueue called. reason=[${reason}]`, {
            name: this.options.name,
            forceEnd,
            errorMessage
        }, enableDebugLog);
        this.cleanDebounceTimer();
        if (this.queue.length > 0) {
            // Replace writeToDatabase with your actual function to write to the database
            this.push(this.queue.slice())
            this.writeTo?.(this.queue.slice())
                .catch(e => {
                    logger.error('error writing to destination', e, {writerName: this.options.name});
                    this.emit('error', new Error('error writing to destination'));
                });

            this.queue = [];
        }

        if (forceEnd) {
            if (errorMessage) {
                logger.debug('emitting error', {name: this.options.name, forceEnd, errorMessage}, enableDebugLog);
                this.emit('error', new Error(errorMessage));
            } else {
                this.emit('end');
            }
        }
    }

    _final(callback: (error?: (Error | null)) => void) {
        logger.debug('final called', {name: this.options.name}, enableDebugLog);
        this.cleanMaxTimeout();
        this.cleanDebounceTimer();
        super._final(callback);
    }

    public getQueueSize = () => this.queue.length;
}

