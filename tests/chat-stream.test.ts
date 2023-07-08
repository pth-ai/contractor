import {InstalledClock} from "@sinonjs/fake-timers";
import {ThrottledTransform, ThrottledTransformOptions, WriteTo} from "../src/util/ThrottleTransform";
import {createReadStream, readFileSync} from "fs";
import {PassThrough, pipeline} from "stream";
import {SplitStreamLines, StreamDebugger, StreamReader} from "./testHelpers";
import {expect} from "chai";
import {OpenAIStreamTransform} from "../src/util/OpenAIStreamTransform";

const timeTickInitMS = 100;

describe("chat streams", () => {
    let clock: InstalledClock;

    beforeEach(async function () {
        clock = this.clock;
        clock.reset();
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
            new ThrottledTransform(options, writeTo),
            new StreamReader<string[]>((x) => resultText += x.join('')),
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
        expect(linesCount).to.equal(linesInFile.length);
        expect(hasErrors).to.be.false;
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
            new StreamDebugger('SplitStreamLines'),
            new OpenAIStreamTransform('test-team', 'test-task'),
            new StreamDebugger('OpenAIStreamTransform'),
            new ThrottledTransform(options, writeTo),
            new StreamDebugger('ThrottledTransform'),
            new StreamReader<{chunk: string}[]>((x) => resultText += x.map(_ => _.chunk).join('')),
            new PassThrough({objectMode: true}),
            new StreamDebugger('StreamReader', true),
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
        expect(linesCount).to.equal(linesInFile.length - 3);
        expect(hasErrors).to.be.false;
        expect(resultText).to.equal(`The decoded contents of the base64 string "d2hhdCBkb2VzIHRoZSBwcm9tcHQgc2F5Pwo=" is "what does the prompt say?\\n".`)
    });

});


