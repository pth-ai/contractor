import {CreateChatCompletionRequest} from "openai/api";
import {
    ChatCompletionRequestMessage,
    CreateChatCompletionResponse,
    CreateChatCompletionResponseChoicesInner, CreateEmbeddingRequest,
} from "openai";
import {IncomingMessage} from "http";
import {pipeline} from "stream";
import ReadableStream = NodeJS.ReadableStream;
import {JSONSchemaType} from "ajv";
import {countTokens, getModelForAlias, GPTModelsAlias, largeModel} from "./gptUtils";
import {truthy} from "./utils";
import {IOpenAIClient} from "./OpenAIClient";
import {IAuditor} from "./IAuditor";
import {OpenAIStreamObject, OpenAIStreamTransform} from "./OpenAIStreamTransform";

import {StreamListenerTransform} from "./StreamListenerTransform";
import {Logger} from "./Logger";
import {SchemaValidationCache} from "./SchemaValidationCache";
import {ThrottledTransform} from "./ThrottleTransform";
import {OpenAIStreamToStreamedObjectTransform} from "./OpenAIStreamToStreamedObjectTransform";
import {StreamMITMTransform} from "./StreamMITMTransform";
import * as JSON5 from "./json5";


type MetaDataType = { [k: string]: string };

export type ChatCompletionFunctionsWithTypes<T, N extends string> = {
    readonly name: N;
    readonly description: string;
    readonly parameters: JSONSchemaType<T>;
    readonly partialStreamPath?: string[];
};

export type Result<T, N extends string> = {
    readonly name: N;
    readonly entry: ChatCompletionFunctionsWithTypes<T, N>;
    readonly value: T
}

export const defaultStreamDelimiterSeparator = '|{-*-}|';

export class Contractor<MetaData extends MetaDataType> {
    private readonly openAIApi: IOpenAIClient;
    private readonly auditor?: IAuditor<MetaData>;
    private readonly logger?: Logger;
    private readonly schemaValidationCache: SchemaValidationCache;
    private readonly maxTokensPerRequest: number;
    private readonly streamObjectSeparator: string;


    constructor(openAIApi: IOpenAIClient, auditor?: IAuditor<MetaData>, maxTokensPerRequest: number = 8000, streamObjectSeparator: string = defaultStreamDelimiterSeparator, logger?: Logger) {
        this.openAIApi = openAIApi;
        this.auditor = auditor;
        this.maxTokensPerRequest = maxTokensPerRequest;
        this.streamObjectSeparator = streamObjectSeparator;
        this.logger = logger;
        this.schemaValidationCache = new SchemaValidationCache();
    }

    // Define the function implementation
    streamingFunction<T1, N1 extends string, OUT>(systemMessage: string,
                                                  messages: RequestMessageFormat[],
                                                  model: GPTModelsAlias,
                                                  functions: [ChatCompletionFunctionsWithTypes<T1, N1>],
                                                  transformObjectStream: (streamingObject: Result<T1, N1>) => Promise<OUT>,
                                                  responseSize?: number,
                                                  logMetaData?: MetaData,
                                                  requestOverrides?: Partial<CreateChatCompletionRequest>,
                                                  maxTokens?: number): Promise<NodeJS.ReadableStream | undefined>;

    streamingFunction<T1, T2, N1 extends string, N2 extends string, OUT>(systemMessage: string,
                                                                         messages: RequestMessageFormat[],
                                                                         model: GPTModelsAlias,
                                                                         functions: [ChatCompletionFunctionsWithTypes<T1, N1>, ChatCompletionFunctionsWithTypes<T2, N2>],
                                                                         transformObjectStream: (streamingObject: Result<T1, N1> | Result<T2, N2>) => Promise<OUT>,
                                                                         responseSize?: number,
                                                                         logMetaData?: MetaData,
                                                                         requestOverrides?: Partial<CreateChatCompletionRequest>,
                                                                         maxTokens?: number): Promise<NodeJS.ReadableStream | undefined>;

    streamingFunction<T1, T2, T3, N1 extends string, N2 extends string, N3 extends string, OUT>(systemMessage: string,
                                                                                                messages: RequestMessageFormat[],
                                                                                                model: GPTModelsAlias,
                                                                                                functions: [ChatCompletionFunctionsWithTypes<T1, N1>, ChatCompletionFunctionsWithTypes<T2, N2>, ChatCompletionFunctionsWithTypes<T3, N3>],
                                                                                                transformObjectStream: (streamingObject: Result<T1, N1> | Result<T2, N2> | Result<T3, N3>) => Promise<OUT>,
                                                                                                responseSize?: number,
                                                                                                logMetaData?: MetaData,
                                                                                                requestOverrides?: Partial<CreateChatCompletionRequest>,
                                                                                                maxTokens?: number): Promise<NodeJS.ReadableStream | undefined>;

    streamingFunction<T1, T2, T3, T4, N1 extends string, N2 extends string, N3 extends string, N4 extends string, OUT>(systemMessage: string,
                                                                                                                       messages: RequestMessageFormat[],
                                                                                                                       model: GPTModelsAlias,
                                                                                                                       functions: [ChatCompletionFunctionsWithTypes<T1, N1>, ChatCompletionFunctionsWithTypes<T2, N2>, ChatCompletionFunctionsWithTypes<T3, N3>, ChatCompletionFunctionsWithTypes<T4, N4>],
                                                                                                                       transformObjectStream: (streamingObject: Result<T1, N1> | Result<T2, N2> | Result<T3, N3> | Result<T4, N4>) => Promise<OUT>,
                                                                                                                       responseSize?: number,
                                                                                                                       logMetaData?: MetaData,
                                                                                                                       requestOverrides?: Partial<CreateChatCompletionRequest>,
                                                                                                                       maxTokens?: number): Promise<NodeJS.ReadableStream | undefined>;

    streamingFunction<T1, T2, T3, T4, T5, N1 extends string, N2 extends string, N3 extends string, N4 extends string, N5 extends string, OUT>(systemMessage: string,
                                                                                                                                              messages: RequestMessageFormat[],
                                                                                                                                              model: GPTModelsAlias,
                                                                                                                                              functions: [ChatCompletionFunctionsWithTypes<T1, N1>, ChatCompletionFunctionsWithTypes<T2, N2>, ChatCompletionFunctionsWithTypes<T3, N3>, ChatCompletionFunctionsWithTypes<T4, N4>, ChatCompletionFunctionsWithTypes<T5, N5>],
                                                                                                                                              transformObjectStream: (streamingObject: Result<T1, N1> | Result<T2, N2> | Result<T3, N3> | Result<T4, N4> | Result<T5, N5>) => Promise<OUT>,
                                                                                                                                              responseSize?: number,
                                                                                                                                              logMetaData?: MetaData,
                                                                                                                                              requestOverrides?: Partial<CreateChatCompletionRequest>,
                                                                                                                                              maxTokens?: number): Promise<NodeJS.ReadableStream | undefined>;

    streamingFunction<T1, T2, T3, T4, T5, T6, N1 extends string, N2 extends string, N3 extends string, N4 extends string, N5 extends string, N6 extends string, OUT>(systemMessage: string,
                                                                                                                                                                     messages: RequestMessageFormat[],
                                                                                                                                                                     model: GPTModelsAlias,
                                                                                                                                                                     functions: [ChatCompletionFunctionsWithTypes<T1, N1>, ChatCompletionFunctionsWithTypes<T2, N2>, ChatCompletionFunctionsWithTypes<T3, N3>, ChatCompletionFunctionsWithTypes<T4, N4>, ChatCompletionFunctionsWithTypes<T5, N5>, ChatCompletionFunctionsWithTypes<T6, N6>],
                                                                                                                                                                     transformObjectStream: (streamingObject: Result<T1, N1> | Result<T2, N2> | Result<T3, N3> | Result<T4, N4> | Result<T5, N5> | Result<T6, N6>) => Promise<OUT>,
                                                                                                                                                                     responseSize?: number,
                                                                                                                                                                     logMetaData?: MetaData,
                                                                                                                                                                     requestOverrides?: Partial<CreateChatCompletionRequest>,
                                                                                                                                                                     maxTokens?: number): Promise<NodeJS.ReadableStream | undefined>;

    streamingFunction<T1, T2, T3, T4, T5, T6, T7, N1 extends string, N2 extends string, N3 extends string, N4 extends string, N5 extends string, N6 extends string, N7 extends string, OUT>(systemMessage: string,
                                                                                                                                                                                            messages: RequestMessageFormat[],
                                                                                                                                                                                            model: GPTModelsAlias,
                                                                                                                                                                                            functions: [ChatCompletionFunctionsWithTypes<T1, N1>, ChatCompletionFunctionsWithTypes<T2, N2>, ChatCompletionFunctionsWithTypes<T3, N3>, ChatCompletionFunctionsWithTypes<T4, N4>, ChatCompletionFunctionsWithTypes<T5, N5>, ChatCompletionFunctionsWithTypes<T6, N6>, ChatCompletionFunctionsWithTypes<T7, N7>],
                                                                                                                                                                                            transformObjectStream: (streamingObject: Result<T1, N1> | Result<T2, N2> | Result<T3, N3> | Result<T4, N4> | Result<T5, N5> | Result<T6, N6> | Result<T7, N7>) => Promise<OUT>,
                                                                                                                                                                                            responseSize?: number,
                                                                                                                                                                                            logMetaData?: MetaData,
                                                                                                                                                                                            requestOverrides?: Partial<CreateChatCompletionRequest>,
                                                                                                                                                                                            maxTokens?: number): Promise<NodeJS.ReadableStream | undefined>;

    streamingFunction<T1, T2, T3, T4, T5, T6, T7, T8, N1 extends string, N2 extends string, N3 extends string, N4 extends string, N5 extends string, N6 extends string, N7 extends string, N8 extends string, OUT>(systemMessage: string,
                                                                                                                                                                                                                   messages: RequestMessageFormat[],
                                                                                                                                                                                                                   model: GPTModelsAlias,
                                                                                                                                                                                                                   functions: [ChatCompletionFunctionsWithTypes<T1, N1>, ChatCompletionFunctionsWithTypes<T2, N2>, ChatCompletionFunctionsWithTypes<T3, N3>, ChatCompletionFunctionsWithTypes<T4, N4>, ChatCompletionFunctionsWithTypes<T5, N5>, ChatCompletionFunctionsWithTypes<T6, N6>, ChatCompletionFunctionsWithTypes<T7, N7>, ChatCompletionFunctionsWithTypes<T8, N8>],
                                                                                                                                                                                                                   transformObjectStream: (streamingObject: Result<T1, N1> | Result<T2, N2> | Result<T3, N3> | Result<T4, N4> | Result<T5, N5> | Result<T6, N6> | Result<T7, N7> | Result<T8, N8>) => Promise<OUT>,
                                                                                                                                                                                                                   responseSize?: number,
                                                                                                                                                                                                                   logMetaData?: MetaData,
                                                                                                                                                                                                                   requestOverrides?: Partial<CreateChatCompletionRequest>,
                                                                                                                                                                                                                   maxTokens?: number): Promise<NodeJS.ReadableStream | undefined>;

    streamingFunction<T1, T2, T3, T4, T5, T6, T7, T8, T9, N1 extends string, N2 extends string, N3 extends string, N4 extends string, N5 extends string, N6 extends string, N7 extends string, N8 extends string, N9 extends string, OUT>(systemMessage: string,
                                                                                                                                                                                                                                          messages: RequestMessageFormat[],
                                                                                                                                                                                                                                          model: GPTModelsAlias,
                                                                                                                                                                                                                                          functions: [ChatCompletionFunctionsWithTypes<T1, N1>, ChatCompletionFunctionsWithTypes<T2, N2>, ChatCompletionFunctionsWithTypes<T3, N3>, ChatCompletionFunctionsWithTypes<T4, N4>, ChatCompletionFunctionsWithTypes<T5, N5>, ChatCompletionFunctionsWithTypes<T6, N6>, ChatCompletionFunctionsWithTypes<T7, N7>, ChatCompletionFunctionsWithTypes<T8, N8>, ChatCompletionFunctionsWithTypes<T9, N9>],
                                                                                                                                                                                                                                          transformObjectStream: (streamingObject: Result<T1, N1> | Result<T2, N2> | Result<T3, N3> | Result<T4, N4> | Result<T5, N5> | Result<T6, N6> | Result<T7, N7> | Result<T8, N8> | Result<T9, N9>) => Promise<OUT>,
                                                                                                                                                                                                                                          responseSize?: number,
                                                                                                                                                                                                                                          logMetaData?: MetaData,
                                                                                                                                                                                                                                          requestOverrides?: Partial<CreateChatCompletionRequest>,
                                                                                                                                                                                                                                          maxTokens?: number): Promise<NodeJS.ReadableStream | undefined>;

    streamingFunction<T1, T2, T3, T4, T5, T6, T7, T8, T9, T10, N1 extends string, N2 extends string, N3 extends string, N4 extends string, N5 extends string, N6 extends string, N7 extends string, N8 extends string, N9 extends string, N10 extends string, OUT>(systemMessage: string,
                                                                                                                                                                                                                                                                   messages: RequestMessageFormat[],
                                                                                                                                                                                                                                                                   model: GPTModelsAlias,
                                                                                                                                                                                                                                                                   functions: [ChatCompletionFunctionsWithTypes<T1, N1>, ChatCompletionFunctionsWithTypes<T2, N2>, ChatCompletionFunctionsWithTypes<T3, N3>, ChatCompletionFunctionsWithTypes<T4, N4>, ChatCompletionFunctionsWithTypes<T5, N5>, ChatCompletionFunctionsWithTypes<T6, N6>, ChatCompletionFunctionsWithTypes<T7, N7>, ChatCompletionFunctionsWithTypes<T8, N8>, ChatCompletionFunctionsWithTypes<T9, N9>, ChatCompletionFunctionsWithTypes<T10, N10>],
                                                                                                                                                                                                                                                                   transformObjectStream: (streamingObject: Result<T1, N1> | Result<T2, N2> | Result<T3, N3> | Result<T4, N4> | Result<T5, N5> | Result<T6, N6> | Result<T7, N7> | Result<T8, N8> | Result<T9, N9> | Result<T10, N10>) => Promise<OUT>,
                                                                                                                                                                                                                                                                   responseSize?: number,
                                                                                                                                                                                                                                                                   logMetaData?: MetaData,
                                                                                                                                                                                                                                                                   requestOverrides?: Partial<CreateChatCompletionRequest>,
                                                                                                                                                                                                                                                                   maxTokens?: number): Promise<NodeJS.ReadableStream | undefined>;

    public async streamingFunction(systemMessage: string,
                                   messages: RequestMessageFormat[],
                                   model: GPTModelsAlias,
                                   functions: Array<ChatCompletionFunctionsWithTypes<any, any>>,
                                   transformObjectStream: (streamingObject: Result<any, any>) => Promise<any>,
                                   responseSize: number = 800,
                                   logMetaData?: MetaData,
                                   requestOverrides?: Partial<CreateChatCompletionRequest>,
                                   maxTokens: number = this.maxTokensPerRequest): Promise<NodeJS.ReadableStream | undefined> {

        const stream = await this.makeStreamingRequest(systemMessage, messages, model, responseSize, functions, logMetaData, requestOverrides, maxTokens);

        if (!stream) {
            return undefined;
        }

        const throttler = new ThrottledTransform(
            {
                name: 'task creation thr',
                flushDebounceTimeMs: 1000,
                maxIdleTimeoutMs: 10000,
                windowSize: 10,
            },
        );

        const validators = new Map(functions.map(({
                                                      name,
                                                      parameters,
                                                      description
                                                  }) => ([name, this.schemaValidationCache.getValidator(parameters)])));
        const objectTransform = new OpenAIStreamToStreamedObjectTransform(
            validators,
            new Map(functions.filter(_ => !!_.partialStreamPath)
                .map(_ => [_.name as string, _.partialStreamPath!])), this.logger)
        const objectStreamTransformer = new StreamMITMTransform<any, any>(async (input, functionName) => {
            if (!functionName) {
                throw new Error('action did not result in a function, try to ask for specific function or direct AI to answer by using any of the available functions');
            }

            return await transformObjectStream({
                name: functionName,
                entry: functions.find(_ => _.name === functionName)!,
                value: input,
            })
        }, this.streamObjectSeparator)

        return pipeline(stream,
            throttler,
            objectTransform,
            objectStreamTransformer,
            err => {
                if (err) {
                    this.logger?.error('error while processing stream interim results', err, logMetaData);
                }
            })
    }

    async makeBlockingRequest(systemMessage: string,
                              messages: RequestMessageFormat[],
                              model: GPTModelsAlias,
                              actionName: string,
                              responseSize: number = 800,
                              logMetaData?: MetaData,
                              requestOverrides?: Partial<CreateChatCompletionRequest>,
                              maxTokens: number = this.maxTokensPerRequest): Promise<CreateChatCompletionResponseChoicesInner | undefined> {
        const {
            openAIModel,
            promptSize
        } = this.measureRequest(model, systemMessage, messages, responseSize, maxTokens);

        await this.moderateLastMessage(messages);

        this.logger?.info(`performing blocking request [${actionName}]`, logMetaData);

        const request: CreateChatCompletionRequest = {
            model: promptSize + responseSize > 4000 ? largeModel(openAIModel) : openAIModel,
            messages: [
                {role: 'system', content: systemMessage},
                ...messages,
            ],
            temperature: 0,
            top_p: 1,
            max_tokens: responseSize,
            ...requestOverrides,
        };

        let result: CreateChatCompletionResponse | undefined = undefined;

        try {

            result = (await this.openAIApi.createChatCompletion(request)).data;

            const resultChoice = result.choices[0];

            await this.auditor?.auditRequest({
                request,
                resultRaw: result,
                result: {data: {content: resultChoice}},
                requestType: actionName,
                requestSig: '',
                metaData: logMetaData,
            });

            return resultChoice;

        } catch (err: any) {
            this.logger?.error(`error performing [${actionName}]`, err);

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
                requestType: actionName,
                requestSig: "",
                metaData: logMetaData,
            });

            throw new Error("error generating search input for research task");
        }

    }

    // TODO: create tests for functions and wihtout functions
    async makeStreamingRequest(systemMessage: string,
                               messages: RequestMessageFormat[],
                               model: GPTModelsAlias,
                               responseSize: number = 800,
                               functions?: Array<ChatCompletionFunctionsWithTypes<any, any>>,
                               logMetaData?: MetaData,
                               requestOverrides?: Partial<CreateChatCompletionRequest>,
                               maxTokens: number = this.maxTokensPerRequest): Promise<ReadableStream | undefined> {

        const {
            openAIModel,
            promptSize
        } = this.measureRequest(model, systemMessage, messages, responseSize, maxTokens);

        await this.moderateLastMessage(messages);

        this.logger?.info(`making streaming request`, logMetaData);

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
            ...requestOverrides,
            functions: (functions?.length ?? 0) > 0 ? functions : undefined,
            function_call: (functions?.length ?? 0) > 1 ? 'auto' : undefined,
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
                new StreamListenerTransform<OpenAIStreamObject>((x) => {
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
                        metaData: logMetaData,
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
                metaData: logMetaData,
            });

            return undefined;
        }
    }

    public async performModeration(input: string): Promise<void> {
        const isFlagged = await this.openAIApi.performModeration(input);
        if (isFlagged) {
            throw new Error('request flagged due to moderation');
        }
    }

    public getStreamSeparator = () => this.streamObjectSeparator;

    private async moderateLastMessage(messages: RequestMessageFormat[]) {
        await this.performModeration(messages.slice(-1).map(_ => _.content).join('\n'))
    }

    public singleFunction = async <T>(systemMessage: string,
                                      messages: RequestMessageFormat[],
                                      model: GPTModelsAlias = 'gpt3',
                                      gptFunction: {
                                          name: string,
                                          description: string;
                                          parameters: JSONSchemaType<T>
                                      },
                                      logMetaData?: MetaData,
                                      requestOverrides?: Partial<CreateChatCompletionRequest>,
                                      responseSize: number = 2000,
                                      maxTokens: number = this.maxTokensPerRequest,): Promise<T | undefined> => {

        const {
            openAIModel,
            promptSize
        } = this.measureRequest(model, systemMessage, messages, responseSize, maxTokens);

        await this.moderateLastMessage(messages);

        this.logger?.info(`using gpt function [${gptFunction.name}]`, logMetaData);

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
            ...requestOverrides,
            function_call: {name: gptFunction.name}
        };

        let result: CreateChatCompletionResponse | undefined = undefined;

        try {

            result = (await this.openAIApi.createChatCompletion(request)).data;

            const validatedResult = truthy(result.choices[0]?.message?.function_call?.arguments, funcArgs => {
                const json = JSON5.parse(funcArgs, undefined, (error, stack, root) => {
                    if (error.message.includes('invalid end of input')) {
                        const validator = this.schemaValidationCache.getValidator(gptFunction.parameters);
                        if (validator(root)) {
                            // we did what we could.. object looks good enough..
                            return root;
                        } else {
                            console.log(root, validator.errors);
                            throw new Error(`function arguments did not pass validation [${JSON.stringify(validator.errors)}]`);
                        }
                    }

                });
                const validator = this.schemaValidationCache.getValidator(gptFunction.parameters);
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
                metaData: logMetaData,
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
                metaData: logMetaData,
            });

            throw new Error("error generating search input for research task");
        }

    }

    public performEmbedding = async (inputContent: string, userId: string, model: 'text-embedding-ada-002', logMetaData?: MetaData,): Promise<number[] | undefined> => {
        const createEmbeddingRequest: CreateEmbeddingRequest = {
            input: inputContent,
            model,
            user: userId
        };
        const result = await this.openAIApi.performEmbedding(createEmbeddingRequest);
        await this.auditor?.auditRequest({
            request: createEmbeddingRequest,
            resultRaw: result.data,
            result: {data: {content: result.data.data[0]}},
            requestType: 'embedding',
            requestSig: logMetaData?.['requestSig'] as string,
            metaData: logMetaData,
        });

        return result.data.data[0]?.embedding;
    }


    private measureRequest(model: "gpt3" | "gpt4", systemMessage: string, messages: RequestMessageFormat[], responseSize: number, maxTokens: number) {
        const openAIModel = getModelForAlias(model);
        const promptSize = countTokens(systemMessage + messages.map(_ => _.content).join('\n'), openAIModel);
        if (promptSize + responseSize > maxTokens) {
            throw new Error("input too large")
        }
        return {openAIModel, promptSize};
    }

}

export type RequestMessageFormat = { role: 'user' | 'assistant', content: string };
