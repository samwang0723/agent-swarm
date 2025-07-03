import { Message } from './conversation.dto';
import {
  mastraMemoryService,
  UserMemorySummary,
} from '../agents/mastra.memory';
import { safePreview } from './conversation.util';
import logger from '../../shared/utils/logger';

// Feature flag for gradual migration
const USE_MASTRA = process.env.USE_MASTRA === 'true';

// Helper function to extract userId and threadId from session-based userId
function parseUserSession(userId: string): {
  userId: string;
  threadId: string;
} {
  // If using new format with user and session IDs
  const userSessionMatch = userId.match(/^user:([^:]+):session:(.+)$/);
  if (userSessionMatch) {
    return {
      userId: userSessionMatch[1],
      threadId: userSessionMatch[2],
    };
  }

  // Fallback: treat the entire string as session ID and use default user
  return {
    userId: 'default-user',
    threadId: userId,
  };
}

// Message history management class - Pure Mastra Memory wrapper
class MessageHistory {
  /**
   * Get message history for a specific user
   * Used for: Getting conversation history for display/context
   */
  async getHistory(userId: string): Promise<Message[]> {
    if (!USE_MASTRA) {
      throw new Error(
        'Legacy message history is no longer supported. Please enable Mastra with USE_MASTRA=true'
      );
    }

    try {
      const { userId: actualUserId, threadId } = parseUserSession(userId);
      const { messages } = await mastraMemoryService.getUserMemory(
        actualUserId,
        threadId
      );

      // Convert Mastra messages to conversation messages
      return messages.map(msg => ({
        role: msg.role,
        content: msg.content,
      })) as Message[];
    } catch (error) {
      logger.error('Failed to get history from Mastra memory', {
        error,
        userId,
      });
      throw error;
    }
  }

  /**
   * Add an assistant message to the history
   * ⚠️ ONLY use this for non-agent flows (e.g., RAG)
   * For agent flows, messages are saved automatically by agent.stream()
   */
  async addAssistantMessage(userId: string, message: string): Promise<void> {
    if (!USE_MASTRA) {
      throw new Error(
        'Legacy message history is no longer supported. Please enable Mastra with USE_MASTRA=true'
      );
    }

    try {
      const { userId: actualUserId, threadId } = parseUserSession(userId);
      await mastraMemoryService.saveAssistantMessage(
        actualUserId,
        threadId,
        message
      );
    } catch (error) {
      logger.error('Failed to save assistant message to Mastra memory', {
        error,
        userId,
        message: safePreview(message, 50).preview,
      });
      throw error;
    }
  }

  /**
   * Clear all history for a specific user
   * Used for: Reset conversation functionality
   */
  async clearHistory(userId: string): Promise<void> {
    if (!USE_MASTRA) {
      throw new Error(
        'Legacy message history is no longer supported. Please enable Mastra with USE_MASTRA=true'
      );
    }

    try {
      const { userId: actualUserId, threadId } = parseUserSession(userId);
      await mastraMemoryService.clearUserMemory(actualUserId, threadId);
    } catch (error) {
      logger.error('Failed to clear history in Mastra memory', {
        error,
        userId,
      });
      throw error;
    }
  }

  /**
   * Initialize user memory with Mastra
   * Used for: Setting up new user sessions
   */
  async initializeUserMemory(userId: string, threadId: string): Promise<void> {
    if (!USE_MASTRA) {
      throw new Error(
        'Legacy message history is no longer supported. Please enable Mastra with USE_MASTRA=true'
      );
    }

    try {
      await mastraMemoryService.initializeUserMemory(userId);
      logger.debug('User memory initialized', { userId, threadId });
    } catch (error) {
      logger.error('Failed to initialize user memory', {
        error,
        userId,
        threadId,
      });
      throw error;
    }
  }

  /**
   * Get user memory summary
   * Used for: Analytics and debugging
   */
  async getUserMemorySummary(
    userId: string
  ): Promise<UserMemorySummary | null> {
    if (!USE_MASTRA) {
      throw new Error(
        'Legacy message history is no longer supported. Please enable Mastra with USE_MASTRA=true'
      );
    }

    try {
      const { userId: actualUserId } = parseUserSession(userId);
      return await mastraMemoryService.getUserMemorySummary(actualUserId);
    } catch (error) {
      logger.error('Failed to get user memory summary', { error, userId });
      return null;
    }
  }

  /**
   * Check if using Mastra memory system
   * Used for: Feature flag checks
   */
  isUsingMastra(): boolean {
    return USE_MASTRA;
  }
}

// Global message history instance
const messageHistory = new MessageHistory();

// Export the message history instance and types
export { messageHistory };
export type { Message };
