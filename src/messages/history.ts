import { Message } from '@messages/types';

// Helper function to fix empty assistant messages that breaks the LLM
// {
//   "role": "assistant",
//   "content": []
// }
function processMessage(message: Message): Message {
  if (message.role === 'assistant' && Array.isArray(message.content)) {
    // An array of content parts is considered empty if it's actually empty
    // or only contains text parts with empty strings.
    const isEmpty =
      message.content.length === 0 ||
      message.content.every(
        part => part.type === 'text' && part.text.trim() === ''
      );

    if (isEmpty) {
      return {
        ...message,
        content: [
          {
            type: 'text',
            text: ' ', // Use a space to ensure the content is not empty.
          },
        ],
      };
    }
  }
  return message;
}

// Message history management class
class MessageHistory {
  private history: Map<string, Message[]> = new Map();
  private readonly maxMessages = 30;

  /**
   * Truncates the history for a given user if it exceeds the maximum number of messages.
   * It ensures that the truncated history starts with a 'user' message to preserve
   * conversation turns, while keeping the total message count at or below the maximum.
   */
  private truncateHistory(userId: string): void {
    const userHistory = this.history.get(userId);
    if (!userHistory || userHistory.length <= this.maxMessages) {
      return;
    }

    const startIndex = userHistory.length - this.maxMessages;

    // Find the first 'user' message at or after the start index to avoid
    // cutting a conversation turn in the middle.
    for (let i = startIndex; i < userHistory.length; i++) {
      if (userHistory[i].role === 'user') {
        // Found a safe place to start the history. Truncate everything before it.
        userHistory.splice(0, i);
        this.history.set(userId, userHistory);
        return;
      }
    }

    // Fallback: If no 'user' message was found in the last `maxMessages`
    // messages (highly unlikely), truncate at the hard limit to prevent
    // unbounded growth. This might break a turn but respects the memory limit.
    userHistory.splice(0, startIndex);
    this.history.set(userId, userHistory);
  }

  /**
   * Get message history for a specific user
   */
  getHistory(userId: string): Message[] {
    const messages = this.history.get(userId) || [];
    // Process all messages to fix any empty assistant content
    return messages.map(processMessage);
  }

  /**
   * Add a user message to the history
   */
  addUserMessage(userId: string, message: string): void {
    const userHistory = this.getHistory(userId);
    userHistory.push({ role: 'user', content: message });
    this.history.set(userId, userHistory);
    this.truncateHistory(userId);
  }

  /**
   * Add an assistant message to the history and maintain the limit
   */
  addAssistantMessage(userId: string, message: string): void {
    const userHistory = this.getHistory(userId);
    userHistory.push({ role: 'assistant', content: message });
    this.history.set(userId, userHistory);
    this.truncateHistory(userId);
  }

  /**
   * Add tool call and tool result messages to the history
   */
  addToolMessages(userId: string, toolMessages: Message[]): void {
    const userHistory = this.getHistory(userId);
    // Process the incoming tool messages to fix any empty assistant content
    const processedMessages = toolMessages.map(processMessage);
    userHistory.push(...processedMessages);
    this.history.set(userId, userHistory);
    this.truncateHistory(userId);
  }

  /**
   * Clear all history for a specific user
   */
  clearHistory(userId: string): void {
    this.history.delete(userId);
  }
}

// Global message history instance
const messageHistory = new MessageHistory();

// Export the message history instance for external access if needed
export { messageHistory };
