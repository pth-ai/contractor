# Contractor

[![NPM Version](https://img.shields.io/npm/v/package-name.svg)](https://www.npmjs.com/package/package-name)
[![License](https://img.shields.io/npm/l/package-name.svg)](https://github.com/your-username/package-name/blob/main/LICENSE)

## Description

Contractor is a purpose-built, open-source library created in TypeScript. Designed with a primary focus on streamlining the usage of [OpenAI's function calling](https://openai.com/blog/function-calling-and-other-api-updates) and enabling incremental, type-safe streaming of JSON outputs, Contractor seamlessly integrates AI functionality into a wide array of applications.

 - incremental & type-safe streaming of JSON output from functions (array elements streaming)
 - built-in auditing facility to log calls to OpenAI and keep track of token usage (streaming & sync)
 - Type-Safe IDE hinting for OpenAI functions and robust handling of data received from OpenAI
 - pluggable logging - wrap your logging library to pass on internal logs to your logging subsystem
 - graceful error handling and recovery (JSON issues, networking issues)

## Prerequisites

Before getting started with Contractor, you should ensure that you meet the following requirements:

 1. Language Compatibility: Contractor is written in TypeScript, offering the advantage of compile-time type safety with well-annotated code. However, it is also compatible with any JavaScript Node applications.
 2. Runtime Environment: The library has been developed and tested to work in Node.js. Compatibility with other runtimes has not been established.
 3. OpenAI API Key: To utilize this library, you'll need to have your own OpenAI API key.

## Installation

```shell
yarn add contractor
#or if you are using npm
npm install contractor
```

## Usage

Creating a `Contractor` instance

```typescript
const apiKey = process.env.OPENAI_API_KEY;

const logger = prefixedLogger('typedStreamingObjectWithAuditor'); // optional..

if (!apiKey) {
    throw new Error('OPENAI_API_KEY env var not provided');
}

const configuration = new Configuration({
    apiKey: apiKey, // your openai key..
});
const openaiClient = new OpenAIApi(configuration);
const client = new OpenAIClient(openaiClient);

const auditor: IAuditor<{ userId: string }> = {
    /**
     * @param record type AuditRecord<MetaData> = {
     *      resultRaw: CreateChatCompletionResponse | undefined;
     *      result: { data: { content: any } } | { error: { message: string, details: any, receivedMessage?: string } };
     *      request: CreateChatCompletionRequest;
     *      requestType: string;
     *      requestSig: string;
     *      metaData?: MetaData;
     *  }
     */
    auditRequest: record => {
        // write records of audit entries to db, use MetaData attribute to pass customerIds 
        // or other identifiers to associate record with business use 
        logger.info(`auditor record [${JSON.stringify(record)}]`)
    }
}; 

const contractor = new Contractor(
    client, // instance of OpenAIClient
    auditor, // OPTIONAL - count token usage and log responses
    800, // OPTIONAL (defaults to 8000)- max tokens per single request (request + response) 
    '<|+|>', // OPTIONAL (defaults to |{-*-}|) - seperator to use when using streaming 
    logger, // OPTIONAL - intercept interaly generated log entries 
);
```

Using `Contractor`

```typescript
// stream response
function streamingFunction(systemMessage: string,
                           messages: RequestMessageFormat[],
                           model: GPTModelsAlias, // gpt3/gpt4
                           functions: [ChatCompletionFunctionsWithTypes<T1, N1>], // array of functions to expose to GPT
                           transformObjectStream: (streamingObject: Result<T1, N1>) => Promise<OUT>, // handle resopnses from AI, make DB calls and pass on result downstream
                           responseSize?: number, // limit response size
                           logMetaData?: MetaData,
                           requestOverrides?: Partial<CreateChatCompletionRequest>, // override OpenAI arguments like top_p etc..
                           maxTokens?: number // limit total token usage for single call
): Promise<NodeJS.ReadableStream | undefined>;

// perform single function sync call (result returned via Promise)
function singleFunction<T>(systemMessage: string,
                           messages: RequestMessageFormat[],
                           model: GPTModelsAlias = 'gpt3', // gpt3/gpt4
                           gptFunction: {
                               name: string, // name of function
                               description: string; // helpful description
                               parameters: JSONSchemaType<T>; // JSPN schema to pass and validate against 
                           },
                           logMetaData?: MetaData,
                           requestOverrides?: Partial<CreateChatCompletionRequest>,
                           responseSize: number = 2000,
                           maxTokens: number = this.maxTokensPerRequest,
): Promise<T | undefined>;
```



## More Examples

Simple agent ([see full example](example/basic_agent.ts))

```typescript
const MathMultiplyOperation: JSONSchemaType<{ firstNumber: number, secondNumber: number }> = {
    type: "object",
    properties: {
        firstNumber: {type: "number", description: "first number"},
        secondNumber: {type: "number", description: "second number"},
    },
    required: ["firstNumber", "secondNumber"],
};

const MathAddOperation: JSONSchemaType<{ firstNumber: number, secondNumber: number }> = {
    type: "object",
    properties: {
        firstNumber: {type: "number", description: "first number"},
        secondNumber: {type: "number", description: "second number"},
    },
    required: ["firstNumber", "secondNumber"],
};

const FinalResultOperation: JSONSchemaType<{ finalResult: number }> = {
    type: "object",
    properties: {
        finalResult: {type: "number", description: "first number"},
    },
    required: ["finalResult"],
};

contractor.streamingFunction('you are a calculator agent',
    [{
        role: 'user', content: `your goal is: ${JSON.stringify(currentGoal)}
operations performed so far: ${operationsPerformed.map(_ => JSON.stringify(_)).join('\n')}`
    }],
    'gpt3',
    [
        {
            name: 'math_add_operation',
            description: 'add two numbers',
            parameters: MathAddOperation
        },
        {
            name: 'math_multiply_operation',
            description: 'multiply two numbers',
            parameters: MathMultiplyOperation
        },
        {
            name: 'final_result_operation',
            description: 'return final math result',
            parameters: FinalResultOperation
        },
    ],
    async streamingObject => {
        if (streamingObject.name === 'math_add_operation') {
            const opStack = [...operationsPerformed,
                {calculated: `${streamingObject.value.firstNumber}+${streamingObject.value.secondNumber}=${streamingObject.value.firstNumber + streamingObject.value.secondNumber}`}];
            performSingleOperation(currentGoal, opStack)
                .then(resolve, reject);
            return {
                "performed": streamingObject.value,
                "stack": opStack
            }
        } else if (streamingObject.name === 'math_multiply_operation') {
            const opStack = [...operationsPerformed,
                {calculated: `${streamingObject.value.firstNumber}*${streamingObject.value.secondNumber}=${streamingObject.value.firstNumber * streamingObject.value.secondNumber}`}];
            performSingleOperation(currentGoal, opStack)
                .then(resolve, reject);
            return {
                "performed": streamingObject.value,
                "stack": opStack
            }
        } else if (streamingObject.name === 'final_result_operation')
            resolve(`final result: ${JSON.stringify(streamingObject.value.finalResult)}`)
        return {
            "performed": streamingObject.value,
            "stack": operationsPerformed,
            "finalResult": streamingObject.value.finalResult
        }
    })

```

Incremental partial streaming ([see full example](example/typed_streaming_multiple_objects.ts))

```typescript

const StoryOutput: JSONSchemaType<{ title: string, lines: string[] }> = {
    type: "object",
    properties: {
        title: {type: "string"},
        lines: {type: "array", description: "story line", items: {"type": 'string'}},
    },
    required: ['title', 'lines'],
};


contractor.streamingFunction('you are a story teller',
    [{
        role: 'user',
        content: 'tell me a short story (50 lines) about an AI agent that went rogue, use available functions to answer'
    }],
    'gpt3',
    [
        {
            name: 'print_output',
            description: 'print content to user',
            parameters: StoryOutput,
            partialStreamPath: ['lines'],
        },
    ],
    async streamingObject => {
        return `story so far: ${streamingObject.value.title}\n${streamingObject.value.lines.join('\n')}`
    })

```


Using with Express server

```typescript
// your express app..
const expressApp = express();

const oaiConf = new Configuration({
    apiKey: process.env.OPENAI_API_KEY,
});

const openaiClient = new OpenAIApi(oaiConf);

const client = new OpenAIClient(openaiClient);

const contractor = new Contractor(client);

const AnswerSchema: JSONSchemaType<{ richMarkdownAnswer: string }> = {
    type: "object",
    properties: {
        richMarkdownAnswer: {type: "string", description: "richly markdown formatted answer"},
    },
    required: ["richMarkdownAnswer"],
};

expressApp.post('/ask-question-sync', async (req: Request, res: Response) => {
    const {question} = req.body;

    const value = await contractor.singleFunction("you are a calculator agent",
        [{role: 'user', content: 'what is the sum of 2+2?'}],
        'gpt3',
        {
            name: 'answer',
            description: 'return answer',
            parameters: AnswerSchema
        }
    );

    res.json({result: value?.richMarkdownAnswer ?? 'no answer :('})
})

expressApp.post('/ask-question-async', async (req: Request, res: Response) => {
    const {question} = req.body;

    contractor.streamingFunction(
        'you are a story teller', // system prompt
        [{
            role: 'user',
            content: 'tell me a short story (50 lines) about an AI agent that went rogue, use available functions to answer'
        }], // messages
        'gpt3', // or gpt4
        [
            {
                name: 'print_output',
                description: 'print content to user',
                parameters: StoryOutput,
                // this is the important bit, the path inside `{ title: string, lines: string[] }` 
                // that should be streamed as the array parts come.. 
                partialStreamPath: ['lines'],
            },
        ], // array of functions to pass to ai, in the 
        async streamingObject => {
            return `story so far: ${streamingObject.value.title}\n${streamingObject.value.lines.join('\n')}`
        }
    ).then(stream => {
        stream && stream.pipe(res);
    });

})
```

For more examples see the `example` directory.

## Bells and whistles

Some additional plug-and-play stuff you will need to get stuff done, like tests or your own use cases

### `StreamListenerTransform`

Place an instance of this class in a stream to intercept chunks

```typescript
import {pipeline} from "stream";
const stream = ...;

const listener = new StreamListenerTransform((x) => console.log("look what I got!", x));
pipeline(stream,
        listener,
        downstream,...)
```

### `SimpleStreamTransform`

Place an instance of this class to manipulate chunks

```typescript
import {pipeline} from "stream";
const stream = ...;

// transform here will transform incoming string chunks by trimming them 
const tranform = new SimpleStreamTransform((input: string) => input.trim());
pipeline(stream,
        tranform,
        downstream,...)
```

### `StreamMITMTransform` 

Place an instance of this class to intercept string stream of stringified json, call a transform function (passed via constructor) and stringify back the result "down pipe".   

```typescript
import {pipeline} from "stream";
const stream = ...;

// transform here will transform incoming string chunks by trimming them 
const tranform = new StreamMITMTransform((input: {text: string}) => input.text.trim());
pipeline(stream,
        tranform,
        downstream,...)
```

### `gptUtils` - useful stuff 

```typescript
import {gptUtils} from "contractor";

// truncate some string to certain size of tokens
const input = "Alfalfa sprouts bananas chili roasted brussel sprouts fig arugula cashew salad dill main course chili pepper cashew creamiest edamame chocolate.";
const model = "gpt3" // or "gpt4"
const maxTokenSize = 10;
const truncatedString = gptUtils.truncateInput(input, model, maxTokenSize);
console.log(`we truncated input [${input}] to size [${maxTokenSize}] and `)

const tokenCount = gptUtils.countTokens(input, model);
console.log(`for string [${input}] we counted [${tokenCount}] tokens!`);
```

## Running tests

```shell
yarn test
```

## Developing & testing module locally

```shell
cd contractor
yarn link
cd <your project>
yarn link contractor
```
## Contributing

We appreciate any contribution to Contractor, and thank you for your interest in improving this open-source project! Here's how you can contribute:

 * Fork the Repository: Start by forking the Contractor repository to your own GitHub account.

 * Clone the Repository: Clone the forked repository to your local machine and create a new branch for your feature or fix.

```shell
git clone https://github.com/<your-username>/contractor
git checkout -b name-of-your-branch
```

 * Make Changes: Implement your new feature or bug fix, making sure to add or update any relevant tests.

 * Run the Tests: Ensure that all tests pass with your changes.

```shell
yarn test
```

 * Push to GitHub: Push your changes and your new branch to your forked repository.


```shell
git push origin name-of-your-branch
```

 * Create a Pull Request: Navigate to your forked repository on GitHub and create a new pull request from your branch to the main branch of the Contractor repository.


In your pull request, please provide a clear description of the changes you've made. The more information you can provide, the easier it will be for us to review and accept your contribution.

Before submitting a pull request, please ensure that your code follows the existing style in the codebase.

Thank you for considering a contribution to Contractor. We're looking forward to your pull request!
