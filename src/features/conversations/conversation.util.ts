import { LanguageModelUsage, ToolCall, ToolResult } from 'ai';
import { LoggableEvent } from './conversation.dto';
import { calculateCost } from '@/shared/utils/costs';
import { getCurrentModelInfo } from '@/shared/config/models';
import logger from '@/shared/utils/logger';

export const sessionCostCache = new Map<string, number>();

export function logTokenUsage(
  sessionId: string,
  { promptTokens, completionTokens, totalTokens }: LanguageModelUsage
) {
  const modelInfo = getCurrentModelInfo();
  const cost = calculateCost(
    modelInfo.modelName!,
    promptTokens,
    completionTokens
  );

  const currentTotalCost = sessionCostCache.get(sessionId) || 0;
  const newTotalCost = currentTotalCost + (cost || 0);
  sessionCostCache.set(sessionId, newTotalCost);

  logger.info('------------------------------');
  logger.info(`Model: ${modelInfo.key} (${modelInfo.modelName})`);
  logger.info(`Prompt tokens: ${promptTokens}`);
  logger.info(`Completion tokens: ${completionTokens}`);
  logger.info(`Total tokens: ${totalTokens}`);
  if (cost !== null) {
    logger.info(`Estimated cost for this call: $${cost.toFixed(6)}`);
    logger.info(`Total session cost: $${newTotalCost.toFixed(6)}`);
  }
  logger.info('------------------------------');
}

// Helper function to log tool information
export function logToolInformation(sessionId: string, event: LoggableEvent) {
  // logger.info('Event:', event);
  logTokenUsage(sessionId, event.usage);
  logger.info(
    `Step finished - Type: ${event.stepType}, Tools: ${
      event.toolCalls?.length || 0
    }, Results: ${event.toolResults?.length || 0}`
  );

  if (event.toolCalls && event.toolCalls.length > 0) {
    logger.info(
      'Tool calls:',
      event.toolCalls.map(
        (tc: ToolCall<string, unknown>) =>
          `${tc.toolName}(${JSON.stringify(tc.args)})`
      )
    );
  }

  if (event.toolResults && event.toolResults.length > 0) {
    logger.info(
      'Tool results:',
      event.toolResults.map((tr: ToolResult<string, unknown, unknown>) => {
        const jsonStr = JSON.stringify(tr.result);
        const truncated =
          jsonStr.length > 100 ? jsonStr.slice(0, 300) + '...' : jsonStr;
        return `${tr.toolName}: ${truncated}`;
      })
    );
  }
}
