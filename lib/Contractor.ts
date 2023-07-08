import {ChatCompletionFunctions, CreateChatCompletionRequest} from "openai/api";
import {ChatCompletionRequestMessage, CreateChatCompletionResponse} from "openai";
import {IncomingMessage} from "http";
import {pipeline} from "stream";
import ReadableStream = NodeJS.ReadableStream;
import {JSONSchemaType} from "ajv";
import {countTokens, getModelForAlias, GPTModelsAlias, largeModel} from "./gptUtils";
import {Logger, SchemaValidator, truthy} from "./utils";
import {IOpenAIClient} from "./OpenAIClient";
import {IAuditor} from "./IAuditor";
import {OpenAIStreamObject, OpenAIStreamTransform} from "./OpenAIStreamTransform";
import {StreamListener} from "./streamingUtils";


export class Contractor {
    private readonly openAIApi: IOpenAIClient;
    private readonly auditor?: IAuditor;
    private readonly logger?: Logger;
    private readonly schemaValidator: SchemaValidator;
    private readonly maxTokensPerRequest: number;

    constructor(openAIApi: IOpenAIClient, auditor?: IAuditor, maxTokensPerRequest: number = 8000, logger?: Logger) {
        this.openAIApi = openAIApi;
        this.auditor = auditor;
        this.maxTokensPerRequest = maxTokensPerRequest;
        this.logger = logger;
        this.schemaValidator = new SchemaValidator();
    }

    async makeStreamingRequest(systemMessage: string,
                               messages: RequestMessageFormat[],
                               model: GPTModelsAlias,
                               responseSize: number = 800,
                               functions?: Array<ChatCompletionFunctions>,
                               requestOverrides?: Partial<CreateChatCompletionRequest>,
                               maxTokens: number = this.maxTokensPerRequest,
                               logMetaData: object = {}): Promise<ReadableStream | undefined> {

        const {openAIModel, promptSize} = this.measureRequest(model, systemMessage, messages, responseSize);

        await this.moderateLastMessage(messages);

        this.logger?.info(`executing streaming gpt action`, logMetaData);

        const requestMessages: ChatCompletionRequestMessage[] = [
            {role: 'system', content: systemMessage},
            ...messages,
        ]

        const request: CreateChatCompletionRequest = {
            model: promptSize + responseSize > 4000 ? largeModel(openAIModel) : openAIModel,
            messages: [
                {role: 'system', content: systemMessage},
                ...messages,
            ],
            temperature: 0,
            top_p: 1,
            max_tokens: responseSize,
            functions,
            ...requestOverrides
        };

        let readContent = ""
        let streamingFunctionName: string | undefined = undefined;
        let createResponse: CreateChatCompletionResponse | undefined = undefined;
        try {
            const response = await this.openAIApi.createStreamingChatCompletion(request);
            createResponse = response.data;
            const chatStream = response.data as unknown as IncomingMessage
            const openAITransformer = new OpenAIStreamTransform(this.logger, logMetaData);

            return pipeline(
                chatStream,
                openAITransformer,
                new StreamListener<OpenAIStreamObject>((x) => {
                    streamingFunctionName = x.functionName;
                    return readContent += x.chunk;
                }),
                err => {
                    if (err) {
                        this.logger?.error('error during stream', err ?? {}, logMetaData);
                    }

                    const prompt_tokens = countTokens(systemMessage + requestMessages.map(_ => _.content).join('\n'), openAIModel);
                    const completion_tokens = countTokens(readContent, openAIModel);

                    this.auditor?.auditRequest({
                        request,
                        resultRaw: {
                            id: response.data.id,
                            model: response.data.model,
                            choices: [{
                                message: streamingFunctionName
                                    ? {
                                        function_call: {
                                            name: streamingFunctionName,
                                            arguments: readContent
                                        }

                                    }
                                    : {
                                        content: readContent,
                                        role: 'assistant'
                                    },
                                index: 0,
                                finish_reason: err?.message
                            }],
                            object: response.data.object,
                            created: response.data.created,
                            usage: {
                                prompt_tokens,
                                completion_tokens,
                                total_tokens: prompt_tokens + completion_tokens,
                            }
                        } as CreateChatCompletionResponse,
                        result: err
                            ? {error: {message: err.message, details: err.toString()}}
                            : {data: {content: readContent}},
                        requestType: 'streaming-request',
                        requestSig: streamingFunctionName ?? '',
                    });


                }
            );


        } catch (err: any) {
            this.logger?.error(`error performing streaming request`, err, logMetaData)

            const prompt_tokens = countTokens(systemMessage + requestMessages.map(_ => _.content).join('\n'), openAIModel);
            const completion_tokens = countTokens(readContent, openAIModel);

            await this.auditor?.auditRequest({
                request,
                resultRaw: {
                    id: createResponse?.id ?? '',
                    model: createResponse?.model ?? '',
                    choices: [{
                        message: streamingFunctionName
                            ? {
                                function_call: {
                                    name: streamingFunctionName,
                                    arguments: readContent
                                }

                            }
                            : {
                                content: readContent,
                                role: 'assistant'
                            },
                        index: 0,
                        finish_reason: err?.message
                    }],
                    object: createResponse?.object ?? '',
                    created: createResponse?.created ?? '',
                    usage: {
                        prompt_tokens,
                        completion_tokens,
                        total_tokens: prompt_tokens + completion_tokens,
                    }
                } as CreateChatCompletionResponse,
                result: {error: {message: err.message, details: err.toString()}},
                requestType: 'agent',
                requestSig: streamingFunctionName ?? '',
            });

            return undefined;
        }
    }


    private async moderateLastMessage(messages: RequestMessageFormat[]) {
        const isFlagged = await this.openAIApi.performModeration(messages.slice(-1).map(_ => _.content).join('\n'));
        if (isFlagged) {
            throw new Error('request flagged due to moderation');
        }
    }


    private measureRequest(model: "gpt3" | "gpt4", systemMessage: string, messages: RequestMessageFormat[], responseSize: number) {
        const openAIModel = getModelForAlias(model);
        const promptSize = countTokens(systemMessage + messages.map(_ => _.content).join('\n'), openAIModel);
        if (promptSize + responseSize > 6000) {
            throw new Error("input too large")
        }
        return {openAIModel, promptSize};
    }

    public executeSingleGPTFunction = async <T>(systemMessage: string,
                                                messages: RequestMessageFormat[],
                                                model: GPTModelsAlias = 'gpt3',
                                                gptFunction: {
                                                    name: string,
                                                    description: string;
                                                    parameters: JSONSchemaType<T>
                                                },
                                                requestOverrides?: Partial<CreateChatCompletionRequest>,
                                                responseSize: number = 2000,
                                                maxTokens: number = this.maxTokensPerRequest,
                                                logMetaData: object = {}): Promise<T | undefined> => {

        const {openAIModel, promptSize} = this.measureRequest(model, systemMessage, messages, responseSize);

        await this.moderateLastMessage(messages);

        this.logger?.info(`executing gpt action [${gptFunction.name}]]`, logMetaData);

        const request: CreateChatCompletionRequest = {
            model: promptSize + responseSize > 4000 ? largeModel(openAIModel) : openAIModel,
            messages: [
                {role: 'system', content: systemMessage},
                ...messages,
            ],
            temperature: 0,
            top_p: 1,
            max_tokens: responseSize,
            functions: [gptFunction],
            ...requestOverrides
        };

        let result: CreateChatCompletionResponse | undefined = undefined;

        try {

            result = (await this.openAIApi.createChatCompletion(request)).data;

            const validatedResult = truthy(result.choices[0]?.message?.function_call?.arguments, funcArgs => {
                const json = JSON.parse(funcArgs);
                const validator = this.schemaValidator.getValidator(gptFunction.parameters);
                if (validator(json)) {
                    return json
                } else {
                    throw new Error(`function arguments did not pass validation [${JSON.stringify(validator.errors)}]`);
                }
            });

            await this.auditor?.auditRequest({
                request,
                resultRaw: result,
                result: {data: {content: validatedResult}},
                requestType: 'single-gpt',
                requestSig: gptFunction.name,
            });

            return validatedResult;

        } catch (err: any) {
            this.logger?.error(`error performing [${gptFunction.name}]`, err);

            await this.auditor?.auditRequest({
                request,
                resultRaw: result,
                result: {
                    error: {
                        message: err.message,
                        details: err.toString(),
                        receivedMessage: JSON.stringify(result?.choices[0]?.message)
                    }
                },
                requestType: 'single-gpt',
                requestSig: gptFunction.name,
            });

            throw new Error("error generating search input for research task");
        }

    }
}

export type RequestMessageFormat = { role: 'user' | 'assistant', content: string };
