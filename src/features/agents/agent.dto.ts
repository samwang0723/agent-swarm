import { LanguageModelV1 } from 'ai';
import { z } from 'zod';
import { Agent as MastraAgent } from '@mastra/core';

export const UBER_EATS_DOMAIN = 'https://www.ubereats.com';

export interface StoreInfo {
  name: string;
  url: string;
  deliveryTime: string;
}

/**
 * Chat context passed through Mastra agent interactions
 * Contains user session information and memory context
 */
export interface ChatContext {
  topic: string | null;
  accessToken?: string; // User's OAuth access token for MCP services
  userId?: string; // User ID for Mastra memory scoping
  sessionId?: string; // Session ID for conversation context
  threadId?: string; // Thread ID for Mastra memory
  resourceId?: string; // Resource ID for agent-specific memory
}

/**
 * Mastra memory context for agent interactions
 * Used to scope memory operations to specific users and threads
 */
export interface MastraMemoryContext {
  resourceId: string; // User-specific resource identifier
  threadId: string; // Session/thread identifier
  userId: string; // User identifier
}

/**
 * Configuration for creating Mastra agents
 * Simplified interface for agent creation
 */
export interface MastraAgentConfig {
  name: string;
  instructions: string;
  model: LanguageModelV1;
  tools?: unknown[];
  memory?: unknown; // Should be Mastra Memory instance, not config object
}

/**
 * Mastra memory configuration data
 * Used for passing resourceId/threadId to agent.stream() calls
 * NOT used as the memory parameter when creating agents
 */
export interface MastraMemoryConfig {
  resourceId: string;
  threadId?: string;
  userId?: string;
}

/**
 * Agent orchestration state
 * Manages the current active agent and conversation context
 */
export interface AgentOrchestrationState {
  currentAgent: string;
  availableAgents: string[];
  context: ChatContext;
  lastHandover?: {
    fromAgent: string;
    toAgent: string;
    reason: string;
    timestamp: Date;
  };
}

/**
 * Agent response with metadata
 * Standardized response format from agent interactions
 */
export interface AgentResponse {
  content: string;
  agent: string;
  context?: ChatContext;
  handover?: {
    targetAgent: string;
    reason: string;
  };
  toolCalls?: Array<{
    id: string;
    name: string;
    args: unknown;
    result?: unknown;
  }>;
}

/**
 * User orchestration cache entry
 * Manages persistent agent state for users
 */
export interface UserOrchestration {
  userId: string;
  sessionId: string;
  agents: Record<string, MastraAgent>; // Agent instances by ID
  receptionistAgent: MastraAgent; // Main receptionist agent
  memoryContext: MastraMemoryContext;
  state: AgentOrchestrationState;
  lastAccessed: Date;
  createdAt: Date;
}

/**
 * Agent statistics for monitoring
 */
export interface AgentStats {
  total: number;
  enabled: number;
  disabled: number;
  agents: Array<{
    id: string;
    name: string;
    enabled: boolean;
    mcpServers: string[];
  }>;
  useMastra: boolean;
}

/**
 * Orchestration statistics for monitoring
 */
export interface OrchestrationStats {
  activeUsers: number;
  totalOrchestrations: number;
  memoryUsage: string;
  averageSessionDuration?: number;
}

/**
 * Tool execution result for Mastra tools
 */
export interface ToolExecutionResult {
  result: unknown;
  context?: Partial<ChatContext>;
  handover?: {
    targetAgent: string;
    reason: string;
    context?: unknown;
  };
}

/**
 * Handover tool configuration
 * Used for creating agent transfer tools
 */
export interface HandoverToolConfig {
  targetAgentId: string;
  targetAgentName: string;
  description: string;
  schema: z.ZodSchema;
}

/**
 * Agent handover result
 * Result of executing a handover between agents
 */
export interface HandoverResult {
  success: boolean;
  fromAgent: string;
  toAgent: string;
  reason: string;
  context?: ChatContext;
  error?: string;
}
