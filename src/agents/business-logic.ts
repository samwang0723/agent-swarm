import { ChatContext } from '.';
import { Agent } from 'agentswarm';
import { AgentFactory } from './factory';

/**
 * Creates and configures the business logic agent system using the AgentFactory.
 * This function serves as the main entry point for creating the agent hierarchy.
 *
 * @param accessToken - Optional OAuth access token for MCP services
 * @returns The receptionist agent that routes to specialized agents
 */
export default function createBusinessLogicAgent(
  accessToken?: string
): Agent<ChatContext> {
  const factory = AgentFactory.getInstance();
  return factory.createBusinessLogicAgent(accessToken);
}
