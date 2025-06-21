import { JsonSchema } from '@/shared/types/json-schema';

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
  inputSchema: JsonSchema;
  requiresAuth?: boolean; // Whether this specific tool requires authentication
}

export interface JsonRpcResponse {
  jsonrpc: '2.0';
  id: string | number | null;
  result?: unknown;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

export interface ToolsListResult {
  tools: McpTool[];
}

export interface ToolCallResult {
  content: {
    type: string;
    text: string;
  }[];
}
