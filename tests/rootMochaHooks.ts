import {Context, Done} from "mocha";
import * as FakeTimers from "@sinonjs/fake-timers";

const clock = FakeTimers.install();

exports.mochaGlobalSetup = async function() {
    // ...
};

// export type InjectableContext = Readonly<{
//     // properties injected using the Root Mocha Hooks
// }>;

// TestContext will be used by all the test
// export type TestContext = Mocha.Context & ServerConfig;

export const mochaHooks = (): Mocha.RootHookObject => {
    return {
        beforeAll(this: Context, done: Done) {
            const context = {
                clock,
            };
            //
            Object.assign(this, context);
            done();
            // asynchronously initialize (testable) system components
        },
        beforeEach(this: Context) {
            // the contents of the Before Each hook
        },
        afterAll(this: Context) {
            // the contents of the After All hook
        },
        afterEach(this: Context) {
            // the contents of the After Each hook
        },
    };
}
