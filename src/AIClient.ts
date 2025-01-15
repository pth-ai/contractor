import {
    ChatCompletion,
    ChatCompletionChunk,
    ChatCompletionCreateParamsBase,
    ChatCompletionCreateParamsStreaming
} from "openai/resources/chat/completions";
import * as Core from "openai/core";
import {CreateEmbeddingResponse, EmbeddingCreateParams} from "openai/resources/embeddings";
import {Stream} from "openai/streaming";
import {ModerationCreateParams, ModerationCreateResponse} from "openai/resources/moderations";
import {Logger} from "useful";


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

    performModeration(body: ModerationCreateParams, options?: Core.RequestOptions, logMeta?: {
        [key: string]: string;
    }): Promise<ModerationCreateResponse>;

}

export interface EmbeddingClient {
    performEmbedding(createEmbeddingRequest: EmbeddingCreateParams, options?: Core.RequestOptions): Core.APIPromise<CreateEmbeddingResponse>;
}

export interface ModerationClient {
    performModeration(body: ModerationCreateParams, options?: Core.RequestOptions): Core.APIPromise<ModerationCreateResponse>
}

export interface EnrichmentClient extends ClientRecovery {
    createChatCompletion(createChatCompletionRequest: ChatCompletionCreateParamsBase, options?: Core.RequestOptions): Core.APIPromise<ChatCompletion>;

    createStreamingChatCompletion(createChatCompletionRequest: ChatCompletionCreateParamsBase, options?: Core.RequestOptions): Core.APIPromise<Stream<ChatCompletionChunk>>;
}

export interface ClientRecovery {
    onChatCompletionFail?(error: any, origRequest: {
        createChatCompletionRequest: ChatCompletionCreateParamsBase,
        options?: Core.RequestOptions, logMeta?: {
            [key: string]: string;
        }
    }): Promise<ChatCompletion>;
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

type ClientProviders = EmbeddingClient | EnrichmentClient | ModerationClient;

interface ClientProvider<T extends ClientProviders> {
    clients: T[];
    models: string[];
    clientPoolSize?: number;
}

export class AIClient implements IAIClient {

    private embeddingPoolMap: Map<string, ClientPool<EmbeddingClient>>;
    private moderationPoolMap: Map<string, ClientPool<ModerationClient>>;
    private enrichmentPoolMap: Map<string, ClientPool<EnrichmentClient>>;

    constructor(embeddingProviders: ClientProvider<EmbeddingClient>[],
                moderationProviders: ClientProvider<ModerationClient>[],
                enrichmentProviders: ClientProvider<EnrichmentClient>[], private logger?: Logger) {

        // Initialize pool maps
        this.embeddingPoolMap = this.initializePoolMap<EmbeddingClient>(embeddingProviders);
        this.moderationPoolMap = this.initializePoolMap<ModerationClient>(moderationProviders);
        this.enrichmentPoolMap = this.initializePoolMap<EnrichmentClient>(enrichmentProviders);
    }

    private initializePoolMap<T extends ClientProviders>(providers: ClientProvider<T>[]): Map<string, ClientPool<T>> {
        const poolMap = new Map<string, ClientPool<T>>();
        providers.forEach(provider => {
            const pool = new ClientPool<T>(provider.clients);
            provider.models.forEach(model => {
                poolMap.set(model, pool); // Associate all models with the same pool
            });
        });
        return poolMap;
    }


    async performEmbedding(createEmbeddingRequest: EmbeddingCreateParams, options?: Core.RequestOptions, logMeta?: {
        [key: string]: string;
    }): Promise<CreateEmbeddingResponse> {
        this.logger?.debug("performEmbedding", logMeta);
        const model = createEmbeddingRequest.model;
        const pool = this.embeddingPoolMap.get(model); // Get the pool associated with the model
        if (!pool) {
            this.logger?.error(`No client pool available for model ${model}`, {}, logMeta)
            throw new Error(`No client pool available for model ${model}`);
        }
        return await pool.execute(async (client) => {
            return await client.performEmbedding(createEmbeddingRequest, options);
        })
    }

    async performModeration(body: ModerationCreateParams, options?: Core.RequestOptions, logMeta?: {
        [key: string]: string;
    }): Promise<ModerationCreateResponse> {
        this.logger?.debug("performModeration", logMeta);
        const model = body.model;
        const pool = this.moderationPoolMap.get(model ?? 'text-moderation-latest'); // Get the pool associated with the model
        if (!pool) {
            this.logger?.error(`No client pool available for model ${model}`, {}, logMeta);
            throw new Error(`No client pool available for model ${model}`);
        }
        return await pool.execute(async (client) => {
            return await client.performModeration(body, options);
        });
    }

    async createChatCompletion(createChatCompletionRequest: ChatCompletionCreateParamsBase, options?: Core.RequestOptions, logMeta?: {
        [key: string]: string;
    }): Promise<ChatCompletion> {
        this.logger?.debug("createChatCompletion", logMeta);
        const model = createChatCompletionRequest.model;
        const pool = this.enrichmentPoolMap.get(model); // Get the pool associated with the model
        if (!pool) {
            this.logger?.error(`No client pool available for model ${model}`, {}, logMeta);
            throw new Error(`No client pool available for model ${model}`);
        }
        return await pool.execute(async (client) => {
            try {
                return await client.createChatCompletion({
                    ...createChatCompletionRequest,
                    stream: false,
                }, options);
            } catch (reason: any) {
                if (client.onChatCompletionFail) {
                    return await client.onChatCompletionFail(reason, {
                        createChatCompletionRequest,
                        options,
                        logMeta
                    });
                } else {
                    throw reason;
                }

            }

        });
    }

    async createStreamingChatCompletion(createChatCompletionRequest: ChatCompletionCreateParamsBase, options?: Core.RequestOptions, logMeta?: {
        [key: string]: string;
    }): Promise<Stream<ChatCompletionChunk>> {
        this.logger?.debug("createStreamingChatCompletion", logMeta);
        const model = createChatCompletionRequest.model;
        const pool = this.enrichmentPoolMap.get(model); // Get the pool associated with the model
        if (!pool) {
            this.logger?.error(`No client pool available for model ${model}`, {}, logMeta);
            throw new Error(`No client pool available for model ${model}`);
        }
        return await pool.execute(async (client) => {
            return client.createStreamingChatCompletion({
                ...createChatCompletionRequest,
                stream: true,
            } as ChatCompletionCreateParamsStreaming, options);
        });
    }

}
