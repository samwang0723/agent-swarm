import { Connection, Client } from '@temporalio/client';
import { syncGmail } from '@/features/tasks/temporal.workflows';
import config from '@/shared/config';
import { nanoid } from 'nanoid';

export const syncGmailTask = async (
  token: string,
  userId: string
): Promise<string> => {
  const connection = await Connection.connect({
    address: config.temporal.address,
  });
  const client = new Client({ connection });

  const handle = await client.workflow.start(syncGmail, {
    taskQueue: config.temporal.taskQueue,
    args: [token, userId],
    workflowId: 'importGmail-' + nanoid(),
  });

  return handle.workflowId;
};
