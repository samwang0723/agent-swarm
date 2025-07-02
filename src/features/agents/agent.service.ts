import { Agent, AgentFunctionTool } from 'agentswarm';
import { Tool } from 'ai';
import { AgentFactory } from '@/features/agents/agent.factory';
import { ChatContext } from './agent.dto';
import { toolRegistry } from '@/features/mcp/mcp.repository';
import { createModelByKey } from '@/shared/config/models';
import {
  convertToAgentTools,
  convertMultiServerToAgentTools,
} from '@/features/agents/agent.util';

/**
 * Creates and configures the business logic agent system using the AgentFactory.
 * This function serves as the main entry point for creating the agent hierarchy.
 *
 * @param accessToken - Optional OAuth access token for MCP services
 * @returns The receptionist agent that routes to specialized agents
 */
const createBusinessLogicAgent = (accessToken?: string): Agent<ChatContext> => {
  const factory = AgentFactory.getInstance();
  return factory.createBusinessLogicAgent(accessToken);
};

// Using tools from multiple servers
const createMultiServiceAgent = (
  serverNames: string[] = [],
  systemPrompt?: string,
  model?: string,
  extraTools: Record<string, AgentFunctionTool> = {}
) => {
  const toolsByServer = toolRegistry.getToolsByServerMap();
  const availableServers = toolRegistry.getServerNames();

  // If no server names provided, use all available servers
  const serversToUse = serverNames.length > 0 ? serverNames : availableServers;

  // Validate that all requested servers are available
  const unavailableServers = serversToUse.filter(
    serverName => !availableServers.includes(serverName)
  );
  if (unavailableServers.length > 0) {
    throw new Error(
      `MCP servers not available: ${unavailableServers.join(', ')}`
    );
  }

  // Combine tools from specified servers and convert to AgentFunctionTool format
  const serverToolsMap: Record<string, Record<string, Tool>> = {};
  serversToUse.forEach(serverName => {
    const serverTools = toolsByServer[serverName] || {};
    serverToolsMap[serverName] = serverTools;
  });

  const convertedTools = convertMultiServerToAgentTools(serverToolsMap);
  const combinedTools = { ...convertedTools, ...extraTools };
  const modelInstance = createModelByKey(model);

  return new Agent<ChatContext>({
    name: 'multi-service',
    description: '',
    instructions:
      systemPrompt ||
      `You are a comprehensive assistant with access to multiple services: ${serversToUse.join(
        ', '
      )}. Available tools from these services allow you to help users with various tasks.`,
    tools: combinedTools,
    model: modelInstance,
    maxTurns: 2,
  });
};

// Conditional tool assignment based on available servers
const createAdaptiveAgent = (systemPrompt?: string, model?: string) => {
  const availableServers = toolRegistry.getServerNames();
  const serverToolsMap: Record<string, Record<string, Tool>> = {};

  // Only add tools from servers that are actually available
  availableServers.forEach(serverName => {
    const serverTools = toolRegistry.getServerTools(serverName);
    serverToolsMap[serverName] = serverTools;
  });

  const tools = convertMultiServerToAgentTools(serverToolsMap);
  const modelInstance = createModelByKey(model);

  return new Agent<ChatContext>({
    name: 'adaptive-agent',
    description: '',
    instructions:
      systemPrompt ||
      `You are an adaptive assistant. Available services: ${availableServers.join(
        ', '
      )}`,
    tools: tools,
    model: modelInstance,
    maxTurns: 2,
  });
};

// Single-purpose agent factory
const createSinglePurposeAgent = (
  serverName: string,
  systemPrompt?: string,
  agentName?: string,
  model?: string
) => {
  if (!toolRegistry.getServerNames().includes(serverName)) {
    throw new Error(`MCP server '${serverName}' is not available`);
  }

  const serverTools = toolRegistry.getServerTools(serverName);
  const toolNames = toolRegistry.getServerToolNames(serverName);
  const convertedTools = convertToAgentTools(serverTools, serverName);

  const modelInstance = createModelByKey(model);

  return new Agent<ChatContext>({
    name: agentName || `${serverName}-agent`,
    description: '',
    instructions:
      systemPrompt ||
      `You are a specialized assistant for ${serverName} services. Available tools: ${toolNames.join(
        ', '
      )}`,
    tools: convertedTools,
    model: modelInstance,
    maxTurns: 2,
  });
};

// Export agent creators
export {
  createBusinessLogicAgent,
  createMultiServiceAgent,
  createAdaptiveAgent,
  createSinglePurposeAgent,
};
