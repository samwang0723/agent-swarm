import * as workflow from '@temporalio/workflow';

// Only import the activity types
import type * as activities from './temporal.activities';

// Load Activities and assign the Retry Policy
const { importGmail, importCalendar } = workflow.proxyActivities<
  typeof activities
>({
  retry: {
    initialInterval: '1 second', // amount of time that must elapse before the first retry occurs.
    maximumInterval: '1 minute', // maximum interval between retries.
    backoffCoefficient: 2, // how much the retry interval increases.
    maximumAttempts: 3, // maximum number of execution attempts.
  },
  startToCloseTimeout: '1 minute', // maximum time allowed for a single Activity Task Execution.
});

// The Temporal Workflow.
export async function syncGmail(
  token: string,
  userId: string
): Promise<string> {
  try {
    const result = await importGmail(token, userId);
    return `${userId} ${result}`;
  } catch (e) {
    throw new workflow.ApplicationFailure('Failed to sync Gmail');
  }
}

export async function syncCalendar(
  token: string,
  userId: string
): Promise<string> {
  try {
    const result = await importCalendar(token, userId);
    return `${userId} ${result}`;
  } catch (e) {
    throw new workflow.ApplicationFailure('Failed to sync Calendar');
  }
}
