import { LanguageModelV1 } from 'ai';
import { ChatContext } from './agent.dto';
import { createBusinessLogicAgent } from './agent.service';
import logger from '@/shared/utils/logger';

import { Session } from '@/shared/middleware/auth';
import { ExtendedHive, ExtendedSwarm } from './agent.dto';

// Cache for swarms to persist across messages
export const swarmCache = new Map<string, ExtendedSwarm<ChatContext>>();

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
