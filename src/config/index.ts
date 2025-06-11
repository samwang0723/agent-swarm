import dotenv from 'dotenv';

dotenv.config();

interface AnthropicConfig {
  apiKey: string;
}

interface LoggingConfig {
  level: string;
}

interface Config {
  anthropic: AnthropicConfig;
  logging: LoggingConfig;
}

const config: Config = {
  anthropic: {
    apiKey: process.env.ANTHROPIC_API_KEY || '',
  },
  logging: {
    level: process.env.LOG_LEVEL || 'info',
  },
};

export default config;
