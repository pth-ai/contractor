import {Configuration, OpenAIApi} from "openai";
import {JSONSchemaType} from "ajv";
import {pipeline} from "stream";
import {Contractor, OpenAIClient, StreamDebuggerTransform} from "contractor";
import {prefixedLogger,} from "../lib";


export const typedStreamingMultipleObjects = () => {

    const apiKey = process.env.OPENAI_API_KEY;
    const logger = prefixedLogger('typedStreamingMultipleObjects');
    if (!apiKey) {
        throw new Error('OPENAI_API_KEY env var not provided');
    }

    const configuration = new Configuration({
        apiKey: apiKey,
    });
    const openaiClient = new OpenAIApi(configuration);
    const client = new OpenAIClient(openaiClient);

    const contractor = new Contractor(client, undefined, undefined, undefined, logger);

    const StoryOutput: JSONSchemaType<{ title: string, lines: string[] }> = {
        type: "object",
        properties: {
            title: {type: "string"},
            lines: {type: "array", description: "story line", items: {"type": 'string'}},
        },
        required: ['title', 'lines'],
    };

    contractor.streamingFunction('you are a story teller',
        [{
            role: 'user',
            content: 'tell me a short story (50 lines) about an AI agent that went rogue, use available functions to answer'
        }],
        'gpt3',
        [
            {
                name: 'print_output',
                description: 'print content to user',
                parameters: StoryOutput,
                partialStreamPath: ['lines'],
            },
        ],
        async streamingObject => {
            return `story so far: ${streamingObject.value.title}\n${streamingObject.value.lines.join('\n')}`
        })
        .then(rs => {
            if (rs) {
                pipeline(rs,
                    new StreamDebuggerTransform("STREAMING OUTPUT", true, logger), // comment in to see in console,
                    (err) => {
                        if (err) {
                            logger.error('Stream failed.', err);
                        } else {
                            logger.info('Stream is done reading.');
                        }
                    }
                )
            }
        });
}
