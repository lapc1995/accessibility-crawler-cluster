import { Mutex } from 'async-mutex';
const mutex = new Mutex();

export let doneCount = 0
export let failedCount = 0
export let successCount = 0

export async function incrementSuccessCount() {
    await mutex.runExclusive(() => {
        successCount++;
        doneCount++;
    });
}

export async function incrementFailedCount() {
    await mutex.runExclusive(() => {
        failedCount++;
        doneCount++;
    });
}

export async function resetCounters() {
    await mutex.runExclusive(() => {
        doneCount = 0;
        failedCount = 0;
        successCount = 0;
    });
}
