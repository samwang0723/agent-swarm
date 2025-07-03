import { Tool } from 'ai';
import { z } from 'zod';
import logger from '../../shared/utils/logger';
import type { ModelProvider } from '../../shared/config/models';
import {
  McpServerConfig,
  McpTool,
  JsonRpcResponse,
  ToolsListResult,
  ToolCallResult,
} from './mcp.dto';
import { JsonSchema } from '../../shared/types/json-schema';

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

    this.availableTools = (result.result as ToolsListResult)?.tools || [];

    // Debug logging for schema analysis
    if (process.env.DEBUG_MCP === '1') {
      logger.info(`[DEBUG_MCP] Schema loading for ${this.config.name}:`);
      this.availableTools.forEach(tool => {
        logger.info(`[DEBUG_MCP] Tool: ${tool.name}`);
        logger.info(`[DEBUG_MCP] Description: ${tool.description}`);
        logger.info(
          `[DEBUG_MCP] Input Schema:`,
          JSON.stringify(tool.inputSchema, null, 2)
        );

        // Special attention to brave_web_search tool
        if (tool.name === 'brave_web_search') {
          logger.info(`[DEBUG_MCP] BRAVE_WEB_SEARCH SCHEMA ANALYSIS:`);
          logger.info(`[DEBUG_MCP] - Type: ${tool.inputSchema?.type}`);
          logger.info(
            `[DEBUG_MCP] - Properties:`,
            JSON.stringify(tool.inputSchema?.properties, null, 2)
          );
          logger.info(
            `[DEBUG_MCP] - Required fields:`,
            tool.inputSchema?.required
          );
          logger.info(
            `[DEBUG_MCP] - Has query property: ${!!tool.inputSchema?.properties?.query}`
          );
        }
      });
    }

    logger.info(
      `Loaded ${this.availableTools.length} tools from ${this.config.name}:`,
      this.availableTools.map(t => t.name)
    );
  }

  async callTool(
    name: string,
    parameters: Record<string, unknown>,
    requiresAuth?: boolean
  ): Promise<unknown> {
    if (process.env.DEBUG_MCP === '1') {
      logger.info(`[DEBUG_MCP] Tool execution started:`);
      logger.info(`[DEBUG_MCP] - Tool name: ${name}`);
      logger.info(
        `[DEBUG_MCP] - Parameters:`,
        JSON.stringify(parameters, null, 2)
      );
      logger.info(`[DEBUG_MCP] - Requires auth: ${requiresAuth}`);
    }

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

    const payload = {
      jsonrpc: '2.0',
      method: 'tools/call',
      params: { name, arguments: parameters },
      id: Date.now(),
    };

    if (process.env.DEBUG_MCP === '1') {
      logger.info(
        `[DEBUG_MCP] JSON-RPC payload:`,
        JSON.stringify(payload, null, 2)
      );
      logger.info(`[DEBUG_MCP] Request headers:`, headers);
    }

    try {
      const response = await fetch(this.config.url, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(
          parseInt(process.env.MCP_TIMEOUT || '30000')
        ),
      });

      if (!response.ok) {
        const errorText = await response.text();
        const errorMessage = `Tool call failed: ${response.status} ${response.statusText} - ${errorText}`;

        if (process.env.DEBUG_MCP === '1') {
          logger.error(`[DEBUG_MCP] HTTP error during tool call:`, {
            toolName: name,
            parameters,
            status: response.status,
            statusText: response.statusText,
            errorText,
            payload,
            headers,
          });
        }

        throw new Error(errorMessage);
      }

      // Handle both JSON and SSE responses
      const responseText = await response.text();

      if (process.env.DEBUG_MCP === '1') {
        logger.info(`[DEBUG_MCP] Raw response from MCP server:`, responseText);
      }

      const result = this.parseResponse(responseText);

      if (process.env.DEBUG_MCP === '1') {
        logger.info(
          `[DEBUG_MCP] Parsed response:`,
          JSON.stringify(result, null, 2)
        );
      }

      if (result.error) {
        const errorMessage = `Tool execution error: ${result.error.message}`;
        if (process.env.DEBUG_MCP === '1') {
          logger.error(`[DEBUG_MCP] Tool call failed:`, {
            toolName: name,
            parameters,
            error: result.error,
            payload,
            responseText,
          });
        }
        throw new Error(errorMessage);
      }

      // Handle MCP response format
      const toolCallResult = result.result as ToolCallResult;
      if (toolCallResult?.content?.[0]?.type === 'text') {
        const text = toolCallResult.content[0].text;
        try {
          return JSON.parse(text);
        } catch {
          return text;
        }
      }

      return result.result;
    } catch (error: unknown) {
      if (
        error instanceof Error &&
        (error.name === 'TimeoutError' || error.name === 'AbortError')
      ) {
        const timeout = parseInt(process.env.MCP_TIMEOUT || '30000') / 1000;
        const errorMessage = `The tool call to '${name}' timed out after ${timeout} seconds. Please try again later.`;

        if (process.env.DEBUG_MCP === '1') {
          logger.error(`[DEBUG_MCP] Tool call timeout:`, {
            toolName: name,
            parameters,
            timeout,
            error: error.message,
          });
        }

        logger.error(errorMessage);
        return {
          error: errorMessage,
        };
      }

      if (process.env.DEBUG_MCP === '1') {
        logger.error(`[DEBUG_MCP] Unexpected error during tool call:`, {
          toolName: name,
          parameters,
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        });
      }

      throw error;
    }
  }

  getAvailableTools(): Tool[] {
    if (process.env.DEBUG_MCP === '1') {
      logger.info(
        `[DEBUG_MCP] Converting ${this.availableTools.length} MCP tools to AI tools`
      );
    }

    return this.availableTools.map(mcpTool => {
      const zodSchema = this.convertInputSchemaToZod(mcpTool.inputSchema);

      if (process.env.DEBUG_MCP === '1') {
        logger.info(`[DEBUG_MCP] Registering tool: ${mcpTool.name}`);
        logger.info(`[DEBUG_MCP] - Description: ${mcpTool.description}`);
        logger.info(
          `[DEBUG_MCP] - Original schema:`,
          JSON.stringify(mcpTool.inputSchema, null, 2)
        );
        logger.info(
          `[DEBUG_MCP] - Zod schema applied: ${zodSchema.constructor.name}`
        );

        // Special logging for brave_web_search
        if (mcpTool.name === 'brave_web_search') {
          logger.info(`[DEBUG_MCP] BRAVE_WEB_SEARCH TOOL REGISTRATION:`);
          logger.info(
            `[DEBUG_MCP] - Schema type: ${mcpTool.inputSchema?.type}`
          );
          logger.info(
            `[DEBUG_MCP] - Has query in properties: ${!!mcpTool.inputSchema?.properties?.query}`
          );
          logger.info(
            `[DEBUG_MCP] - Query is required: ${mcpTool.inputSchema?.required?.includes('query')}`
          );
        }
      }

      return {
        description: mcpTool.description,
        parameters: zodSchema,
        execute: async parameters => {
          return await this.callTool(
            mcpTool.name,
            parameters,
            mcpTool.requiresAuth
          );
        },
      };
    });
  }

  private convertInputSchemaToZod(schema: JsonSchema): z.ZodType {
    if (process.env.DEBUG_MCP === '1') {
      logger.info(
        `[DEBUG_MCP] Schema conversion input:`,
        JSON.stringify(schema, null, 2)
      );
    }

    if (!schema || !schema.type) {
      if (process.env.DEBUG_MCP === '1') {
        logger.warn(
          `[DEBUG_MCP] Invalid schema - falling back to z.any():`,
          schema
        );
      }
      // Return a default schema if the input is invalid
      return z.any();
    }

    switch (schema.type) {
      case 'object': {
        const shape: z.ZodRawShape = {};
        if (schema.properties) {
          for (const key of Object.keys(schema.properties)) {
            const prop = schema.properties[key];
            let zodType = this.convertInputSchemaToZod(prop).describe(
              prop.description || ''
            );

            if (!schema.required?.includes(key)) {
              zodType = zodType.optional();
            }
            shape[key] = zodType;
          }
        }
        return z.object(shape);
      }
      case 'string':
        return z.string().describe(schema.description || '');
      case 'number':
      case 'integer':
        return z.number().describe(schema.description || '');
      case 'boolean':
        return z.boolean().describe(schema.description || '');
      case 'array':
        if (schema.items) {
          return z
            .array(this.convertInputSchemaToZod(schema.items))
            .describe(schema.description || '');
        }
        return z.array(z.any()).describe(schema.description || ''); // Fallback for arrays with no item schema
      default:
        if (process.env.DEBUG_MCP === '1') {
          logger.warn(
            `[DEBUG_MCP] Unknown schema type '${schema.type}' - falling back to z.any()`
          );
        }
        return z.any(); // Fallback for unknown types
    }

    // Note: We can't easily log the resulting Zod schema as it's not serializable,
    // but we can log when we successfully convert specific types
  }

  getToolNames(): string[] {
    return this.availableTools.map(t => t.name);
  }

  private parseResponse(responseText: string): JsonRpcResponse {
    try {
      // Handle JSON-RPC response
      if (responseText.trim().startsWith('{')) {
        return JSON.parse(responseText);
      }

      // Handle Server-Sent Events (SSE) stream
      const lines = responseText
        .trim()
        .split('\n')
        .filter(line => line.startsWith('data: '));

      if (lines.length > 0) {
        // In case of multiple data lines, we might need to decide how to handle them.
        // For now, parsing the last one as it's most likely the final result.
        const lastLine = lines[lines.length - 1];
        const jsonData = lastLine.substring(5).trim();
        return JSON.parse(jsonData);
      }

      // Fallback for unexpected format
      throw new Error('Invalid response format');
    } catch (error) {
      logger.error('Failed to parse MCP response:', {
        responseText,
        error,
      });
      // Ensure a consistent error format
      return {
        jsonrpc: '2.0',
        id: null,
        error: {
          code: -32700, // Parse error
          message: 'Failed to parse response',
          data: responseText,
        },
      };
    }
  }
}
