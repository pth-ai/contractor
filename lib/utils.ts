import SparkMD5 from "spark-md5";

export function assertIsDefined<T>(value: T | null | undefined, errorMsg: string = 'value was not defined'): asserts value is T {
    if (value === null || value === undefined) {
        throw Error(errorMsg);
    }
}

const toBinary = (string: string) => {
    const codeUnits = Uint16Array.from(
        { length: string.length },
        (element, index) => string.charCodeAt(index)
    );
    const charCodes = new Uint8Array(codeUnits.buffer);

    let result = "";
    charCodes.forEach((char) => {
        result += String.fromCharCode(char);
    });
    return result;
};


export const toBase64 = (input: string) => btoa(toBinary(input));

export const stringToHashKey = (input: string) => toBase64(SparkMD5.hash(input).toString()).slice(0, 15);

export const delayedPromise = <T>(delayMS: number, action: () => Promise<T>): Promise<T> =>
    new Promise<T>((resolve, reject) => {
        const timer = setTimeout(() => {
            clearTimeout(timer);
            try {
                resolve(action());
            } catch (e) {
                reject(e)
            }
        }, delayMS);
    });

export const getRandomInt = (max: number): number => Math.floor(Math.random() * Math.floor(max));

const _retryPromise = async <T>(name: string, action: () => Promise<T>, maxRetries: number, attempt: number = 0, ignoreErrors?: (e: any) => boolean): Promise<T> => {
    try {
        return await action()
    } catch (e) {
        if (ignoreErrors && ignoreErrors(e)) {
            throw e;
        } else if (attempt >= maxRetries) {
            console.error(`max retries reached [${name}] error=[${String(e)}] (original error=[${String(e)}])`);
            throw e;
        } else {
            return await delayedPromise(1000 + getRandomInt(300), () => {
                console.debug(`_retryPromise [${name}] retrying..`);
                return _retryPromise(name, action, maxRetries, attempt + 1, ignoreErrors);
            });
        }
    }
};

export const retryPromise = <T>(name: string, action: () => Promise<T>, maxRetries: number, ignoreErrors?: (e: any) => boolean): Promise<T> =>
    _retryPromise(name, action, maxRetries, 0, ignoreErrors);

type NonFalsy<T> = T extends false ? never : T;

export const truthy = <T, RES>(t: T | null | undefined | false, action: (t: NonNullable<NonFalsy<T>>) => RES | undefined): RES | undefined =>
    (t !== null && t !== undefined && t !== false && action(t as NonNullable<NonFalsy<T>>) || undefined) || undefined;