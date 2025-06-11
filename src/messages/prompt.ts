import logger from '@/utils/logger';
import { readFileSync } from 'fs';
import { join } from 'path';

// Load system prompt from file
function loadSystemPrompt(domain: string): string {
  try {
    // Use process.cwd() to get the project root, then navigate to config
    const promptPath = join(process.cwd(), `src/config/prompts/${domain}.txt`);
    return readFileSync(promptPath, 'utf-8').trim();
  } catch (error) {
    logger.error('Failed to load system prompt from file:', error);
    // Fallback to a basic prompt if file loading fails
    return `You are a professional ${domain} assistant with access to various tools and services.`;
  }
}

export { loadSystemPrompt };
