import {ChatCompletion, ChatCompletionCreateParamsBase} from "openai/resources/chat/completions";
import {CreateEmbeddingResponse, EmbeddingCreateParams} from "openai/resources/embeddings";


export interface ICacher {
    /**
     * make sure when `request` comes back from cache, it must have {isFromCache: true}
     * @param request
     */
    retrieveRequestFromCache: (request: ChatCompletionCreateParamsBase) => Promise<(ChatCompletion & {
        isFromCache: true
    }) | undefined>;
    cacheRequest: (response: ChatCompletion, request: ChatCompletionCreateParamsBase) => Promise<void>;

    /**
     * make sure when `request` comes back from cache, it must have {isFromCache: true}
     * @param request
     */
    retrieveEmbeddingFromCache: (request: EmbeddingCreateParams) => Promise<(CreateEmbeddingResponse & {
        isFromCache: true
    }) | undefined>;
    cacheEmbedding: (response: CreateEmbeddingResponse, request: EmbeddingCreateParams, ) => Promise<void>;


}
