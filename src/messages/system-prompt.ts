import logger from "@/utils/logger";
import { readFileSync } from "fs";
import { join } from "path";

// Load system prompt from file
function loadSystemPrompt(): string {
  try {
    const promptPath = join(__dirname, '../../config/system-prompt.txt');
    return readFileSync(promptPath, 'utf-8').trim();
  } catch (error) {
    logger.error('Failed to load system prompt from file:', error);
    // Fallback to a basic prompt if file loading fails
    return 'You are a professional personal assistant with access to various tools and services.';
  }
}

export const DEFAULT_SYSTEM_PROMPT = loadSystemPrompt();