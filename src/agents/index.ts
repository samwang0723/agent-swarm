import { Agent } from 'agentswarm';
import { toolRegistry } from '@tools/index';
import { createModelByKey } from '@/config/models';
import { convertToAgentTools, convertMultiServerToAgentTools } from './convert';

export interface ChatContext {
  topic: string | null;
  accessToken?: string; // User's OAuth access token for MCP services
}

// Using tools from multiple servers
const createMultiServiceAgent = (
  serverNames: string[] = [],
  systemPrompt?: string,
  model?: string
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
  const serverToolsMap: Record<string, Record<string, any>> = {};
  serversToUse.forEach(serverName => {
    const serverTools = toolsByServer[serverName] || {};
    serverToolsMap[serverName] = serverTools;
  });

  const combinedTools = convertMultiServerToAgentTools(serverToolsMap);
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
    maxTurns: 10,
    temperature: 0.7,
  });
};

// Conditional tool assignment based on available servers
const createAdaptiveAgent = (systemPrompt?: string, model?: string) => {
  const availableServers = toolRegistry.getServerNames();
  const serverToolsMap: Record<string, Record<string, any>> = {};

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
    maxTurns: 10,
    temperature: 0.7,
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
    maxTurns: 10,
    temperature: 0.7,
  });
};

// Export agent creators
export {
  createMultiServiceAgent,
  createAdaptiveAgent,
  createSinglePurposeAgent,
};
