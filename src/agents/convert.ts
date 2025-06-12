import { Tool } from 'ai';
import { AgentFunctionTool } from 'agentswarm';
import logger from '@utils/logger';
import { toolRegistry } from '@tools/index';

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
      parameters: tool.parameters as any, // Cast to Parameters type
      execute: async (args: any, options: any) => {
        try {
          // Inject access token from context if available
          if (serverName && options?.context?.accessToken) {
            toolRegistry.setAccessTokenForServer(
              serverName,
              options.context.accessToken
            );
          }

          // The original tool.execute expects both args and ToolExecutionOptions
          if (tool.execute) {
            // Create minimal ToolExecutionOptions object
            const toolOptions = {
              abortSignal: undefined,
              toolCallId: `${toolName}-${Date.now()}`, // Generate unique ID
              messages: [], // Required by ToolExecutionOptions
            };

            const result = await tool.execute(args, toolOptions);

            // Ensure we return the result in a consistent format
            return { result: result, context: {} };
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
      const prefixedName = `${serverName}_${toolName}`;
      combinedTools[prefixedName] = {
        ...toolConfig,
        description: `[${serverName}] ${toolConfig.description}`,
      };
    }
  }

  return combinedTools;
}
