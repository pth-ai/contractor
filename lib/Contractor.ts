import {CreateChatCompletionRequest} from "openai/api";
import {ChatCompletionRequestMessage, CreateChatCompletionResponse, CreateEmbeddingRequest,} from "openai";
import {IncomingMessage} from "http";
import {pipeline} from "stream";
import {JSONSchemaType} from "ajv";
import {countTokens, getModelForAlias, GPTModelsAlias, largeModel} from "./gptUtils";
import {assertIsDefined, truthy} from "./utils";
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
import ReadableStream = NodeJS.ReadableStream;


type MetaDataType = { [k: string]: string };

export type ChatCompletionFunctionsWithTypes2<T, N extends string> = {
    readonly name: N;
    readonly description: string;
    readonly parameters: JSONSchemaType<Wrapper<N, T>>;
    readonly partialStreamPath?: string[];
};

export type Result2<T, N extends string> = {
    readonly name: N;
    readonly entry: ChatCompletionFunctionsWithTypes2<T, N>;
    readonly value: T
}

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

    makeBlockingRequestWithFunctions<T1, N1 extends string>(systemMessage: string,
                                                            messages: RequestMessageFormat[],
                                                            model: GPTModelsAlias,
                                                            actionName: string,
                                                            functions: [ChatCompletionFunctionsWithTypes<T1, N1>],
                                                            responseSize?: number,
                                                            logMetaData?: MetaData,
                                                            requestOverrides?: Partial<CreateChatCompletionRequest>,
                                                            maxTokens?: number): Promise<Result<T1, N1> | undefined>;

    makeBlockingRequestWithFunctions<T1, T2, N1 extends string, N2 extends string>(systemMessage: string,
                                                                                   messages: RequestMessageFormat[],
                                                                                   model: GPTModelsAlias,
                                                                                   actionName: string,
                                                                                   functions: [ChatCompletionFunctionsWithTypes<T1, N1>, ChatCompletionFunctionsWithTypes<T2, N2>],
                                                                                   responseSize?: number,
                                                                                   logMetaData?: MetaData,
                                                                                   requestOverrides?: Partial<CreateChatCompletionRequest>,
                                                                                   maxTokens?: number): Promise<Result<T1, N1> | Result<T2, N2> | undefined>;

    makeBlockingRequestWithFunctions<T1, T2, T3, N1 extends string, N2 extends string, N3 extends string>(systemMessage: string,
                                                                                                          messages: RequestMessageFormat[],
                                                                                                          model: GPTModelsAlias,
                                                                                                          actionName: string,
                                                                                                          functions: [ChatCompletionFunctionsWithTypes<T1, N1>, ChatCompletionFunctionsWithTypes<T2, N2>, ChatCompletionFunctionsWithTypes<T3, N3>],
                                                                                                          responseSize?: number,
                                                                                                          logMetaData?: MetaData,
                                                                                                          requestOverrides?: Partial<CreateChatCompletionRequest>,
                                                                                                          maxTokens?: number): Promise<Result<T1, N1> | Result<T2, N2> | Result<T3, N3> | undefined>;

    makeBlockingRequestWithFunctions<T1, T2, T3, T4, N1 extends string, N2 extends string, N3 extends string, N4 extends string>(systemMessage: string,
                                                                                                                                 messages: RequestMessageFormat[],
                                                                                                                                 model: GPTModelsAlias,
                                                                                                                                 actionName: string,
                                                                                                                                 functions: [ChatCompletionFunctionsWithTypes<T1, N1>, ChatCompletionFunctionsWithTypes<T2, N2>, ChatCompletionFunctionsWithTypes<T3, N3>, ChatCompletionFunctionsWithTypes<T4, N4>],
                                                                                                                                 responseSize?: number,
                                                                                                                                 logMetaData?: MetaData,
                                                                                                                                 requestOverrides?: Partial<CreateChatCompletionRequest>,
                                                                                                                                 maxTokens?: number): Promise<Result<T1, N1> | Result<T2, N2> | Result<T3, N3> | Result<T4, N4> | undefined>;

    makeBlockingRequestWithFunctions<T1, T2, T3, T4, T5, N1 extends string, N2 extends string, N3 extends string, N4 extends string, N5 extends string>(systemMessage: string,
                                                                                                                                                        messages: RequestMessageFormat[],
                                                                                                                                                        model: GPTModelsAlias,
                                                                                                                                                        actionName: string,
                                                                                                                                                        functions: [ChatCompletionFunctionsWithTypes<T1, N1>, ChatCompletionFunctionsWithTypes<T2, N2>, ChatCompletionFunctionsWithTypes<T3, N3>, ChatCompletionFunctionsWithTypes<T4, N4>, ChatCompletionFunctionsWithTypes<T5, N5>],
                                                                                                                                                        responseSize?: number,
                                                                                                                                                        logMetaData?: MetaData,
                                                                                                                                                        requestOverrides?: Partial<CreateChatCompletionRequest>,
                                                                                                                                                        maxTokens?: number): Promise<Result<T1, N1> | Result<T2, N2> | Result<T3, N3> | Result<T4, N4> | Result<T5, N5> | undefined>;

    makeBlockingRequestWithFunctions<T1, T2, T3, T4, T5, T6, N1 extends string, N2 extends string, N3 extends string, N4 extends string, N5 extends string, N6 extends string>(systemMessage: string,
                                                                                                                                                                               messages: RequestMessageFormat[],
                                                                                                                                                                               model: GPTModelsAlias,
                                                                                                                                                                               actionName: string,
                                                                                                                                                                               functions: [ChatCompletionFunctionsWithTypes<T1, N1>, ChatCompletionFunctionsWithTypes<T2, N2>, ChatCompletionFunctionsWithTypes<T3, N3>, ChatCompletionFunctionsWithTypes<T4, N4>, ChatCompletionFunctionsWithTypes<T5, N5>, ChatCompletionFunctionsWithTypes<T6, N6>],
                                                                                                                                                                               responseSize?: number,
                                                                                                                                                                               logMetaData?: MetaData,
                                                                                                                                                                               requestOverrides?: Partial<CreateChatCompletionRequest>,
                                                                                                                                                                               maxTokens?: number): Promise<Result<T1, N1> | Result<T2, N2> | Result<T3, N3> | Result<T4, N4> | Result<T5, N5> | Result<T6, N6> | undefined>;

    makeBlockingRequestWithFunctions<T1, T2, T3, T4, T5, T6, T7, N1 extends string, N2 extends string, N3 extends string, N4 extends string, N5 extends string, N6 extends string, N7 extends string>(systemMessage: string,
                                                                                                                                                                                                      messages: RequestMessageFormat[],
                                                                                                                                                                                                      model: GPTModelsAlias,
                                                                                                                                                                                                      actionName: string,
                                                                                                                                                                                                      functions: [ChatCompletionFunctionsWithTypes<T1, N1>, ChatCompletionFunctionsWithTypes<T2, N2>, ChatCompletionFunctionsWithTypes<T3, N3>, ChatCompletionFunctionsWithTypes<T4, N4>, ChatCompletionFunctionsWithTypes<T5, N5>, ChatCompletionFunctionsWithTypes<T6, N6>, ChatCompletionFunctionsWithTypes<T7, N7>],
                                                                                                                                                                                                      responseSize?: number,
                                                                                                                                                                                                      logMetaData?: MetaData,
                                                                                                                                                                                                      requestOverrides?: Partial<CreateChatCompletionRequest>,
                                                                                                                                                                                                      maxTokens?: number): Promise<Result<T1, N1> | Result<T2, N2> | Result<T3, N3> | Result<T4, N4> | Result<T5, N5> | Result<T6, N6> | Result<T7, N7> | undefined>;

    makeBlockingRequestWithFunctions<T1, T2, T3, T4, T5, T6, T7, T8, N1 extends string, N2 extends string, N3 extends string, N4 extends string, N5 extends string, N6 extends string, N7 extends string, N8 extends string>(systemMessage: string,
                                                                                                                                                                                                                             messages: RequestMessageFormat[],
                                                                                                                                                                                                                             model: GPTModelsAlias,
                                                                                                                                                                                                                             actionName: string,
                                                                                                                                                                                                                             functions: [ChatCompletionFunctionsWithTypes<T1, N1>, ChatCompletionFunctionsWithTypes<T2, N2>, ChatCompletionFunctionsWithTypes<T3, N3>, ChatCompletionFunctionsWithTypes<T4, N4>, ChatCompletionFunctionsWithTypes<T5, N5>, ChatCompletionFunctionsWithTypes<T6, N6>, ChatCompletionFunctionsWithTypes<T7, N7>, ChatCompletionFunctionsWithTypes<T8, N8>],
                                                                                                                                                                                                                             responseSize?: number,
                                                                                                                                                                                                                             logMetaData?: MetaData,
                                                                                                                                                                                                                             requestOverrides?: Partial<CreateChatCompletionRequest>,
                                                                                                                                                                                                                             maxTokens?: number): Promise<Result<T1, N1> | Result<T2, N2> | Result<T3, N3> | Result<T4, N4> | Result<T5, N5> | Result<T6, N6> | Result<T7, N7> | Result<T8, N8> | undefined>;

    makeBlockingRequestWithFunctions<T1, T2, T3, T4, T5, T6, T7, T8, T9, N1 extends string, N2 extends string, N3 extends string, N4 extends string, N5 extends string, N6 extends string, N7 extends string, N8 extends string, N9 extends string>(systemMessage: string,
                                                                                                                                                                                                                                                    messages: RequestMessageFormat[],
                                                                                                                                                                                                                                                    model: GPTModelsAlias,
                                                                                                                                                                                                                                                    actionName: string,
                                                                                                                                                                                                                                                    functions: [ChatCompletionFunctionsWithTypes<T1, N1>, ChatCompletionFunctionsWithTypes<T2, N2>, ChatCompletionFunctionsWithTypes<T3, N3>, ChatCompletionFunctionsWithTypes<T4, N4>, ChatCompletionFunctionsWithTypes<T5, N5>, ChatCompletionFunctionsWithTypes<T6, N6>, ChatCompletionFunctionsWithTypes<T7, N7>, ChatCompletionFunctionsWithTypes<T8, N8>, ChatCompletionFunctionsWithTypes<T9, N9>],
                                                                                                                                                                                                                                                    responseSize?: number,
                                                                                                                                                                                                                                                    logMetaData?: MetaData,
                                                                                                                                                                                                                                                    requestOverrides?: Partial<CreateChatCompletionRequest>,
                                                                                                                                                                                                                                                    maxTokens?: number): Promise<Result<T1, N1> | Result<T2, N2> | Result<T3, N3> | Result<T4, N4> | Result<T5, N5> | Result<T6, N6> | Result<T7, N7> | Result<T8, N8> | Result<T9, N9> | undefined>;

    makeBlockingRequestWithFunctions<T1, T2, T3, T4, T5, T6, T7, T8, T9, T10, N1 extends string, N2 extends string, N3 extends string, N4 extends string, N5 extends string, N6 extends string, N7 extends string, N8 extends string, N9 extends string, N10 extends string>(systemMessage: string,
                                                                                                                                                                                                                                                                             messages: RequestMessageFormat[],
                                                                                                                                                                                                                                                                             model: GPTModelsAlias,
                                                                                                                                                                                                                                                                             actionName: string,
                                                                                                                                                                                                                                                                             functions: [ChatCompletionFunctionsWithTypes<T1, N1>, ChatCompletionFunctionsWithTypes<T2, N2>, ChatCompletionFunctionsWithTypes<T3, N3>, ChatCompletionFunctionsWithTypes<T4, N4>, ChatCompletionFunctionsWithTypes<T5, N5>, ChatCompletionFunctionsWithTypes<T6, N6>, ChatCompletionFunctionsWithTypes<T7, N7>, ChatCompletionFunctionsWithTypes<T8, N8>, ChatCompletionFunctionsWithTypes<T9, N9>, ChatCompletionFunctionsWithTypes<T10, N10>],
                                                                                                                                                                                                                                                                             responseSize?: number,
                                                                                                                                                                                                                                                                             logMetaData?: MetaData,
                                                                                                                                                                                                                                                                             requestOverrides?: Partial<CreateChatCompletionRequest>,
                                                                                                                                                                                                                                                                             maxTokens?: number): Promise<Result<T1, N1> | Result<T2, N2> | Result<T3, N3> | Result<T4, N4> | Result<T5, N5> | Result<T6, N6> | Result<T7, N7> | Result<T8, N8> | Result<T9, N9> | Result<T10, N10> | undefined>;
    async makeBlockingRequestWithFunctions(systemMessage: string,
                                           messages: RequestMessageFormat[],
                                           model: GPTModelsAlias,
                                           actionName: string,
                                           functions: Array<ChatCompletionFunctionsWithTypes<any, any>>,
                                           responseSize: number = 800,
                                           logMetaData?: MetaData,
                                           requestOverrides?: Partial<CreateChatCompletionRequest>,
                                           maxTokens: number = this.maxTokensPerRequest): Promise<Result<any, any>> {
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
            functions: (functions?.length ?? 0) > 0 ? functions : undefined,
            function_call: (functions?.length ?? 0) > 1 ? 'auto' : undefined,
        };

        let result: CreateChatCompletionResponse | undefined = undefined;

        try {

            result = (await this.openAIApi.createChatCompletion(request)).data;

            const funCall = result.choices[0]?.message?.function_call;
            assertIsDefined(funCall, 'function was not returned');
            const validator = functions.find(_ => _.name === funCall.name);
            assertIsDefined(validator, `could not find func validator for name [${funCall.name}]`)
            const validatedResult = this.extractFunctionValidatedResult(funCall.arguments, validator.parameters);

            await this.recordAudit(systemMessage, messages, openAIModel, funCall.arguments ?? '', request, result,
                actionName, undefined, logMetaData);

            return {
                name: funCall.name,
                entry: validator,
                value: validatedResult,
            };

        } catch (err: any) {
            this.logger?.error(`error performing [${actionName}]`, err);

            await this.recordAudit(systemMessage, messages, openAIModel, "", request,
                result, actionName, err, logMetaData);

            throw new Error("error performing blocking request with functions");
        }

    }

    makeBlockingRequestWithFunctionsAlt<T1, N1 extends string>(systemMessage: string,
                                                               messages: RequestMessageFormat[],
                                                               model: GPTModelsAlias,
                                                               actionName: string,
                                                               functions: [ChatCompletionFunctionsWithTypes2<T1, N1>],
                                                               responseSize?: number,
                                                               logMetaData?: MetaData,
                                                               requestOverrides?: Partial<CreateChatCompletionRequest>,
                                                               maxTokens?: number): Promise<Result2<T1, N1> | undefined>;

    makeBlockingRequestWithFunctionsAlt<T1, T2, N1 extends string, N2 extends string>(systemMessage: string,
                                                                                      messages: RequestMessageFormat[],
                                                                                      model: GPTModelsAlias,
                                                                                      actionName: string,
                                                                                      functions: [ChatCompletionFunctionsWithTypes2<T1, N1>, ChatCompletionFunctionsWithTypes2<T2, N2>],
                                                                                      responseSize?: number,
                                                                                      logMetaData?: MetaData,
                                                                                      requestOverrides?: Partial<CreateChatCompletionRequest>,
                                                                                      maxTokens?: number): Promise<Result2<T1, N1> | Result2<T2, N2> | undefined>;

    makeBlockingRequestWithFunctionsAlt<T1, T2, T3, N1 extends string, N2 extends string, N3 extends string>(systemMessage: string,
                                                                                                             messages: RequestMessageFormat[],
                                                                                                             model: GPTModelsAlias,
                                                                                                             actionName: string,
                                                                                                             functions: [ChatCompletionFunctionsWithTypes2<T1, N1>, ChatCompletionFunctionsWithTypes2<T2, N2>, ChatCompletionFunctionsWithTypes2<T3, N3>],
                                                                                                             responseSize?: number,
                                                                                                             logMetaData?: MetaData,
                                                                                                             requestOverrides?: Partial<CreateChatCompletionRequest>,
                                                                                                             maxTokens?: number): Promise<Result2<T1, N1> | Result2<T2, N2> | Result2<T3, N3> | undefined>;

    makeBlockingRequestWithFunctionsAlt<T1, T2, T3, T4, N1 extends string, N2 extends string, N3 extends string, N4 extends string>(systemMessage: string,
                                                                                                                                    messages: RequestMessageFormat[],
                                                                                                                                    model: GPTModelsAlias,
                                                                                                                                    actionName: string,
                                                                                                                                    functions: [ChatCompletionFunctionsWithTypes2<T1, N1>, ChatCompletionFunctionsWithTypes2<T2, N2>, ChatCompletionFunctionsWithTypes2<T3, N3>, ChatCompletionFunctionsWithTypes2<T4, N4>],
                                                                                                                                    responseSize?: number,
                                                                                                                                    logMetaData?: MetaData,
                                                                                                                                    requestOverrides?: Partial<CreateChatCompletionRequest>,
                                                                                                                                    maxTokens?: number): Promise<Result2<T1, N1> | Result2<T2, N2> | Result2<T3, N3> | Result2<T4, N4> | undefined>;

    makeBlockingRequestWithFunctionsAlt<T1, T2, T3, T4, T5, N1 extends string, N2 extends string, N3 extends string, N4 extends string, N5 extends string>(systemMessage: string,
                                                                                                                                                           messages: RequestMessageFormat[],
                                                                                                                                                           model: GPTModelsAlias,
                                                                                                                                                           actionName: string,
                                                                                                                                                           functions: [ChatCompletionFunctionsWithTypes2<T1, N1>, ChatCompletionFunctionsWithTypes2<T2, N2>, ChatCompletionFunctionsWithTypes2<T3, N3>, ChatCompletionFunctionsWithTypes2<T4, N4>, ChatCompletionFunctionsWithTypes2<T5, N5>],
                                                                                                                                                           responseSize?: number,
                                                                                                                                                           logMetaData?: MetaData,
                                                                                                                                                           requestOverrides?: Partial<CreateChatCompletionRequest>,
                                                                                                                                                           maxTokens?: number): Promise<Result2<T1, N1> | Result2<T2, N2> | Result2<T3, N3> | Result2<T4, N4> | Result2<T5, N5> | undefined>;


    async makeBlockingRequestWithFunctionsAlt(systemMessage: string,
                                              messages: RequestMessageFormat[],
                                              model: GPTModelsAlias,
                                              actionName: string,
                                              functions: Array<ChatCompletionFunctionsWithTypes2<any, any>>,
                                              responseSize: number = 800,
                                              logMetaData?: MetaData,
                                              requestOverrides?: Partial<CreateChatCompletionRequest>,
                                              maxTokens: number = this.maxTokensPerRequest): Promise<Result2<any, any>> {
        const {
            openAIModel,
            promptSize
        } = this.measureRequest(model, systemMessage, messages, responseSize, maxTokens);

        await this.moderateLastMessage(messages);

        this.logger?.info(`performing blocking request alt [${actionName}]`, logMetaData);

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

            const objStr = result.choices[0]?.message?.content;
            assertIsDefined(objStr, 'response content not generated');
            const objJson = JSON5.parse(objStr);
            const objType = objJson['type'] as string;
            assertIsDefined(objType, 'could not resolve object type');
            const validator = functions.find(_ => _.name === objType);
            assertIsDefined(validator, `could not find func validator for name [${objType}]`)
            const validatedResult = this.extractFunctionValidatedResult(objStr, validator.parameters);

            await this.recordAudit(systemMessage, messages, openAIModel, objStr, request, result,
                actionName, undefined, logMetaData);

            return {
                name: objType,
                entry: validator,
                value: validatedResult?.value,
            };

        } catch (err: any) {
            this.logger?.error(`error performing [${actionName}]`, err);

            await this.recordAudit(systemMessage, messages, openAIModel, "", request,
                result, undefined, err, logMetaData);

            throw new Error("error performing blocking request with functions alt");
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

                    this.recordAudit(systemMessage, requestMessages, openAIModel, readContent, request,
                        response.data, streamingFunctionName, err ?? undefined, logMetaData);

                }
            );


        } catch (err: any) {
            this.logger?.error(`error performing streaming request`, err, logMetaData)

            await this.recordAudit(systemMessage, requestMessages, openAIModel, readContent, request, createResponse,
                streamingFunctionName, err, logMetaData);

            return undefined;
        }
    }

    public async performModeration(input: string): Promise<void> {
        const isFlagged = await this.openAIApi.performModeration(input);
        if (isFlagged) {
            throw new Error(`request flagged due to moderation. input: [${input.slice(0, 200)}]`);
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
            const readContent = result.choices[0]?.message?.function_call?.arguments;
            const validatedResult = this.extractFunctionValidatedResult(readContent, gptFunction.parameters);

            await this.recordAudit(systemMessage, messages, openAIModel, readContent ?? '', request, result,
                gptFunction.name, undefined, logMetaData)

            return validatedResult;

        } catch (err: any) {
            this.logger?.error(`error performing [${gptFunction.name}]`, err);

            await this.recordAudit(systemMessage, messages, openAIModel, result?.choices[0]?.message?.function_call?.arguments ?? '',
                request, result, gptFunction.name, undefined, logMetaData);

            throw new Error(`error performing single function [${gptFunction.name}]`);
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

    private extractFunctionValidatedResult<T, I, K>(readContent: string | undefined, functionSchema: JSONSchemaType<T>) {
        return truthy(readContent, funcArgs => {
            const json = JSON5.parse(funcArgs, undefined, (error, stack, root) => {
                if (error.message.includes('invalid end of input')) {
                    const validator = this.schemaValidationCache.getValidator(functionSchema);
                    if (validator(root)) {
                        // we did what we could.. object looks good enough..
                        return root;
                    } else {
                        throw new Error(`function arguments did not pass validation [${JSON.stringify(validator.errors)}]`);
                    }
                }

            });
            const validator = this.schemaValidationCache.getValidator(functionSchema);
            if (validator(json)) {
                return json
            } else {
                throw new Error(`function arguments did not pass validation [${JSON.stringify(validator.errors)}]`);
            }
        });
    }

    private recordAudit(systemMessage: string, requestMessages: ChatCompletionRequestMessage[], openAIModel: "gpt-3.5-turbo-0613" | "gpt-4-0613" | "gpt-3.5-turbo-16k-0613",
                        readContent: string, request: CreateChatCompletionRequest, response?: CreateChatCompletionResponse, functionName?: string,
                        err?: Error, logMetaData?: MetaData) {

        const prompt_tokens = countTokens(systemMessage + requestMessages.map(_ => _.content).join('\n'), openAIModel);
        const completion_tokens = countTokens(readContent, openAIModel);

        this.auditor?.auditRequest({
            request,
            resultRaw: {
                id: response?.id,
                model: response?.model,
                choices: [{
                    message: functionName
                        ? {
                            function_call: {
                                name: functionName,
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
                object: response?.object,
                created: response?.created,
                usage: {
                    prompt_tokens,
                    completion_tokens,
                    total_tokens: prompt_tokens + completion_tokens,
                }
            } as CreateChatCompletionResponse,
            result: err
                ? {error: {message: err.message, details: err.toString()}}
                : {data: {content: readContent}},
            requestType: 'blocking-request',
            requestSig: functionName ?? '',
            metaData: logMetaData,
        });
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

interface Wrapper<N extends string, T> {
    type: N;
    value: T;
}

export const createResultWrapper = <N extends string, T>(name: N, tSchema: JSONSchemaType<T>): JSONSchemaType<Wrapper<N, T>> => ({
    type: "object",
    additionalProperties: false,
    properties: {
        type: {type: "string", const: name},
        value: tSchema,
    },
    required: ['type', 'value'],
} as unknown as JSONSchemaType<Wrapper<N, T>>);


export type RequestMessageFormat = { role: 'user' | 'assistant', content: string };
