# Infrastructure Components

This directory contains core infrastructure components for the application, including database setup, schema definitions, and local development environment configuration.

## Database

### Connection (`database.ts`)

This module provides a PostgreSQL connection pool and query utilities using the `pg` library. It's configured via `config.db`.

**Features:**

- Connection pooling via `pg.Pool`.
- Error handling for idle clients.
- A `query` function that logs query execution time and results.
- A `getClient` function to get a client from the pool.

**Usage:**

```typescript
import { query, getClient } from '@/shared/infrastructure/database';

// Execute a query
const { rows } = await query('SELECT * FROM users WHERE id = $1', [userId]);

// Get a client for a transaction
const client = await getClient();
try {
  await client.query('BEGIN');
  // ... do transaction queries
  await client.query('COMMIT');
} catch (e) {
  await client.query('ROLLBACK');
  throw e;
} finally {
  client.release();
}
```

### Schema (`schema.sql`)

This file defines the complete database schema for the application. It includes table definitions for:

- `users`
- `integrations`
- `emails`
- `messages`
- `calendar_events` (as a TimescaleDB hypertable)
- `embeddings` (with `vectorscale` for vector storage)
- `summaries`
- `sessions`

It also sets up required PostgreSQL extensions like `vectorscale` and `uuid-ossp`.

### Database Initialization (`init-temporal-db.sh`)

This script is used within the Docker Compose setup to create the `temporal` database required by the Temporal.io server.

## Docker Compose (`docker-compose.yml`)

The `docker-compose.yml` file configures the local development environment. It sets up the following services:

- **`temporal`**: The Temporal.io server for workflow orchestration.
- **`temporal-worker`**: A container for running Temporal workers.
- **`temporal-ui`**: The web UI for the Temporal server.
- **`db`**: A TimescaleDB instance (PostgreSQL with time-series capabilities) that serves as the main application database (`appdb`) and also hosts the `temporal` database.
- **`google-assistant`**: Mock MCP service for Google Assistant.
- **`time`**: Mock MCP service for time-related functions.
- **`booking`**: Mock MCP service for booking.

All services are connected via a `temporal-network` bridge network. The `db` service persists data to a Docker volume `db_data`.
