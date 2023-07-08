import {CreateChatCompletionResponse} from "openai";
import {CreateChatCompletionRequest} from "openai/api";

export interface IAuditor {
    auditRequest: (p: {
        resultRaw: CreateChatCompletionResponse | undefined;
        result: { data: { content: any } } | { error: { message: string, details: any, receivedMessage?: string } };
        request: CreateChatCompletionRequest;
        requestType: string;
        requestSig: string
    }) => Promise<void>
}