import { Agent as MastraAgent } from '@mastra/core';
import {
  MastraMemoryContext,
  UserOrchestration,
  OrchestrationStats,
} from './agent.dto';
import logger from '../../shared/utils/logger';
import { Session } from '../../shared/middleware/auth';
import { AgentFactory } from './agent.factory';
import { mastraMemoryService } from './mastra.memory';
import { memoryPatterns } from '../../shared/config/mastra';

// User-specific agent orchestration cache
const userOrchestrations = new Map<string, UserOrchestration>();

// Cleanup configuration
const CLEANUP_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes
const INACTIVE_THRESHOLD_MS = 60 * 60 * 1000; // 1 hour

/**
 * Create user orchestration for Mastra agent management
 * This replaces the old AgentSwarm with user-scoped agent instances
 */
async function createUserOrchestration(
  userId: string,
  sessionId: string,
  accessToken?: string
): Promise<UserOrchestration> {
  try {
    logger.info(`Creating Mastra orchestration for user ${userId}`);

    // Initialize user memory
    await mastraMemoryService.initializeUserMemory(userId);

    // Create memory context
    const memoryContext: MastraMemoryContext = {
      resourceId: memoryPatterns.getResourceId(userId),
      threadId: memoryPatterns.getThreadId(sessionId),
      userId,
    };

    // Create agents through factory
    const factory = AgentFactory.getInstance();
    const receptionistAgent = factory.createBusinessLogicAgent(
      accessToken,
      userId
    ) as MastraAgent;

    if (!receptionistAgent) {
      throw new Error('Failed to create receptionist agent');
    }

    // Get registry for agent management
    const registry = factory.getRegistry();
    if (!registry) {
      throw new Error('Agent registry not available');
    }

    // Get all available agents from the registry
    const availableAgents = registry.getAvailableAgents();
    const agents: Record<string, MastraAgent> = {
      receptionist: receptionistAgent,
    };

    // Add all specialized agents from the registry
    for (const agentId of availableAgents) {
      const agent = registry.getAgent(agentId);
      if (agent && agentId !== 'receptionist') {
        agents[agentId] = agent;
      }
    }

    logger.debug(
      `Added ${Object.keys(agents).length} agents to orchestration:`,
      {
        agentIds: Object.keys(agents),
        availableAgents,
      }
    );

    // Create orchestration state
    const orchestration: UserOrchestration = {
      userId,
      sessionId,
      agents,
      receptionistAgent,
      memoryContext,
      state: {
        currentAgent: 'receptionist',
        availableAgents: registry.getAvailableAgents(),
        context: {
          topic: null,
          accessToken,
          userId,
          sessionId,
          threadId: memoryContext.threadId,
          resourceId: memoryContext.resourceId,
        },
      },
      lastAccessed: new Date(),
      createdAt: new Date(),
    };

    logger.info(
      `Created orchestration for user ${userId} with ${orchestration.state.availableAgents.length} available agents`
    );

    return orchestration;
  } catch (error) {
    logger.error('Failed to create user orchestration:', error);
    throw error;
  }
}

/**
 * Get or create user-specific agent orchestration
 * Main entry point for user agent management
 */
export async function getOrCreateUserOrchestration(
  session: Session
): Promise<UserOrchestration> {
  const userId = session.id;
  if (!userId) {
    throw new Error('Session ID is required for user orchestration');
  }

  // Check if orchestration already exists
  let orchestration = userOrchestrations.get(userId);

  if (!orchestration) {
    logger.info(`Creating new orchestration for user ${userId}`);

    orchestration = await createUserOrchestration(
      userId,
      session.id,
      session.accessToken
    );

    userOrchestrations.set(userId, orchestration);
  } else {
    // Update session context and access time
    orchestration.lastAccessed = new Date();
    orchestration.sessionId = session.id;
    orchestration.memoryContext.threadId = memoryPatterns.getThreadId(
      session.id
    );

    // Update context with current session
    orchestration.state.context = {
      ...orchestration.state.context,
      sessionId: session.id,
      threadId: orchestration.memoryContext.threadId,
      accessToken: session.accessToken,
    };

    logger.debug(
      `Reusing orchestration for user ${userId}, session ${session.id}`
    );
  }

  return orchestration;
}

/**
 * Initialize user orchestration (pre-warming)
 * Useful for reducing first-message latency
 */
export async function initializeUserOrchestration(
  session: Session
): Promise<void> {
  const userId = session.id;
  if (!userId) {
    logger.warn('Cannot initialize user orchestration without session ID');
    return;
  }

  if (!userOrchestrations.has(userId)) {
    logger.info(`Pre-warming orchestration for user ${userId}`);

    try {
      await getOrCreateUserOrchestration(session);
    } catch (error) {
      logger.error(
        `Failed to pre-warm orchestration for user ${userId}:`,
        error
      );
    }
  }
}

/**
 * Get user memory context for a specific session
 * Utility function for creating memory context
 */
export function getUserMemoryContext(
  userId: string,
  sessionId: string
): MastraMemoryContext {
  return {
    resourceId: memoryPatterns.getResourceId(userId),
    threadId: memoryPatterns.getThreadId(sessionId),
    userId,
  };
}

/**
 * Clear user orchestration (cleanup)
 * Used for logout or manual cleanup
 */
export async function clearUserOrchestration(userId: string): Promise<void> {
  try {
    const orchestration = userOrchestrations.get(userId);
    if (orchestration) {
      userOrchestrations.delete(userId);
      logger.info(`Cleared orchestration for user ${userId}`);
    }
  } catch (error) {
    logger.error(`Failed to clear orchestration for user ${userId}:`, error);
  }
}

/**
 * Get current orchestration statistics
 * Useful for monitoring and debugging
 */
export function getOrchestrationStats(): OrchestrationStats {
  const activeUsers = userOrchestrations.size;
  const memoryUsage = `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`;

  // Calculate average session duration
  let totalDuration = 0;
  let sessionCount = 0;
  const now = new Date();

  for (const orchestration of userOrchestrations.values()) {
    const duration = now.getTime() - orchestration.createdAt.getTime();
    totalDuration += duration;
    sessionCount++;
  }

  const averageSessionDuration =
    sessionCount > 0 ? totalDuration / sessionCount / 1000 / 60 : 0; // in minutes

  return {
    activeUsers,
    totalOrchestrations: activeUsers,
    memoryUsage,
    averageSessionDuration: Math.round(averageSessionDuration * 100) / 100,
  };
}

/**
 * Get orchestration for a specific user
 * Useful for debugging and monitoring
 */
export function getUserOrchestration(
  userId: string
): UserOrchestration | undefined {
  return userOrchestrations.get(userId);
}

/**
 * Get current active agent from user orchestration
 * Returns the agent instance based on the current state
 */
export function getCurrentAgent(
  orchestration: UserOrchestration
): MastraAgent | undefined {
  const currentAgentId = orchestration.state.currentAgent;

  if (!currentAgentId) {
    logger.warn('No current agent set in orchestration state');
    return undefined;
  }

  const currentAgent = orchestration.agents[currentAgentId];

  if (!currentAgent) {
    logger.warn(
      `Current agent '${currentAgentId}' not found in agents record`,
      {
        availableAgents: Object.keys(orchestration.agents),
        currentAgentId,
      }
    );
    return undefined;
  }

  return currentAgent;
}

/**
 * Get current agent for a specific user
 * Convenience function that combines user lookup and current agent retrieval
 */
export function getCurrentAgentForUser(
  userId: string
): MastraAgent | undefined {
  const orchestration = getUserOrchestration(userId);

  if (!orchestration) {
    logger.warn(`No orchestration found for user ${userId}`);
    return undefined;
  }

  return getCurrentAgent(orchestration);
}

/**
 * Update access token for a user's orchestration
 * Used when tokens are refreshed
 */
export function updateUserAccessToken(
  userId: string,
  accessToken: string
): void {
  const orchestration = userOrchestrations.get(userId);
  if (orchestration) {
    orchestration.state.context.accessToken = accessToken;

    // Update access token in factory
    const factory = AgentFactory.getInstance();
    factory.updateAccessToken(accessToken);

    logger.debug(`Updated access token for user ${userId}`);
  }
}

/**
 * Cleanup inactive user orchestrations
 * Runs periodically to free up memory
 */
function cleanupInactiveOrchestrations(): void {
  const now = new Date();
  const toDelete: string[] = [];

  for (const [userId, orchestration] of userOrchestrations.entries()) {
    const timeSinceLastAccess =
      now.getTime() - orchestration.lastAccessed.getTime();

    if (timeSinceLastAccess > INACTIVE_THRESHOLD_MS) {
      toDelete.push(userId);
    }
  }

  for (const userId of toDelete) {
    userOrchestrations.delete(userId);
    logger.debug(`Cleaned up inactive orchestration for user ${userId}`);
  }

  if (toDelete.length > 0) {
    logger.info(`Cleaned up ${toDelete.length} inactive user orchestrations`);
  }
}

// Start cleanup interval
setInterval(cleanupInactiveOrchestrations, CLEANUP_INTERVAL_MS);

// Legacy function names for backward compatibility
export const getOrCreateSwarm = getOrCreateUserOrchestration;
export const initializeSwarm = initializeUserOrchestration;

// Export memory service for direct access
export { mastraMemoryService };
