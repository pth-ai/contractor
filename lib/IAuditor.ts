import {CreateChatCompletionResponse} from "openai";
import {CreateChatCompletionRequest} from "openai/api";

export type AuditRecord<MetaData> = {
    resultRaw: CreateChatCompletionResponse | undefined;
    result: { data: { content: any } } | { error: { message: string, details: any, receivedMessage?: string } };
    request: CreateChatCompletionRequest;
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