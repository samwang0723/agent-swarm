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
