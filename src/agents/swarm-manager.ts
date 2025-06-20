import { LanguageModelV1 } from 'ai';
import { ChatContext } from '@/agents';
import createBusinessLogicAgent from '@/agents/business-logic';
import logger from '@utils/logger';
import { calculateCost } from '@/utils/costs';
import { getCurrentModelInfo } from '@/config/models';
import { Session } from '@/middleware/auth';
import { ExtendedHive, ExtendedSwarm } from './extended-swarm';

// Cache for swarms to persist across messages
export const swarmCache = new Map<string, ExtendedSwarm<ChatContext>>();
export const sessionCostCache = new Map<string, number>();

// Helper function to create and configure the swarm
function createHiveSwarm(
  model: LanguageModelV1,
  accessToken?: string
): ExtendedSwarm<ChatContext> {
  const hive = new ExtendedHive<ChatContext>({
    queen: createBusinessLogicAgent(accessToken),
    defaultModel: model,
    defaultContext: { topic: null },
  });

  return hive.spawnSwarm();
}

export function logTokenUsage(
  sessionId: string,
  { promptTokens, completionTokens, totalTokens }: any
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
export function logToolInformation(sessionId: string, event: any) {
  // logger.info('Event:', event);
  logTokenUsage(sessionId, event.usage);
  logger.info(
    `Step finished - Type: ${event.stepType}, Tools: ${
      event.toolCalls?.length || 0
    }, Results: ${event.toolResults?.length || 0}`
  );

  if (event.toolCalls?.length > 0) {
    logger.info(
      'Tool calls:',
      event.toolCalls.map(
        (tc: any) => `${tc.toolName}(${JSON.stringify(tc.args)})`
      )
    );
  }

  if (event.toolResults?.length > 0) {
    logger.info(
      'Tool results:',
      event.toolResults.map((tr: any) => {
        const jsonStr = JSON.stringify(tr.result);
        const truncated =
          jsonStr.length > 100 ? jsonStr.slice(0, 300) + '...' : jsonStr;
        return `${tr.toolName}: ${truncated}`;
      })
    );
  }
}

export function getOrCreateSwarm(
  session: Session,
  model: LanguageModelV1
): ExtendedSwarm<ChatContext> {
  let swarm = swarmCache.get(session.id);
  if (!swarm) {
    logger.info(`Creating new swarm for session ${session.id}`);
    swarm = createHiveSwarm(model, session.accessToken);
    swarmCache.set(session.id, swarm);
  }
  return swarm;
}

export function initializeSwarm(
  session: Session,
  model: LanguageModelV1
): void {
  if (!swarmCache.has(session.id)) {
    logger.info(`Pre-warming swarm for session ${session.id}`);
    const swarm = createHiveSwarm(model, session.accessToken);
    swarmCache.set(session.id, swarm);
  }
}
