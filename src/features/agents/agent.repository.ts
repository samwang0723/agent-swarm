import { z } from 'zod';
import { Memory } from '@mastra/memory';
import { Agent, createTool, Tool } from '@mastra/core';
import { AgentConfig, AgentSystemConfig } from '../../shared/config/agents';
import logger from '../../shared/utils/logger';
import { toolRegistry } from '../mcp/mcp.repository';
import { createModelByKey } from '../../shared/config/models';
import {
  validateAgentSystemConfig,
  logAgentSystemInfo,
} from '../../shared/utils/agent';
import { MastraMemoryContext } from './agent.dto';
import { loadSystemPrompt, createBasicMastraAgent } from './agent.util';
import { mastraMemoryService } from './mastra.memory';
import {
  createMastraMemory,
  createAgentMemoryConfig,
} from '../../shared/config/mastra';

// Define the correct type for Mastra tools as returned by createTool
type MastraToolResult = ReturnType<typeof createTool>;

export class AgentRegistry {
  private agents: Map<string, Agent> = new Map();
  private handoverTools: Map<string, MastraToolResult> = new Map();
  private receptionistAgent: Agent | null = null;
  private receptionistWorkflow: unknown = null;
  private memory: Memory | undefined;

  constructor(
    private config: AgentSystemConfig,
    private accessToken?: string,
    private userId?: string
  ) {
    this.validateConfiguration();
    this.initializeMemory();
    this.initializeRegistry();
  }

  private validateConfiguration(): void {
    const validation = validateAgentSystemConfig(this.config);

    if (!validation.valid) {
      const errorMessage = `Invalid agent configuration: ${validation.errors.join(
        '; '
      )}`;
      logger.error(errorMessage);
      throw new Error(errorMessage);
    }

    if (validation.warnings.length > 0) {
      logger.warn('Agent configuration warnings:', validation.warnings);
    }

    // Log system information
    logAgentSystemInfo(this.config);
  }

  private initializeMemory(): void {
    try {
      logger.info('Starting Mastra memory initialization...');
      this.memory = createMastraMemory();

      logger.debug('Memory initialization result:', {
        memoryCreated: !!this.memory,
        memoryType: typeof this.memory,
        memoryConstructor: this.memory ? this.memory.constructor.name : 'none',
        memoryMethods: this.memory
          ? Object.keys(this.memory).filter(
              key => typeof this.memory![key as keyof Memory] === 'function'
            )
          : [],
        memoryStringified: this.memory
          ? 'memory instance exists'
          : 'null memory',
      });

      // Validate memory instance
      if (!this.memory) {
        throw new Error('Memory instance is null after createMastraMemory()');
      }

      const memoryInstance = this.memory;
      const requiredMethods = ['createThread', 'query'];
      const missingMethods = requiredMethods.filter(
        method => !memoryInstance[method as keyof Memory]
      );

      if (missingMethods.length > 0) {
        logger.error('Memory instance missing required methods:', {
          missingMethods,
          hasCreateThread: !!memoryInstance.createThread,
          hasQuery: !!memoryInstance.query,
          availableMethods: Object.keys(memoryInstance),
          memoryPrototype: Object.getPrototypeOf(memoryInstance),
        });
        throw new Error(
          `Memory instance missing required methods: ${missingMethods.join(', ')}`
        );
      }

      // Test memory instance functionality
      try {
        // Basic memory instance validation
        if (typeof memoryInstance.createThread !== 'function') {
          throw new Error('createThread is not a function');
        }
        if (typeof memoryInstance.query !== 'function') {
          throw new Error('query is not a function');
        }
        logger.debug('Memory instance validation passed');
      } catch (validationError) {
        logger.error('Memory instance validation failed:', validationError);
        throw new Error(`Memory validation failed: ${validationError}`);
      }

      // Initialize user memory if userId is provided
      if (this.userId) {
        mastraMemoryService.initializeUserMemory(this.userId).catch(error => {
          logger.error(
            'Failed to initialize user memory during registry setup:',
            error
          );
        });
      }

      logger.info('✅ Mastra memory system initialized successfully', {
        hasMemory: !!this.memory,
        memoryType: typeof this.memory,
        userId: this.userId || 'no userId',
      });
    } catch (error) {
      logger.error('❌ Failed to initialize Mastra memory system:', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        userId: this.userId,
      });
      throw error;
    }
  }

  private initializeRegistry(): void {
    logger.info('Initializing agent registry...');

    // Set access token if provided
    if (this.accessToken) {
      toolRegistry.setAccessTokenForAll(this.accessToken);
    }

    // Create specialized agents
    this.createSpecializedAgents();

    // Create handover tools
    this.createHandoverTools();

    // Create receptionist agent
    this.createReceptionistAgent();

    // Setup bidirectional handovers
    this.setupBidirectionalHandovers();

    logger.info('Agent registry initialization completed');
  }

  private createSpecializedAgents(): void {
    const enabledAgents = this.config.agents.filter(a => a.enabled);
    logger.info(`Creating ${enabledAgents.length} enabled agents...`);

    // Validate memory before creating agents
    if (!this.memory) {
      logger.error('Cannot create agents: Memory instance is null');
      throw new Error('Memory instance is null - cannot create agents');
    }

    logger.debug('Pre-agent creation memory validation:', {
      hasMemory: !!this.memory,
      memoryType: typeof this.memory,
      memoryConstructor: this.memory ? this.memory.constructor.name : 'none',
    });

    for (const agentConfig of enabledAgents) {
      try {
        logger.info(
          `Creating ${agentConfig.id} agent with MCP servers: ${agentConfig.mcpServers.join(
            ', '
          )}`
        );

        const systemPrompt = loadSystemPrompt(agentConfig.systemPromptFile);
        const fullPrompt =
          systemPrompt + (agentConfig.additionalInstructions || '');

        // Collect and convert tools from MCP servers
        const serverToolsMap: Record<string, Tool<z.ZodType>> = {};
        agentConfig.mcpServers.forEach(serverName => {
          const serverTools = toolRegistry.getServerTools(serverName);
          Object.entries(serverTools).forEach(([toolName, tool]) => {
            serverToolsMap[toolName] = tool;
          });
        });

        const modelInstance = createModelByKey(agentConfig.model);
        if (!modelInstance) {
          throw new Error(`Failed to create model for agent ${agentConfig.id}`);
        }

        // Validate memory before passing to agent
        logger.debug(`Pre-agent creation validation for ${agentConfig.id}:`, {
          hasMemory: !!this.memory,
          memoryType: typeof this.memory,
          memoryConstructor: this.memory
            ? this.memory.constructor.name
            : 'none',
          memoryIsFunction: typeof this.memory === 'function',
          memoryMethods: this.memory
            ? Object.keys(this.memory).slice(0, 5)
            : [],
        });

        if (!this.memory) {
          throw new Error(
            `Memory instance is null for agent ${agentConfig.id}`
          );
        }

        logger.debug(
          `Creating agent ${agentConfig.id} with validated memory instance`
        );

        const agent = createBasicMastraAgent({
          name: agentConfig.id,
          instructions: fullPrompt,
          model: modelInstance,
          tools: serverToolsMap,
          memory: this.memory, // Pass the actual Memory instance, not config
        });

        // Validate agent was created with memory
        const agentMemory = (agent as { memory?: Memory }).memory;
        logger.debug(`Post-creation memory validation for ${agentConfig.id}:`, {
          agentHasMemory: !!agentMemory,
          agentMemoryType: typeof agentMemory,
          agentMemoryConstructor: agentMemory
            ? agentMemory.constructor.name
            : 'none',
          agentMemoryIsSameInstance: agentMemory === this.memory,
        });

        if (!agentMemory) {
          logger.error(
            `⚠️  Agent ${agentConfig.id} was created without memory!`,
            {
              originalMemory: !!this.memory,
              agentMemory: !!agentMemory,
            }
          );
        }

        this.agents.set(agentConfig.id, agent);

        logger.info(`✅ ${agentConfig.id} Mastra agent created successfully`, {
          hasMemory: !!agentMemory,
          memoryAttached: agentMemory === this.memory,
        });
      } catch (error) {
        logger.error(`❌ Failed to create agent ${agentConfig.id}:`, {
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
          agentId: agentConfig.id,
        });
        throw error;
      }
    }

    logger.info(`✅ All ${enabledAgents.length} agents created successfully`);

    // Create handover tools after all agents are created
    this.createHandoverTools();
  }

  private createHandoverTools(): void {
    logger.info('Creating handover tools...');

    for (const agentConfig of this.config.agents) {
      if (!agentConfig.enabled) continue;

      const agent = this.agents.get(agentConfig.id);
      if (!agent) {
        logger.warn(
          `Agent ${agentConfig.id} not found, skipping handover tool creation`
        );
        continue;
      }

      // Create Mastra handover tool with correct execute signature
      const mastraHandoverTool = createTool({
        id: `transfer_to_${agentConfig.id}`,
        description:
          agentConfig.routingDescription ||
          `Call this tool to transfer to the ${agentConfig.name}`,
        inputSchema: z.object({
          topic: z.string().describe('User requested topic'),
          context: z
            .unknown()
            .optional()
            .describe('Additional context for the transfer'),
        }),
        execute: async ({ context }) => {
          // Access parameters from context object
          const { topic, context: additionalContext } = context as {
            topic: string;
            context?: unknown;
          };
          const topicStr = (topic || '').trim();
          logger.debug(
            `Transferring to ${agentConfig.id} agent for topic: ${topicStr}`
          );
          return {
            handover: true,
            targetAgent: agentConfig.id,
            agent,
            context: { ...(additionalContext || {}), topic: topicStr },
          };
        },
      });

      this.handoverTools.set(
        `transfer_to_${agentConfig.id}`,
        mastraHandoverTool
      );
      logger.debug(`✓ Created handover tool: transfer_to_${agentConfig.id}`);
    }

    logger.info(`Created ${this.handoverTools.size} handover tools`);
  }

  private createReceptionistAgent(): void {
    logger.info('Creating receptionist agent...');

    // Validate memory before creating receptionist
    if (!this.memory) {
      logger.error('Cannot create receptionist: Memory instance is null');
      throw new Error(
        'Memory instance is null - cannot create receptionist agent'
      );
    }

    const modelInstance = createModelByKey(this.config.receptionist.model);
    if (!modelInstance) {
      throw new Error('Failed to create model for receptionist agent');
    }

    // Mastra receptionist agent with workflow orchestration
    const handoverTools = Object.fromEntries(
      Array.from(this.handoverTools.entries()).map(([key, value]) => [
        key,
        value as Tool<z.ZodType>,
      ])
    );

    this.receptionistAgent = createBasicMastraAgent({
      name: this.config.receptionist.name,
      instructions: this.config.receptionist.instructions,
      model: modelInstance,
      tools: handoverTools,
      memory: this.memory, // Pass the actual Memory instance, not config
    });

    // Validate receptionist was created with memory
    const receptionistMemory = (this.receptionistAgent as { memory?: Memory })
      .memory;

    if (!receptionistMemory) {
      logger.error('⚠️  Receptionist agent was created without memory!', {
        originalMemory: !!this.memory,
        receptionistMemory: !!receptionistMemory,
      });
    }

    this.createReceptionistWorkflow();
    logger.info(
      `✅ Mastra receptionist agent created with ${this.handoverTools.size} handover tools and workflow orchestration`,
      {
        hasMemory: !!receptionistMemory,
        memoryAttached: receptionistMemory === this.memory,
      }
    );
  }

  private createReceptionistWorkflow(): void {
    if (!this.receptionistAgent) return;

    try {
      // TODO: Implement proper Mastra workflow using the new API
      // For now, create a simple workflow placeholder to avoid the legacy API issues
      this.receptionistWorkflow = {
        id: 'receptionist-workflow',
        description: 'Receptionist workflow for agent orchestration',
        agents: this.agents,
        receptionistAgent: this.receptionistAgent,

        // Simple execution method
        execute: async (input: {
          message: string;
          context?: unknown;
          userId?: string;
          sessionId?: string;
        }) => {
          // Execute receptionist agent first
          const response = await this.receptionistAgent!.generate(
            input.message
          );

          // Simple parsing to determine target agent
          const targetAgent = this.parseTargetAgent(response.text);

          return {
            result: response.text,
            targetAgent,
          };
        },
      };

      logger.info(
        '✓ Receptionist workflow placeholder created (to be updated with proper Mastra workflow API)'
      );
    } catch (error) {
      logger.error('Failed to create receptionist workflow:', error);
    }
  }

  private parseTargetAgent(response: string): string | undefined {
    // Simple parsing logic to determine target agent from response
    // This should be enhanced based on your specific requirements
    const agentIds = Array.from(this.agents.keys());

    for (const agentId of agentIds) {
      if (response.toLowerCase().includes(agentId.toLowerCase())) {
        return agentId;
      }
    }

    return undefined;
  }

  private setupBidirectionalHandovers(): void {
    logger.info('Setting up bidirectional handovers...');

    if (!this.receptionistAgent) {
      throw new Error('Receptionist agent is not available');
    }

    // Create Mastra handover tool for returning to receptionist
    const transferToReceptionistTool = createTool({
      id: 'transfer_to_receptionist',
      description: 'Call this tool to transfer back to the receptionist',
      inputSchema: z.object({
        topic: z.string().describe('User requested topic'),
        reason: z.string().optional().describe('Reason for transferring back'),
      }),
      execute: async ({ context }) => {
        // Access parameters from context object
        const { topic, reason } = context as {
          topic: string;
          reason?: string;
        };
        const topicStr = (topic || '').trim();
        logger.debug(
          `Transferring back to receptionist for topic: ${topicStr}, reason: ${reason}`
        );
        return {
          handover: true,
          targetAgent: 'receptionist',
          agent: this.receptionistAgent!,
          context: { reason, topic: topicStr },
        };
      },
    });

    this.handoverTools.set(
      'transfer_to_receptionist',
      transferToReceptionistTool
    );
    logger.info('✓ Added Mastra handback tool: transfer_to_receptionist');
  }

  public getReceptionistAgent(): Agent {
    if (!this.receptionistAgent) {
      throw new Error('Receptionist agent not initialized');
    }
    return this.receptionistAgent;
  }

  public getReceptionistWorkflow(): unknown {
    return this.receptionistWorkflow;
  }

  public getAgent(agentId: string): Agent | undefined {
    return this.agents.get(agentId);
  }

  public getAvailableAgents(): string[] {
    return Array.from(this.agents.keys());
  }

  public updateAccessToken(accessToken: string): void {
    this.accessToken = accessToken;
    toolRegistry.setAccessTokenForAll(accessToken);
    logger.info('Access token updated for all agents');
  }

  public getAgentConfig(agentId: string): AgentConfig | undefined {
    return this.config.agents.find(c => c.id === agentId);
  }

  public isAgentEnabled(agentId: string): boolean {
    const config = this.getAgentConfig(agentId);
    return config?.enabled ?? false;
  }

  public getAgentStats(): {
    total: number;
    enabled: number;
    disabled: number;
    agents: { id: string; name: string; enabled: boolean }[];
  } {
    const agents = this.config.agents.map(c => ({
      id: c.id,
      name: c.name,
      enabled: c.enabled ?? false,
    }));
    return {
      total: agents.length,
      enabled: agents.filter(a => a.enabled).length,
      disabled: agents.filter(a => !a.enabled).length,
      agents,
    };
  }

  public getMemoryService() {
    return mastraMemoryService;
  }

  public async initializeAgentMemory(
    agentId: string,
    userId: string,
    sessionId: string
  ): Promise<void> {
    try {
      await mastraMemoryService.initializeUserMemory(userId);
      logger.debug(
        `Memory initialized for agent ${agentId}, user ${userId}, session ${sessionId}`
      );
    } catch (error) {
      logger.error(`Failed to initialize memory for agent ${agentId}:`, error);
      throw error;
    }
  }

  public async getAgentMemoryContext(
    userId: string,
    sessionId: string
  ): Promise<MastraMemoryContext | null> {
    if (!userId) return null;
    try {
      const memoryCfg = createAgentMemoryConfig(userId, sessionId);
      return {
        resourceId: memoryCfg.resource,
        threadId: memoryCfg.thread,
        userId,
      };
    } catch (error) {
      logger.error('Failed to get agent memory context:', error);
      return null;
    }
  }

  public getUserId(): string | undefined {
    return this.userId;
  }
}
