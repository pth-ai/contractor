import {InstalledClock} from "@sinonjs/fake-timers";
import {Readable} from "stream";
import {expect} from 'chai';
import {ThrottledTransform, ThrottledTransformOptions, WriteTo} from "../src/util/ThrottleTransform";
import {waitForCondition} from "./testHelpers";
import {throwError} from "../../frontend/src/utils/tsUtils";

const timeTickInitMS = 100;

describe("ThrottledTransform", () => {
    let clock: InstalledClock;

    beforeEach(async function () {
        clock = this.clock;
        clock.reset();
    })

    // Helper function to create a readable stream
    const createReadableStream = (data: any[]) => {
        return new Readable({
            objectMode: true,
            read() {
                if (data.length > 0) {
                    this.push(data.shift());
                } else {
                    this.push(null);
                }
            },
        });
    };

    const createGradualReadableStream = (data: any[], intervalMs: number | (() => number), throttledTransform: ThrottledTransform<unknown>) => {
        return new Readable({
            objectMode: true,
            read() {
                const waitTime = typeof intervalMs === 'number' ? intervalMs : intervalMs();
                console.debug(`[CGRS] read called data_l=${data.length} t=${Date.now()} wait=${waitTime} queueSize=${throttledTransform.getQueueSize()}`);
                if (data.length > 0) {
                    console.debug(`[CGRS] push setTimeout called data_l=${data.length} date=${Date.now()}`);
                    setTimeout(() => {
                        console.debug(`[CGRS] push setTimeout triggered`);
                        this.push(data.shift());
                        if (data.length === 0) {
                            console.debug(`[CGRS] push setTimeout FIN triggered`);
                            this.push(null);
                        }
                    }, waitTime);
                } else {
                    console.debug("[CGRS] empty setTimeout called");
                    setTimeout(() => {
                        console.debug("[CGRS] empty setTimeout triggered");
                        this.push(null);
                    }, waitTime);
                }
            },
        });
    };

    it("should flush the queue when it reaches the windowSize", async () => {
        const options: ThrottledTransformOptions = {
            name: "Test",
            windowSize: 2,
            flushDebounceTimeMs: 100,
            maxIdleTimeoutMs: 500,
        };

        const data = [1, 2, 3, 4, 5];
        const readStream = createReadableStream(data.slice());
        let callTimes = 0;
        const writeTo: WriteTo = async (x: any) => {
            callTimes += 1
        };
        const throttledTransform = new ThrottledTransform(options, writeTo);

        readStream.pipe(throttledTransform);

        await new Promise((resolve) => throttledTransform.on("finish", resolve));

        expect(callTimes).to.equal(3)
    });

    it("should flush the queue when flushDebounceTimeMs is reached", async () => {
        const options: ThrottledTransformOptions = {
            name: "Test",
            windowSize: 10,
            flushDebounceTimeMs: 100,
            maxIdleTimeoutMs: 500,
        };

        const data = [1, 2, 3, 4, 5];
        const readStream = createReadableStream(data.slice());
        let callTimes = 0;
        const writeTo: WriteTo = async (x: any) => {
            callTimes += 1
        };
        const throttledTransform = new ThrottledTransform(options, writeTo);

        readStream.pipe(throttledTransform);

        await new Promise((resolve) => throttledTransform.on("finish", resolve));

        expect(callTimes).to.equal(1)
    });

    it("should flush the queue when maxIdleTimeoutMs is reached", async () => {
        const options: ThrottledTransformOptions = {
            name: "Test",
            windowSize: 10,
            flushDebounceTimeMs: 100,
            maxIdleTimeoutMs: 500,
        };

        const data = [1, 2, 3, 4, 5];
        const readStream = createReadableStream(data.slice());
        let callTimes = 0;
        const writeTo: WriteTo = async (x: any) => {
            callTimes += 1
        };
        const throttledTransform = new ThrottledTransform(options, writeTo);

        readStream.pipe(throttledTransform);

        await new Promise((resolve) => {
            throttledTransform.on("finish", resolve);
        });

        clock.tick(501);

        expect(callTimes).to.equal(1)
    });

    it("should flush the queue when the window size is reached", async () => {
        const options: ThrottledTransformOptions = {
            name: "Test",
            windowSize: 5,
            flushDebounceTimeMs: 1000,
            maxIdleTimeoutMs: 5000,
        };

        let callTimes = 0;
        const writeTo: WriteTo = async (x: any) => {
            callTimes += 1;
        };

        const throttledTransform = new ThrottledTransform(options, writeTo);

        const data = Array.from({length: 10}, (_, i) => i + 1);

        const readableStream = createReadableStream(data);
        readableStream.pipe(throttledTransform);

        await new Promise((resolve) => throttledTransform.on("finish", resolve));

        expect(callTimes).to.equal(2);
    });

    it("should flush the queue after input is all transmitted", async () => {
        const options: ThrottledTransformOptions = {
            name: "Test",
            windowSize: 5,
            flushDebounceTimeMs: 1000,
            maxIdleTimeoutMs: 5000,
        };

        let callTimes = 0;
        const writeTo: WriteTo = async (x: any) => {
            callTimes += 1;
        };

        const throttledTransform = new ThrottledTransform(options, writeTo);

        const data = Array.from({length: 3}, (_, i) => i + 1);

        const readableStream = createReadableStream(data);
        readableStream.pipe(throttledTransform);

        await new Promise((resolve) => throttledTransform.on("finish", resolve));
        expect(callTimes).to.equal(1);

    });

    it("should flush the queue after the flush debounce time", async () => {

        const inputSize = 6;

        const options: ThrottledTransformOptions = {
            name: "Test",
            windowSize: inputSize * 2,
            flushDebounceTimeMs: timeTickInitMS * (inputSize / 2),
            maxIdleTimeoutMs: timeTickInitMS * inputSize,
        };

        let callTimes = 0;
        const writeTo: WriteTo = async (x: any) => {
            callTimes += 1;
        };

        const throttledTransform = new ThrottledTransform(options, writeTo);

        const data = Array.from({length: inputSize}, (_, i) => i + 1);

        const readableStream = createGradualReadableStream(data, timeTickInitMS, throttledTransform);
        readableStream.pipe(throttledTransform);

        const sucessCondition = waitForCondition(() => callTimes === 1);

        clock.tickAsync(timeTickInitMS * (inputSize / 2 + 1)); // Simulate time passing

        await sucessCondition;

        expect(callTimes).to.be.most(1);

    });

    it("should error the queue after the max idle timeout", async () => {

        const inputSize = 6;

        const options: ThrottledTransformOptions = {
            name: "Test",
            windowSize: inputSize * 2,
            flushDebounceTimeMs: timeTickInitMS * (inputSize / 2),
            maxIdleTimeoutMs: timeTickInitMS * 10,
        };

        let callTimes = 0;
        const writeTo: WriteTo = async (x: any) => {
            callTimes += 1;
        };

        const throttledTransform = new ThrottledTransform(options, writeTo);
        let isErrorInTTStream = false;
        throttledTransform.on('error', () => isErrorInTTStream = true);

        const data = Array.from({length: inputSize}, (_, i) => i + 1);


        let intervalCalls = 0;
        // only return three readables and get "stuck" after
        const readableStream = createGradualReadableStream(data, () => {
            intervalCalls += 1;
            return intervalCalls <= 3
                ? timeTickInitMS
                : timeTickInitMS * 100;
        }, throttledTransform);
        readableStream.pipe(throttledTransform);

        const sucessCondition = waitForCondition(() => isErrorInTTStream === true);

        clock.tickAsync(
            // time span of timeout
            timeTickInitMS * 10
            // timespan of first three items
            + timeTickInitMS * 3 +
            // one extra tick
            +timeTickInitMS); // Simulate time passing

        await sucessCondition;

        expect(callTimes).to.be.most(1);
        expect(isErrorInTTStream).to.equal(true);

    });


    it("should emit error when there's a problem with writeTo", async () => {

        const inputSize = 9;

        const options: ThrottledTransformOptions = {
            name: "Test",
            windowSize: inputSize / 3,
            flushDebounceTimeMs: timeTickInitMS * 10,
            maxIdleTimeoutMs: timeTickInitMS * 20,
        };

        let callTimes = 0;
        const writeTo: WriteTo = async (x: any) => {
            callTimes === 1
                // throw error on second write
                ? throwError('errrr')
                : callTimes += 1;
        };

        const throttledTransform = new ThrottledTransform(options, writeTo);
        let isErrorInTTStream = false;
        throttledTransform.on('error', () => isErrorInTTStream = true);

        const data = Array.from({length: inputSize}, (_, i) => i + 1);

        // only return three readables and get "stuck" after
        const readableStream = createGradualReadableStream(data, timeTickInitMS, throttledTransform);
        readableStream.pipe(throttledTransform);

        const sucessCondition = waitForCondition(() => isErrorInTTStream === true);

        clock.tickAsync(
            // error should happen in the second itteration (6 pushes and error)
            timeTickInitMS * 7); // Simulate time passing

        await sucessCondition;

        expect(callTimes).to.be.most(1);
        expect(isErrorInTTStream).to.equal(true);

    });

    it("should not flush the queue if flushDebounceTimeMs is not reached and maxIdleTimeoutMs is not reached and window size is not reached", async () => {
        const options: ThrottledTransformOptions = {
            name: "Test",
            windowSize: 5,
            flushDebounceTimeMs: timeTickInitMS * 10,
            maxIdleTimeoutMs: timeTickInitMS * 20,
        };

        const data = [1, 2, 3];
        const readStream = createReadableStream(data.slice());
        let callTimes = 0;
        const writeTo: WriteTo = async (x: any) => {
            callTimes += 1;
        };
        const throttledTransform = new ThrottledTransform(options, writeTo);

        readStream.pipe(throttledTransform);

        const sucessCondition = waitForCondition(() => callTimes === 0);

        clock.tickAsync(
            // error should happen in the second itteration (6 pushes and error)
            timeTickInitMS * data.length + 1); // Simulate time passing

        await sucessCondition;

        expect(callTimes).to.equal(0);
    });

    it("should handle multiple chunks correctly, respecting window size and flushDebounceTimeMs", async () => {

        const inputSize = 10;
        const data = Array.from({length: inputSize}, (_, i) => i + 1);

        const options: ThrottledTransformOptions = {
            name: "Test",
            windowSize: inputSize / 2,
            flushDebounceTimeMs: timeTickInitMS * 10,
            maxIdleTimeoutMs: timeTickInitMS * 20,
        };

        let callTimes = 0;
        const writeTo: WriteTo = async (x: any) => {
            console.debug(`[writeTo] called with data=${JSON.stringify(x)}`);
            callTimes += 1;
        };
        const throttledTransform = new ThrottledTransform(options, writeTo);
        const readStream = createGradualReadableStream(data.slice(), 50, throttledTransform);
        readStream.pipe(throttledTransform);

        const successCondition = new Promise((resolve) => throttledTransform.on("finish", resolve))

        clock.tickAsync(
            // error should happen in the second itteration (6 pushes and error)
            timeTickInitMS * data.length + 1); // Simulate time passing

        await successCondition;


        expect(callTimes).to.equal(2);
    });

    it("should handle an empty input stream without errors", async () => {
        const inputSize = 0;
        const data: any[] = [];

        const options: ThrottledTransformOptions = {
            name: "Test",
            windowSize: inputSize / 3,
            flushDebounceTimeMs: timeTickInitMS * 10,
            maxIdleTimeoutMs: timeTickInitMS * 20,
        };

        const readStream = createReadableStream(data.slice());
        let callTimes = 0;
        const writeTo: WriteTo = async (x: any) => {
            callTimes += 1;
        };
        const throttledTransform = new ThrottledTransform(options, writeTo);

        readStream.pipe(throttledTransform);

        const successCondition = new Promise((resolve) => throttledTransform.on("finish", resolve))

        clock.tickAsync(
            // error should happen in the second itteration (6 pushes and error)
            timeTickInitMS * data.length + 1); // Simulate time passing

        await successCondition;

        expect(callTimes).to.equal(0);
    });


});

