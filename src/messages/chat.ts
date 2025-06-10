import { AnthropicProviderOptions } from '@ai-sdk/anthropic';
import { streamText, smoothStream, LanguageModelV1 } from 'ai';
import { messageHistory } from '@messages/history';
import { OutputStrategy } from './types';
import { toolRegistry } from '../tools/index.js';
import logger from '@utils/logger';
import { DEFAULT_SYSTEM_PROMPT } from './system-prompt';

export async function sendMessage(
  model: LanguageModelV1,
  message: string,
  userId: string,
  outputStrategy: OutputStrategy
) {
  // Use console output by default if no strategy provided
  const output = outputStrategy;

  // Add user message to history
  messageHistory.addUserMessage(userId, message);

  // Get current history for this user
  const history = messageHistory.getHistory(userId);

  const result = await streamText({
    model: model,
    system: DEFAULT_SYSTEM_PROMPT,
    experimental_transform: smoothStream(),
    tools: toolRegistry.getTools(),
    maxSteps: 10, // Enable multi-step tool calls
    temperature: 0.7,
    maxTokens: 200,
    providerOptions: {
      anthropic: {
        thinking: { type: 'enabled', budgetTokens: 12000 },
      } satisfies AnthropicProviderOptions,
    },
    messages: history,
    onStepFinish({
      stepType,
      toolCalls,
      toolResults,
      text,
      finishReason,
      usage,
      response,
    }) {
      // Log step information for debugging
      logger.info(
        `Step finished - Type: ${stepType}, Tools: ${toolCalls.length}, Results: ${toolResults.length}`
      );

      if (toolCalls.length > 0) {
        logger.info(
          'Tool calls:',
          toolCalls.map(tc => `${tc.toolName}(${JSON.stringify(tc.args)})`)
        );
      }

      if (toolResults.length > 0) {
        logger.info(
          'Tool results:',
          toolResults.map(tr => `${tr.toolName}: ${JSON.stringify(tr.result)}`)
        );
      }
    },
    onError({ error }) {
      logger.error('sendMessage', error);
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      if (output.onError) {
        try {
          output.onError(errorMessage);
        } catch (streamError) {
          logger.error('Error while handling onError:', streamError);
        }
      }
    },
    onFinish(finishResult) {
      // The messages will be handled after the stream is complete
      // since they're available on the result object

      if (output.onFinish) {
        try {
          output.onFinish({ complete: true, sessionId: userId });
        } catch (streamError) {
          logger.error('Error while handling onFinish:', streamError);
        }
      }
    },
  });

  // Send start event if supported
  if (output.onStart) {
    output.onStart({ sessionId: userId, streaming: true });
  }

  // Collect the final text and stream it using the output strategy
  // Use array for efficient string concatenation with lazy evaluation
  const textChunks: string[] = [];
  let cachedAccumulated: string | null = null;
  let cacheValid = false;

  // Lazy getter for accumulated text - only builds when needed
  const getAccumulated = (): string => {
    if (!cacheValid) {
      cachedAccumulated = textChunks.join('');
      cacheValid = true;
    }
    return cachedAccumulated!;
  };

  for await (const text of result.textStream) {
    textChunks.push(text);
    cacheValid = false; // Invalidate cache when new text is added

    // Pass lazy accumulator - only builds string if output strategy needs it
    output.onChunk(text, getAccumulated());
  }

  // Get the final accumulated text
  const finalText = getAccumulated();

  // After streaming is complete, add response messages (including tool calls/results) to history
  try {
    const responseObject = await result.response;
    if (responseObject?.messages && responseObject.messages.length > 0) {
      messageHistory.addToolMessages(userId, responseObject.messages);
    }
  } catch (error) {
    logger.error('Error adding response messages to history:', error);
  }

  return {
    messages: messageHistory.getHistory(userId),
    newMessage: finalText,
  };
}
