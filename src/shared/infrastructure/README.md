# Infrastructure Components

This directory contains core infrastructure components for the application.

## Temporal Connection Manager

The Temporal connection manager (`temporal.ts`) provides a singleton pattern for managing Temporal.io connections and operations.

### Features

- **Singleton Pattern**: Ensures single connection instance across the application
- **Auto-reconnection**: Implements exponential backoff retry logic
- **Health Monitoring**: Real-time connection health checks
- **Worker Management**: Create, start, and stop workers with proper lifecycle management
- **Graceful Shutdown**: Handles application shutdown gracefully
- **Type Safety**: Full TypeScript support with proper type definitions

### Usage

```typescript
import {
  temporalManager,
  executeWorkflow,
  createTemporalWorker,
} from '@/shared/infrastructure/temporal';

// Initialize connection
await temporalManager.connect();

// Create and start a worker
const worker = await createTemporalWorker('my-worker', {
  workflowsPath: require.resolve('./workflows'),
  activities: require('./activities'),
  taskQueue: 'my-queue',
});

// Execute a workflow
const handle = await executeWorkflow('MyWorkflow', [arg1, arg2], {
  workflowId: 'my-workflow-id',
  taskQueue: 'my-queue',
});

// Check connection status
const isHealthy = temporalManager.isHealthy();
const stats = temporalManager.getStats();
```

### Configuration

Configure via environment variables:

```bash
TEMPORAL_ADDRESS=localhost:7233
TEMPORAL_NAMESPACE=default
TEMPORAL_TASK_QUEUE=default-queue
TEMPORAL_CONNECT_TIMEOUT=10000
TEMPORAL_RPC_TIMEOUT=30000
```

### Architecture Decisions

1. **Singleton Pattern**: Prevents multiple connection instances and ensures consistent configuration
2. **Health Monitoring**: Proactive connection monitoring with automatic recovery
3. **Worker Lifecycle**: Proper worker management with graceful shutdown
4. **Type Safety**: Full TypeScript support for better developer experience
5. **Error Handling**: Comprehensive error handling with structured logging

## Database Connection

The database connection (`database.ts`) provides PostgreSQL connection pooling and query utilities.

## Docker Compose

The `docker-compose.yml` file sets up the development environment with:

- Temporal server
- Temporal UI
- TimescaleDB (PostgreSQL extension)
- Proper networking and dependencies
