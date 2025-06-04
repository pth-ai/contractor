import {pipeline} from "stream";
import {JSONSchemaType} from "ajv";
import {countTokens, GPTModels, largeModel} from "./gptUtils";
import {assertIsDefined, truthy} from "./utils";
import {IAuditor} from "./IAuditor";
import {StreamListenerTransform} from "./StreamListenerTransform";
import {SchemaValidationCache} from "./SchemaValidationCache";
import {ThrottledTransform} from "./ThrottleTransform";
import {OpenAIStreamToStreamedObjectTransform} from "./OpenAIStreamToStreamedObjectTransform";
import {StreamMITMTransform} from "./StreamMITMTransform";
import * as JSON5 from "./json5";
import ReadableStream = NodeJS.ReadableStream;
import {JSONSchemaToTypescriptConverter} from "./JSONSchemaToTypescriptConverter";
import {ChatCompletion, ChatCompletionCreateParamsBase} from "openai/resources/chat/completions";
import {OpenAIStreamChunkTransform} from "./OpenAIStreamChunkTransform";
import {AIClient} from "./AIClient";
import {ICacher} from "./ICacher";
import {ModerationCreateParams} from "openai/resources/moderations";
import * as Core from "openai/core";
import {
    ChatCompletionAssistantMessageParam,
    ChatCompletionSystemMessageParam, ChatCompletionToolMessageParam, ChatCompletionUserMessageParam
} from "openai/resources/chat/completions";
import {Logger} from "useful";
import {OpenAIStreamObject} from "./OpenAIStreamObject";

type MetaDataType = {
    [k: string]: string
};

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

// Helper type to extract the Result union from a tuple of function definitions
export type FunctionsResultUnion<Fns extends readonly ChatCompletionFunctionsWithTypes<any, string>[]> =
// 1. Get the union of all function definition types in the input tuple `Fns`
    Fns[number] extends infer FuncDef
        // 2. For each type `FuncDef` in that union...
        ? FuncDef extends ChatCompletionFunctionsWithTypes<infer T, infer N>
            // 3. ...if it matches the structure, create the corresponding Result<T, N> type
            ? Result<T, N>
            // 4. Otherwise, yield `never` (shouldn't happen with proper constraints)
            : never
        // 5. If the input wasn't a valid function definition union, yield `never`
        : never;


export class Contractor<MetaData extends MetaDataType> {


    private readonly schemaValidationCache: SchemaValidationCache;


    constructor(private aiClient: AIClient,
                private functionsMessagePlaceHolder: string,
                private auditor?: IAuditor<MetaData>,
                private cacher?: ICacher,
                private maxTokensPerRequest: number = 16000,
                private streamObjectSeparator: string = defaultStreamDelimiterSeparator,
                private logger?: Logger,
                private settings?: { disableModeration?: boolean }) {

        this.schemaValidationCache = new SchemaValidationCache();
    }


    public async streamingFunction<
        F extends readonly ChatCompletionFunctionsWithTypes<any, string>[],
        OUT
    >(
        systemMessage: string,
        messages: RequestMessageFormat[],
        model: GPTModels,
        functions: F,
        transformObjectStream: (streamingObject: FunctionsResultUnion<F>) => Promise<OUT>,
        responseSize: number = 2000,
        logMetaData?: MetaData,
        requestOverrides?: Partial<ChatCompletionCreateParamsBase>,
        maxTokens: number = this.maxTokensPerRequest
    ): Promise<NodeJS.ReadableStream | undefined> {

        const regexp = new RegExp(this.functionsMessagePlaceHolder, 'g');

        const responseFormatGen = new JSONSchemaToTypescriptConverter(createResultsWrapper(functions), 'Result').generateTypescript();

        const stream = await this.makeStreamingRequest(
            systemMessage.replace(regexp, responseFormatGen),
            messages.map(m => m.role === 'user'
                ? ({
                    ...m,
                    content: typeof m.content === 'string' ? m.content.replace(regexp, responseFormatGen) : m.content
                }) : m),
            model, responseSize, logMetaData, requestOverrides, maxTokens);

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
            } as FunctionsResultUnion<F>)
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

    async makeBlockingRequestWithFunctionsAlt<
        F extends readonly ChatCompletionFunctionsWithTypes<any, string>[]
    >(
        systemMessage: string,
        messages: RequestMessageFormat[],
        model: GPTModels,
        actionName: string,
        functions: F,
        responseSize: number = 2000,
        logMetaData?: MetaData,
        requestOverrides?: Partial<ChatCompletionCreateParamsBase>,
        maxTokens: number = this.maxTokensPerRequest
    ): Promise<FunctionsResultUnion<F> | undefined> {

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
            assertIsDefined(objStr, `response content not generated [${JSON.stringify(result)}]`);

            const objJson = JSON5.parse(objStr, undefined, (error) => {
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
            } as FunctionsResultUnion<F>;

        } catch (err: any) {
            this.logger?.error(`error performing [${actionName}]`, err);

            await this.recordAudit(systemMessage, _messages, model, "", request,
                result, undefined, err, logMetaData);

            throw new Error("error performing blocking request with functions alt");
        }

    }

    async makeBlockingRequest(requestSystemMessage: string,
                              requestMessages: RequestMessageFormat[],
                              model: GPTModels,
                              actionName: string,
                              responseSize: number = 2000,
                              logMetaData?: MetaData,
                              requestOverrides?: Partial<ChatCompletionCreateParamsBase>,
                              maxTokens: number = this.maxTokensPerRequest): Promise<string> {

        const {
            promptSize
        } = this.measureRequest(model, requestSystemMessage, requestMessages, responseSize, maxTokens);

        await this.moderateLastMessage(requestMessages);
        const oaiModel = promptSize + responseSize > 4000 ? largeModel(model) : model;

        const {systemMessage, messages} = (() => {

            const messages = oaiModel.startsWith('o1')
                ? requestMessages.map((m, i) => i === 0
                    ? {
                        ...m,
                        content: `## System instructions:\n${requestSystemMessage}\n\n## Task instructions:\n${m.content}`
                    }
                    : m)
                : requestMessages;

            return {
                systemMessage: oaiModel.startsWith('o1') ? undefined : requestSystemMessage,
                messages,
            }
        })();

        const request: ChatCompletionCreateParamsBase = {
            model: oaiModel,
            messages: [
                ...(systemMessage ? [{role: 'system', content: systemMessage} as const] : []),
                ...messages,
            ],
            temperature: oaiModel.startsWith('o1') ? undefined : 0,
            max_tokens: oaiModel.startsWith('o1') ? undefined : maxTokens,
            max_completion_tokens: oaiModel.startsWith('o1') ? responseSize : undefined,
            ...requestOverrides,
        };

        let result: (ChatCompletion & { isFromCache?: boolean }) | undefined = undefined;

        try {

            result = await truthy(this.cacher, async _ => await _.retrieveRequestFromCache(request, logMetaData)) ?? await this.aiClient.createChatCompletion(request, logMetaData);

            const responseStr = result.choices[0]?.message?.content;
            assertIsDefined(responseStr, `response content not generated [${JSON.stringify(result)}]`);

            if (!result.isFromCache) {
                this.cacher?.cacheRequest(result, request, logMetaData)
                    .then(_ignore => ({}))
            }

            await this.recordAudit(systemMessage ?? '', messages, result.model, responseStr, request, result,
                actionName, undefined, {...logMetaData, isFromCache: result.isFromCache ? 'true' : undefined} as any);

            return responseStr;

        } catch (err: any) {
            this.logger?.error(`error performing [${actionName}]`, err);

            await this.recordAudit(systemMessage ?? '', messages, model, "", request,
                result, undefined, err, logMetaData);

            throw new Error(`error performing blocking request [${actionName}]`);
        }

    }


    // TODO: create tests for functions and wihtout functions
    async makeStreamingRequest(systemMessage: string,
                               messages: RequestMessageFormat[],
                               model: GPTModels,
                               responseSize: number = 2000,
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

    private extractFunctionValidatedResult<T>(readContent: string | undefined, functionSchema: JSONSchemaType<T>) {
        return truthy(readContent, funcArgs => {
            const json = JSON5.parse(funcArgs, undefined, (error, _stack, root) => {
                if (error.message.includes('invalid end of input')) {
                    const validator = this.schemaValidationCache.getValidator(functionSchema);
                    if (validator(root)) {
                        // we did what we could.. object looks good enough..
                        return {type: 'return-healed', value: root} as const;
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
            isFromCache: response ? response.hasOwnProperty('isFromCache') : undefined,
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

export const createResultsWrapper = (funcs: ReadonlyArray<{
    name: string,
    parameters: JSONSchemaType<any>,
    description: string
}>): JSONSchemaType<any> & { type: string } => ({
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
} as unknown as JSONSchemaType<any> & { type: string });


export type RequestMessageFormat =
    | ChatCompletionSystemMessageParam
    | ChatCompletionUserMessageParam
    | ChatCompletionAssistantMessageParam
    | ChatCompletionToolMessageParam;
