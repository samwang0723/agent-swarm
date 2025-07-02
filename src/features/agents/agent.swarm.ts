import { LanguageModelV1 } from 'ai';
import { ChatContext } from './agent.dto';
import logger from '@/shared/utils/logger';

import { Session } from '@/shared/middleware/auth';
import { ExtendedHive, ExtendedSwarm } from './agent.dto';
import { AgentFactory } from './agent.factory';

// Cache for swarms to persist across messages
export const swarmCache = new Map<string, ExtendedSwarm<ChatContext>>();

// Helper function to create and configure the swarm
function createHiveSwarm(
  model: LanguageModelV1,
  accessToken?: string
): ExtendedSwarm<ChatContext> {
  const factory = AgentFactory.getInstance();
  const queen = factory.createBusinessLogicAgent(accessToken);
  const registry = factory.getRegistry();

  if (!registry) {
    throw new Error('Agent registry could not be initialized.');
  }

  const hive = new ExtendedHive<ChatContext>({
    queen,
    defaultModel: model,
    defaultContext: { topic: null, accessToken },
    registry,
  });

  return hive.spawnSwarm();
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
