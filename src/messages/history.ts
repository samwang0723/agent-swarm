import { Message } from './types';

// Message history management class
class MessageHistory {
  private history: Map<string, Message[]> = new Map();
  private readonly maxHistoryPairs = 10; // 10 user-assistant pairs (20 total messages)

  /**
   * Get message history for a specific user
   */
  getHistory(userId: string): Message[] {
    return this.history.get(userId) || [];
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
    userHistory.push(...toolMessages);
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
