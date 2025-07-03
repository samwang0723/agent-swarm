import { AgentConfig, AgentSystemConfig } from '../config/agents';
import { mcpServers } from '../config/mcp';
import logger from './logger';

/**
 * Validates an agent configuration against available MCP servers
 */
export function validateAgentConfig(config: AgentConfig): {
  valid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check required fields
  if (!config.id) errors.push('Agent ID is required');
  if (!config.name) errors.push('Agent name is required');
  if (!config.systemPromptFile) errors.push('System prompt file is required');
  if (!config.mcpServers || config.mcpServers.length === 0) {
    errors.push('At least one MCP server is required');
  }

  // Validate MCP servers exist and are enabled
  const availableServers = mcpServers
    .filter(server => server.enabled)
    .map(server => server.name);

  const unavailableServers = config.mcpServers.filter(
    serverName => !availableServers.includes(serverName)
  );

  if (unavailableServers.length > 0) {
    errors.push(
      `MCP servers not available or disabled: ${unavailableServers.join(', ')}`
    );
  }

  // Check for auth requirements
  const requiresAuthServers = mcpServers
    .filter(
      server => server.requiresAuth && config.mcpServers.includes(server.name)
    )
    .map(server => server.name);

  if (requiresAuthServers.length > 0 && !config.requiresAuth) {
    warnings.push(
      `Agent uses servers that require auth but agent doesn't require auth: ${requiresAuthServers.join(', ')}`
    );
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validates the entire agent system configuration
 */
export function validateAgentSystemConfig(config: AgentSystemConfig): {
  valid: boolean;
  errors: string[];
  warnings: string[];
} {
  const allErrors: string[] = [];
  const allWarnings: string[] = [];

  // Check for duplicate agent IDs
  const agentIds = config.agents.map(agent => agent.id);
  const duplicateIds = agentIds.filter(
    (id, index) => agentIds.indexOf(id) !== index
  );
  if (duplicateIds.length > 0) {
    allErrors.push(`Duplicate agent IDs found: ${duplicateIds.join(', ')}`);
  }

  // Validate each agent configuration
  for (const agentConfig of config.agents) {
    const validation = validateAgentConfig(agentConfig);

    if (!validation.valid) {
      allErrors.push(
        `Agent ${agentConfig.id}: ${validation.errors.join(', ')}`
      );
    }

    if (validation.warnings.length > 0) {
      allWarnings.push(
        `Agent ${agentConfig.id}: ${validation.warnings.join(', ')}`
      );
    }
  }

  // Check if at least one agent is enabled
  const enabledAgents = config.agents.filter(agent => agent.enabled);
  if (enabledAgents.length === 0) {
    allWarnings.push('No agents are enabled');
  }

  return {
    valid: allErrors.length === 0,
    errors: allErrors,
    warnings: allWarnings,
  };
}

/**
 * Generates a template for a new agent configuration
 */
export function generateAgentTemplate(
  id: string,
  name: string,
  mcpServers: string[],
  options: {
    systemPromptFile?: string;
    requiresAuth?: boolean;
    routingKeywords?: string[];
    routingDescription?: string;
    enabled?: boolean;
  } = {}
): AgentConfig {
  return {
    id,
    name,
    description: `Handles ${name.toLowerCase()} related queries`,
    mcpServers,
    systemPromptFile: options.systemPromptFile || id,
    enabled: options.enabled ?? true,
    requiresAuth: options.requiresAuth ?? false,
    routingKeywords: options.routingKeywords || [id],
    routingDescription:
      options.routingDescription ||
      `Call this tool to transfer to the ${name}. This agent can handle ${name.toLowerCase()} related queries.`,
  };
}

/**
 * Logs agent system statistics and configuration
 */
export function logAgentSystemInfo(config: AgentSystemConfig): void {
  const stats = {
    totalAgents: config.agents.length,
    enabledAgents: config.agents.filter(a => a.enabled).length,
    authRequiredAgents: config.agents.filter(a => a.requiresAuth).length,
    mcpServersUsed: [...new Set(config.agents.flatMap(a => a.mcpServers))],
  };

  logger.info('Agent System Configuration:', {
    receptionist: config.receptionist.name,
    stats,
    agents: config.agents.map(a => ({
      id: a.id,
      name: a.name,
      enabled: a.enabled,
      requiresAuth: a.requiresAuth,
      mcpServers: a.mcpServers,
    })),
  });
}

/**
 * Helper to find agents by routing keywords
 */
export function findAgentsByKeyword(
  config: AgentSystemConfig,
  keyword: string
): AgentConfig[] {
  return config.agents.filter(
    agent =>
      agent.enabled &&
      agent.routingKeywords?.some(k =>
        k.toLowerCase().includes(keyword.toLowerCase())
      )
  );
}
