import { Agent } from '@mastra/core';
import { AgentRegistry } from './agent.repository';
import { agentSystemConfig } from '../../shared/config/agents';
import { mastraMemoryService } from './mastra.memory';
import {
  createMastraMemory,
  createAgentMemoryConfig,
} from '../../shared/config/mastra';
import logger from '../../shared/utils/logger';

export class AgentFactory {
  private static instance: AgentFactory | null = null;
  private registry: AgentRegistry | null = null;
  private mastraMemory: unknown = null;

  private constructor() {
    this.initializeMastraMemory();
  }

  public static getInstance(): AgentFactory {
    if (!AgentFactory.instance) {
      AgentFactory.instance = new AgentFactory();
    }
    return AgentFactory.instance;
  }

  /**
   * Initialize Mastra memory system
   */
  private initializeMastraMemory(): void {
    try {
      this.mastraMemory = createMastraMemory();
      logger.info('Mastra memory system initialized in factory');
    } catch (error) {
      logger.error(
        'Failed to initialize Mastra memory system in factory:',
        error
      );
      throw error;
    }
  }

  public createBusinessLogicAgent(
    accessToken?: string,
    userId?: string
  ): Agent {
    try {
      logger.info('Creating agent registry with Mastra configuration');

      // Create registry with user ID for Mastra memory support
      this.registry = new AgentRegistry(agentSystemConfig, accessToken, userId);

      const stats = this.registry.getAgentStats();
      logger.info(
        `Agent registry created successfully: ${stats.enabled}/${stats.total} agents enabled using Mastra`
      );

      // Initialize Mastra memory for user if userId provided
      if (userId) {
        this.initializeUserMemory(userId).catch(error => {
          logger.error(
            'Failed to initialize user memory during agent creation:',
            error
          );
        });
      }

      const receptionistAgent = this.registry.getReceptionistAgent();

      logger.debug(
        'Created Mastra receptionist agent with workflow orchestration'
      );

      return receptionistAgent;
    } catch (error) {
      logger.error('Failed to create business logic agent:', error);
      throw new Error(
        `Failed to create business logic agent: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Initialize user memory for Mastra agents
   */
  private async initializeUserMemory(userId: string): Promise<void> {
    if (!userId) return;

    try {
      await mastraMemoryService.initializeUserMemory(userId);
      logger.debug(`User memory initialized for user: ${userId}`);
    } catch (error) {
      logger.error(
        `Failed to initialize user memory for user ${userId}:`,
        error
      );
      throw error;
    }
  }

  /**
   * Create agent memory configuration for a specific user and session
   */
  public createAgentMemoryConfig(userId: string, sessionId: string) {
    try {
      return createAgentMemoryConfig(userId, sessionId);
    } catch (error) {
      logger.error('Failed to create agent memory config:', error);
      return null;
    }
  }

  /**
   * Get the workflow for Mastra agent orchestration
   */
  public getReceptionistWorkflow(): unknown {
    if (!this.registry) {
      return null;
    }

    return this.registry.getReceptionistWorkflow();
  }

  /**
   * Get memory service for Mastra agents
   */
  public getMemoryService() {
    return mastraMemoryService;
  }

  /**
   * Initialize agent memory for a specific agent, user, and session
   */
  public async initializeAgentMemory(
    agentId: string,
    userId: string,
    sessionId: string
  ): Promise<void> {
    if (!this.registry) {
      return;
    }

    try {
      await this.registry.initializeAgentMemory(agentId, userId, sessionId);
    } catch (error) {
      logger.error(`Failed to initialize agent memory for ${agentId}:`, error);
      throw error;
    }
  }

  /**
   * Get agent memory context for Mastra agents
   */
  public async getAgentMemoryContext(userId: string, sessionId: string) {
    if (!this.registry) {
      return null;
    }

    return await this.registry.getAgentMemoryContext(userId, sessionId);
  }

  public getRegistry(): AgentRegistry | null {
    return this.registry;
  }

  public updateAccessToken(accessToken: string): void {
    if (this.registry) {
      this.registry.updateAccessToken(accessToken);
    }
  }

  /**
   * Check if Mastra is enabled (always true now)
   */
  public isMastraEnabled(): boolean {
    return true;
  }

  /**
   * Get agent type information
   */
  public getAgentType(): 'mastra' {
    return 'mastra';
  }

  /**
   * Get factory statistics
   */
  public getFactoryStats() {
    return {
      useMastra: true,
      hasRegistry: !!this.registry,
      hasMastraMemory: !!this.mastraMemory,
      registryStats: this.registry?.getAgentStats() || null,
    };
  }

  public reset(): void {
    this.registry = null;
    this.mastraMemory = null;
    this.initializeMastraMemory();
    logger.info('Agent factory reset');
  }
}
