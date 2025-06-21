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

interface Config {
  anthropic: AnthropicConfig;
  logging: LoggingConfig;
  db: DatabaseConfig;
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
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT ? parseInt(process.env.DB_PORT, 10) : 5432,
    database: process.env.DB_NAME || 'appdb',
  },
};

export default config;
