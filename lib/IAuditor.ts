import {CreateChatCompletionResponse, CreateEmbeddingRequest, CreateEmbeddingResponse} from "openai";
import {CreateChatCompletionRequest} from "openai/api";

export type AuditRecord<MetaData> = {
    resultRaw: CreateChatCompletionResponse | CreateEmbeddingResponse | undefined;
    result: { data: { content: any } } | { error: { message: string, details: any, receivedMessage?: string } };
    request: CreateChatCompletionRequest | CreateEmbeddingRequest;
    requestType: string;
    requestSig: string;
    metaData?: MetaData;
}

export interface IAuditor<MetaData> {
    /**
     * @param record
     */
    auditRequest: (record: AuditRecord<MetaData>) => Promise<void>
}