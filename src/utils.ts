import SparkMD5 from "spark-md5";

export function assertIsDefined<T>(value: T | null | undefined, errorMsg: string = 'value was not defined'): asserts value is T {
    if (value === null || value === undefined) {
        throw Error(errorMsg);
    }
}

const toBinary = (string: string) => {
    const codeUnits = Uint16Array.from(
        { length: string.length },
        (_element, index) => string.charCodeAt(index)
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

type NonFalsy<T> = T extends false ? never : T;

export const truthy = <T, RES>(t: T | null | undefined | false, action: (t: NonNullable<NonFalsy<T>>) => RES | undefined): RES | undefined =>
    (t !== null && t !== undefined && t !== false && action(t as NonNullable<NonFalsy<T>>) || undefined) || undefined;
