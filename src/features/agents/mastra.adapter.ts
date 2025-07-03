import { Tool } from 'ai';
import { createTool } from '@mastra/core';
import { z } from 'zod';
import logger from '../../shared/utils/logger';
import { toolRegistry } from '../mcp/mcp.repository';
import { StoreInfo, UBER_EATS_DOMAIN } from './agent.dto';

/**
 * Converts a JSON Schema object to a Zod schema for Mastra tool compatibility
 * @param jsonSchema - JSON Schema object from MCP tool parameters
 * @returns Zod schema object
 */
function convertJsonSchemaToZod(
  jsonSchema: Record<string, unknown> | z.ZodTypeAny
): z.ZodTypeAny {
  // If the schema is already a Zod schema, return it directly
  if (jsonSchema instanceof z.ZodType) {
    if (process.env.DEBUG_MCP === '1') {
      logger.info(
        `[DEBUG_MCP] Schema is already a Zod instance, returning directly.`
      );
    }
    return jsonSchema;
  }

  if (process.env.DEBUG_MCP === '1') {
    logger.info(
      `[DEBUG_MCP] Schema conversion input:`,
      JSON.stringify(jsonSchema, null, 2)
    );
  }

  if (!jsonSchema || typeof jsonSchema !== 'object') {
    if (process.env.DEBUG_MCP === '1') {
      logger.warn(
        `[DEBUG_MCP] Invalid JSON schema - falling back to z.unknown():`,
        jsonSchema
      );
    }
    return z.unknown();
  }

  const {
    type,
    properties,
    required = [],
    items,
    enum: enumValues,
  } = jsonSchema;

  switch (type) {
    case 'string': {
      let stringSchema: z.ZodString | z.ZodEnum<[string, ...string[]]> =
        z.string();
      if (enumValues && Array.isArray(enumValues) && enumValues.length > 0) {
        // Validate that all enum values are strings and array is non-empty
        const stringEnumValues = enumValues.filter(
          (val): val is string => typeof val === 'string'
        );
        if (stringEnumValues.length > 0) {
          stringSchema = z.enum(stringEnumValues as [string, ...string[]]);
        }
      }
      return stringSchema;
    }

    case 'number':
      return z.number();

    case 'integer':
      return z.number().int();

    case 'boolean':
      return z.boolean();

    case 'array': {
      if (items) {
        return z.array(
          convertJsonSchemaToZod(items as Record<string, unknown>)
        );
      }
      return z.array(z.unknown());
    }

    case 'object': {
      if (process.env.DEBUG_MCP === '1') {
        logger.info(`[DEBUG_MCP] Converting object schema:`);
        logger.info(
          `[DEBUG_MCP] - Properties:`,
          JSON.stringify(properties, null, 2)
        );
        logger.info(`[DEBUG_MCP] - Required fields:`, required);
      }

      if (properties && typeof properties === 'object') {
        const shape: Record<string, z.ZodTypeAny> = {};

        for (const [key, value] of Object.entries(properties)) {
          let fieldSchema = convertJsonSchemaToZod(
            value as Record<string, unknown>
          );

          // Make field optional if not in required array
          if (!Array.isArray(required) || !required.includes(key)) {
            fieldSchema = fieldSchema.optional();
            if (process.env.DEBUG_MCP === '1') {
              logger.info(`[DEBUG_MCP] - Field '${key}' marked as optional`);
            }
          } else {
            if (process.env.DEBUG_MCP === '1') {
              logger.info(`[DEBUG_MCP] - Field '${key}' marked as required`);
            }
          }

          shape[key] = fieldSchema;
        }

        if (process.env.DEBUG_MCP === '1') {
          logger.info(
            `[DEBUG_MCP] - Created object schema with fields:`,
            Object.keys(shape)
          );
        }
        return z.object(shape);
      }
      return z.record(z.unknown());
    }

    default:
      if (process.env.DEBUG_MCP === '1') {
        logger.warn(
          `[DEBUG_MCP] Unknown schema type '${type}' - falling back to z.unknown()`
        );
      }
      return z.unknown();
  }
}

/**
 * Parses Uber Eats store information from raw text
 * This preserves the existing parsing logic from agent.util.ts
 */
function parseUberEatsStores(rawText: string): string {
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
    return stores
      .map(
        store =>
          `- ${store.name}, ${store.url}, Delivery in: ${store.deliveryTime}`
      )
      .join('\n');
  }

  return rawText;
}

/**
 * Creates a Mastra tool from an MCP Tool object
 * @param toolName - Name of the tool
 * @param mcpTool - MCP Tool object from 'ai' library
 * @param serverName - Optional server name for access token injection
 * @returns Mastra tool created with createTool
 */
export function createMastraToolFromMcp(
  toolName: string,
  mcpTool: Tool,
  serverName?: string
) {
  // Convert JSON Schema parameters to Zod schema
  const inputSchema = mcpTool.parameters
    ? convertJsonSchemaToZod(mcpTool.parameters)
    : z.object({});

  if (process.env.DEBUG_MCP === '1') {
    logger.info(`[DEBUG_MCP] Creating Mastra tool: ${toolName}`);
    logger.info(`[DEBUG_MCP] - Server: ${serverName || 'unknown'}`);
    logger.info(`[DEBUG_MCP] - Description: ${mcpTool.description}`);
    logger.info(
      `[DEBUG_MCP] - Original parameters:`,
      JSON.stringify(mcpTool.parameters, null, 2)
    );
  }

  return createTool({
    id: toolName,
    description: mcpTool.description || `Tool: ${toolName}`,
    inputSchema,
    execute: async (params, context) => {
      if (process.env.DEBUG_MCP === '1') {
        logger.info(`[DEBUG_MCP] Mastra tool execution started: ${toolName}`);
        logger.info(
          `[DEBUG_MCP] - Incoming params:`,
          JSON.stringify(params, null, 2)
        );
        logger.info(`[DEBUG_MCP] - Context:`, JSON.stringify(context, null, 2));

        // Special attention to query parameter
        if (params && typeof params === 'object' && 'query' in params) {
          logger.info(
            `[DEBUG_MCP] - Query parameter present: "${params.query}"`
          );
        } else {
          logger.warn(`[DEBUG_MCP] - Query parameter NOT found in params`);
        }
      }

      try {
        // Inject access token from context if available and server requires auth
        if (
          serverName &&
          context &&
          typeof context === 'object' &&
          'accessToken' in context
        ) {
          toolRegistry.setAccessTokenForServer(
            serverName,
            (context as { accessToken: string }).accessToken
          );
        }

        // Execute the original MCP tool
        if (mcpTool.execute) {
          // Create minimal ToolExecutionOptions object for AI SDK compatibility
          const toolOptions = {
            abortSignal: undefined, // Could be passed through context if needed
            toolCallId: `${toolName}-${Date.now()}`, // Generate unique ID
            messages: [], // Required by ToolExecutionOptions
          };

          if (process.env.DEBUG_MCP === '1') {
            logger.info(`[DEBUG_MCP] Pre-MCP tool execution: ${toolName}`);
            logger.info(
              `[DEBUG_MCP] - Parameters being passed to MCP:`,
              JSON.stringify(params, null, 2)
            );
            logger.info(
              `[DEBUG_MCP] - Tool options:`,
              JSON.stringify(toolOptions, null, 2)
            );

            // Confirm query parameter is still present
            if (params && typeof params === 'object' && 'query' in params) {
              logger.info(
                `[DEBUG_MCP] - Query parameter confirmed before MCP call: "${params.query}"`
              );
            } else {
              logger.error(
                `[DEBUG_MCP] - Query parameter LOST before MCP call!`
              );
            }
          }

          const result = await mcpTool.execute(params, toolOptions);

          if (process.env.DEBUG_MCP === '1') {
            logger.info(
              `[DEBUG_MCP] Raw result from MCP tool:`,
              JSON.stringify(result, null, 2)
            );
          }

          let finalResult = result;

          // Apply Uber Eats parsing if result is a string (preserving existing logic)
          if (typeof result === 'string') {
            if (process.env.DEBUG_MCP === '1') {
              logger.info(
                `[DEBUG_MCP] Applying Uber Eats parsing to string result`
              );
            }
            finalResult = parseUberEatsStores(result);
            if (process.env.DEBUG_MCP === '1') {
              logger.info(
                `[DEBUG_MCP] Result after Uber Eats parsing:`,
                JSON.stringify(finalResult, null, 2)
              );
            }
          }

          if (process.env.DEBUG_MCP === '1') {
            logger.info(
              `[DEBUG_MCP] Final result structure:`,
              JSON.stringify({ result: finalResult, context: {} }, null, 2)
            );
          }

          // Return the result in a consistent format
          return { result: finalResult, context: {} };
        }

        const error = `Tool ${toolName} has no execute function`;
        if (process.env.DEBUG_MCP === '1') {
          logger.error(`[DEBUG_MCP] Tool execution error: ${error}`);
        }
        throw new Error(error);
      } catch (error) {
        if (process.env.DEBUG_MCP === '1') {
          logger.error(`[DEBUG_MCP] Error executing Mastra tool ${toolName}:`, {
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
            params,
            context,
          });
        }
        logger.error(`Error executing Mastra tool ${toolName}:`, error);
        // Re-throw the error so the agent can handle it
        throw error;
      }
    },
  });
}

/**
 * Converts MCP tools to Mastra tool format
 * @param mcpTools - Record of MCP Tool objects
 * @param serverName - Optional server name for access token injection
 * @returns Array of Mastra tools
 */
export function convertMcpToolsToMastraTools(
  mcpTools: Record<string, Tool>,
  serverName?: string
) {
  const mastraTools: ReturnType<typeof createMastraToolFromMcp>[] = [];

  for (const [toolName, mcpTool] of Object.entries(mcpTools)) {
    try {
      const mastraTool = createMastraToolFromMcp(toolName, mcpTool, serverName);
      mastraTools.push(mastraTool);
    } catch (error) {
      logger.error(
        `Failed to convert MCP tool ${toolName} to Mastra format:`,
        error
      );
      // Continue with other tools instead of failing completely
    }
  }

  return mastraTools;
}

/**
 * Converts multiple server tools to Mastra tools with server prefixing
 * @param toolsByServer - Record of MCP tools grouped by server name
 * @returns Array of Mastra tools with prefixed names to avoid conflicts
 */
export function convertMultiServerMcpToolsToMastraTools(
  toolsByServer: Record<string, Record<string, Tool>>
) {
  const allMastraTools: ReturnType<typeof createMastraToolFromMcp>[] = [];

  for (const [serverName, serverTools] of Object.entries(toolsByServer)) {
    try {
      const serverMastraTools: ReturnType<typeof createMastraToolFromMcp>[] =
        [];

      for (const [toolName, mcpTool] of Object.entries(serverTools)) {
        try {
          // Create tool with server prefix to avoid naming conflicts
          const prefixedToolName = `${serverName}_${toolName}`;
          const mastraTool = createMastraToolFromMcp(
            prefixedToolName,
            {
              ...mcpTool,
              description: `[${serverName}] ${mcpTool.description || toolName}`,
            },
            serverName
          );

          serverMastraTools.push(mastraTool);
        } catch (error) {
          logger.error(
            `Failed to convert tool ${toolName} from server ${serverName}:`,
            error
          );
        }
      }

      allMastraTools.push(...serverMastraTools);
      logger.info(
        `Converted ${serverMastraTools.length} tools from server ${serverName} to Mastra format`
      );
    } catch (error) {
      logger.error(`Failed to convert tools from server ${serverName}:`, error);
    }
  }

  return allMastraTools;
}

/**
 * Converts tools from the tool registry to Mastra format
 * @returns Array of all Mastra tools from the registry
 */
export function convertRegistryToolsToMastraTools() {
  const toolsByServer = toolRegistry.getToolsByServerMap();
  return convertMultiServerMcpToolsToMastraTools(toolsByServer);
}

/**
 * Converts tools from a specific server to Mastra format
 * @param serverName - Name of the MCP server
 * @returns Array of Mastra tools from the specified server
 */
export function convertServerToolsToMastraTools(serverName: string) {
  const serverTools = toolRegistry.getServerTools(serverName);
  return convertMcpToolsToMastraTools(serverTools, serverName);
}
