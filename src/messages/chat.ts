import { LanguageModelV1 } from 'ai';
import { messageHistory } from '@messages/history';
import { OutputStrategy } from '@messages/types';
import logger from '@utils/logger';
import { Hive, Swarm } from 'agentswarm';
import { ChatContext } from '@/agents';
import createBusinessLogicAgent from '@/agents/business-logic';
import { Session } from '@/middleware/auth';

// Cache for swarms to persist across messages
const swarmCache = new Map<string, Swarm<ChatContext>>();

// Helper function to create and configure the swarm
function createHiveSwarm(model: LanguageModelV1, accessToken?: string) {
  const hive = new Hive<ChatContext>({
    queen: createBusinessLogicAgent(accessToken),
    defaultModel: model,
    defaultContext: { topic: null },
  });

  return hive.spawnSwarm();
}

// Helper function to log tool information
function logToolInformation(event: any) {
  logger.info(
    `Step finished - Type: ${event.stepType}, Tools: ${
      event.toolCalls?.length || 0
    }, Results: ${event.toolResults?.length || 0}`
  );

  if (event.toolCalls?.length > 0) {
    logger.info(
      'Tool calls:',
      event.toolCalls.map(
        (tc: any) => `${tc.toolName}(${JSON.stringify(tc.args)})`
      )
    );
  }

  if (event.toolResults?.length > 0) {
    logger.info(
      'Tool results:',
      event.toolResults.map((tr: any) => {
        const jsonStr = JSON.stringify(tr.result);
        const truncated =
          jsonStr.length > 100 ? jsonStr.slice(0, 100) + '...' : jsonStr;
        return `${tr.toolName}: ${truncated}`;
      })
    );
  }
}

// Helper function to handle text streaming with efficient accumulation
async function streamText(
  textStream: AsyncIterable<string>,
  outputStrategy: OutputStrategy
): Promise<string> {
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

  for await (const text of textStream) {
    textChunks.push(text);
    cacheValid = false; // Invalidate cache when new text is added
    outputStrategy.onChunk(text, getAccumulated());
  }

  return getAccumulated();
}

// Helper function to handle response messages and update history
async function handleResponseMessages(userId: string, result: any) {
  try {
    const responseMessages = await result.messages;
    if (responseMessages?.length > 0) {
      // Filter and fix empty assistant messages to prevent LLM errors during agent handover
      const processedMessages = responseMessages.map((message: any) => {
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
      });

      messageHistory.addToolMessages(userId, processedMessages);
    }
  } catch (error) {
    logger.error('Error adding response messages to history:', error);
  }
}

// Helper function to handle output strategy lifecycle
function handleOutputLifecycle(
  outputStrategy: OutputStrategy,
  userId: string,
  phase: 'start' | 'finish' | 'error',
  data?: any
) {
  try {
    switch (phase) {
      case 'start':
        outputStrategy.onStart?.({ sessionId: userId, streaming: true });
        break;
      case 'finish':
        outputStrategy.onFinish?.({ complete: true, sessionId: userId });
        break;
      case 'error':
        outputStrategy.onError?.(data);
        break;
    }
  } catch (error) {
    logger.error(`Error while handling output ${phase}:`, error);
  }
}

export async function sendMessage(
  session: Session,
  model: LanguageModelV1,
  message: string,
  outputStrategy: OutputStrategy
) {
  // Add user message to history and get current history
  messageHistory.addUserMessage(session.id, message);
  const history = messageHistory.getHistory(session.id);

  // Get or create swarm for this user
  let swarm = swarmCache.get(session.id);
  if (!swarm) {
    swarm = createHiveSwarm(model, session.accessToken);
    swarmCache.set(session.id, swarm);
  }

  try {
    const result = swarm.streamText({
      messages: history,
      returnToQueen: true,
      onStepFinish: logToolInformation,
    });

    // Handle output lifecycle - start
    handleOutputLifecycle(outputStrategy, session.id, 'start');

    // Stream text and accumulate result
    const finalText = await streamText(result.textStream, outputStrategy);

    // Handle response messages and update history
    await handleResponseMessages(session.id, result);

    // Handle output lifecycle - finish
    handleOutputLifecycle(outputStrategy, session.id, 'finish');

    return {
      messages: messageHistory.getHistory(session.id),
      newMessage: finalText,
    };
  } catch (error) {
    logger.error('sendMessage', error);
    const errorMessage = error instanceof Error ? error.message : String(error);

    // Handle output lifecycle - error
    handleOutputLifecycle(outputStrategy, session.id, 'error', errorMessage);

    // Return on error
    return {
      messages: messageHistory.getHistory(session.id),
      newMessage: `Error: ${errorMessage}`,
    };
  }
}
