import { Message } from '@messages/types';

// Helper function to fix empty assistant messages that breaks the LLM
// {
//   "role": "assistant",
//   "content": []
// }
function processMessage(message: Message): Message {
  if (message.role === 'assistant' && Array.isArray(message.content)) {
    // Handle empty content array
    if (message.content.length === 0) {
      return {
        ...message,
        content: [
          {
            type: 'text',
            text: 'agent handover',
          },
        ],
      };
    }

    // Check if any text content is empty and replace only those items
    const hasEmptyText = message.content.some(
      (item: any) => item?.type === 'text' && item?.text === ''
    );
    if (hasEmptyText) {
      return {
        ...message,
        content: message.content.map((item: any) => {
          if (item?.type === 'text' && item?.text === '') {
            return {
              ...item,
              text: 'agent handover',
            };
          }
          return item;
        }),
      };
    }
  }
  return message;
}

// Message history management class
class MessageHistory {
  private history: Map<string, Message[]> = new Map();
  private readonly maxHistoryPairs = 10; // 10 user-assistant pairs (20 total messages)

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
  }

  /**
   * Add an assistant message to the history and maintain the limit
   */
  addAssistantMessage(userId: string, message: string): void {
    const userHistory = this.getHistory(userId);
    userHistory.push({ role: 'assistant', content: message });

    // Ensure we don't exceed the maximum history pairs
    // Each pair consists of 1 user + 1 assistant message
    if (userHistory.length > this.maxHistoryPairs * 2) {
      // Remove the oldest pair (2 messages)
      userHistory.splice(0, 2);
    }

    this.history.set(userId, userHistory);
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
  }

  /**
   * Clear all history for a specific user
   */
  clearHistory(userId: string): void {
    this.history.delete(userId);
  }

  /**
   * Get the number of message pairs for a user
   */
  getMessagePairCount(userId: string): number {
    return Math.floor(this.getHistory(userId).length / 2);
  }
}

// Global message history instance
const messageHistory = new MessageHistory();

// Export the message history instance for external access if needed
export { messageHistory };
