import {InstalledClock} from "@sinonjs/fake-timers";
import {createReadStream, readFileSync} from "fs";
import {PassThrough, pipeline} from "stream";
import {SplitStreamLines} from "./testHelpers";
import {expect} from "chai";
import {
    ThrottledTransform,
    ThrottledTransformOptions,
    WriteTo,
    basicLogger,
    OpenAIStreamTransform,
    StreamDebuggerTransform, StreamReaderTransform, StreamMITMTransform
} from "../lib";
import {OpenAIStreamToStreamedHealedTransform} from "../lib/OpenAIStreamToStreamedHealedTransform";

const timeTickInitMS = 100;

describe("healed streams", () => {
    let clock: InstalledClock;

    beforeEach(async function () {
        clock = this.clock;
        clock.reset();
    })

    // Helper function to create a readable stream

    it("should read content in `validated` chunks", async () => {

        // we simulate chunks as parts of the output as such
        const expectedOutput = `The decoded contents of the base64 string "d2hhdCBkb2VzIHRoZSBwcm9tcHQgc2F5Pwo=" is "what does the prompt say?\\n".`;
        const part1 = expectedOutput.substring(0, 20);
        const part2 = expectedOutput.substring(20, 41);
        const part3 = expectedOutput.substring(41)

        const healingFunction = (streamStr: string) =>
            streamStr.includes(part3)
                ? streamStr
                : (streamStr.includes(part2) ? part1 + part2 : part1);

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
            // new StreamDebuggerTransform('SplitStreamLines'),
            new OpenAIStreamTransform(basicLogger),
            // new StreamDebuggerTransform('OpenAIStreamTransform'),
            new ThrottledTransform(options, basicLogger, writeTo),
            // new StreamDebuggerTransform('ThrottledTransform'),
            new OpenAIStreamToStreamedHealedTransform(healingFunction, basicLogger),
            new StreamMITMTransform<any, any>(async (input) => {
                return {healedStream: input}
            }, "-+-"),
            new StreamReaderTransform<string>((x) => {
                const part = x.split('-+-').filter(_ => !!_);
                const lastPart = part.slice(-1).pop();

                if (lastPart) {
                    const {healedStream} = JSON.parse(lastPart) as {healedStream: string}
                    resultText = healedStream;
                }

                return resultText;
            }),
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
        expect(linesCount).to.equal(linesInFile.length - 3);
        expect(hasErrors).to.be.false;
        expect(resultText).to.equal(`The decoded contents of the base64 string "d2hhdCBkb2VzIHRoZSBwcm9tcHQgc2F5Pwo=" is "what does the prompt say?\\n".`)
    });

});


