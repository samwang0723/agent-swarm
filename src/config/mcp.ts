import { McpServerConfig } from '@tools/mcp-client';
import dotenv from 'dotenv';

dotenv.config();

export const mcpServers: McpServerConfig[] = [
  {
    name: 'restaurant-booking',
    url: process.env.RESTAURANT_BOOKING_MCP_URL || 'http://localhost:3000/mcp',
    healthUrl:
      process.env.RESTAURANT_BOOKING_MCP_HEALTH_URL ||
      'http://localhost:3000/health',
    enabled: process.env.RESTAURANT_BOOKING_MCP_ENABLED !== 'false',
  },
  {
    name: 'time',
    url: process.env.TIME_MCP_URL || 'http://localhost:3000/mcp',
    healthUrl:
      process.env.TIME_MCP_HEALTH_URL || 'http://localhost:3000/health',
    enabled: process.env.TIME_MCP_ENABLED !== 'false',
  },
  // {
  //   name: 'browser-booking',
  //   url: process.env.BROWSER_MCP_URL || 'http://localhost:3000/mcp',
  //   healthUrl:
  //     process.env.BROWSER_MCP_HEALTH_URL || 'http://localhost:3000/health',
  //   enabled: process.env.BROWSER_MCP_ENABLED !== 'false',
  // },
  // Add more MCP servers here as needed
];
