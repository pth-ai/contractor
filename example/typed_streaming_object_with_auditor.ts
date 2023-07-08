import {Configuration, OpenAIApi} from "openai";
import {JSONSchemaType} from "ajv";
import {pipeline} from "stream";
import {Contractor, OpenAIClient, StreamDebuggerTransform} from "contractor";
import {IAuditor, prefixedLogger,} from "../lib";


export const typedStreamingObjectWithAuditor = () => {

    const apiKey = process.env.OPENAI_API_KEY;

    const logger = prefixedLogger('typedStreamingObjectWithAuditor');
    if (!apiKey) {
        throw new Error('OPENAI_API_KEY env var not provided');
    }

    const configuration = new Configuration({
        apiKey: apiKey,
    });
    const openaiClient = new OpenAIApi(configuration);
    const client = new OpenAIClient(openaiClient);

    const auditor = {
        auditRequest: record => {
            logger.info(`auditor record [${JSON.stringify(record)}]`)
        }
    } as IAuditor<{ userId: string }>

    const contractor = new Contractor(client, auditor, undefined, undefined, logger);

    const MathMultiplyOperation: JSONSchemaType<{ firstNumber: number, secondNumber: number }> = {
        type: "object",
        properties: {
            firstNumber: {type: "number", description: "first number"},
            secondNumber: {type: "number", description: "second number"},
        },
        required: ["firstNumber", "secondNumber"],
    };

    const MathAddOperation: JSONSchemaType<{ firstNumber: number, secondNumber: number }> = {
        type: "object",
        properties: {
            firstNumber: {type: "number", description: "first number"},
            secondNumber: {type: "number", description: "second number"},
        },
        required: ["firstNumber", "secondNumber"],
    };


    contractor.streamingFunction('you are a calculator agent',
        [{role: 'user', content: 'what is the sum of 2+2?'}],
        'gpt3',
        [
            {
                name: 'math_add_operation',
                description: 'add two numbers',
                parameters: MathAddOperation
            },
            {
                name: 'math_multiply_operation',
                description: 'multiply two numbers',
                parameters: MathMultiplyOperation
            },
        ],
        async streamingObject => {
            if (streamingObject.name === 'math_add_operation') {
                return {
                    result: streamingObject.value.firstNumber + streamingObject.value.secondNumber
                };
            } else if (streamingObject.name === 'math_multiply_operation') {
                return {
                    result: streamingObject.value.firstNumber * streamingObject.value.secondNumber
                };
            }
            return ""
        },
        undefined,
        {userId: 'user-id-for-auditing'}
    )
        .then(rs => {
            if (rs) {
                pipeline(rs,
                    new StreamDebuggerTransform("FINAL OUTPUT", true, logger), // comment in to see in console,
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
