import {Pg} from "../src/dal/db";
import {getServerConfig} from "../src/ServerConfig";
import {IMailer} from "../src/util/Mailer";
import SGResponse from "@sendgrid/helpers/classes/response";
import {hasKeyDefined} from "../../frontend/src/utils/tsUtils";
import {
    IYielderClient,
    PlansReport,
} from "../src/dal/clients/YielderClient";
import {YielderProcess} from "../../frontend/src/model/YielderProcess";
import {TeamsDAO} from "../src/dal/DAO/TeamsDAO";
import {UsersDAO} from "../src/dal/DAO/UsersDAO";
import {ICommunications} from "../src/dal/managers/CommunicationManager";
import {IsFlagged} from "../src/dal/clients/OpenAIClient";
import {InstalledClock} from "@sinonjs/fake-timers";
import {Configuration, CreateChatCompletionResponse, CreateCompletionResponse, OpenAIApi} from "openai";
import {IOpenAIClient} from "../src/dal/clients/OpenAIClient";
import {CreateChatCompletionRequest, CreateCompletionRequest} from "openai/api";
import {AxiosPromise, AxiosRequestConfig, AxiosResponse} from "axios";
import {Transform} from "stream";
import * as stream from "stream";
import {MigrationDAO} from "../src/dal/DAO/MigrationDAO";

export const config = getServerConfig();
export const pg = Pg.default({...config, POSTGRES_POOL_MAX: 10});

export const fakeILSRate = 3.5;

export type StubCommunicationsOverrides = { [K in keyof ICommunications]?: ICommunications[K] };
export const stubCommunications = (overrides?: StubCommunicationsOverrides, mailer?: IMailer): ICommunications => {
    return {
        sendInternalSystemAlert(subject: string, content: string): Promise<[SGResponse, {}] | void> {
            if (overrides && hasKeyDefined(overrides, 'sendInternalSystemAlert')) {
                return overrides['sendInternalSystemAlert'](subject, content);
            } else if (mailer?.sendInternalSystemAlert) {
                return mailer?.sendInternalSystemAlert(subject, content)
            } else {
                throw new Error(`not implemented in stub @[${JSON.stringify(arguments)}]`);
            }
        },
        sendOnboardingEmail(confirmationToken: string, userEmail: string, confirmationCode: number): Promise<[SGResponse, {}] | void> {
            if (overrides && hasKeyDefined(overrides, 'sendOnboardingEmail')) {
                return overrides['sendOnboardingEmail'](confirmationToken, userEmail, confirmationCode);
            } else {
                throw new Error(`not implemented in stub @[${JSON.stringify(arguments)}]`);
            }
        },
        sendResetPassword(userEmail: string, token: string): Promise<[SGResponse, {}] | void> {
            if (overrides && hasKeyDefined(overrides, 'sendResetPassword')) {
                return overrides['sendResetPassword'](userEmail, token);
            } else {
                throw new Error(`not implemented in stub @[${JSON.stringify(arguments)}]`);
            }
        },
        sendSupportRequest(name: string, contactReason: string, email: string, teamId: string, userId: string, userPlanId: string, message: string): Promise<void> {
            if (overrides && hasKeyDefined(overrides, 'sendSupportRequest')) {
                return overrides['sendSupportRequest'](name, contactReason, email, teamId, userId, userPlanId, message);
            } else {
                throw new Error(`not implemented in stub @[${JSON.stringify(arguments)}]`);
            }
        },
    }
}

export type StubOpenAIAPIOverrides = { [K in keyof IOpenAIClient]?: IOpenAIClient[K] };
export const stubOpenAIClient = (overrides?: StubOpenAIAPIOverrides): IOpenAIClient => {
    return {
        createCompletion(createCompletionRequest: CreateCompletionRequest, options?: AxiosRequestConfig): Promise<AxiosResponse<CreateCompletionResponse, any>> {
            if (overrides && hasKeyDefined(overrides, 'createCompletion')) {
                return overrides['createCompletion'](createCompletionRequest, options);
            } else {
                throw new Error(`not implemented in stub @[${JSON.stringify(arguments)}]`);
            }
        },
        createChatCompletion(createChatCompletionRequest: CreateChatCompletionRequest, options?: AxiosRequestConfig): Promise<AxiosResponse<CreateChatCompletionResponse, any>> {
            if (overrides && hasKeyDefined(overrides, 'createChatCompletion')) {
                return overrides['createChatCompletion'](createChatCompletionRequest, options);
            } else {
                throw new Error(`not implemented in stub @[${JSON.stringify(arguments)}]`);
            }
        },
        createStreamingChatCompletion(createChatCompletionRequest: CreateChatCompletionRequest, options?: AxiosRequestConfig): AxiosPromise<CreateChatCompletionResponse> {
            if (overrides && hasKeyDefined(overrides, 'createStreamingChatCompletion')) {
                return overrides['createStreamingChatCompletion'](createChatCompletionRequest, options);
            } else {
                throw new Error(`not implemented in stub @[${JSON.stringify(arguments)}]`);
            }
        },
        performModeration(userRequest: string): Promise<IsFlagged> {
            if (overrides && hasKeyDefined(overrides, 'performModeration')) {
                return overrides['performModeration'](userRequest);
            } else {
                throw new Error(`not implemented in stub @[${JSON.stringify(arguments)}]`);
            }
        }

    }
}

export type StubMailerOverrides = { [K in keyof IMailer]?: IMailer[K] };
export const stubMailer = (overrides?: StubMailerOverrides): IMailer => {
    return {


        sendInternalSystemAlert(subject: string, content: string): Promise<[SGResponse, {}] | void> {
            if (overrides && hasKeyDefined(overrides, 'sendInternalSystemAlert')) {
                return overrides['sendInternalSystemAlert'](subject, content);
            } else {
                throw new Error(`not implemented in stub @[${JSON.stringify(arguments)}]`);
            }
        },
        sendOnboardingEmail(confirmationToken: string, userEmail: string, confirmationCode: number): Promise<[SGResponse, {}] | void> {
            if (overrides && hasKeyDefined(overrides, 'sendOnboardingEmail')) {
                return overrides['sendOnboardingEmail'](confirmationToken, userEmail, confirmationCode);
            } else {
                throw new Error(`not implemented in stub @[${JSON.stringify(arguments)}]`);
            }
        },
        sendResetPassword(userEmail: string, token: string): Promise<[SGResponse, {}] | void> {
            if (overrides && hasKeyDefined(overrides, 'sendResetPassword')) {
                return overrides['sendResetPassword'](userEmail, token);
            } else {
                throw new Error(`not implemented in stub @[${JSON.stringify(arguments)}]`);
            }
        },
        sendSupportRequest(name: string, contactReason: string, email: string, teamId: string, userId: string, userPlanId: string, message: string): Promise<void> {
            if (overrides && hasKeyDefined(overrides, 'sendSupportRequest')) {
                return overrides['sendSupportRequest'](name, contactReason, email, teamId, userId, userPlanId, message);
            } else {
                throw new Error(`not implemented in stub @[${JSON.stringify(arguments)}]`);
            }
        },
        sendUserSystemAlert(teamId: string, subject: string, content: string): Promise<void> {
            if (overrides && hasKeyDefined(overrides, 'sendUserSystemAlert')) {
                return overrides['sendUserSystemAlert'](teamId, subject, content);
            } else {
                throw new Error(`not implemented in stub @[${JSON.stringify(arguments)}]`);
            }
        },

    }
}

export type StubYielderClientOverdies = { [K in keyof IYielderClient]?: IYielderClient[K] };
export const stubYielderClient = (overrides?: StubYielderClientOverdies): IYielderClient => {
    return {
        deleteProcess(processId: string): Promise<void> {
            if (overrides && hasKeyDefined(overrides, 'getPlansReport')) {
                return overrides['deleteProcess'](processId)
            } else {
                throw new Error(`not implemented in stub @[${JSON.stringify(arguments)}]`);
            }
        },
        getPlansReport(): Promise<PlansReport> {
            if (overrides && hasKeyDefined(overrides, 'getPlansReport')) {
                return overrides['getPlansReport']()
            } else {
                throw new Error(`not implemented in stub @[${JSON.stringify(arguments)}]`);
            }
        },
        getAllProcesses(): Promise<YielderProcess[]> {
            if (overrides && hasKeyDefined(overrides, 'getAllProcesses')) {
                return overrides['getAllProcesses']()
            } else {
                throw new Error(`not implemented in stub @[${JSON.stringify(arguments)}]`);
            }
        },
        getProcess(processId: string): Promise<YielderProcess | undefined> {
            if (overrides && hasKeyDefined(overrides, 'getProcess')) {
                return overrides['getProcess'](processId)
            } else {
                throw new Error(`not implemented in stub @[${JSON.stringify(arguments)}]`);
            }
        },
        setEnableProcess(processName: string, isEnabled: boolean): Promise<void> {
            if (overrides && hasKeyDefined(overrides, 'getPlansReport')) {
                return overrides['setEnableProcess'](processName, isEnabled)
            } else {
                throw new Error(`not implemented in stub @[${JSON.stringify(arguments)}]`);
            }
        }


    }
}


export const TestTimes = {
    t0: new Date(Date.UTC(2021, 10)),
    t0_5: new Date(Date.UTC(2021, 10, 15)),
    t0_end: new Date(Date.UTC(2021, 10, 30)),
    t1: new Date(Date.UTC(2021, 11)),
    t2: new Date(Date.UTC(2022, 0)),
    t2_5: new Date(Date.UTC(2022, 0, 15)),
    t3: new Date(Date.UTC(2022, 1)),
    t4: new Date(Date.UTC(2022, 2)),
}

export const TestTeams = {
    team1Id: "team1Id",
    team2Id: "team2Id",
    team3Id: "team3Id",
    team4Id: "team4Id",
}

export const TestWorkspaces = {
    workspace1: "test-workspace-1",
    workspace2: "test-workspace-2",
    workspace3: "test-workspace-3",
}


const migrationsDAO = new MigrationDAO(pg.db, pg.pgp)
const teamDAO = new TeamsDAO(pg.db, pg.pgp)
const usersDAO = new UsersDAO(pg.db, pg.pgp, migrationsDAO)

const DAOs = {
    teamDAO,
    usersDAO,
}

export const daosCleanup = async () => {
    const daos = Object.values(DAOs);
    for (const dao of daos) {
        await dao.testCleanup();
        await dao.initialize();
    }
}

export const getDaos = () => DAOs;

export const setSystemTime = (clock: InstalledClock, date: Date) => {
    console.info(`setting system time.. new: [${date.toString()}] old [${new Date().toString()}]`);
    clock.setSystemTime(date);
}

export const createTestUser = async () => {
    const {teamId} = await teamDAO.createTeam('tmp-id');
    const {newUserId} = await usersDAO.create("test@test.com", "test", 'Asia/Jerusalem', teamId);
    await teamDAO.setMainUserId(teamId, newUserId);

    return {teamId, newUserId};
}

export const bootstrapManagers = ({useRealBlueSnapClient}: { useRealBlueSnapClient?: boolean }) => {
    const yielderClientStub: { [K in keyof IYielderClient]?: IYielderClient[K] } = {};
    const yielderClient = stubYielderClient(yielderClientStub);
    const mailerOverrides = stubMailer();

    const communicationsStub = stubCommunications(undefined, mailerOverrides);
    const configuration = new Configuration({
        apiKey: config.OPENAI_API_KEY,
    });
    const openAiClient = new OpenAIApi(configuration);
    const openAPIClientStub: StubOpenAIAPIOverrides = {};
    const mockOpenAPIClient = stubOpenAIClient(openAPIClientStub)


    return {
        openAPIClientStub,
        mockOpenAPIClient,
        yielderClientStub,
        yielderClient,
        mailerOverrides,
        communicationsStub,
        openAiClient,
    }
}

export const waitForCondition = (checkCondition: () => boolean, intervalMs: number = 100) => {
    return new Promise((resolve) => {
        const checkAndResolve = () => {
            if (checkCondition()) {
                resolve(true);
            } else {
                setTimeout(checkAndResolve, intervalMs);
            }
        };
        checkAndResolve();
    });
};

export class SplitStreamLines extends Transform {
    _transform(chunk: any, encoding: string, callback: Function) {
        for (const line of chunk.toString().split('\n')) {
            this.push(line);
        }
        callback();
    }
}


export class StreamDebugger extends stream.Transform {
    private name: string;
    private terminateStream: boolean;

    constructor(name: string, terminateStream: boolean = false) {
        super({objectMode: true});
        this.name = name;
        this.terminateStream = terminateStream;
    }

    _transform(chunk: any, encoding: string, callback: Function) {
        console.debug(`[${this.name}] passing data [${JSON.stringify(chunk)}]`);
        if (!this.terminateStream) {
            this.push(chunk);
        }
        callback();
    }
}

export class StreamReader<T> extends Transform {
    private consumer: (input: T) => void;

    constructor(consumer: (input: T) => void) {
        super({objectMode: true});
        this.consumer = consumer;
    }

    _transform(chunk: T, encoding: string, callback: Function) {
        this.consumer(chunk);
        this.push(chunk);
        callback();
    }
}