import {ChatCompletion, ChatCompletionCreateParamsBase} from "openai/resources/chat/completions";
import {CreateEmbeddingResponse, EmbeddingCreateParams} from "openai/resources/embeddings";

export type AuditRecord<MetaData> = {
    resultRaw: ChatCompletion | CreateEmbeddingResponse | undefined;
    result: { data: { content: any } } | { error: { message: string, details: any, receivedMessage?: string } };
    request: ChatCompletionCreateParamsBase | EmbeddingCreateParams;
    requestType: string;
    requestSig: string;
    metaData?: MetaData;
    isFromCache?: boolean;
}

export interface IAuditor<MetaData> {
    /**
     * @param record
     */
    auditRequest: (record: AuditRecord<MetaData>) => Promise<void>
}
