import {InstalledClock} from "@sinonjs/fake-timers";
import {Transform} from "stream";

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


export const setSystemTime = (clock: InstalledClock, date: Date) => {
    console.info(`setting system time.. new: [${date.toString()}] old [${new Date().toString()}]`);
    clock.setSystemTime(date);
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

export function reduceAndTrim(input: string): string {
    // Remove trailing spaces from each line
    let trimmedLines = input.split('\n')
        .filter(_ => !!_.trim())
        .map(line => line.trim().replace(/\s+$/, ''));

    // Reduce consecutive characters and join the lines back
    return trimmedLines.map(line => line.replace(/\s{2,}/g, ' ')).join('\n');
}