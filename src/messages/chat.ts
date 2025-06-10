import { AnthropicProviderOptions } from '@ai-sdk/anthropic';
import { streamText, smoothStream, LanguageModelV1 } from 'ai';
import { messageHistory } from '@messages/history';
import { OutputStrategy } from './types';
import { ConsoleOutput } from './output-strategies';
import logger from '@utils/logger';

export async function sendMessage(
  model: LanguageModelV1,
  message: string,
  userId: string,
  outputStrategy?: OutputStrategy
) {
  // Use console output by default if no strategy provided
  const output = outputStrategy || new ConsoleOutput();

  // Add user message to history
  messageHistory.addUserMessage(userId, message);

  // Get current history for this user
  const history = messageHistory.getHistory(userId);

  const { textStream, reasoning, reasoningDetails } = await streamText({
    model: model,
    system: 'You are a helpful assistant.',
    experimental_transform: smoothStream(),
    providerOptions: {
      anthropic: {
        thinking: { type: 'enabled', budgetTokens: 12000 },
      } satisfies AnthropicProviderOptions,
    },
    messages: history,
    onError({ error }) {
      logger.error('sendMessage', error);
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      if (output.onError) {
        output.onError(errorMessage);
      }
    },
    onFinish({ text, finishReason, usage, response }) {
      // Add assistant message to history
      messageHistory.addAssistantMessage(userId, text);
      if (output.onFinish) {
        output.onFinish({ complete: true, sessionId: userId });
      }
    },
  });

  // Send start event if supported
  if (output.onStart) {
    output.onStart({ sessionId: userId, streaming: true });
  }

  // Collect the final text and stream it using the output strategy
  let finalText = '';

  for await (const text of textStream) {
    finalText += text;
    output.onChunk(text, finalText);
  }

  return {
    messages: messageHistory.getHistory(userId),
    newMessage: finalText,
  };
}
