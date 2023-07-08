import {encoding_for_model} from "@dqbd/tiktoken";

import {Logger} from "./Logger";

export type GPTModelsAlias = 'gpt3' | 'gpt4';
export type GPTModels = 'gpt-3.5-turbo-0613' | 'gpt-4-0613' | 'gpt-3.5-turbo-16k-0613';
export const largeModel = (model: GPTModels): GPTModels => {
    switch (model) {
        case "gpt-3.5-turbo-0613":
            return "gpt-3.5-turbo-16k-0613";
        case "gpt-4-0613":
            return "gpt-4-0613";
        case "gpt-3.5-turbo-16k-0613":
            return "gpt-3.5-turbo-16k-0613";
    }
}

export const getModelForAlias = (alias: GPTModelsAlias): GPTModels => {
    switch (alias) {
        case "gpt3":
            return 'gpt-3.5-turbo-0613';
        case "gpt4":
            return 'gpt-4-0613';
    }
}

export function countTokens(input: string, model: GPTModels, logger?: Logger) {
    const tokenize = encoding_for_model(model === 'gpt-3.5-turbo-0613' ? 'gpt-3.5-turbo' : 'gpt-4-0314');
    try {
        return tokenize.encode(input).length;
    } catch (e) {
        logger?.error('error counting tokens for input', e);
        throw new Error('error counting tokens for input')
    } finally {
        tokenize.free();
    }

}

export function truncateInput(input: string,
                              model: GPTModelsAlias,
                              maxSize: number,
                              logger?: Logger) {
    const tokenize = encoding_for_model(getModelForAlias(model) === 'gpt-3.5-turbo-0613' ? 'gpt-3.5-turbo' : 'gpt-4-0314');
    try {
        return new TextDecoder().decode(tokenize.decode(tokenize.encode(input).slice(0, maxSize)));
    } catch (e) {
        logger?.error('error truncating input', e);
        throw new Error('error truncating input');
    } finally {
        tokenize.free();
    }

}


