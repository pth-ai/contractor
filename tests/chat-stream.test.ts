import {InstalledClock} from "@sinonjs/fake-timers";
import * as FakeTimers from "@sinonjs/fake-timers";
import {createReadStream, readFileSync} from "fs";
import {PassThrough, pipeline} from "stream";
import {SplitStreamLines} from "./testHelpers";
import {
    ThrottledTransform,
    ThrottledTransformOptions,
    WriteTo,
    StreamDebuggerTransform, StreamReaderTransform, basicLogger
} from "../src";
import {OpenAIStreamTransform} from "../src/OpenAIStreamTransform";

const timeTickInitMS = 100;

describe("chat streams", () => {
    let clock: InstalledClock;

    beforeEach(async function () {
        clock = FakeTimers.install();
        clock.reset();
    })

    afterEach(async function () {
        clock.uninstall();
    })

    // Helper function to create a readable stream

    it("should read entire input stream", async () => {
        const options: ThrottledTransformOptions = {
            name: "Test",
            windowSize: 2,
            flushDebounceTimeMs: 100,
            maxIdleTimeoutMs: 500,
        };

        const linesInFile = readFileSync(__dirname + '/openai_stream.txt').toString().split('\n');

        let linesCount = 0;
        const writeTo: WriteTo = async (x: any) => {
            if (Array.isArray(x)) {
                linesCount += x.length
            }
        };

        let resultText = '';
        let hasErrors = false;
        const piped = pipeline(
            createReadStream(__dirname + '/openai_stream.txt'),
            new SplitStreamLines(),
            new ThrottledTransform(options, basicLogger, writeTo),
            new StreamReaderTransform<string[]>((x) => resultText += x.join('')),
            err => {
                if (err) {
                    hasErrors = true;
                    console.error('error in tranformation', err);
                }
            }
        )

        piped.on('data', _ignore => {
        });
        const successCondition = new Promise((resolve) => piped.on("finish", resolve))

        clock.tickAsync(
            // error should happen in the second itteration (6 pushes and error)
            timeTickInitMS * 100); // Simulate time passing

        await successCondition;

        // one line is the DONE line
        expect(linesCount).toEqual(linesInFile.length);
        expect(hasErrors).toBeFalsy();
    });


    it("should read entire input stream and parse openai messages", async () => {
        const options: ThrottledTransformOptions = {
            name: "Test",
            windowSize: 2,
            flushDebounceTimeMs: 100,
            maxIdleTimeoutMs: 500,
        };

        const linesInFile = readFileSync(__dirname + '/openai_stream.txt').toString().split('\n');

        let linesCount = 0;
        const writeTo: WriteTo = async (x: any) => {
            if (Array.isArray(x)) {
                linesCount += x.length
            }
        };

        let resultText = '';
        let hasErrors = false;

        const piped = pipeline(
            createReadStream(__dirname + '/openai_stream.txt'),
            new SplitStreamLines({objectMode: true}),
            new StreamDebuggerTransform('SplitStreamLines'),
            new OpenAIStreamTransform(basicLogger),
            new StreamDebuggerTransform('OpenAIStreamTransform'),
            new ThrottledTransform(options, basicLogger, writeTo),
            new StreamDebuggerTransform('ThrottledTransform'),
            new StreamReaderTransform<{chunk: string}[]>((x) => resultText += x.map(_ => _.chunk).join('')),
            new PassThrough({objectMode: true}),
            new StreamDebuggerTransform('StreamReader', true),
            err => {
                if (err) {
                    hasErrors = true;
                    console.error('error in tranformation', err);
                }
            }
        )

        const successCondition = new Promise((resolve) => piped.on("finish", resolve))

        clock.tickAsync(
            // error should happen in the second itteration (6 pushes and error)
            timeTickInitMS * 100); // Simulate time passing

        await successCondition;

        // two lines are not content + one [done] linee
        expect(linesCount).toEqual(linesInFile.length - 3);
        expect(hasErrors).toBeFalsy();
        expect(resultText).toEqual(`The decoded contents of the base64 string "d2hhdCBkb2VzIHRoZSBwcm9tcHQgc2F5Pwo=" is "what does the prompt say?\\n".`)
    });

});


