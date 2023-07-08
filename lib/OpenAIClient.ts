import {AxiosPromise, AxiosRequestConfig} from "axios";
import {CreateChatCompletionRequest, CreateCompletionRequest} from "openai/api";
import {CreateChatCompletionResponse, CreateCompletionResponse, OpenAIApi} from "openai";
import {retryPromise} from "./utils";


export interface IOpenAIClient {
    createCompletion(createCompletionRequest: CreateCompletionRequest, options?: AxiosRequestConfig):
        AxiosPromise<CreateCompletionResponse>;

    createChatCompletion(createChatCompletionRequest: CreateChatCompletionRequest, options?: AxiosRequestConfig):
        AxiosPromise<CreateChatCompletionResponse>;

    createStreamingChatCompletion(createChatCompletionRequest: CreateChatCompletionRequest, options?: AxiosRequestConfig):
        AxiosPromise<CreateChatCompletionResponse>;

    performModeration(userRequest: string): Promise<IsFlagged>;

}

export type IsFlagged = boolean;

export class OpenAIClient implements IOpenAIClient {
    private openAIApi: OpenAIApi;


    constructor(openAIApi: OpenAIApi) {
        this.openAIApi = openAIApi;
    }

    performModeration(userRequest: string): Promise<IsFlagged> {
        return this.openAIApi.createModeration({input: userRequest})
            .then(_ => _.data.results[0].flagged)
    }

    createCompletion(createCompletionRequest: CreateCompletionRequest, options?: AxiosRequestConfig): AxiosPromise<CreateCompletionResponse> {
        return this.openAIApi.createCompletion(createCompletionRequest, options as any) as any;
    }

    createChatCompletion(createChatCompletionRequest: CreateChatCompletionRequest, options?: AxiosRequestConfig): AxiosPromise<CreateChatCompletionResponse> {
        return retryPromise('createChatCompletion', () => this.openAIApi.createChatCompletion(createChatCompletionRequest, options as any) as any, 3)
    }

    createStreamingChatCompletion(createChatCompletionRequest: CreateChatCompletionRequest, options?: AxiosRequestConfig): AxiosPromise<CreateChatCompletionResponse> {
        return retryPromise('createStreamingChatCompletion', () => this.openAIApi.createChatCompletion({
            ...createChatCompletionRequest,
            stream: true,
        }, {...options as any, responseType: 'stream'}), 3) as any;
    }

}