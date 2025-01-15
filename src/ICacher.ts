import {ChatCompletion, ChatCompletionCreateParamsBase} from "openai/resources/chat/completions";
import {CreateEmbeddingResponse, EmbeddingCreateParams} from "openai/resources/embeddings";


export interface ICacher {
    /**
     * make sure when `request` comes back from cache, it must have {isFromCache: true}
     * @param request
     */
    retrieveRequestFromCache: (request: ChatCompletionCreateParamsBase,
                               logMeta?: { [key: string]: string; }) => Promise<(ChatCompletion & {
        isFromCache: true
    }) | undefined>;
    cacheRequest: (response: ChatCompletion, request: ChatCompletionCreateParamsBase,
                   logMeta?: { [key: string]: string; }) => Promise<void>;

    /**
     * make sure when `request` comes back from cache, it must have {isFromCache: true}
     * @param request
     */
    retrieveEmbeddingFromCache: (request: EmbeddingCreateParams,
                                 logMeta?: { [key: string]: string; }) => Promise<(CreateEmbeddingResponse & {
        isFromCache: true
    }) | undefined>;
    cacheEmbedding: (response: CreateEmbeddingResponse, request: EmbeddingCreateParams,
                     logMeta?: { [key: string]: string; }) => Promise<void>;


}
