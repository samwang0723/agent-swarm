import { Agent } from 'agentswarm';
import { ChatContext } from './agent.dto';
import { AgentRegistry } from './agent.repository';
import { agentSystemConfig } from '@/shared/config/agents';
import logger from '@/shared/utils/logger';

export class AgentFactory {
  private static instance: AgentFactory | null = null;
  private registry: AgentRegistry | null = null;

  private constructor() {}

  public static getInstance(): AgentFactory {
    if (!AgentFactory.instance) {
      AgentFactory.instance = new AgentFactory();
    }
    return AgentFactory.instance;
  }

  public createBusinessLogicAgent(accessToken?: string): Agent<ChatContext> {
    try {
      logger.info('Creating agent registry with configuration');

      this.registry = new AgentRegistry(agentSystemConfig, accessToken);

      const stats = this.registry.getAgentStats();
      logger.info(
        `Agent registry created successfully: ${stats.enabled}/${stats.total} agents enabled`
      );

      return this.registry.getReceptionistAgent();
    } catch (error) {
      logger.error('Failed to create business logic agent:', error);
      throw new Error(
        `Failed to create business logic agent: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  public getRegistry(): AgentRegistry | null {
    return this.registry;
  }

  public updateAccessToken(accessToken: string): void {
    if (this.registry) {
      this.registry.updateAccessToken(accessToken);
    }
  }

  public reset(): void {
    this.registry = null;
  }
}
