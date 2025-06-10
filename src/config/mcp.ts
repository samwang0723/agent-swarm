import { McpServerConfig } from '../tools/mcp-client.js';

export const mcpServers: McpServerConfig[] = [
  {
    name: 'restaurant-booking',
    url: process.env.RESTAURANT_BOOKING_MCP_URL || 'http://localhost:3001/mcp',
    healthUrl:
      process.env.RESTAURANT_BOOKING_MCP_HEALTH_URL ||
      'http://localhost:3001/health',
    enabled: process.env.RESTAURANT_BOOKING_MCP_ENABLED !== 'false',
  },
  // Add more MCP servers here as needed
];
