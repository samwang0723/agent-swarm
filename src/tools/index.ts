import { McpRegistry } from './mcp-registry.js';
import { mcpServers } from '../config/mcp.js';
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
   * Get all registered tools as an object
   */
  getTools(): Record<string, any> {
    return this.mcpRegistry.getTools();
  }

  /**
   * Get a specific tool by name
   */
  getTool(name: string): any {
    return this.mcpRegistry.getTool(name);
  }

  /**
   * Check if a tool exists
   */
  hasTool(name: string): boolean {
    return this.mcpRegistry.hasTool(name);
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
