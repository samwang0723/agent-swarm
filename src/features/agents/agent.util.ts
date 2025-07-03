import { readFileSync } from 'fs';
import { join } from 'path';
import { createTool, Agent } from '@mastra/core';
import { z } from 'zod';
import { LanguageModelV1 } from 'ai';
import { Memory } from '@mastra/memory';

import logger from '../../shared/utils/logger';
import { StoreInfo, UBER_EATS_DOMAIN } from './agent.dto';

function formatStoreOutput(store: StoreInfo): string {
  return `- ${store.name}, ${store.url}, Delivery in: ${store.deliveryTime}`;
}

export function parseUberEatsStores(rawText: string): string {
  if (!rawText.includes('- heading "All stores"')) {
    return rawText;
  }

  const stores: StoreInfo[] = [];

  // A new store block seems to start with a line like:
  // - generic [ref=e...]:
  const storeBlocks = rawText.split(/\n(?=\s*-\s*generic\s*\[ref=e\d+\]:)/);

  for (const block of storeBlocks) {
    try {
      const nameMatch = block.match(/- link "([^"]+)":/);
      const urlMatch = block.match(/- \/url: (.*)/);
      const timeMatch = block.match(/- generic: (\d+\s*min)/);

      if (nameMatch && urlMatch && timeMatch) {
        stores.push({
          name: nameMatch[1],
          url: `${UBER_EATS_DOMAIN}${urlMatch[1].trim()}`,
          deliveryTime: timeMatch[1],
        });
      }
    } catch (e) {
      logger.error('Error parsing store block:', e);
    }
  }

  if (stores.length > 0) {
    return stores.map(formatStoreOutput).join('\n');
  }

  return rawText;
}

/**
 * Load system prompt from file
 * @param domain - The domain/filename (without .txt extension)
 * @returns The system prompt text
 */
export function loadSystemPrompt(domain: string): string {
  try {
    // Use process.cwd() to get the project root, then navigate to prompts
    const promptPath = join(process.cwd(), `src/shared/prompts/${domain}.txt`);
    return readFileSync(promptPath, 'utf-8').trim();
  } catch (error) {
    logger.error('Failed to load system prompt from file:', error);
    // Fallback to a basic prompt if file loading fails
    return `You are a professional ${domain} assistant with access to various tools and services.`;
  }
}

/**
 * Creates a handover tool for Mastra agent delegation
 * @param targetAgentName - Name of the target agent to hand over to
 * @param description - Description of when to use this handover
 * @returns Mastra tool for agent handover
 */
export function createMastraHandoverTool(
  targetAgentName: string,
  description: string
) {
  return createTool({
    id: `handover_to_${targetAgentName}`,
    description: `Hand over the conversation to ${targetAgentName}. ${description}`,
    inputSchema: z.object({
      reason: z.string().describe('Reason for the handover'),
      context: z
        .unknown()
        .optional()
        .describe('Additional context to pass to the target agent'),
    }),
    execute: async ({ context }) => {
      // Access parameters from context object (Mastra pattern)
      const { reason, context: additionalContext } = context as {
        reason: string;
        context?: unknown;
      };

      logger.info(`Handing over to ${targetAgentName}: ${reason}`);
      return {
        handover: true,
        targetAgent: targetAgentName,
        reason,
        context: additionalContext,
      };
    },
  });
}

/**
 * Utility function to create a basic Mastra agent with proper types
 * This is a simplified version - use agent.service.ts functions for full agent creation
 * @param config - Agent configuration object
 * @returns Configured Mastra agent
 */
export function createBasicMastraAgent(config: {
  name: string;
  instructions: string;
  model: LanguageModelV1;
  tools?: ReturnType<typeof createTool>[];
  memory?: Memory; // Mastra Memory instance
}): Agent {
  try {
    // Validate required configuration
    if (!config.name || !config.instructions || !config.model) {
      throw new Error(
        'Missing required agent configuration: name, instructions, or model'
      );
    }

    // Log agent creation details for debugging
    logger.debug(`Creating Mastra agent: ${config.name}`, {
      hasModel: !!config.model,
      hasMemory: !!config.memory,
      hasTools: !!config.tools,
      toolsCount: config.tools
        ? Array.isArray(config.tools)
          ? config.tools.length
          : 'non-array'
        : 0,
      memoryType: config.memory ? typeof config.memory : 'undefined',
      modelType: config.model
        ? {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            modelId: (config.model as any).modelId,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            provider: (config.model as any).provider,
          }
        : 'undefined',
    });

    // Validate memory instance if provided
    if (config.memory) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const memoryInstance = config.memory as any;
      logger.debug(`Agent ${config.name}: Validating memory instance`, {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        memoryConstructor: memoryInstance.constructor?.name || 'unknown',
        memoryMethods: Object.keys(memoryInstance).slice(0, 10), // First 10 methods
        hasCreateThread: !!memoryInstance.createThread,
        hasQuery: !!memoryInstance.query,
        hasGetThreadById: !!memoryInstance.getThreadById,
        hasGetThreadsByResourceId: !!memoryInstance.getThreadsByResourceId,
        memoryType: typeof memoryInstance,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        memoryInstanceId: memoryInstance.id || 'no-id',
      });

      if (!memoryInstance.createThread || !memoryInstance.query) {
        logger.warn(
          `Agent ${config.name}: Memory instance missing required methods`,
          {
            hasCreateThread: !!memoryInstance.createThread,
            hasQuery: !!memoryInstance.query,
            availableMethods: Object.keys(memoryInstance),
            memoryPrototype: Object.getPrototypeOf(memoryInstance),
          }
        );
      } else {
        logger.debug(`Agent ${config.name}: Memory instance validation passed`);
      }
    } else {
      logger.warn(
        `Agent ${config.name}: No memory instance provided - agent will not have persistent memory`
      );
    }

    // Convert tools array to a record if it exists
    const toolsRecord = config.tools?.reduce(
      (acc, tool) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const toolId = (tool as any).id;
        if (toolId) {
          acc[toolId] = tool;
        }
        return acc;
      },
      {} as Record<string, ReturnType<typeof createTool>>
    );

    // Create the agent with proper type casting
    const agent = new Agent({
      name: config.name,
      instructions: config.instructions,
      model: config.model,
      tools: toolsRecord,
      memory: config.memory,
    });

    // Validate the created agent
    if (!agent.stream || typeof agent.stream !== 'function') {
      throw new Error(
        `Agent ${config.name}: Missing stream method after creation`
      );
    }

    // Validate memory attachment after agent creation
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const agentMemory = (agent as any).memory;
    logger.debug(`Agent ${config.name} memory attachment validation:`, {
      originalMemoryProvided: !!config.memory,
      originalMemoryType: config.memory ? typeof config.memory : 'undefined',
      agentMemoryAttached: !!agentMemory,
      agentMemoryType: agentMemory ? typeof agentMemory : 'undefined',
      memoryIsSameInstance:
        config.memory && agentMemory ? agentMemory === config.memory : false,
      agentMemoryConstructor: agentMemory
        ? agentMemory.constructor.name
        : 'none',
    });

    // Critical check for memory attachment
    if (config.memory && !agentMemory) {
      logger.error(
        `❌ CRITICAL: Agent ${config.name} was created without memory despite memory being provided!`,
        {
          providedMemory: !!config.memory,
          attachedMemory: !!agentMemory,
          memoryType: config.memory ? typeof config.memory : 'undefined',
          agentProperties: Object.keys(agent),
        }
      );

      // TEMPORARY WORKAROUND: Manually attach memory if Agent constructor failed to do so
      logger.warn(
        `🔧 WORKAROUND: Manually attaching memory to agent ${config.name}`
      );
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (agent as any).memory = config.memory;

        // Verify the manual attachment worked
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const manuallyAttachedMemory = (agent as any).memory;
        if (manuallyAttachedMemory === config.memory) {
          logger.info(
            `✓ Memory manually attached successfully to agent ${config.name}`
          );
        } else {
          logger.error(
            `❌ Manual memory attachment failed for agent ${config.name}`
          );
          throw new Error(
            `Agent ${config.name}: Memory was provided but could not be attached to agent`
          );
        }
      } catch (attachError) {
        logger.error(
          `❌ Failed to manually attach memory to agent ${config.name}:`,
          attachError
        );
        throw new Error(
          `Agent ${config.name}: Memory was provided but not attached to agent and manual attachment failed: ${attachError instanceof Error ? attachError.message : String(attachError)}`
        );
      }
    }

    if (config.memory && agentMemory && agentMemory !== config.memory) {
      logger.warn(
        `⚠️  Agent ${config.name}: Memory attached but not the same instance as provided`,
        {
          providedMemory: config.memory
            ? config.memory.constructor.name
            : 'none',
          attachedMemory: agentMemory ? agentMemory.constructor.name : 'none',
          areSameInstance: agentMemory === config.memory,
        }
      );
    }

    // Log successful creation
    logger.info(`✓ Mastra agent ${config.name} created successfully`, {
      hasStream: !!agent.stream,
      hasMemory: !!agentMemory,
      memoryConfigured: config.memory ? 'yes' : 'no',
      memoryAttached: !!agentMemory,
      memoryMatches:
        config.memory && agentMemory ? agentMemory === config.memory : false,
      agentMethods: Object.keys(agent).filter(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        key => typeof (agent as any)[key] === 'function'
      ),
    });

    return agent;
  } catch (error) {
    logger.error(`Failed to create Mastra agent ${config.name}:`, {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      config: {
        name: config.name,
        hasInstructions: !!config.instructions,
        instructionsLength: config.instructions
          ? config.instructions.length
          : 0,
        hasModel: !!config.model,
        hasMemory: !!config.memory,
        hasTools: !!config.tools,
      },
    });
    throw error;
  }
}

/**
 * Validates agent configuration before creation
 * @param config - Agent configuration to validate
 * @returns Validation result
 */
export function validateAgentConfig(config: {
  name: string;
  instructions: string;
  model: unknown;
}): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!config.name || typeof config.name !== 'string') {
    errors.push('Agent name is required and must be a string');
  }

  if (!config.instructions || typeof config.instructions !== 'string') {
    errors.push('Agent instructions are required and must be a string');
  }

  if (!config.model) {
    errors.push('Agent model is required');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Creates a standardized memory configuration for agents
 * @param userId - User identifier
 * @param resourceId - Resource identifier (optional, defaults to user-based)
 * @param threadId - Thread identifier (optional)
 * @returns Memory configuration object
 */
export function createMemoryConfig(
  userId: string,
  resourceId?: string,
  threadId?: string
) {
  return {
    userId,
    resourceId: resourceId || `user:${userId}`,
    threadId: threadId || `thread:${Date.now()}`,
  };
}
