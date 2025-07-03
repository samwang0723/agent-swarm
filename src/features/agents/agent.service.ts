import { Agent } from '@mastra/core';
import { Tool } from 'ai';
import { toolRegistry } from '../mcp/mcp.repository';
import { createModelByKey, createModel } from '../../shared/config/models';
import { createBasicMastraAgent } from './agent.util';
import {
  convertMcpToolsToMastraTools as adapterConvertMcpTools,
  convertMultiServerMcpToolsToMastraTools as adapterConvertMultiServerTools,
} from './mastra.adapter';
import { mastraMemoryService } from './mastra.memory';
import logger from '../../shared/utils/logger';
import { createMastraMemory } from '../../shared/config/mastra';

/**
 * Creates a simple business agent with all available MCP tools.
 * This is a utility function for creating standalone agents.
 * For the full configured agent system, use AgentFactory.createBusinessLogicAgent()
 *
 * @param userId - User ID for Mastra memory scoping (required)
 * @param accessToken - Optional OAuth access token for MCP services
 * @returns A simple business agent with all available tools
 */
const createSimpleBusinessAgent = (
  userId: string,
  accessToken?: string
): Agent => {
  logger.info('Creating simple business agent with Mastra');

  // Initialize user memory if needed
  mastraMemoryService.initializeUserMemory(userId).catch(error => {
    logger.error('Failed to initialize user memory:', error);
  });

  // Get tools from registry and convert to Mastra format
  const toolsByServer = toolRegistry.getToolsByServerMap();
  const mastraTools = adapterConvertMultiServerTools(toolsByServer);

  // Set access token for servers that require auth
  if (accessToken) {
    toolRegistry.setAccessTokenForAll(accessToken);
  }

  const model = createModel();
  if (!model) {
    throw new Error('Failed to create model for simple business agent');
  }

  return createBasicMastraAgent({
    name: 'simple-business-agent',
    instructions: `You are a comprehensive business assistant with access to multiple services: ${toolRegistry.getServerNames().join(', ')}. 
    You can help users with various business tasks including data analysis, communication, project management, and more.
    Always provide helpful, accurate, and professional assistance.`,
    model,
    tools: mastraTools,
    memory: createMastraMemory(), // Pass actual Memory instance
  });
};

/**
 * Creates an agent with tools from multiple MCP servers
 *
 * @param userId - User ID for Mastra memory scoping (required)
 * @param serverNames - Array of MCP server names to include (defaults to all available)
 * @param systemPrompt - Optional custom system prompt
 * @param model - Optional model key
 * @returns Multi-service agent
 */
const createMultiServiceAgent = (
  userId: string,
  serverNames: string[] = [],
  systemPrompt?: string,
  model?: string
): Agent => {
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

  // Combine tools from specified servers
  const serverToolsMap: Record<string, Record<string, Tool>> = {};
  serversToUse.forEach(serverName => {
    const serverTools = toolsByServer[serverName] || {};
    serverToolsMap[serverName] = serverTools;
  });

  const modelInstance = createModelByKey(model);
  if (!modelInstance) {
    throw new Error('Failed to create model for multi-service agent');
  }
  const instructions =
    systemPrompt ||
    `You are a comprehensive assistant with access to multiple services: ${serversToUse.join(
      ', '
    )}. Available tools from these services allow you to help users with various tasks.`;

  logger.info('Creating multi-service agent with Mastra');

  // Convert tools to Mastra format
  const mastraTools = adapterConvertMultiServerTools(serverToolsMap);

  return createBasicMastraAgent({
    name: 'multi-service',
    instructions,
    model: modelInstance,
    tools: mastraTools,
    memory: createMastraMemory(), // Pass actual Memory instance
  });
};

/**
 * Creates an adaptive agent that uses all available MCP servers
 *
 * @param userId - User ID for Mastra memory scoping (required)
 * @param systemPrompt - Optional custom system prompt
 * @param model - Optional model key
 * @returns Adaptive agent
 */
const createAdaptiveAgent = (
  userId: string,
  systemPrompt?: string,
  model?: string
): Agent => {
  const availableServers = toolRegistry.getServerNames();
  const serverToolsMap: Record<string, Record<string, Tool>> = {};

  // Only add tools from servers that are actually available
  availableServers.forEach(serverName => {
    const serverTools = toolRegistry.getServerTools(serverName);
    serverToolsMap[serverName] = serverTools;
  });

  const modelInstance = createModelByKey(model);
  if (!modelInstance) {
    throw new Error('Failed to create model for adaptive agent');
  }
  const instructions =
    systemPrompt ||
    `You are an adaptive assistant. Available services: ${availableServers.join(', ')}`;

  logger.info('Creating adaptive agent with Mastra');

  // Convert tools to Mastra format
  const mastraTools = adapterConvertMultiServerTools(serverToolsMap);

  return createBasicMastraAgent({
    name: 'adaptive-agent',
    instructions,
    model: modelInstance,
    tools: mastraTools,
    memory: createMastraMemory(), // Pass actual Memory instance
  });
};

/**
 * Creates a specialized agent for a single MCP server
 *
 * @param userId - User ID for Mastra memory scoping (required)
 * @param serverName - Name of the MCP server to use
 * @param systemPrompt - Optional custom system prompt
 * @param agentName - Optional custom agent name
 * @param model - Optional model key
 * @returns Single-purpose agent
 */
const createSinglePurposeAgent = (
  userId: string,
  serverName: string,
  systemPrompt?: string,
  agentName?: string,
  model?: string
): Agent => {
  if (!toolRegistry.getServerNames().includes(serverName)) {
    throw new Error(`MCP server '${serverName}' is not available`);
  }

  const serverTools = toolRegistry.getServerTools(serverName);
  const toolNames = toolRegistry.getServerToolNames(serverName);
  const modelInstance = createModelByKey(model);
  if (!modelInstance) {
    throw new Error(`Failed to create model for ${serverName} agent`);
  }
  const name = agentName || `${serverName}-agent`;
  const instructions =
    systemPrompt ||
    `You are a specialized assistant for ${serverName} services. Available tools: ${toolNames.join(', ')}`;

  logger.info(`Creating single-purpose agent for ${serverName} with Mastra`);

  // Convert tools to Mastra format
  const mastraTools = adapterConvertMcpTools(serverTools, serverName);

  return createBasicMastraAgent({
    name,
    instructions,
    model: modelInstance,
    tools: mastraTools,
    memory: createMastraMemory(), // Pass actual Memory instance
  });
};

/**
 * Creates a custom Mastra agent with memory configuration
 *
 * @param userId - User ID for Mastra memory scoping (required)
 * @param name - Agent name
 * @param instructions - Agent instructions
 * @param serverNames - Array of MCP server names to include (defaults to all available)
 * @param model - Optional model key
 * @returns Custom Mastra agent
 */
const createMastraAgent = (
  userId: string,
  name: string,
  instructions: string,
  serverNames: string[] = [],
  model?: string
): Agent => {
  logger.info(`Creating Mastra agent: ${name}`);

  // Initialize user memory
  mastraMemoryService.initializeUserMemory(userId).catch(error => {
    logger.error('Failed to initialize user memory:', error);
  });

  // Get tools from specified servers or all available servers
  const availableServers = toolRegistry.getServerNames();
  const serversToUse = serverNames.length > 0 ? serverNames : availableServers;

  const serverToolsMap: Record<string, Record<string, Tool>> = {};
  serversToUse.forEach(serverName => {
    if (availableServers.includes(serverName)) {
      const serverTools = toolRegistry.getServerTools(serverName);
      serverToolsMap[serverName] = serverTools;
    }
  });

  // Convert tools to Mastra format
  const mastraTools = adapterConvertMultiServerTools(serverToolsMap);
  const modelInstance = createModelByKey(model);
  if (!modelInstance) {
    throw new Error(`Failed to create model for ${name} agent`);
  }

  return createBasicMastraAgent({
    name,
    instructions,
    model: modelInstance,
    tools: mastraTools,
    memory: createMastraMemory(), // Pass actual Memory instance
  });
};

// Export agent creators
export {
  createSimpleBusinessAgent,
  createMultiServiceAgent,
  createAdaptiveAgent,
  createSinglePurposeAgent,
  createMastraAgent,
  // Legacy export for backward compatibility
  createSimpleBusinessAgent as createBusinessLogicAgent,
};
