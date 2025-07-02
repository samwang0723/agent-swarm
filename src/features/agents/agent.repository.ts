import { Agent } from 'agentswarm';
import { z } from 'zod';
import { AgentConfig, AgentSystemConfig } from '@/shared/config/agents';
import logger from '@/shared/utils/logger';
import { toolRegistry } from '@/features/mcp/mcp.repository';
import { createModelByKey } from '@/shared/config/models';
import {
  validateAgentSystemConfig,
  logAgentSystemInfo,
} from '@/shared/utils/agent';
import { ChatContext, HandoverTool } from './agent.dto';
import { createMultiServiceAgent } from './agent.service';
import { loadSystemPrompt } from './agent.util';

export class AgentRegistry {
  private agents: Map<string, Agent<ChatContext>> = new Map();
  private handoverTools: Map<string, HandoverTool> = new Map();
  private receptionistAgent: Agent<ChatContext> | null = null;

  constructor(
    private config: AgentSystemConfig,
    private accessToken?: string
  ) {
    this.validateConfiguration();
    this.initializeRegistry();
  }

  private validateConfiguration(): void {
    const validation = validateAgentSystemConfig(this.config);

    if (!validation.valid) {
      const errorMessage = `Invalid agent configuration: ${validation.errors.join('; ')}`;
      logger.error(errorMessage);
      throw new Error(errorMessage);
    }

    if (validation.warnings.length > 0) {
      logger.warn('Agent configuration warnings:', validation.warnings);
    }

    // Log system information
    logAgentSystemInfo(this.config);
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
    const enabledAgents = this.config.agents.filter(agent => agent.enabled);
    logger.info(`Creating ${enabledAgents.length} enabled agents...`);

    for (const agentConfig of enabledAgents) {
      try {
        logger.info(
          `Creating ${agentConfig.id} agent with MCP servers: ${agentConfig.mcpServers.join(', ')}`
        );

        const systemPrompt = loadSystemPrompt(agentConfig.systemPromptFile);
        const fullPrompt =
          systemPrompt + (agentConfig.additionalInstructions || '');

        const agent = createMultiServiceAgent(
          agentConfig.mcpServers,
          fullPrompt
        );

        this.agents.set(agentConfig.id, agent);
        logger.info(`✓ ${agentConfig.id} agent created successfully`);
      } catch (error) {
        logger.error(`✗ Failed to create ${agentConfig.id} agent:`, error);
        throw new Error(
          `Failed to create ${agentConfig.id} agent: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    }
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

      const handoverTool: HandoverTool = {
        type: 'handover',
        description:
          agentConfig.routingDescription ||
          `Call this tool to transfer to the ${agentConfig.name}`,
        parameters: z.object({
          topic: z.string().describe('User requested topic'),
        }),
        execute: async args => {
          const topic = ((args.topic as string) || '').trim();
          if (!agent) {
            throw new Error(`${agentConfig.name} is not available`);
          }
          logger.debug(
            `Transferring to ${agentConfig.id} agent for topic: ${topic}`
          );
          return {
            agent,
            context: { topic },
          };
        },
      };

      const toolName = `transfer_to_${agentConfig.id}`;
      this.handoverTools.set(toolName, handoverTool);
      logger.debug(`✓ Created handover tool: ${toolName}`);
    }

    logger.info(`Created ${this.handoverTools.size} handover tools`);
  }

  private createReceptionistAgent(): void {
    logger.info('Creating receptionist agent...');

    const tools: Record<string, HandoverTool> = {};

    // Add all handover tools to receptionist
    for (const [toolName, tool] of this.handoverTools.entries()) {
      tools[toolName] = tool;
    }

    const modelInstance = createModelByKey(this.config.receptionist.model);

    this.receptionistAgent = new Agent<ChatContext>({
      name: this.config.receptionist.name,
      description: this.config.receptionist.description,
      instructions: this.config.receptionist.instructions,
      tools,
      model: modelInstance,
      maxTurns: 10,
    });

    logger.info(
      `✓ Receptionist agent created with ${Object.keys(tools).length} handover tools`
    );
  }

  private setupBidirectionalHandovers(): void {
    logger.info('Setting up bidirectional handovers...');

    // Create transfer back to receptionist tool
    const transferToReceptionist: HandoverTool = {
      type: 'handover',
      description: 'Call this tool to transfer back to the receptionist',
      parameters: z.object({
        topic: z.string().describe('User requested topic'),
      }),
      execute: async args => {
        const topic = ((args.topic as string) || '').trim();
        if (!this.receptionistAgent) {
          throw new Error('Receptionist agent is not available');
        }
        logger.debug(`Transferring back to receptionist for topic: ${topic}`);
        return {
          agent: this.receptionistAgent,
          context: { topic },
        };
      },
    };

    // Add transfer back tool to all specialized agents
    let agentsWithHandback = 0;
    for (const agent of this.agents.values()) {
      if (agent.tools) {
        agent.tools['transfer_to_receptionist'] = transferToReceptionist;
        agentsWithHandback++;
      }
    }

    logger.info(`✓ Added handback capability to ${agentsWithHandback} agents`);
  }

  public getReceptionistAgent(): Agent<ChatContext> {
    if (!this.receptionistAgent) {
      throw new Error('Receptionist agent not initialized');
    }
    return this.receptionistAgent;
  }

  public getAgent(agentId: string): Agent<ChatContext> | undefined {
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
    return this.config.agents.find(config => config.id === agentId);
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
    const agents = this.config.agents.map(config => ({
      id: config.id,
      name: config.name,
      enabled: config.enabled ?? false,
    }));

    return {
      total: agents.length,
      enabled: agents.filter(a => a.enabled).length,
      disabled: agents.filter(a => !a.enabled).length,
      agents,
    };
  }
}
