import { McpRegistry } from '@tools/mcp-registry';
import { mcpServers } from '@config/mcp';
import logger from '@utils/logger';

export class ToolRegistry {
  private mcpRegistry: McpRegistry;

  constructor() {
    this.mcpRegistry = new McpRegistry(mcpServers);
    this.initializeTools();
  }

  private async initializeTools() {
    try {
      await this.mcpRegistry.initialize();
      logger.info(
        `Tool registry initialized with ${
          this.getToolNames().length
        } total tools`
      );
    } catch (error) {
      logger.error('Failed to initialize tools:', error);
    }
  }

  /**
   * Get all registered tools as a flattened object with prefixed names
   */
  getTools(): Record<string, any> {
    return this.mcpRegistry.getTools();
  }

  /**
   * Get tools grouped by MCP server name
   */
  getToolsByServerMap(): Record<string, Record<string, any>> {
    return this.mcpRegistry.getToolsByServerMap();
  }

  /**
   * Get tools from a specific MCP server
   */
  getServerTools(serverName: string): Record<string, any> {
    return this.mcpRegistry.getServerTools(serverName);
  }

  /**
   * Get tool names from a specific MCP server
   */
  getServerToolNames(serverName: string): string[] {
    return this.mcpRegistry.getServerToolNames(serverName);
  }

  /**
   * Get available MCP server names
   */
  getServerNames(): string[] {
    return this.mcpRegistry.getServerNames();
  }

  /**
   * Get a specific tool by name
   */
  getTool(name: string): any {
    return this.mcpRegistry.getTool(name);
  }

  /**
   * Get a specific tool from a specific server
   */
  getServerTool(serverName: string, toolName: string): any {
    return this.mcpRegistry.getServerTool(serverName, toolName);
  }

  /**
   * Check if a tool exists
   */
  hasTool(name: string): boolean {
    return this.mcpRegistry.hasTool(name);
  }

  /**
   * Check if a server has a specific tool
   */
  hasServerTool(serverName: string, toolName: string): boolean {
    return this.mcpRegistry.hasServerTool(serverName, toolName);
  }

  /**
   * Get tool names
   */
  getToolNames(): string[] {
    return this.mcpRegistry.getToolNames();
  }

  /**
   * Get MCP server status
   */
  getStatus(): Record<string, { connected: boolean; toolCount: number }> {
    return this.mcpRegistry.getStatus();
  }
}

// Export singleton instance
export const toolRegistry = new ToolRegistry();
