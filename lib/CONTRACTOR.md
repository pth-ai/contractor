## Generate var arg generic interface for contractor 

```typescript
function generateInterface(n) {
    let result = "";

    for (let i = 1; i <= n; i++) {
        const types = Array.from({length: i}, (_, k) => 'T' + (k + 1)).join(', ');
        const names = Array.from({length: i}, (_, k) => 'N' + (k + 1) + ' extends string').join(', ');
        const functions = Array.from({length: i}, (_, k) => `ChatCompletionFunctionsWithTypes<T${k + 1}, N${k + 1}>`).join(', ');
        const results = Array.from({length: i}, (_, k) => `Result<T${k + 1}, N${k + 1}>`).join(' | ');
        
        result += `streamingFunction<${types}, ${names}, OUT>(systemMessage: string,
                    messages: RequestMessageFormat[],
                    model: GPTModelsAlias,
                    functions: [${functions}],
                    transformObjectStream: (streamingObject: ${results}) => Promise<OUT>,
                    responseSize?: number,
                    logMetaData?: MetaData,
                    requestOverrides?: Partial<CreateChatCompletionRequest>,
                    maxTokens?: number): Promise<NodeJS.ReadableStream | undefined>;\n\n`;
    }

    return result;
}

console.log(generateInterface(10));
```