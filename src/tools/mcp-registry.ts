import { Tool } from 'ai';
import { McpClient, McpServerConfig } from '@tools/mcp-client';
import logger from '@utils/logger';

export class McpRegistry {
  private clients: Map<string, McpClient> = new Map();
  private allTools: Map<string, Tool> = new Map();
  private toolsByServer: Map<string, Map<string, Tool>> = new Map();

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

      // Initialize server-specific tools map
      const serverTools = new Map<string, Tool>();
      this.toolsByServer.set(config.name, serverTools);

      // Register all tools from this client
      const tools = client.getAvailableTools();
      const toolNames = client.getToolNames();
      
      tools.forEach((tool, index) => {
        const toolName = toolNames[index];
        const prefixedName = `${config.name}_${toolName}`;
        
        // Store in flattened map with prefix
        this.allTools.set(prefixedName, tool);
        
        // Store in server-specific map without prefix
        serverTools.set(toolName, tool);
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
   * Get all registered tools as a flattened object with prefixed names
   */
  getTools(): Record<string, Tool> {
    const toolsObject: Record<string, Tool> = {};
    this.allTools.forEach((tool, name) => {
      toolsObject[name] = tool;
    });
    return toolsObject;
  }

  /**
   * Get tools grouped by MCP server name
   */
  getToolsByServerMap(): Record<string, Record<string, Tool>> {
    const serverToolsObject: Record<string, Record<string, Tool>> = {};
    
    this.toolsByServer.forEach((tools, serverName) => {
      const toolsObject: Record<string, Tool> = {};
      tools.forEach((tool, toolName) => {
        toolsObject[toolName] = tool;
      });
      serverToolsObject[serverName] = toolsObject;
    });
    
    return serverToolsObject;
  }

  /**
   * Get tools from a specific MCP server as objects
   */
  getServerTools(serverName: string): Record<string, Tool> {
    const serverTools = this.toolsByServer.get(serverName);
    if (!serverTools) {
      return {};
    }
    
    const toolsObject: Record<string, Tool> = {};
    serverTools.forEach((tool, toolName) => {
      toolsObject[toolName] = tool;
    });
    return toolsObject;
  }

  /**
   * Get tool names from a specific MCP server
   */
  getServerToolNames(serverName: string): string[] {
    const serverTools = this.toolsByServer.get(serverName);
    return serverTools ? Array.from(serverTools.keys()) : [];
  }

  /**
   * Get a specific tool by name
   */
  getTool(name: string): Tool | undefined {
    return this.allTools.get(name);
  }

  /**
   * Get a specific tool from a specific server
   */
  getServerTool(serverName: string, toolName: string): Tool | undefined {
    const serverTools = this.toolsByServer.get(serverName);
    return serverTools?.get(toolName);
  }

  /**
   * Check if a tool exists
   */
  hasTool(name: string): boolean {
    return this.allTools.has(name);
  }

  /**
   * Check if a server has a specific tool
   */
  hasServerTool(serverName: string, toolName: string): boolean {
    const serverTools = this.toolsByServer.get(serverName);
    return serverTools?.has(toolName) ?? false;
  }

  /**
   * Get tool names
   */
  getToolNames(): string[] {
    return Array.from(this.allTools.keys());
  }

  /**
   * Get available MCP server names
   */
  getServerNames(): string[] {
    return Array.from(this.toolsByServer.keys());
  }

  /**
   * Get status of all MCP clients
   */
  getStatus(): Record<string, { connected: boolean; toolCount: number }> {
    const status: Record<string, { connected: boolean; toolCount: number }> =
      {};

    this.configs.forEach(config => {
      const client = this.clients.get(config.name);
      const serverTools = this.toolsByServer.get(config.name);
      status[config.name] = {
        connected: !!client,
        toolCount: serverTools ? serverTools.size : 0,
      };
    });

    return status;
  }

}
