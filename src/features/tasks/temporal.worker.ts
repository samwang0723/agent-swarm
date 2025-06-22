import { NativeConnection, Worker } from '@temporalio/worker';
import * as activities from '@/features/tasks/temporal.activities';
import config from '@/shared/config';

async function run() {
  // Step 1: Establish a connection with Temporal server.
  //
  // Worker code uses `@temporalio/worker.NativeConnection`.
  // (But in your application code it's `@temporalio/client.Connection`.)
  const connection = await NativeConnection.connect({
    address: config.temporal.address,
    // TLS and gRPC metadata configuration goes here.
  });
  try {
    // Step 2: Register Workflows and Activities with the Worker.
    const worker = await Worker.create({
      connection,
      namespace: config.temporal.namespace,
      taskQueue: config.temporal.taskQueue,
      // Workflows are registered using a path as they run in a separate JS context.
      workflowsPath: new URL('./temporal.workflows.ts', import.meta.url)
        .pathname,
      activities,
    });

    // Step 3: Start accepting tasks on the Task Queue specified in TASK_QUEUE_NAME
    //
    // The worker runs until it encounters an unexpected error or the process receives a shutdown signal registered on
    // the SDK Runtime object.
    //
    // By default, worker logs are written via the Runtime logger to STDERR at INFO level.
    //
    // See https://typescript.temporal.io/api/classes/worker.Runtime#install to customize these defaults.
    await worker.run();
  } finally {
    // Close the connection once the worker has stopped
    await connection.close();
  }
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
