import { Tool } from 'ai';
import { z } from 'zod';
import logger from '@utils/logger';
import type { ModelProvider } from '@config/models';

export interface McpServerConfig {
  name: string;
  url: string;
  healthUrl?: string;
  enabled: boolean;
  requiresAuth?: boolean; // Whether this MCP server requires authentication
}

export interface McpTool {
  name: string;
  description: string;
  inputSchema: any;
  requiresAuth?: boolean; // Whether this specific tool requires authentication
}

export class McpClient {
  private sessionId: string | null = null;
  private availableTools: McpTool[] = [];
  private accessToken: string | null = null;

  constructor(
    private config: McpServerConfig,
    private modelProvider?: ModelProvider
  ) {}

  /**
   * Set the OAuth access token for authenticated requests
   */
  setAccessToken(token: string | null): void {
    this.accessToken = token;
  }

  async initialize(): Promise<void> {
    if (!this.config.enabled) {
      logger.info(`MCP server ${this.config.name} is disabled`);
      return;
    }

    try {
      await this.healthCheck();
      await this.initializeSession();
      await this.loadTools();
      logger.info(
        `MCP client for ${this.config.name} initialized with ${this.availableTools.length} tools`
      );
    } catch (error) {
      logger.error(
        `Failed to initialize MCP client for ${this.config.name}:`,
        error
      );
      throw error;
    }
  }

  private async healthCheck(): Promise<void> {
    if (!this.config.healthUrl) return;

    const response = await fetch(this.config.healthUrl, {
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) {
      throw new Error(`Health check failed: ${response.status}`);
    }
  }

  private async initializeSession(): Promise<void> {
    // Match the exact format from the working test script
    const response = await fetch(this.config.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 'init',
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: { tools: {} },
          clientInfo: { name: 'agent-swarm', version: '1.0.0' },
        },
      }),
    });
    logger.info(`Session initialization request: ${this.config.url}`);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Session initialization failed: ${response.status} - ${errorText}`
      );
    }

    // Get the full response text to extract session ID (like curl -i)
    const responseText = await response.text();

    // Extract session ID from headers (check both response headers and response text)
    this.sessionId = response.headers.get('mcp-session-id');
    if (!this.sessionId) {
      // Try to extract from response text if it's in there
      const sessionMatch = responseText.match(/mcp-session-id:\s*([^\s\r\n]+)/);
      this.sessionId = sessionMatch ? sessionMatch[1].trim() : 'default';
    }

    logger.info(`MCP session initialized: ${this.sessionId}`);

    // Send initialized notification (skip response handling for notification)
    try {
      await fetch(this.config.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json, text/event-stream',
          'mcp-session-id': this.sessionId,
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'notifications/initialized',
          params: {},
        }),
      });
    } catch (error) {
      logger.warn('Failed to send initialized notification:', error);
      // Don't fail the whole initialization for this
    }
  }

  private async loadTools(): Promise<void> {
    const response = await fetch(this.config.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
        'mcp-session-id': this.sessionId!,
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'tools/list',
        id: 'list-tools',
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Failed to list tools: ${response.status} - ${errorText}`
      );
    }

    // Handle both JSON and SSE responses
    const responseText = await response.text();
    const result = this.parseResponse(responseText);

    if (result.error) {
      throw new Error(`Tools list error: ${result.error.message}`);
    }

    this.availableTools = result.result?.tools || [];
    logger.info(
      `Loaded ${this.availableTools.length} tools from ${this.config.name}:`,
      this.availableTools.map(t => t.name)
    );
  }

  async callTool(
    name: string,
    parameters: any,
    requiresAuth?: boolean
  ): Promise<any> {
    if (!this.sessionId) {
      throw new Error('MCP session not initialized');
    }

    // Check if authentication is required
    const needsAuth =
      requiresAuth ||
      this.config.requiresAuth ||
      this.availableTools.find(t => t.name === name)?.requiresAuth;

    if (needsAuth && !this.accessToken) {
      throw new Error(
        `Tool '${name}' requires authentication but no access token provided`
      );
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
      'mcp-session-id': this.sessionId,
    };

    // Add authorization header if needed
    if (needsAuth && this.accessToken) {
      headers['Authorization'] = `Bearer ${this.accessToken}`;
    }

    try {
      const response = await fetch(this.config.url, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'tools/call',
          params: { name, arguments: parameters },
          id: Date.now(),
        }),
        signal: AbortSignal.timeout(
          parseInt(process.env.MCP_TIMEOUT || '30000')
        ),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Tool call failed: ${response.status} ${response.statusText} - ${errorText}`
        );
      }

      // Handle both JSON and SSE responses
      const responseText = await response.text();
      const result = this.parseResponse(responseText);

      if (result.error) {
        throw new Error(`Tool execution error: ${result.error.message}`);
      }

      // Handle MCP response format
      if (result.result?.content?.[0]?.type === 'text') {
        const text = result.result.content[0].text;
        try {
          return JSON.parse(text);
        } catch {
          return text;
        }
      }

      return result.result;
    } catch (error: any) {
      if (error.name === 'TimeoutError' || error.name === 'AbortError') {
        const timeout = parseInt(process.env.MCP_TIMEOUT || '30000') / 1000;
        const errorMessage = `The tool call to '${name}' timed out after ${timeout} seconds. Please try again later.`;
        logger.error(errorMessage);
        return {
          error: errorMessage,
        };
      }
      throw error;
    }
  }

  getAvailableTools(): Tool[] {
    return this.availableTools.map(mcpTool => ({
      description: mcpTool.description,
      parameters: this.convertInputSchemaToZod(mcpTool.inputSchema),
      execute: async parameters => {
        return await this.callTool(
          mcpTool.name,
          parameters,
          mcpTool.requiresAuth
        );
      },
    }));
  }

  private convertInputSchemaToZod(schema: any): z.ZodType {
    if (!schema || schema.type !== 'object') {
      return z.object({});
    }

    // Log the schema conversion strategy being used
    if (this.modelProvider) {
      logger.debug(
        `Using ${this.modelProvider} schema conversion strategy for ${this.config.name}`
      );
    }

    const zodShape: Record<string, z.ZodType> = {};

    for (const [key, prop] of Object.entries(schema.properties || {})) {
      const property = prop as any;
      let zodType: z.ZodType;

      switch (property.type) {
        case 'string':
          zodType = z.string();
          if (property.enum) {
            zodType = z.enum(property.enum);
          }
          break;
        case 'number':
          zodType = z.number();
          if (property.minimum)
            zodType = (zodType as z.ZodNumber).min(property.minimum);
          if (property.maximum)
            zodType = (zodType as z.ZodNumber).max(property.maximum);
          break;
        case 'boolean':
          zodType = z.boolean();
          break;
        case 'array':
          zodType = z.array(z.string()); // Simplified for now
          break;
        default:
          zodType = z.any();
      }

      if (property.description) {
        zodType = zodType.describe(property.description);
      }

      // Conditional logic based on model provider
      let isRequired: boolean;

      if (this.modelProvider === 'google') {
        // For Google Gemini: Only mark as required if explicitly listed in the schema's required array
        isRequired = schema.required?.includes(key) ?? false;
      } else {
        // For Claude/OpenAI: Use stricter validation - required unless has default value
        isRequired =
          schema.required?.includes(key) ||
          (property.default === undefined &&
            !Object.prototype.hasOwnProperty.call(property, 'default'));
      }

      if (!isRequired) {
        zodType = zodType.optional();
      }

      zodShape[key] = zodType;
    }

    return z.object(zodShape);
  }

  getToolNames(): string[] {
    return this.availableTools.map(t => t.name);
  }

  private parseResponse(responseText: string): any {
    // Check if it's SSE format (starts with "event:")
    if (responseText.startsWith('event:')) {
      // Extract JSON from SSE data line
      const dataLine = responseText
        .split('\n')
        .find(line => line.startsWith('data:'));
      if (dataLine) {
        const jsonData = dataLine.substring(5).trim(); // Remove "data:" prefix
        try {
          return JSON.parse(jsonData);
        } catch {
          throw new Error(`Invalid JSON in SSE data: ${jsonData}`);
        }
      } else {
        throw new Error(`No data line found in SSE response: ${responseText}`);
      }
    } else {
      // Direct JSON response
      try {
        return JSON.parse(responseText);
      } catch {
        throw new Error(`Invalid JSON response: ${responseText}`);
      }
    }
  }
}
