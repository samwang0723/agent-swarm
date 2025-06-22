interface AnthropicConfig {
  apiKey: string;
}

interface LoggingConfig {
  level: string;
}

interface DatabaseConfig {
  user?: string;
  password?: string;
  host?: string;
  port?: number;
  database?: string;
}

interface TemporalConfig {
  address: string;
  namespace: string;
  taskQueue: string;
  connectTimeout?: number;
  rpcTimeout?: number;
}

interface Config {
  anthropic: AnthropicConfig;
  logging: LoggingConfig;
  db: DatabaseConfig;
  temporal: TemporalConfig;
}

const config: Config = {
  anthropic: {
    apiKey: process.env.ANTHROPIC_API_KEY || '',
  },
  logging: {
    level: process.env.LOG_LEVEL || 'info',
  },
  db: {
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    host: process.env.DB_HOST || '127.0.0.1',
    port: process.env.DB_PORT ? parseInt(process.env.DB_PORT, 10) : 5432,
    database: process.env.DB_NAME || 'appdb',
  },
  temporal: {
    address: process.env.TEMPORAL_ADDRESS || 'localhost:7233',
    namespace: process.env.TEMPORAL_NAMESPACE || 'default',
    taskQueue: process.env.TEMPORAL_TASK_QUEUE || 'default-queue',
    connectTimeout: process.env.TEMPORAL_CONNECT_TIMEOUT
      ? parseInt(process.env.TEMPORAL_CONNECT_TIMEOUT, 10)
      : 10000,
    rpcTimeout: process.env.TEMPORAL_RPC_TIMEOUT
      ? parseInt(process.env.TEMPORAL_RPC_TIMEOUT, 10)
      : 30000,
  },
};

export default config;
