import {Configuration, OpenAIApi} from "openai";
import {JSONSchemaType} from "ajv";
import {pipeline} from "stream";
import {Contractor, OpenAIClient, StreamDebuggerTransform} from "contractor";
import {prefixedLogger,} from "../lib";


export const basicAgent = () => {

    const apiKey = process.env.OPENAI_API_KEY;

    const logger = prefixedLogger('basicAgent');
    if (!apiKey) {
        throw new Error('OPENAI_API_KEY env var not provided');
    }

    const configuration = new Configuration({
        apiKey: apiKey,
    });
    const openaiClient = new OpenAIApi(configuration);
    const client = new OpenAIClient(openaiClient);

    const contractor = new Contractor(client, undefined, undefined, undefined, logger);

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

    const FinalResultOperation: JSONSchemaType<{ finalResult: number }> = {
        type: "object",
        properties: {
            finalResult: {type: "number", description: "first number"},
        },
        required: ["finalResult"],
    };

    const performSingleOperation = (currentGoal: string, operationsPerformed: object[] = []): Promise<any> => {


        return new Promise((resolve, reject) => {
            contractor.streamingFunction('you are a calculator agent',
                [{
                    role: 'user', content: `your goal is: ${JSON.stringify(currentGoal)}
operations performed so far: ${operationsPerformed.map(_ => JSON.stringify(_)).join('\n')}`
                }],
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
                    {
                        name: 'final_result_operation',
                        description: 'return final math result',
                        parameters: FinalResultOperation
                    },
                ],
                async streamingObject => {
                    if (streamingObject.name === 'math_add_operation') {
                        const opStack = [...operationsPerformed,
                            {calculated: `${streamingObject.value.firstNumber}+${streamingObject.value.secondNumber}=${streamingObject.value.firstNumber + streamingObject.value.secondNumber}`}];
                        performSingleOperation(currentGoal, opStack)
                            .then(resolve, reject);
                        return {
                            "performed": streamingObject.value,
                            "stack": opStack
                        }
                    } else if (streamingObject.name === 'math_multiply_operation') {
                        const opStack = [...operationsPerformed,
                            {calculated: `${streamingObject.value.firstNumber}*${streamingObject.value.secondNumber}=${streamingObject.value.firstNumber * streamingObject.value.secondNumber}`}];
                        performSingleOperation(currentGoal, opStack)
                            .then(resolve, reject);
                        return {
                            "performed": streamingObject.value,
                            "stack": opStack
                        }
                    } else if (streamingObject.name === 'final_result_operation')
                        resolve(`final result: ${JSON.stringify(streamingObject.value.finalResult)}`)
                    return {
                        "performed": streamingObject.value,
                        "stack": operationsPerformed,
                        "finalResult": streamingObject.value.finalResult
                    }
                })
                .then(rs => {
                    if (rs) {
                        pipeline(rs,
                            new StreamDebuggerTransform("OUTPUT", true, logger), // comment in to see in console,
                            err => {
                                if (err) {
                                    reject(err);
                                    logger.error('Stream failed.', err);
                                } else {

                                    logger.info('Stream is done reading.');
                                }
                            }
                        )
                    }
                })

        });
    }

    const agentGoal = "calculate 10!";
    performSingleOperation(agentGoal)
        .then(res => logger.info(`final result: [${JSON.stringify(res)}]`))


}
