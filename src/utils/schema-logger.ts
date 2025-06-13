import { z } from 'zod';
import logger from './logger';

/**
 * Utility to extract readable schema information from Zod objects for LLM consumption
 */

interface ToolSchemaInfo {
  name: string;
  description: string;
  parameters: {
    type: string;
    properties?: Record<string, any>;
    required?: string[];
  };
  server?: string;
}

/**
 * Extract JSON Schema-like structure from Zod schema
 */
export function extractZodSchema(zodSchema: z.ZodType): any {
  try {
    // Handle ZodObject
    if (zodSchema instanceof z.ZodObject) {
      const shape = zodSchema.shape;
      const properties: Record<string, any> = {};
      const required: string[] = [];

      for (const [key, value] of Object.entries(shape)) {
        const zodType = value as z.ZodType;
        properties[key] = extractZodTypeInfo(zodType);

        // Check if field is required (not optional)
        if (!zodType.isOptional()) {
          required.push(key);
        }
      }

      return {
        type: 'object',
        properties,
        required: required.length > 0 ? required : undefined,
      };
    }

    // For other types, try to extract basic info
    return extractZodTypeInfo(zodSchema);
  } catch (error) {
    logger.warn('Failed to extract Zod schema:', error);
    return { type: 'unknown', description: 'Schema extraction failed' };
  }
}

/**
 * Extract information from individual Zod types
 */
function extractZodTypeInfo(zodType: z.ZodType): any {
  try {
    // Get description if available
    const description = zodType.description;

    // Handle different Zod types
    if (zodType instanceof z.ZodString) {
      return { type: 'string', description };
    }

    if (zodType instanceof z.ZodNumber) {
      return { type: 'number', description };
    }

    if (zodType instanceof z.ZodBoolean) {
      return { type: 'boolean', description };
    }

    if (zodType instanceof z.ZodArray) {
      return {
        type: 'array',
        items: extractZodTypeInfo(zodType.element),
        description,
      };
    }

    if (zodType instanceof z.ZodEnum) {
      return {
        type: 'string',
        enum: zodType.options,
        description,
      };
    }

    if (zodType instanceof z.ZodOptional) {
      return extractZodTypeInfo(zodType.unwrap());
    }

    if (zodType instanceof z.ZodObject) {
      return extractZodSchema(zodType);
    }

    // Default fallback
    return { type: 'any', description };
  } catch (error) {
    return {
      type: 'unknown',
      description: 'Type extraction failed',
    };
  }
}

/**
 * Log tool schema information in a format suitable for LLM consumption
 */
export function logToolSchemaForLLM(
  toolName: string,
  description: string,
  parameters: z.ZodType,
  server?: string
): void {
  try {
    const schemaInfo: ToolSchemaInfo = {
      name: toolName,
      description,
      parameters: extractZodSchema(parameters),
      ...(server && { server }),
    };

    logger.info(`🔧 Tool Schema Registered for LLM: ${toolName}`, {
      toolSchema: schemaInfo,
      readableFormat: {
        name: toolName,
        description,
        server: server || 'unknown',
        parameterSchema: JSON.stringify(schemaInfo.parameters, null, 2),
      },
    });
  } catch (error) {
    logger.error(`Failed to log schema for tool ${toolName}:`, error);
  }
}

/**
 * Log multiple tool schemas for an agent
 */
export function logAgentToolSchemasForLLM(
  agentName: string,
  tools: Record<string, { description: string; parameters: z.ZodType }>,
  serverName?: string
): void {
  const toolSchemas: ToolSchemaInfo[] = [];

  for (const [toolName, tool] of Object.entries(tools)) {
    try {
      const schemaInfo: ToolSchemaInfo = {
        name: toolName,
        description: tool.description,
        parameters: extractZodSchema(tool.parameters),
        ...(serverName && { server: serverName }),
      };
      toolSchemas.push(schemaInfo);
    } catch (error) {
      logger.warn(`Failed to extract schema for tool ${toolName}:`, error);
    }
  }

  logger.info(`🤖 Agent Tool Schemas Registered for LLM: ${agentName}`, {
    agentName,
    serverName: serverName || 'multiple',
    toolCount: toolSchemas.length,
    toolSchemas,
    summary: {
      agentName,
      availableTools: toolSchemas.map(t => ({
        name: t.name,
        description: t.description,
        hasParameters: Object.keys(t.parameters.properties || {}).length > 0,
        requiredFields: t.parameters.required || [],
      })),
    },
  });
}

/**
 * Create a comprehensive tool registry summary for LLM
 */
export function logCompleteToolRegistryForLLM(
  toolsByServer: Record<
    string,
    Record<string, { description: string; parameters: z.ZodType }>
  >,
  totalToolCount: number
): void {
  const registrySummary = {
    totalTools: totalToolCount,
    serverCount: Object.keys(toolsByServer).length,
    toolsByServer: {} as Record<string, any>,
  };

  for (const [serverName, tools] of Object.entries(toolsByServer)) {
    const serverTools = [];
    for (const [toolName, tool] of Object.entries(tools)) {
      try {
        serverTools.push({
          name: toolName,
          description: tool.description,
          parameters: extractZodSchema(tool.parameters),
        });
      } catch (error) {
        logger.warn(
          `Failed to process tool ${toolName} from ${serverName}:`,
          error
        );
      }
    }
    registrySummary.toolsByServer[serverName] = {
      toolCount: serverTools.length,
      tools: serverTools,
    };
  }

  logger.info('🌟 Complete Tool Registry for LLM Ready', {
    registrySummary,
    llmContext: {
      message:
        'All available tools have been registered and are ready for LLM consumption',
      totalAvailableTools: totalToolCount,
      serversWithTools: Object.keys(toolsByServer),
      toolCategories: Object.entries(registrySummary.toolsByServer).map(
        ([server, info]) => ({
          server,
          toolCount: (info as any).toolCount,
          capabilities: (info as any).tools
            .map((t: any) => t.description)
            .slice(0, 3), // Sample capabilities
        })
      ),
    },
  });
}
