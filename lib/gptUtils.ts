import {encoding_for_model} from "@dqbd/tiktoken";

import {Logger} from "./Logger";


export type GPTModels =
    'gpt-3.5-turbo-0613'
    | 'gpt-4-1106-preview'
    | 'gpt-3.5-turbo-16k-0613'
    | 'gpt-3.5-turbo-1106'
    | 'gpt-4-turbo-2024-04-09'
    | string;
export const largeModel = (model: GPTModels): GPTModels => {
    switch (model) {
        case "gpt-3.5-turbo-0613":
            return "gpt-3.5-turbo-16k-0613";
        case "gpt-3.5-turbo-1106":
            return "gpt-3.5-turbo-1106";
        case "gpt-4-1106-preview":
            return "gpt-4-1106-preview";
        case "gpt-4-turbo-2024-04-09":
            return "gpt-4-turbo-2024-04-09";
        case "gpt-3.5-turbo-16k-0613":
            return "gpt-3.5-turbo-16k-0613";
        default:
            return model;
    }
}

export function countTokens(input: string, model: GPTModels, logger?: Logger) {
    const tokenize = encoding_for_model(model === 'gpt-3.5-turbo-0613' ? 'gpt-3.5-turbo' : 'gpt-4');
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
                              model: GPTModels,
                              maxSize: number,
                              logger?: Logger) {
    const tokenize = encoding_for_model(model.startsWith('gpt-3') ? 'gpt-3.5-turbo' : 'gpt-4');
    try {
        return new TextDecoder().decode(tokenize.decode(tokenize.encode(input).slice(0, maxSize)));
    } catch (e) {
        logger?.error('error truncating input', e);
        throw new Error('error truncating input');
    } finally {
        tokenize.free();
    }

}

type Vector = number[];

/**
 * Combine two vectors by applying weights and adding them together.
 *
 * @param {Vector} v1 - The first vector to combine. This is typically the category embedding vector.
 * @param {Vector} v2 - The second vector to combine. This is typically the keyword embedding vector.
 * @param {number} w1 - The weight to apply to the first vector (v1). This must be between 0 and 1.
 *
 * @returns {Vector} The combined vector.
 *
 * @throws {Error} If the two vectors have different lengths.
 *
 * @typedef {number[]} Vector - A vector is represented as an array of numbers.
 *
 * This function takes two vectors and a weight for the first vector, and combines them into a single vector.
 * The vectors should be the same length, and they should typically be embedding vectors produced by a machine learning model.
 * The weight for the second vector is implicitly set to be (1 - w1), so the weights for the two vectors always add up to 1.
 */
export function combineVectors(v1: Vector, v2: Vector, w1: number): Vector {
    if (v1.length !== v2.length) {
        throw new Error("Vectors must be the same length");
    }

    const w2 = 1 - w1;
    const result: Vector = [];

    for (let i = 0; i < v1.length; i++) {
        result.push(w1 * v1[i] + w2 * v2[i]);
    }

    return result;
}
