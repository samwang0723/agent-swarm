import { Tool } from 'ai';
import { McpClient, McpServerConfig } from './mcp-client.js';
import logger from '@utils/logger';

export class McpRegistry {
  private clients: Map<string, McpClient> = new Map();
  private allTools: Map<string, Tool> = new Map();

  constructor(private configs: McpServerConfig[]) {}

  async initialize(): Promise<void> {
    const initPromises = this.configs.map(config =>
      this.initializeClient(config)
    );

    // Initialize all clients in parallel
    const results = await Promise.allSettled(initPromises);

    // Log results
    results.forEach((result, index) => {
      const config = this.configs[index];
      if (result.status === 'rejected') {
        logger.error(
          `Failed to initialize MCP client for ${config.name}:`,
          result.reason
        );
      }
    });

    logger.info(
      `MCP Registry initialized with ${this.clients.size} active clients and ${this.allTools.size} total tools`
    );
  }

  private async initializeClient(config: McpServerConfig): Promise<void> {
    if (!config.enabled) {
      logger.info(`Skipping disabled MCP server: ${config.name}`);
      return;
    }

    try {
      const client = new McpClient(config);
      await client.initialize();

      this.clients.set(config.name, client);

      // Register all tools from this client
      const tools = client.getAvailableTools();
      tools.forEach((tool, index) => {
        const toolName = client.getToolNames()[index];
        const prefixedName = `${config.name}_${toolName}`;
        this.allTools.set(prefixedName, tool);
      });

      logger.info(`Registered ${tools.length} tools from ${config.name}`);
    } catch (error) {
      logger.error(
        `Failed to initialize MCP client for ${config.name}:`,
        error
      );
      throw error;
    }
  }

  /**
   * Get all registered tools as an object
   */
  getTools(): Record<string, Tool> {
    const toolsObject: Record<string, Tool> = {};
    this.allTools.forEach((tool, name) => {
      toolsObject[name] = tool;
    });
    return toolsObject;
  }

  /**
   * Get a specific tool by name
   */
  getTool(name: string): Tool | undefined {
    return this.allTools.get(name);
  }

  /**
   * Check if a tool exists
   */
  hasTool(name: string): boolean {
    return this.allTools.has(name);
  }

  /**
   * Get tool names
   */
  getToolNames(): string[] {
    return Array.from(this.allTools.keys());
  }

  /**
   * Get status of all MCP clients
   */
  getStatus(): Record<string, { connected: boolean; toolCount: number }> {
    const status: Record<string, { connected: boolean; toolCount: number }> =
      {};

    this.configs.forEach(config => {
      const client = this.clients.get(config.name);
      status[config.name] = {
        connected: !!client,
        toolCount: client ? client.getToolNames().length : 0,
      };
    });

    return status;
  }

  /**
   * Get tools from a specific MCP server
   */
  getToolsByServer(serverName: string): string[] {
    return this.getToolNames().filter(name =>
      name.startsWith(`${serverName}_`)
    );
  }
}
