import {
  Connection,
  Client,
  WorkflowExecutionAlreadyStartedError,
} from '@temporalio/client';
import { syncGmail, syncCalendar } from '@/features/tasks/temporal.workflows';
import config from '@/shared/config';
import { nanoid } from 'nanoid';

export const syncGmailTask = async (
  token: string,
  userId: string
): Promise<string> => {
  const connection = await Connection.connect({
    address: config.temporal.address,
  });

  try {
    const client = new Client({ connection });

    // Start a one-off workflow for immediate sync
    const handle = await client.workflow.start(syncGmail, {
      taskQueue: config.temporal.taskQueue,
      args: [token, userId],
      workflowId: 'importGmail-' + nanoid(),
    });

    try {
      // Start the cron workflow
      await client.workflow.start(syncGmail, {
        cronSchedule: '*/10 * * * *',
        taskQueue: config.temporal.taskQueue,
        args: [token, userId],
        workflowId: `importGmail-cron-${userId}`,
      });
    } catch (e) {
      if (!(e instanceof WorkflowExecutionAlreadyStartedError)) {
        throw e;
      }
      // If it's already started, we can ignore the error.
    }

    return handle.workflowId;
  } finally {
    await connection.close();
  }
};

export const syncCalendarTask = async (
  token: string,
  userId: string
): Promise<string> => {
  const connection = await Connection.connect({
    address: config.temporal.address,
  });

  try {
    const client = new Client({ connection });

    // Start a one-off workflow for immediate sync
    const handle = await client.workflow.start(syncCalendar, {
      taskQueue: config.temporal.taskQueue,
      args: [token, userId],
      workflowId: 'importCalendar-' + nanoid(),
    });

    try {
      // Start the cron workflow
      await client.workflow.start(syncCalendar, {
        cronSchedule: '*/10 * * * *',
        taskQueue: config.temporal.taskQueue,
        args: [token, userId],
        workflowId: `importCalendar-cron-${userId}`,
      });
    } catch (e) {
      if (!(e instanceof WorkflowExecutionAlreadyStartedError)) {
        throw e;
      }
      // If it's already started, we can ignore the error.
    }

    return handle.workflowId;
  } finally {
    await connection.close();
  }
};
