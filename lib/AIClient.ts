import {
    ChatCompletion,
    ChatCompletionChunk,
    ChatCompletionCreateParamsBase,
    ChatCompletionCreateParamsStreaming
} from "openai/resources/chat/completions";
import * as Core from "openai/core";
import {CreateEmbeddingResponse, EmbeddingCreateParams} from "openai/resources/embeddings";
import {Stream} from "openai/streaming";
import {Logger} from "./Logger";


export interface IAIClient {

    createChatCompletion(createChatCompletionRequest: ChatCompletionCreateParamsBase, options?: Core.RequestOptions, logMeta?: {
        [key: string]: string;
    }): Promise<ChatCompletion>;

    createStreamingChatCompletion(createChatCompletionRequest: ChatCompletionCreateParamsBase, options?: Core.RequestOptions, logMeta?: {
        [key: string]: string;
    }): Promise<Stream<ChatCompletionChunk>>;

    performEmbedding(createEmbeddingRequest: EmbeddingCreateParams, options?: Core.RequestOptions, logMeta?: {
        [key: string]: string;
    }): Promise<CreateEmbeddingResponse>;

    performModeration(userRequest: string, logMeta?: { [key: string]: string; }): Promise<IsFlagged>;

}

type IsFlagged = boolean;

export interface EmbeddingClient {
    performEmbedding(createEmbeddingRequest: EmbeddingCreateParams, options?: Core.RequestOptions): Core.APIPromise<CreateEmbeddingResponse>;
}

export interface ModerationClient {
    performModeration(userRequest: string): Promise<IsFlagged>;
}

export interface EnrichmentClient {
    createChatCompletion(createChatCompletionRequest: ChatCompletionCreateParamsBase, options?: Core.RequestOptions): Core.APIPromise<ChatCompletion>;

    createStreamingChatCompletion(createChatCompletionRequest: ChatCompletionCreateParamsBase, options?: Core.RequestOptions): Core.APIPromise<Stream<ChatCompletionChunk>>;
}

class ClientPool<T> {
    private busyClients: Set<T>;
    private queue: ((client: T) => Promise<void>)[];

    constructor(
        private clients: T[],
    ) {
        this.busyClients = new Set();
        this.queue = [];
    }

    private getNextAvailableClient(): T | null {
        for (let client of this.clients) {
            if (!this.busyClients.has(client)) {
                return client;
            }
        }
        return null;
    }

    private processQueue(): void {
        if (this.queue.length > 0) {
            const availableClient = this.getNextAvailableClient();
            if (availableClient) {
                const requestFunction = this.queue.shift();
                if (requestFunction) {
                    this.busyClients.add(availableClient);
                    requestFunction(availableClient).finally(() => {
                        this.busyClients.delete(availableClient);
                        this.processQueue();
                    });
                }
            }
        }
    }

    async execute<RES>(request: (client: T) => Promise<RES>): Promise<RES> {
        const availableClient = this.getNextAvailableClient();
        if (availableClient) {
            this.busyClients.add(availableClient);
            availableClient
            return await request(availableClient)
                .finally(() => {
                    this.busyClients.delete(availableClient);
                    this.processQueue();
                });
        } else {
            return new Promise<RES>(async (resolve, reject) => {
                this.queue.push(async client => {
                    try {
                        const result = request(client);
                        resolve(result);
                    } catch (e) {
                        reject(e);
                    }
                });
            });
        }
    }
}


export class AIClient implements IAIClient {
    private embeddingPool: ClientPool<EmbeddingClient>;
    private moderationPool: ClientPool<ModerationClient>;
    private enrichmentPool: ClientPool<EnrichmentClient>;

    constructor(embeddingClients: EmbeddingClient[], moderationClients: ModerationClient[], enrichmentClients: EnrichmentClient[],
                private logger?: Logger) {
        this.embeddingPool = new ClientPool(embeddingClients);
        this.moderationPool = new ClientPool(moderationClients);
        this.enrichmentPool = new ClientPool(enrichmentClients);

    }

    async performEmbedding(createEmbeddingRequest: EmbeddingCreateParams, options?: Core.RequestOptions, logMeta?: {
        [key: string]: string;
    }): Promise<CreateEmbeddingResponse> {
        this.logger?.debug("performEmbedding", logMeta);
        return await this.embeddingPool.execute(async (client) => {
            return await client.performEmbedding(createEmbeddingRequest, options);
        });
    }

    async performModeration(userRequest: string, logMeta?: { [key: string]: string; }): Promise<IsFlagged> {
        this.logger?.debug("performModeration", logMeta);
        return await this.moderationPool.execute(async (client) => {
            return await client.performModeration(userRequest);
        });
    }

    async createChatCompletion(createChatCompletionRequest: ChatCompletionCreateParamsBase, options?: Core.RequestOptions, logMeta?: {
        [key: string]: string;
    }): Promise<ChatCompletion> {
        this.logger?.debug("createChatCompletion", logMeta);
        return await this.enrichmentPool.execute(async (client) => {
            return await client.createChatCompletion({
                ...createChatCompletionRequest,
                stream: false,
            }, options)
        });
    }

    async createStreamingChatCompletion(createChatCompletionRequest: ChatCompletionCreateParamsBase, options?: Core.RequestOptions, logMeta?: {
        [key: string]: string;
    }): Promise<Stream<ChatCompletionChunk>> {
        this.logger?.debug("createStreamingChatCompletion", logMeta);
        return await this.enrichmentPool.execute(async (client) => {
            return client.createStreamingChatCompletion({
                ...createChatCompletionRequest,
                stream: true,
            } as ChatCompletionCreateParamsStreaming, options)
        });
    }

}
