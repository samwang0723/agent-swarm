import { Tool } from 'ai';
import { readFileSync } from 'fs';
import { join } from 'path';
import { AgentFunctionTool } from 'agentswarm';
import { z } from 'zod';

import logger from '@/shared/utils/logger';
import { toolRegistry } from '@/features/mcp/mcp.repository';
import { ChatContext, StoreInfo, UBER_EATS_DOMAIN } from './agent.dto';

/**
 * Converts serverTools (Tool objects from 'ai' library) to AgentFunctionTool format
 * @param serverTools - Record of Tool objects from MCP servers
 * @param serverName - Name of the MCP server (for token injection)
 * @returns Record of AgentFunctionTool objects
 */
export function convertToAgentTools(
  serverTools: Record<string, Tool>,
  serverName?: string
): Record<string, AgentFunctionTool> {
  const agentTools: Record<string, AgentFunctionTool> = {};

  for (const [toolName, tool] of Object.entries(serverTools)) {
    agentTools[toolName] = {
      type: 'function' as const,
      description: tool.description,
      parameters: tool.parameters as z.ZodObject<z.ZodRawShape>,
      execute: async (
        args: Record<string, unknown> & Partial<ChatContext>,
        options: { abortSignal?: AbortSignal }
      ) => {
        try {
          // Inject access token from context if available
          if (serverName && args?.accessToken) {
            toolRegistry.setAccessTokenForServer(serverName, args.accessToken);
          }

          // The original tool.execute expects both args and ToolExecutionOptions
          if (tool.execute) {
            // Create minimal ToolExecutionOptions object
            const toolOptions = {
              abortSignal: options?.abortSignal,
              toolCallId: `${toolName}-${Date.now()}`, // Generate unique ID
              messages: [], // Required by ToolExecutionOptions
            };

            const result = await tool.execute(args, toolOptions);
            let finalResult = result;
            if (typeof result === 'string') {
              finalResult = parseUberEatsStores(result);
            }

            // Ensure we return the result in a consistent format
            return { result: finalResult, context: {} };
          }

          const error = `Tool ${toolName} has no execute function`;
          throw new Error(error);
        } catch (error) {
          logger.error(`Error executing tool ${toolName}:`, error);
          // Re-throw the error so the agent can handle it
          throw error;
        }
      },
    };
  }

  return agentTools;
}

/**
 * Converts multiple server tools to agent tools format
 * @param toolsByServer - Record of server tools grouped by server name
 * @returns Record of AgentFunctionTool objects with combined tools
 */
export function convertMultiServerToAgentTools(
  toolsByServer: Record<string, Record<string, Tool>>
): Record<string, AgentFunctionTool> {
  const combinedTools: Record<string, AgentFunctionTool> = {};

  for (const [serverName, serverTools] of Object.entries(toolsByServer)) {
    const convertedTools = convertToAgentTools(serverTools, serverName);

    // Add server prefix to avoid naming conflicts
    for (const [toolName, toolConfig] of Object.entries(convertedTools)) {
      if (combinedTools[toolName]) {
        logger.warn(
          `Tool name collision: The tool '${toolName}' from server '${serverName}' is overwriting a previously registered tool with the same name.`
        );
      }
      combinedTools[toolName] = {
        ...toolConfig,
        description: `[${serverName}] ${toolConfig.description}`,
      };
    }
  }

  return combinedTools;
}

function formatStoreOutput(store: StoreInfo): string {
  return `- ${store.name}, ${store.url}, Delivery in: ${store.deliveryTime}`;
}

export function parseUberEatsStores(rawText: string): string {
  if (!rawText.includes('- heading "All stores"')) {
    return rawText;
  }

  const stores: StoreInfo[] = [];

  // A new store block seems to start with a line like:
  // - generic [ref=e...]:
  const storeBlocks = rawText.split(/\n(?=\s*-\s*generic\s*\[ref=e\d+\]:)/);

  for (const block of storeBlocks) {
    try {
      const nameMatch = block.match(/- link "([^"]+)":/);
      const urlMatch = block.match(/- \/url: (.*)/);
      const timeMatch = block.match(/- generic: (\d+\s*min)/);

      if (nameMatch && urlMatch && timeMatch) {
        stores.push({
          name: nameMatch[1],
          url: `${UBER_EATS_DOMAIN}${urlMatch[1].trim()}`,
          deliveryTime: timeMatch[1],
        });
      }
    } catch (e) {
      logger.error('Error parsing store block:', e);
    }
  }

  if (stores.length > 0) {
    return stores.map(formatStoreOutput).join('\n');
  }

  return rawText;
}

// Load system prompt from file
function loadSystemPrompt(domain: string): string {
  try {
    // Use process.cwd() to get the project root, then navigate to config
    const promptPath = join(process.cwd(), `src/shared/prompts/${domain}.txt`);
    return readFileSync(promptPath, 'utf-8').trim();
  } catch (error) {
    logger.error('Failed to load system prompt from file:', error);
    // Fallback to a basic prompt if file loading fails
    return `You are a professional ${domain} assistant with access to various tools and services.`;
  }
}

export { loadSystemPrompt };
