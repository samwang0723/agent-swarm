import { Agent } from "@ai-sdk/swarm";
import { toolRegistry } from '@tools/index';

// Using tools from multiple servers
const createMultiServiceAgent = (serverNames: string[] = []) => {
  const toolsByServer = toolRegistry.getToolsByServerMap();
  const availableServers = toolRegistry.getServerNames();
  
  // If no server names provided, use all available servers
  const serversToUse = serverNames.length > 0 ? serverNames : availableServers;
  
  // Validate that all requested servers are available
  const unavailableServers = serversToUse.filter(serverName => !availableServers.includes(serverName));
  if (unavailableServers.length > 0) {
    throw new Error(`MCP servers not available: ${unavailableServers.join(', ')}`);
  }
  
  // Combine tools from specified servers
  const combinedTools: Record<string, any> = {};
  serversToUse.forEach(serverName => {
    const serverTools = toolsByServer[serverName] || {};
    Object.assign(combinedTools, serverTools);
  });
  
  return new Agent({
    name: "multi-service",
    system: `You are a comprehensive assistant with access to multiple services: ${serversToUse.join(', ')}. Available tools from these services allow you to help users with various tasks.`,
    tools: combinedTools
  });
};

// Conditional tool assignment based on available servers
const createAdaptiveAgent = () => {
  const availableServers = toolRegistry.getServerNames();
  const tools: Record<string, any> = {};
  
  // Only add tools from servers that are actually available
  availableServers.forEach(serverName => {
    const serverTools = toolRegistry.getServerTools(serverName);
    Object.assign(tools, serverTools);
  });
  
  return new Agent({
    name: "adaptive-agent",
    system: `You are an adaptive assistant. Available services: ${availableServers.join(', ')}`,
    tools: tools
  });
};

// Single-purpose agent factory
const createSinglePurposeAgent = (serverName: string, systemPrompt?: string, agentName?: string) => {
  if (!toolRegistry.getServerNames().includes(serverName)) {
    throw new Error(`MCP server '${serverName}' is not available`);
  }
  
  const serverTools = toolRegistry.getServerTools(serverName);
  const toolNames = toolRegistry.getServerToolNames(serverName);
  
  return new Agent({
    name: agentName || `${serverName}-agent`,
    system: systemPrompt || `You are a specialized assistant for ${serverName} services. Available tools: ${toolNames.join(', ')}`,
    tools: serverTools
  });
};

// Export agent creators
export {
  createMultiServiceAgent,
  createAdaptiveAgent,
  createSinglePurposeAgent,
};