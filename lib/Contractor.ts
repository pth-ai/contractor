import {pipeline} from "stream";
import {JSONSchemaType} from "ajv";
import {countTokens, GPTModels, largeModel} from "./gptUtils";
import {assertIsDefined, truthy} from "./utils";
import {IAuditor} from "./IAuditor";
import {StreamListenerTransform} from "./StreamListenerTransform";
import {Logger} from "./Logger";
import {SchemaValidationCache} from "./SchemaValidationCache";
import {ThrottledTransform} from "./ThrottleTransform";
import {OpenAIStreamToStreamedObjectTransform} from "./OpenAIStreamToStreamedObjectTransform";
import {StreamMITMTransform} from "./StreamMITMTransform";
import * as JSON5 from "./json5";
import ReadableStream = NodeJS.ReadableStream;
import {JSONSchemaToTypescriptConverter} from "./JSONSchemaToTypescriptConverter";
import {OpenAIStreamToStreamedHealedTransform} from "./OpenAIStreamToStreamedHealedTransform";
import {ChatCompletion, ChatCompletionCreateParamsBase} from "openai/resources/chat/completions";
import {CreateEmbeddingResponse, Embedding, EmbeddingCreateParams} from "openai/resources/embeddings";
import {OpenAIStreamChunkTransform, OpenAIStreamObject} from "./OpenAIStreamChunkTransform";
import {AIClient} from "./AIClient";
import {ICacher} from "./ICacher";
import {ModerationCreateParams} from "openai/resources/moderations";
import * as Core from "openai/core";
import {
    ChatCompletionAssistantMessageParam,
    ChatCompletionSystemMessageParam, ChatCompletionToolMessageParam, ChatCompletionUserMessageParam
} from "openai/resources/chat/completions";

type MetaDataType = {
    [k: string]: string
};

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


    private readonly schemaValidationCache: SchemaValidationCache;


    constructor(private aiClient: AIClient,
                private functionsMessagePlaceHolder: string,
                private auditor?: IAuditor<MetaData>,
                private cacher?: ICacher,
                private maxTokensPerRequest: number = 8000,
                private streamObjectSeparator: string = defaultStreamDelimiterSeparator,
                private logger?: Logger,
                private settings?: { disableModeration?: boolean }) {

        this.schemaValidationCache = new SchemaValidationCache();
    }

    // Define the function implementation
    streamingFunction<T1, N1 extends string, OUT>(systemMessage: string,
                                                  messages: RequestMessageFormat[],
                                                  model: GPTModels,
                                                  functions: [ChatCompletionFunctionsWithTypes<T1, N1>],
                                                  transformObjectStream: (streamingObject: Result<T1, N1>) => Promise<OUT>,
                                                  responseSize?: number,
                                                  logMetaData?: MetaData,
                                                  requestOverrides?: Partial<ChatCompletionCreateParamsBase>,
                                                  maxTokens?: number): Promise<NodeJS.ReadableStream | undefined>;

    streamingFunction<T1, T2, N1 extends string, N2 extends string, OUT>(systemMessage: string,
                                                                         messages: RequestMessageFormat[],
                                                                         model: GPTModels,
                                                                         functions: [ChatCompletionFunctionsWithTypes<T1, N1>, ChatCompletionFunctionsWithTypes<T2, N2>],
                                                                         transformObjectStream: (streamingObject: Result<T1, N1> | Result<T2, N2>) => Promise<OUT>,
                                                                         responseSize?: number,
                                                                         logMetaData?: MetaData,
                                                                         requestOverrides?: Partial<ChatCompletionCreateParamsBase>,
                                                                         maxTokens?: number): Promise<NodeJS.ReadableStream | undefined>;

    streamingFunction<T1, T2, T3, N1 extends string, N2 extends string, N3 extends string, OUT>(systemMessage: string,
                                                                                                messages: RequestMessageFormat[],
                                                                                                model: GPTModels,
                                                                                                functions: [ChatCompletionFunctionsWithTypes<T1, N1>, ChatCompletionFunctionsWithTypes<T2, N2>, ChatCompletionFunctionsWithTypes<T3, N3>],
                                                                                                transformObjectStream: (streamingObject: Result<T1, N1> | Result<T2, N2> | Result<T3, N3>) => Promise<OUT>,
                                                                                                responseSize?: number,
                                                                                                logMetaData?: MetaData,
                                                                                                requestOverrides?: Partial<ChatCompletionCreateParamsBase>,
                                                                                                maxTokens?: number): Promise<NodeJS.ReadableStream | undefined>;

    streamingFunction<T1, T2, T3, T4, N1 extends string, N2 extends string, N3 extends string, N4 extends string, OUT>(systemMessage: string,
                                                                                                                       messages: RequestMessageFormat[],
                                                                                                                       model: GPTModels,
                                                                                                                       functions: [ChatCompletionFunctionsWithTypes<T1, N1>, ChatCompletionFunctionsWithTypes<T2, N2>, ChatCompletionFunctionsWithTypes<T3, N3>, ChatCompletionFunctionsWithTypes<T4, N4>],
                                                                                                                       transformObjectStream: (streamingObject: Result<T1, N1> | Result<T2, N2> | Result<T3, N3> | Result<T4, N4>) => Promise<OUT>,
                                                                                                                       responseSize?: number,
                                                                                                                       logMetaData?: MetaData,
                                                                                                                       requestOverrides?: Partial<ChatCompletionCreateParamsBase>,
                                                                                                                       maxTokens?: number): Promise<NodeJS.ReadableStream | undefined>;

    streamingFunction<T1, T2, T3, T4, T5, N1 extends string, N2 extends string, N3 extends string, N4 extends string, N5 extends string, OUT>(systemMessage: string,
                                                                                                                                              messages: RequestMessageFormat[],
                                                                                                                                              model: GPTModels,
                                                                                                                                              functions: [ChatCompletionFunctionsWithTypes<T1, N1>, ChatCompletionFunctionsWithTypes<T2, N2>, ChatCompletionFunctionsWithTypes<T3, N3>, ChatCompletionFunctionsWithTypes<T4, N4>, ChatCompletionFunctionsWithTypes<T5, N5>],
                                                                                                                                              transformObjectStream: (streamingObject: Result<T1, N1> | Result<T2, N2> | Result<T3, N3> | Result<T4, N4> | Result<T5, N5>) => Promise<OUT>,
                                                                                                                                              responseSize?: number,
                                                                                                                                              logMetaData?: MetaData,
                                                                                                                                              requestOverrides?: Partial<ChatCompletionCreateParamsBase>,
                                                                                                                                              maxTokens?: number): Promise<NodeJS.ReadableStream | undefined>;

    streamingFunction<T1, T2, T3, T4, T5, T6, N1 extends string, N2 extends string, N3 extends string, N4 extends string, N5 extends string, N6 extends string, OUT>(systemMessage: string,
                                                                                                                                                                     messages: RequestMessageFormat[],
                                                                                                                                                                     model: GPTModels,
                                                                                                                                                                     functions: [ChatCompletionFunctionsWithTypes<T1, N1>, ChatCompletionFunctionsWithTypes<T2, N2>, ChatCompletionFunctionsWithTypes<T3, N3>, ChatCompletionFunctionsWithTypes<T4, N4>, ChatCompletionFunctionsWithTypes<T5, N5>, ChatCompletionFunctionsWithTypes<T6, N6>],
                                                                                                                                                                     transformObjectStream: (streamingObject: Result<T1, N1> | Result<T2, N2> | Result<T3, N3> | Result<T4, N4> | Result<T5, N5> | Result<T6, N6>) => Promise<OUT>,
                                                                                                                                                                     responseSize?: number,
                                                                                                                                                                     logMetaData?: MetaData,
                                                                                                                                                                     requestOverrides?: Partial<ChatCompletionCreateParamsBase>,
                                                                                                                                                                     maxTokens?: number): Promise<NodeJS.ReadableStream | undefined>;

    streamingFunction<T1, T2, T3, T4, T5, T6, T7, N1 extends string, N2 extends string, N3 extends string, N4 extends string, N5 extends string, N6 extends string, N7 extends string, OUT>(systemMessage: string,
                                                                                                                                                                                            messages: RequestMessageFormat[],
                                                                                                                                                                                            model: GPTModels,
                                                                                                                                                                                            functions: [ChatCompletionFunctionsWithTypes<T1, N1>, ChatCompletionFunctionsWithTypes<T2, N2>, ChatCompletionFunctionsWithTypes<T3, N3>, ChatCompletionFunctionsWithTypes<T4, N4>, ChatCompletionFunctionsWithTypes<T5, N5>, ChatCompletionFunctionsWithTypes<T6, N6>, ChatCompletionFunctionsWithTypes<T7, N7>],
                                                                                                                                                                                            transformObjectStream: (streamingObject: Result<T1, N1> | Result<T2, N2> | Result<T3, N3> | Result<T4, N4> | Result<T5, N5> | Result<T6, N6> | Result<T7, N7>) => Promise<OUT>,
                                                                                                                                                                                            responseSize?: number,
                                                                                                                                                                                            logMetaData?: MetaData,
                                                                                                                                                                                            requestOverrides?: Partial<ChatCompletionCreateParamsBase>,
                                                                                                                                                                                            maxTokens?: number): Promise<NodeJS.ReadableStream | undefined>;

    streamingFunction<T1, T2, T3, T4, T5, T6, T7, T8, N1 extends string, N2 extends string, N3 extends string, N4 extends string, N5 extends string, N6 extends string, N7 extends string, N8 extends string, OUT>(systemMessage: string,
                                                                                                                                                                                                                   messages: RequestMessageFormat[],
                                                                                                                                                                                                                   model: GPTModels,
                                                                                                                                                                                                                   functions: [ChatCompletionFunctionsWithTypes<T1, N1>, ChatCompletionFunctionsWithTypes<T2, N2>, ChatCompletionFunctionsWithTypes<T3, N3>, ChatCompletionFunctionsWithTypes<T4, N4>, ChatCompletionFunctionsWithTypes<T5, N5>, ChatCompletionFunctionsWithTypes<T6, N6>, ChatCompletionFunctionsWithTypes<T7, N7>, ChatCompletionFunctionsWithTypes<T8, N8>],
                                                                                                                                                                                                                   transformObjectStream: (streamingObject: Result<T1, N1> | Result<T2, N2> | Result<T3, N3> | Result<T4, N4> | Result<T5, N5> | Result<T6, N6> | Result<T7, N7> | Result<T8, N8>) => Promise<OUT>,
                                                                                                                                                                                                                   responseSize?: number,
                                                                                                                                                                                                                   logMetaData?: MetaData,
                                                                                                                                                                                                                   requestOverrides?: Partial<ChatCompletionCreateParamsBase>,
                                                                                                                                                                                                                   maxTokens?: number): Promise<NodeJS.ReadableStream | undefined>;

    streamingFunction<T1, T2, T3, T4, T5, T6, T7, T8, T9, N1 extends string, N2 extends string, N3 extends string, N4 extends string, N5 extends string, N6 extends string, N7 extends string, N8 extends string, N9 extends string, OUT>(systemMessage: string,
                                                                                                                                                                                                                                          messages: RequestMessageFormat[],
                                                                                                                                                                                                                                          model: GPTModels,
                                                                                                                                                                                                                                          functions: [ChatCompletionFunctionsWithTypes<T1, N1>, ChatCompletionFunctionsWithTypes<T2, N2>, ChatCompletionFunctionsWithTypes<T3, N3>, ChatCompletionFunctionsWithTypes<T4, N4>, ChatCompletionFunctionsWithTypes<T5, N5>, ChatCompletionFunctionsWithTypes<T6, N6>, ChatCompletionFunctionsWithTypes<T7, N7>, ChatCompletionFunctionsWithTypes<T8, N8>, ChatCompletionFunctionsWithTypes<T9, N9>],
                                                                                                                                                                                                                                          transformObjectStream: (streamingObject: Result<T1, N1> | Result<T2, N2> | Result<T3, N3> | Result<T4, N4> | Result<T5, N5> | Result<T6, N6> | Result<T7, N7> | Result<T8, N8> | Result<T9, N9>) => Promise<OUT>,
                                                                                                                                                                                                                                          responseSize?: number,
                                                                                                                                                                                                                                          logMetaData?: MetaData,
                                                                                                                                                                                                                                          requestOverrides?: Partial<ChatCompletionCreateParamsBase>,
                                                                                                                                                                                                                                          maxTokens?: number): Promise<NodeJS.ReadableStream | undefined>;

    streamingFunction<T1, T2, T3, T4, T5, T6, T7, T8, T9, T10, N1 extends string, N2 extends string, N3 extends string, N4 extends string, N5 extends string, N6 extends string, N7 extends string, N8 extends string, N9 extends string, N10 extends string, OUT>(systemMessage: string,
                                                                                                                                                                                                                                                                   messages: RequestMessageFormat[],
                                                                                                                                                                                                                                                                   model: GPTModels,
                                                                                                                                                                                                                                                                   functions: [ChatCompletionFunctionsWithTypes<T1, N1>, ChatCompletionFunctionsWithTypes<T2, N2>, ChatCompletionFunctionsWithTypes<T3, N3>, ChatCompletionFunctionsWithTypes<T4, N4>, ChatCompletionFunctionsWithTypes<T5, N5>, ChatCompletionFunctionsWithTypes<T6, N6>, ChatCompletionFunctionsWithTypes<T7, N7>, ChatCompletionFunctionsWithTypes<T8, N8>, ChatCompletionFunctionsWithTypes<T9, N9>, ChatCompletionFunctionsWithTypes<T10, N10>],
                                                                                                                                                                                                                                                                   transformObjectStream: (streamingObject: Result<T1, N1> | Result<T2, N2> | Result<T3, N3> | Result<T4, N4> | Result<T5, N5> | Result<T6, N6> | Result<T7, N7> | Result<T8, N8> | Result<T9, N9> | Result<T10, N10>) => Promise<OUT>,
                                                                                                                                                                                                                                                                   responseSize?: number,
                                                                                                                                                                                                                                                                   logMetaData?: MetaData,
                                                                                                                                                                                                                                                                   requestOverrides?: Partial<ChatCompletionCreateParamsBase>,
                                                                                                                                                                                                                                                                   maxTokens?: number): Promise<NodeJS.ReadableStream | undefined>;

    public async streamingFunction(systemMessage: string,
                                   messages: RequestMessageFormat[],
                                   model: GPTModels,
                                   functions: Array<ChatCompletionFunctionsWithTypes<any, any>>,
                                   transformObjectStream: (streamingObject: Result<any, any>) => Promise<any>,
                                   responseSize: number = 800,
                                   logMetaData?: MetaData,
                                   requestOverrides?: Partial<ChatCompletionCreateParamsBase>,
                                   maxTokens: number = this.maxTokensPerRequest): Promise<NodeJS.ReadableStream | undefined> {


        const regexp = new RegExp(this.functionsMessagePlaceHolder, 'g');

        const responseFormatGen = new JSONSchemaToTypescriptConverter(createResultsWrapper(functions), 'Result').generateTypescript();

        const stream = await this.makeStreamingRequest(
            systemMessage.replace(regexp, responseFormatGen),
            messages.map(m => m.role === 'user'
                ? ({
                    ...m,
                    content: typeof m.content === 'string' ? m.content.replace(regexp, responseFormatGen) : m.content
                }) : m),
            model, responseSize, functions, logMetaData, requestOverrides, maxTokens);

        if (!stream) {
            return undefined;
        }

        const throttler = new ThrottledTransform(
            {
                name: 'task creation thr',
                flushDebounceTimeMs: 1000,
                maxIdleTimeoutMs: 20000,
                windowSize: 50,
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
                .map(_ => [_.name as string, ['value', ...(_.partialStreamPath ?? [])]])),
            this.logger,
            'name',
            'value')
        const objectStreamTransformer = new StreamMITMTransform<any, any>(async (input, functionName) => {
            if (!functionName) {
                throw new Error('action did not result in a function, try to ask for specific function or direct AI to answer by using any of the available functions');
            }

            return await transformObjectStream({
                name: functionName,
                entry: functions.find(_ => _.name === functionName)!,
                value: input.value,
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

    public async streamingHealer(systemMessage: string,
                                 messages: RequestMessageFormat[],
                                 model: GPTModels,
                                 healer: (streamStr: string) => (string | undefined),
                                 responseSize: number = 800,
                                 logMetaData?: MetaData,
                                 requestOverrides?: Partial<ChatCompletion>,
                                 maxTokens: number = this.maxTokensPerRequest,
                                 manipulateResult?: (input: {
                                     healedStream: string
                                 }) => any,
                                 onSuccessFinished?: () => void): Promise<NodeJS.ReadableStream | undefined> {

        const stream = await this.makeStreamingRequest(
            systemMessage,
            messages,
            model,
            responseSize,
            undefined,
            logMetaData,
            requestOverrides,
            maxTokens);

        if (!stream) {
            return undefined;
        }

        const throttler = new ThrottledTransform(
            {
                name: 'task creation thr',
                flushDebounceTimeMs: 1000,
                maxIdleTimeoutMs: 20000,
                windowSize: 10,
            },
        );

        const healedTransform = new OpenAIStreamToStreamedHealedTransform(healer, this.logger)

        const objectStreamTransformer = new StreamMITMTransform<string, unknown>(
            async (input) => {
                return manipulateResult ? manipulateResult({healedStream: input}) : {healedStream: manipulateResult};
            }, this.streamObjectSeparator,
            onSuccessFinished
        )

        return pipeline(
            stream,
            throttler,
            healedTransform,
            objectStreamTransformer,
            err => {
                if (err) {
                    this.logger?.error('error while processing stream interim results', err, logMetaData);
                }
            })
    }

    makeBlockingRequestWithFunctions<T1, N1 extends string>(systemMessage: string,
                                                            messages: RequestMessageFormat[],
                                                            model: GPTModels,
                                                            actionName: string,
                                                            functions: [ChatCompletionFunctionsWithTypes<T1, N1>],
                                                            responseSize?: number,
                                                            logMetaData?: MetaData,
                                                            requestOverrides?: Partial<ChatCompletionCreateParamsBase>,
                                                            maxTokens?: number): Promise<Result<T1, N1> | undefined>;

    makeBlockingRequestWithFunctions<T1, T2, N1 extends string, N2 extends string>(systemMessage: string,
                                                                                   messages: RequestMessageFormat[],
                                                                                   model: GPTModels,
                                                                                   actionName: string,
                                                                                   functions: [ChatCompletionFunctionsWithTypes<T1, N1>, ChatCompletionFunctionsWithTypes<T2, N2>],
                                                                                   responseSize?: number,
                                                                                   logMetaData?: MetaData,
                                                                                   requestOverrides?: Partial<ChatCompletionCreateParamsBase>,
                                                                                   maxTokens?: number): Promise<Result<T1, N1> | Result<T2, N2> | undefined>;

    makeBlockingRequestWithFunctions<T1, T2, T3, N1 extends string, N2 extends string, N3 extends string>(systemMessage: string,
                                                                                                          messages: RequestMessageFormat[],
                                                                                                          model: GPTModels,
                                                                                                          actionName: string,
                                                                                                          functions: [ChatCompletionFunctionsWithTypes<T1, N1>, ChatCompletionFunctionsWithTypes<T2, N2>, ChatCompletionFunctionsWithTypes<T3, N3>],
                                                                                                          responseSize?: number,
                                                                                                          logMetaData?: MetaData,
                                                                                                          requestOverrides?: Partial<ChatCompletionCreateParamsBase>,
                                                                                                          maxTokens?: number): Promise<Result<T1, N1> | Result<T2, N2> | Result<T3, N3> | undefined>;

    makeBlockingRequestWithFunctions<T1, T2, T3, T4, N1 extends string, N2 extends string, N3 extends string, N4 extends string>(systemMessage: string,
                                                                                                                                 messages: RequestMessageFormat[],
                                                                                                                                 model: GPTModels,
                                                                                                                                 actionName: string,
                                                                                                                                 functions: [ChatCompletionFunctionsWithTypes<T1, N1>, ChatCompletionFunctionsWithTypes<T2, N2>, ChatCompletionFunctionsWithTypes<T3, N3>, ChatCompletionFunctionsWithTypes<T4, N4>],
                                                                                                                                 responseSize?: number,
                                                                                                                                 logMetaData?: MetaData,
                                                                                                                                 requestOverrides?: Partial<ChatCompletionCreateParamsBase>,
                                                                                                                                 maxTokens?: number): Promise<Result<T1, N1> | Result<T2, N2> | Result<T3, N3> | Result<T4, N4> | undefined>;

    makeBlockingRequestWithFunctions<T1, T2, T3, T4, T5, N1 extends string, N2 extends string, N3 extends string, N4 extends string, N5 extends string>(systemMessage: string,
                                                                                                                                                        messages: RequestMessageFormat[],
                                                                                                                                                        model: GPTModels,
                                                                                                                                                        actionName: string,
                                                                                                                                                        functions: [ChatCompletionFunctionsWithTypes<T1, N1>, ChatCompletionFunctionsWithTypes<T2, N2>, ChatCompletionFunctionsWithTypes<T3, N3>, ChatCompletionFunctionsWithTypes<T4, N4>, ChatCompletionFunctionsWithTypes<T5, N5>],
                                                                                                                                                        responseSize?: number,
                                                                                                                                                        logMetaData?: MetaData,
                                                                                                                                                        requestOverrides?: Partial<ChatCompletionCreateParamsBase>,
                                                                                                                                                        maxTokens?: number): Promise<Result<T1, N1> | Result<T2, N2> | Result<T3, N3> | Result<T4, N4> | Result<T5, N5> | undefined>;

    makeBlockingRequestWithFunctions<T1, T2, T3, T4, T5, T6, N1 extends string, N2 extends string, N3 extends string, N4 extends string, N5 extends string, N6 extends string>(systemMessage: string,
                                                                                                                                                                               messages: RequestMessageFormat[],
                                                                                                                                                                               model: GPTModels,
                                                                                                                                                                               actionName: string,
                                                                                                                                                                               functions: [ChatCompletionFunctionsWithTypes<T1, N1>, ChatCompletionFunctionsWithTypes<T2, N2>, ChatCompletionFunctionsWithTypes<T3, N3>, ChatCompletionFunctionsWithTypes<T4, N4>, ChatCompletionFunctionsWithTypes<T5, N5>, ChatCompletionFunctionsWithTypes<T6, N6>],
                                                                                                                                                                               responseSize?: number,
                                                                                                                                                                               logMetaData?: MetaData,
                                                                                                                                                                               requestOverrides?: Partial<ChatCompletionCreateParamsBase>,
                                                                                                                                                                               maxTokens?: number): Promise<Result<T1, N1> | Result<T2, N2> | Result<T3, N3> | Result<T4, N4> | Result<T5, N5> | Result<T6, N6> | undefined>;

    makeBlockingRequestWithFunctions<T1, T2, T3, T4, T5, T6, T7, N1 extends string, N2 extends string, N3 extends string, N4 extends string, N5 extends string, N6 extends string, N7 extends string>(systemMessage: string,
                                                                                                                                                                                                      messages: RequestMessageFormat[],
                                                                                                                                                                                                      model: GPTModels,
                                                                                                                                                                                                      actionName: string,
                                                                                                                                                                                                      functions: [ChatCompletionFunctionsWithTypes<T1, N1>, ChatCompletionFunctionsWithTypes<T2, N2>, ChatCompletionFunctionsWithTypes<T3, N3>, ChatCompletionFunctionsWithTypes<T4, N4>, ChatCompletionFunctionsWithTypes<T5, N5>, ChatCompletionFunctionsWithTypes<T6, N6>, ChatCompletionFunctionsWithTypes<T7, N7>],
                                                                                                                                                                                                      responseSize?: number,
                                                                                                                                                                                                      logMetaData?: MetaData,
                                                                                                                                                                                                      requestOverrides?: Partial<ChatCompletionCreateParamsBase>,
                                                                                                                                                                                                      maxTokens?: number): Promise<Result<T1, N1> | Result<T2, N2> | Result<T3, N3> | Result<T4, N4> | Result<T5, N5> | Result<T6, N6> | Result<T7, N7> | undefined>;

    makeBlockingRequestWithFunctions<T1, T2, T3, T4, T5, T6, T7, T8, N1 extends string, N2 extends string, N3 extends string, N4 extends string, N5 extends string, N6 extends string, N7 extends string, N8 extends string>(systemMessage: string,
                                                                                                                                                                                                                             messages: RequestMessageFormat[],
                                                                                                                                                                                                                             model: GPTModels,
                                                                                                                                                                                                                             actionName: string,
                                                                                                                                                                                                                             functions: [ChatCompletionFunctionsWithTypes<T1, N1>, ChatCompletionFunctionsWithTypes<T2, N2>, ChatCompletionFunctionsWithTypes<T3, N3>, ChatCompletionFunctionsWithTypes<T4, N4>, ChatCompletionFunctionsWithTypes<T5, N5>, ChatCompletionFunctionsWithTypes<T6, N6>, ChatCompletionFunctionsWithTypes<T7, N7>, ChatCompletionFunctionsWithTypes<T8, N8>],
                                                                                                                                                                                                                             responseSize?: number,
                                                                                                                                                                                                                             logMetaData?: MetaData,
                                                                                                                                                                                                                             requestOverrides?: Partial<ChatCompletionCreateParamsBase>,
                                                                                                                                                                                                                             maxTokens?: number): Promise<Result<T1, N1> | Result<T2, N2> | Result<T3, N3> | Result<T4, N4> | Result<T5, N5> | Result<T6, N6> | Result<T7, N7> | Result<T8, N8> | undefined>;

    makeBlockingRequestWithFunctions<T1, T2, T3, T4, T5, T6, T7, T8, T9, N1 extends string, N2 extends string, N3 extends string, N4 extends string, N5 extends string, N6 extends string, N7 extends string, N8 extends string, N9 extends string>(systemMessage: string,
                                                                                                                                                                                                                                                    messages: RequestMessageFormat[],
                                                                                                                                                                                                                                                    model: GPTModels,
                                                                                                                                                                                                                                                    actionName: string,
                                                                                                                                                                                                                                                    functions: [ChatCompletionFunctionsWithTypes<T1, N1>, ChatCompletionFunctionsWithTypes<T2, N2>, ChatCompletionFunctionsWithTypes<T3, N3>, ChatCompletionFunctionsWithTypes<T4, N4>, ChatCompletionFunctionsWithTypes<T5, N5>, ChatCompletionFunctionsWithTypes<T6, N6>, ChatCompletionFunctionsWithTypes<T7, N7>, ChatCompletionFunctionsWithTypes<T8, N8>, ChatCompletionFunctionsWithTypes<T9, N9>],
                                                                                                                                                                                                                                                    responseSize?: number,
                                                                                                                                                                                                                                                    logMetaData?: MetaData,
                                                                                                                                                                                                                                                    requestOverrides?: Partial<ChatCompletionCreateParamsBase>,
                                                                                                                                                                                                                                                    maxTokens?: number): Promise<Result<T1, N1> | Result<T2, N2> | Result<T3, N3> | Result<T4, N4> | Result<T5, N5> | Result<T6, N6> | Result<T7, N7> | Result<T8, N8> | Result<T9, N9> | undefined>;

    makeBlockingRequestWithFunctions<T1, T2, T3, T4, T5, T6, T7, T8, T9, T10, N1 extends string, N2 extends string, N3 extends string, N4 extends string, N5 extends string, N6 extends string, N7 extends string, N8 extends string, N9 extends string, N10 extends string>(systemMessage: string,
                                                                                                                                                                                                                                                                             messages: RequestMessageFormat[],
                                                                                                                                                                                                                                                                             model: GPTModels,
                                                                                                                                                                                                                                                                             actionName: string,
                                                                                                                                                                                                                                                                             functions: [ChatCompletionFunctionsWithTypes<T1, N1>, ChatCompletionFunctionsWithTypes<T2, N2>, ChatCompletionFunctionsWithTypes<T3, N3>, ChatCompletionFunctionsWithTypes<T4, N4>, ChatCompletionFunctionsWithTypes<T5, N5>, ChatCompletionFunctionsWithTypes<T6, N6>, ChatCompletionFunctionsWithTypes<T7, N7>, ChatCompletionFunctionsWithTypes<T8, N8>, ChatCompletionFunctionsWithTypes<T9, N9>, ChatCompletionFunctionsWithTypes<T10, N10>],
                                                                                                                                                                                                                                                                             responseSize?: number,
                                                                                                                                                                                                                                                                             logMetaData?: MetaData,
                                                                                                                                                                                                                                                                             requestOverrides?: Partial<ChatCompletionCreateParamsBase>,
                                                                                                                                                                                                                                                                             maxTokens?: number): Promise<Result<T1, N1> | Result<T2, N2> | Result<T3, N3> | Result<T4, N4> | Result<T5, N5> | Result<T6, N6> | Result<T7, N7> | Result<T8, N8> | Result<T9, N9> | Result<T10, N10> | undefined>;
    async makeBlockingRequestWithFunctions(systemMessage: string,
                                           messages: RequestMessageFormat[],
                                           model: GPTModels,
                                           actionName: string,
                                           functions: Array<ChatCompletionFunctionsWithTypes<any, any>>,
                                           responseSize: number = 800,
                                           logMetaData?: MetaData,
                                           requestOverrides?: Partial<ChatCompletionCreateParamsBase>,
                                           maxTokens: number = this.maxTokensPerRequest): Promise<Result<any, any>> {
        const {
            promptSize
        } = this.measureRequest(model, systemMessage, messages, responseSize, maxTokens);

        await this.moderateLastMessage(messages);

        this.logger?.info(`performing blocking request [${actionName}]`, logMetaData);

        const request: ChatCompletionCreateParamsBase = {
            model: promptSize + responseSize > 4000 ? largeModel(model) : model,
            messages: [
                {role: 'system', content: systemMessage},
                ...messages,
            ],
            temperature: 0,
            max_tokens: responseSize,
            ...requestOverrides,
            functions: (functions?.length ?? 0) > 0 ? functions : undefined,
            function_call: (functions?.length ?? 0) > 1 ? 'auto' : undefined,
        };

        let result: ChatCompletion | undefined = undefined;

        try {

            result = (await this.aiClient.createChatCompletion(request, logMetaData));

            const funCall = result.choices[0]?.message?.function_call;
            assertIsDefined(funCall, 'function was not returned');
            const validator = functions.find(_ => _.name === funCall.name);
            assertIsDefined(validator, `could not find func validator for name [${funCall.name}]`)
            const validatedResult = this.extractFunctionValidatedResult(funCall.arguments, validator.parameters);

            await this.recordAudit(systemMessage, messages, model, funCall.arguments ?? '', request, result,
                actionName, undefined, logMetaData);

            return {
                name: funCall.name,
                entry: validator,
                value: validatedResult,
            };

        } catch (err: any) {
            this.logger?.error(`error performing [${actionName}]`, err);

            await this.recordAudit(systemMessage, messages, model, "", request,
                result, actionName, err, logMetaData);

            throw new Error("error performing blocking request with functions");
        }

    }

    makeBlockingRequestWithFunctionsAlt<T1, N1 extends string>(systemMessage: string,
                                                               messages: RequestMessageFormat[],
                                                               model: GPTModels,
                                                               actionName: string,
                                                               functions: [ChatCompletionFunctionsWithTypes<T1, N1>],
                                                               responseSize?: number,
                                                               logMetaData?: MetaData,
                                                               requestOverrides?: Partial<ChatCompletionCreateParamsBase>,
                                                               maxTokens?: number): Promise<Result2<T1, N1> | undefined>;

    makeBlockingRequestWithFunctionsAlt<T1, T2, N1 extends string, N2 extends string>(systemMessage: string,
                                                                                      messages: RequestMessageFormat[],
                                                                                      model: GPTModels,
                                                                                      actionName: string,
                                                                                      functions: [ChatCompletionFunctionsWithTypes<T1, N1>, ChatCompletionFunctionsWithTypes<T2, N2>],
                                                                                      responseSize?: number,
                                                                                      logMetaData?: MetaData,
                                                                                      requestOverrides?: Partial<ChatCompletionCreateParamsBase>,
                                                                                      maxTokens?: number): Promise<Result2<T1, N1> | Result2<T2, N2> | undefined>;

    makeBlockingRequestWithFunctionsAlt<T1, T2, T3, N1 extends string, N2 extends string, N3 extends string>(systemMessage: string,
                                                                                                             messages: RequestMessageFormat[],
                                                                                                             model: GPTModels,
                                                                                                             actionName: string,
                                                                                                             functions: [ChatCompletionFunctionsWithTypes<T1, N1>, ChatCompletionFunctionsWithTypes<T2, N2>, ChatCompletionFunctionsWithTypes<T3, N3>],
                                                                                                             responseSize?: number,
                                                                                                             logMetaData?: MetaData,
                                                                                                             requestOverrides?: Partial<ChatCompletionCreateParamsBase>,
                                                                                                             maxTokens?: number): Promise<Result2<T1, N1> | Result2<T2, N2> | Result2<T3, N3> | undefined>;

    makeBlockingRequestWithFunctionsAlt<T1, T2, T3, T4, N1 extends string, N2 extends string, N3 extends string, N4 extends string>(systemMessage: string,
                                                                                                                                    messages: RequestMessageFormat[],
                                                                                                                                    model: GPTModels,
                                                                                                                                    actionName: string,
                                                                                                                                    functions: [ChatCompletionFunctionsWithTypes<T1, N1>, ChatCompletionFunctionsWithTypes<T2, N2>, ChatCompletionFunctionsWithTypes<T3, N3>, ChatCompletionFunctionsWithTypes<T4, N4>],
                                                                                                                                    responseSize?: number,
                                                                                                                                    logMetaData?: MetaData,
                                                                                                                                    requestOverrides?: Partial<ChatCompletionCreateParamsBase>,
                                                                                                                                    maxTokens?: number): Promise<Result2<T1, N1> | Result2<T2, N2> | Result2<T3, N3> | Result2<T4, N4> | undefined>;

    makeBlockingRequestWithFunctionsAlt<T1, T2, T3, T4, T5, N1 extends string, N2 extends string, N3 extends string, N4 extends string, N5 extends string>(systemMessage: string,
                                                                                                                                                           messages: RequestMessageFormat[],
                                                                                                                                                           model: GPTModels,
                                                                                                                                                           actionName: string,
                                                                                                                                                           functions: [ChatCompletionFunctionsWithTypes<T1, N1>, ChatCompletionFunctionsWithTypes<T2, N2>, ChatCompletionFunctionsWithTypes<T3, N3>, ChatCompletionFunctionsWithTypes<T4, N4>, ChatCompletionFunctionsWithTypes<T5, N5>],
                                                                                                                                                           responseSize?: number,
                                                                                                                                                           logMetaData?: MetaData,
                                                                                                                                                           requestOverrides?: Partial<ChatCompletionCreateParamsBase>,
                                                                                                                                                           maxTokens?: number): Promise<Result2<T1, N1> | Result2<T2, N2> | Result2<T3, N3> | Result2<T4, N4> | Result2<T5, N5> | undefined>;


    async makeBlockingRequestWithFunctionsAlt(systemMessage: string,
                                              messages: RequestMessageFormat[],
                                              model: GPTModels,
                                              actionName: string,
                                              functions: Array<ChatCompletionFunctionsWithTypes<any, any>>,
                                              responseSize: number = 800,
                                              logMetaData?: MetaData,
                                              requestOverrides?: Partial<ChatCompletionCreateParamsBase>,
                                              maxTokens: number = this.maxTokensPerRequest): Promise<Result2<any, any>> {

        const regexp = new RegExp(this.functionsMessagePlaceHolder, 'g');

        const responseFormatGen = new JSONSchemaToTypescriptConverter(createResultsWrapper(functions), 'Result').generateTypescript();

        const _messages = messages.map(m => m.role === 'user'
            ? ({
                ...m,
                content: typeof m.content === 'string' ? m.content.replace(regexp, responseFormatGen) : m.content
            })
            : m);
        const {
            promptSize
        } = this.measureRequest(model, systemMessage, _messages, responseSize, maxTokens);

        await this.moderateLastMessage(_messages);

        this.logger?.info(`performing blocking request alt [${actionName}]`, logMetaData);

        const request: ChatCompletionCreateParamsBase = {
            model: promptSize + responseSize > 4000 ? largeModel(model) : model,
            messages: [
                {role: 'system', content: systemMessage.replace(regexp, responseFormatGen)},
                ..._messages,
            ],
            temperature: 0,
            max_tokens: responseSize,
            ...requestOverrides,
        };

        let result: (ChatCompletion & { isFromCache?: boolean }) | undefined = undefined;

        try {

            result = await truthy(this.cacher, async _ => await _.retrieveRequestFromCache(request, logMetaData)) ?? await this.aiClient.createChatCompletion(request, logMetaData);

            const objStr = result.choices[0]?.message?.content;
            assertIsDefined(objStr, 'response content not generated');

            const objJson = JSON5.parse(objStr, undefined, (error, stack, root) => {
                if (error.message.includes(`invalid character '`)) {
                    return {type: 'skip-char'};
                } else {
                    return undefined;
                }
            });

            // const objJson = JSON5.parse(objStr, );
            const objType = objJson['name'] as string;
            assertIsDefined(objType, 'could not resolve object type');
            const objValueStr = JSON.stringify(objJson['value']);
            const validator = functions.find(_ => _.name === objType);
            assertIsDefined(validator, `could not find func validator for name [${objType}]`)
            const validatedResult = this.extractFunctionValidatedResult(objValueStr, validator.parameters);


            if (!result.isFromCache) {
                this.cacher?.cacheRequest(result, request, logMetaData)
                    .then(_ignore => ({}))
            }

            await this.recordAudit(systemMessage, _messages, model, objValueStr, request, result,
                actionName, undefined, logMetaData);

            return {
                name: objType,
                entry: validator,
                value: validatedResult,
            };

        } catch (err: any) {
            this.logger?.error(`error performing [${actionName}]`, err);

            await this.recordAudit(systemMessage, _messages, model, "", request,
                result, undefined, err, logMetaData);

            throw new Error("error performing blocking request with functions alt");
        }

    }

    async makeBlockingRequest(systemMessage: string,
                              messages: RequestMessageFormat[],
                              model: GPTModels,
                              actionName: string,
                              responseSize: number = 800,
                              logMetaData?: MetaData,
                              requestOverrides?: Partial<ChatCompletionCreateParamsBase>,
                              maxTokens: number = this.maxTokensPerRequest): Promise<string> {
        const {
            promptSize
        } = this.measureRequest(model, systemMessage, messages, responseSize, maxTokens);

        await this.moderateLastMessage(messages);
        const oaiModel = promptSize + responseSize > 4000 ? largeModel(model) : model;

        const request: ChatCompletionCreateParamsBase = {
            model: oaiModel,
            messages: [
                {role: 'system', content: systemMessage},
                ...messages,
            ],
            temperature: 0,
            max_tokens: responseSize,
            ...requestOverrides,
        };

        let result: (ChatCompletion & { isFromCache?: boolean }) | undefined = undefined;

        try {

            result = await truthy(this.cacher, async _ => await _.retrieveRequestFromCache(request, logMetaData)) ?? await this.aiClient.createChatCompletion(request, logMetaData);

            const responseStr = result.choices[0]?.message?.content;
            assertIsDefined(responseStr, 'response content not generated');

            if (!result.isFromCache) {
                this.cacher?.cacheRequest(result, request, logMetaData)
                    .then(_ignore => ({}))
            }

            await this.recordAudit(systemMessage, messages, result.model, responseStr, request, result,
                actionName, undefined, {...logMetaData, isFromCache: result.isFromCache ? 'true' : undefined} as any);

            return responseStr;

        } catch (err: any) {
            this.logger?.error(`error performing [${actionName}]`, err);

            await this.recordAudit(systemMessage, messages, model, "", request,
                result, undefined, err, logMetaData);

            throw new Error(`error performing blocking request [${actionName}]`);
        }

    }


    // TODO: create tests for functions and wihtout functions
    async makeStreamingRequest(systemMessage: string,
                               messages: RequestMessageFormat[],
                               model: GPTModels,
                               responseSize: number = 800,
                               functions?: Array<ChatCompletionFunctionsWithTypes<any, any>>,
                               logMetaData?: MetaData,
                               requestOverrides?: Partial<ChatCompletionCreateParamsBase>,
                               maxTokens: number = this.maxTokensPerRequest): Promise<ReadableStream | undefined> {

        const {
            promptSize
        } = this.measureRequest(model, systemMessage, messages, responseSize, maxTokens);

        await this.moderateLastMessage(messages);

        this.logger?.info(`making streaming request`, logMetaData);

        const requestMessages: RequestMessageFormat[] = [
            {role: 'system', content: systemMessage},
            ...messages,
        ]

        const request: ChatCompletionCreateParamsBase = {
            model: promptSize + responseSize > 4000 ? largeModel(model) : model,
            messages: [
                {role: 'system', content: systemMessage},
                ...messages,
            ],
            temperature: 0,
            max_tokens: responseSize,
            ...requestOverrides,
        };
        let readContent = ""
        let streamingFunctionName: string | undefined = undefined;
        try {
            const response = await this.aiClient.createStreamingChatCompletion(request, logMetaData);
            const streamTransform = new OpenAIStreamChunkTransform(this.logger, logMetaData);
            // TODO: for streaming - cache + retrieve this from cache..
            return pipeline(
                response,
                streamTransform,
                new StreamListenerTransform<OpenAIStreamObject>((x) => {
                    streamingFunctionName = x.functionName;
                    return readContent += x.chunk;
                }),
                err => {
                    if (err) {
                        this.logger?.error('error during stream', err ?? {}, logMetaData);
                    }

                    this.recordAudit(systemMessage, requestMessages, model, readContent, request,
                        undefined, streamingFunctionName, err ?? undefined, logMetaData);

                }
            );


        } catch (err: any) {
            this.logger?.error(`error performing streaming request`, err, logMetaData);
            await this.recordAudit(systemMessage, requestMessages, model, readContent, request,
                undefined, streamingFunctionName, err, logMetaData);

            return undefined;
        }
    }

    public async performModeration(body: ModerationCreateParams, options?: Core.RequestOptions, logMetaData?: MetaData): Promise<void> {
        if (!this.settings?.disableModeration) {
            const response = await this.aiClient.performModeration(body, options);
            const isFlagged = response.results[0].flagged;
            this.logger?.debug(`request flagged due to moderation. [${JSON.stringify(response.results[0])}]`, logMetaData)
            if (isFlagged) {
                throw new Error(`request flagged due to moderation.`);
            }
        }
    }

    public getStreamSeparator = () => this.streamObjectSeparator;

    public getFunctionsMessagePlaceHolder = () => this.functionsMessagePlaceHolder;

    private async moderateLastMessage(messages: RequestMessageFormat[], logMetaData?: MetaData) {
        const content = messages.slice(-1).map(_ => _.content).join('\n');
        await this.performModeration({input: content}, undefined, logMetaData);
    }

    public singleFunction = async <T>(systemMessage: string,
                                      messages: RequestMessageFormat[],
                                      model: GPTModels = 'gpt-3.5-turbo-0613',
                                      gptFunction: {
                                          name: string,
                                          description: string;
                                          parameters: JSONSchemaType<T>
                                      },
                                      logMetaData?: MetaData,
                                      requestOverrides?: Partial<ChatCompletionCreateParamsBase>,
                                      responseSize: number = 2000,
                                      maxTokens: number = this.maxTokensPerRequest,): Promise<T | undefined> => {

        const {
            promptSize
        } = this.measureRequest(model, systemMessage, messages, responseSize, maxTokens);

        await this.moderateLastMessage(messages);

        this.logger?.info(`using gpt function [${gptFunction.name}]`, logMetaData);

        const request: ChatCompletionCreateParamsBase = {
            model: promptSize + responseSize > 4000 ? largeModel(model) : model,
            messages: [
                {role: 'system', content: systemMessage},
                ...messages,
            ],
            temperature: 0,
            max_tokens: responseSize,
            functions: [gptFunction],
            ...requestOverrides,
            function_call: {name: gptFunction.name}
        };

        let result: ChatCompletion | undefined = undefined;

        try {

            result = (await this.aiClient.createChatCompletion(request, logMetaData));
            const readContent = result.choices[0]?.message?.function_call?.arguments;
            const validatedResult = this.extractFunctionValidatedResult(readContent, gptFunction.parameters);

            await this.recordAudit(systemMessage, messages, result.model, readContent ?? '', request, result,
                gptFunction.name, undefined, logMetaData)

            return validatedResult;

        } catch (err: any) {
            this.logger?.error(`error performing [${gptFunction.name}]`, err);

            await this.recordAudit(systemMessage, messages, result?.model ?? model, result?.choices[0]?.message?.function_call?.arguments ?? '',
                request, result, gptFunction.name, undefined, logMetaData);

            throw new Error(`error performing single function [${gptFunction.name}]`);
        }

    }

    public performEmbedding = async (inputContent: EmbeddingCreateParams['input'], userId: string, model: 'text-embedding-ada-002' | 'text-embedding-3-small' | string, logMetaData?: MetaData,): Promise<Embedding[]> => {
        const createEmbeddingRequest: EmbeddingCreateParams = {
            input: inputContent,
            model,
            user: userId
        };
        const result: CreateEmbeddingResponse & {
            isFromCache?: boolean
        } = (await truthy(this.cacher, async _ => await _.retrieveEmbeddingFromCache(createEmbeddingRequest, logMetaData))) ??
            await this.aiClient.performEmbedding(createEmbeddingRequest, logMetaData);

        await this.auditor?.auditRequest({
            request: createEmbeddingRequest,
            resultRaw: result,
            result: {data: {content: result.data}},
            requestType: 'embedding',
            requestSig: logMetaData?.['requestSig'] ?? '-',
            metaData: logMetaData,
        });

        if (!result.isFromCache) {
            this.cacher?.cacheEmbedding(result, createEmbeddingRequest, logMetaData)
                .then(_ignore => ({}));
        }

        return result.data;
    }

    private extractFunctionValidatedResult<T, I, K>(readContent: string | undefined, functionSchema: JSONSchemaType<T>) {
        return truthy(readContent, funcArgs => {
            const json = JSON5.parse(funcArgs, undefined, (error, stack, root) => {
                if (error.message.includes('invalid end of input')) {
                    const validator = this.schemaValidationCache.getValidator(functionSchema);
                    if (validator(root)) {
                        // we did what we could.. object looks good enough..
                        return {type: 'return-healed', value: root};
                    } else {
                        throw new Error(`function arguments did not pass validation [${JSON.stringify(validator.errors)}]`);
                    }
                } else {
                    return undefined;
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

    private async recordAudit(systemMessage: string, requestMessages: RequestMessageFormat[], model: GPTModels,
                              readContent: string, request: ChatCompletionCreateParamsBase, response?: ChatCompletion, functionName?: string,
                              err?: Error, logMetaData?: MetaData) {

        const prompt_tokens = countTokens(systemMessage + requestMessages.map(_ => _.content).join('\n'), response?.model ?? model, this.logger);
        const completion_tokens = countTokens(readContent, response?.model ?? model, this.logger);

        await this.auditor?.auditRequest({
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
            } as ChatCompletion,
            result: err
                ? {error: {message: err.message, details: err.toString()}}
                : {data: {content: readContent}},
            requestType: 'blocking-request',
            requestSig: functionName ?? '',
            metaData: logMetaData,
        });
    }

    private measureRequest(model: GPTModels, systemMessage: string, messages: RequestMessageFormat[], responseSize: number, maxTokens: number) {
        const promptSize = countTokens(systemMessage + messages.map(_ => _.content).join('\n'), model, this.logger);
        if (promptSize + responseSize > maxTokens) {
            const m = `warning: input too large. model [${model}] prmopt=[${promptSize}] response=[${responseSize}] max=[${maxTokens}]`;
            this.logger?.error(m, {});
            throw new Error(m)
        }
        return {
            model,
            promptSize,
        };
    }

}

interface Wrapper<N extends string, T> {
    type: N;
    value: T;
}

export const createResultWrapper = <N extends string, T>(name: N, tSchema: JSONSchemaType<T>, description: string = ""): JSONSchemaType<Wrapper<N, T>> => ({
    type: "object",
    additionalProperties: false,
    description,
    properties: {
        type: {type: "string", const: name},
        value: tSchema,
    },
    required: ['type', 'value'],
} as unknown as JSONSchemaType<Wrapper<N, T>>);

export const createResultsWrapper = (funcs: ({
    name: string,
    parameters: JSONSchemaType<any>,
    description: string
})[]): JSONSchemaType<any> => ({
    $id: 'results-wrapper',
    title: 'Result',
    type: "object",
    additionalProperties: false,
    oneOf: funcs.map(f => ({
        type: 'object',
        description: f.description,
        properties: {
            name: {type: 'string', const: f.name},
            value: f.parameters,
        },
    }))
} as unknown as JSONSchemaType<any>);


export type RequestMessageFormat =
    | ChatCompletionSystemMessageParam
    | ChatCompletionUserMessageParam
    | ChatCompletionAssistantMessageParam
    | ChatCompletionToolMessageParam;
