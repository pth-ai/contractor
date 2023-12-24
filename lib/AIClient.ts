import OpenAI from "openai";
import {
    ChatCompletion, ChatCompletionChunk,
    ChatCompletionCreateParamsBase,
    ChatCompletionCreateParamsStreaming
} from "openai/resources/chat/completions";
import * as Core from "openai/core";
import {APIPromise} from "openai/core";
import {CreateEmbeddingResponse, EmbeddingCreateParams} from "openai/resources/embeddings";
import {Stream} from "openai/streaming";
import {Agent} from "node:https";


export interface IAIClient {

    createChatCompletion(createChatCompletionRequest: ChatCompletionCreateParamsBase, options?: Core.RequestOptions): Core.APIPromise<ChatCompletion>;

    createStreamingChatCompletion(createChatCompletionRequest: ChatCompletionCreateParamsBase, options?: Core.RequestOptions): Core.APIPromise<Stream<ChatCompletionChunk>>;

    performEmbedding(createEmbeddingRequest: EmbeddingCreateParams, options?: Core.RequestOptions): Core.APIPromise<CreateEmbeddingResponse>;

    performModeration(userRequest: string): Promise<IsFlagged>;

}

type IsFlagged = boolean;

export class AIClient implements IAIClient {
    private openAIApi: OpenAI;
    private embeddingAgent: Agent;

    constructor(openAIApi: OpenAI) {
        this.openAIApi = openAIApi;
        this.embeddingAgent = new Agent({
            keepAlive: true,
            maxSockets: 10,
            timeout: 10000, // 10 seconds
        });
    }

    performEmbedding(createEmbeddingRequest: EmbeddingCreateParams, options?: Core.RequestOptions): Core.APIPromise<CreateEmbeddingResponse> {
        return this.openAIApi.embeddings.create(createEmbeddingRequest, {
            ...options,
            httpAgent: this.embeddingAgent,
        });
    }

    performModeration(userRequest: string): Promise<IsFlagged> {
        return this.openAIApi.moderations.create({input: userRequest})
            .then(_ => _.results[0].flagged)
    }

    createChatCompletion(createChatCompletionRequest: ChatCompletionCreateParamsBase, options?: Core.RequestOptions): Core.APIPromise<ChatCompletion> {
        return this.openAIApi.chat.completions.create({
            ...createChatCompletionRequest,
            stream: false,
        }, options)
    }

    createStreamingChatCompletion(createChatCompletionRequest: ChatCompletionCreateParamsBase, options?: Core.RequestOptions): APIPromise<Stream<ChatCompletionChunk>> {
        return this.openAIApi.chat.completions.create({
            ...createChatCompletionRequest,
            stream: true,
        } as ChatCompletionCreateParamsStreaming, options)
    }

}
