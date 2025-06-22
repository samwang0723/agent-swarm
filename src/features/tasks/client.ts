import { Connection, Client } from '@temporalio/client';
import { syncGmail } from '@/features/tasks/temporal.workflows';
import { nanoid } from 'nanoid';
import process from 'process';
import config from '@/shared/config';

async function run() {
  if (process.argv.length <= 2) {
    console.error('Must specify a name as the command-line argument');
    process.exit(1);
  }

  console.log('Starting syncGmail workflow');
  console.log('Token:', process.argv[2]);
  console.log('User ID:', process.argv[3]);
  console.log('Task Queue:', config.temporal.taskQueue);
  console.log('Namespace:', config.temporal.namespace);
  console.log('Address:', config.temporal.address);

  const token = process.argv[2];
  const userId = process.argv[3];
  const connection = await Connection.connect({
    address: config.temporal.address,
  });
  const client = new Client({ connection });

  const handle = await client.workflow.start(syncGmail, {
    taskQueue: config.temporal.taskQueue,
    args: [token, userId],
    workflowId: 'importGmail-' + nanoid(),
  });
  console.log(await handle.result());
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
