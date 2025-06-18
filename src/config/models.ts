import { createAnthropic } from '@ai-sdk/anthropic';
import { createOpenAI } from '@ai-sdk/openai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import logger from '@utils/logger';
import dotenv from 'dotenv';
import { LanguageModelV1 } from 'ai';

dotenv.config();

export type ModelProvider = 'anthropic' | 'openai' | 'google';

export interface ModelConfig {
  provider: ModelProvider;
  modelName: string;
  baseURL?: string;
  apiKey?: string;
}

// Available model configurations
const MODEL_CONFIGS: Record<string, ModelConfig> = {
  'claude-3-5-sonnet': {
    provider: 'anthropic',
    modelName: 'claude-3-5-sonnet-20241022',
    baseURL: 'https://api.anthropic.com/v1',
    apiKey: process.env.ANTHROPIC_API_KEY,
  },
  'claude-3-5-haiku': {
    provider: 'anthropic',
    modelName: 'claude-3-5-haiku-20241022',
    baseURL: 'https://api.anthropic.com/v1',
    apiKey: process.env.ANTHROPIC_API_KEY,
  },
  'gpt-4o': {
    provider: 'openai',
    modelName: 'gpt-4o',
    baseURL: 'https://api.openai.com/v1',
    apiKey: process.env.OPENAI_API_KEY,
  },
  'gpt-4o-mini': {
    provider: 'openai',
    modelName: 'gpt-4o-mini',
    baseURL: 'https://api.openai.com/v1',
    apiKey: process.env.OPENAI_API_KEY,
  },
  'gemini-2.5-flash': {
    provider: 'google',
    modelName: 'gemini-2.5-flash-preview-05-20',
    baseURL: 'https://generativelanguage.googleapis.com/v1beta',
    apiKey: process.env.GOOGLE_API_KEY,
  },
  'gemini-2.0-flash': {
    provider: 'google',
    modelName: 'gemini-2.0-flash',
    baseURL: 'https://generativelanguage.googleapis.com/v1beta',
    apiKey: process.env.GOOGLE_API_KEY,
  },
};

// Create a model instance from a given key
export const createModelByKey = (
  modelKey?: string
): LanguageModelV1 | undefined => {
  if (!modelKey) return undefined;

  const config = MODEL_CONFIGS[modelKey];

  if (!config) {
    const availableModels = Object.keys(MODEL_CONFIGS).join(', ');
    const error = `Unknown model key: ${modelKey}. Available models: ${availableModels}`;
    logger.error(error);
    throw new Error(error);
  }

  if (!config.apiKey) {
    const envVar =
      config.provider === 'anthropic'
        ? 'ANTHROPIC_API_KEY'
        : config.provider === 'google'
          ? 'GOOGLE_API_KEY'
          : 'OPENAI_API_KEY';
    const error = `Missing API key for ${config.provider} (model: ${modelKey}). Please set ${envVar} environment variable.`;
    logger.error(error);
    throw new Error(error);
  }

  logger.info(
    `Initializing LLM model: ${config.modelName} (${config.provider}) from key: ${modelKey}`
  );

  try {
    switch (config.provider) {
      case 'anthropic': {
        const anthropic = createAnthropic({
          apiKey: config.apiKey,
        });
        const model = anthropic(config.modelName as any);
        logger.info(
          `✅ Anthropic model ${config.modelName} initialized successfully for key ${modelKey}`
        );
        return model;
      }
      case 'openai': {
        const openai = createOpenAI({
          apiKey: config.apiKey,
          compatibility: 'strict',
        });
        const model = openai(config.modelName as any);
        logger.info(
          `✅ OpenAI model ${config.modelName} initialized successfully for key ${modelKey}`
        );
        return model;
      }
      case 'google': {
        const google = createGoogleGenerativeAI({
          apiKey: config.apiKey,
        });
        const model = google(`models/${config.modelName}` as any);
        logger.info(
          `✅ Google model models/${config.modelName} initialized successfully for key ${modelKey}`
        );
        return model;
      }
      default: {
        const error = `Unsupported provider: ${config.provider}`;
        logger.error(error);
        throw new Error(error);
      }
    }
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';
    logger.error(
      `Failed to initialize model ${config.modelName} for key ${modelKey}: ${errorMessage}`
    );
    throw error;
  }
};

// Get the current model from environment variable or default
const getCurrentModelKey = (): string => {
  return process.env.LLM_MODEL || 'claude-3-5-sonnet';
};

// Create and configure the model instance
export const createModel = () => {
  const modelKey = getCurrentModelKey();
  return createModelByKey(modelKey);
};

// Get current model information for logging/debugging
export const getCurrentModelInfo = () => {
  const modelKey = getCurrentModelKey();
  const config = MODEL_CONFIGS[modelKey];

  return {
    key: modelKey,
    provider: config?.provider,
    modelName: config?.modelName,
    isConfigured: !!config?.apiKey,
  };
};

// List all available models
export const getAvailableModels = () => {
  return Object.entries(MODEL_CONFIGS).map(([key, config]) => ({
    key,
    provider: config.provider,
    modelName: config.modelName,
    isConfigured: !!config.apiKey,
  }));
};
