import { LanguageModelV1 } from 'ai';
import { messageHistory } from './history.service';
import { OutputStrategy } from './conversation.dto';
import logger from '@/shared/utils/logger';
import { Session } from '@/shared/middleware/auth';
import {
  getOrCreateSwarm,
  logToolInformation,
} from '@/features/agents/agent.swarm';

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
  const swarm = getOrCreateSwarm(session, model);

  try {
    outputStrategy.onStart?.({ sessionId: session.id, streaming: true });
    // logger.info('Sending message to swarm', history);
    // logger.info('Swarm queen', swarm.queen);
    // logger.info('Swarm active agent', swarm.activeAgent);

    // manual override to use the queen as the active agent as returnToQueen sometimes doesn't work
    // Only use for Gemini models
    if (model.modelId.includes('gemini')) {
      swarm.setActiveAgent(swarm.queen);
    }
    const result = swarm.streamText({
      messages: history,
      returnToQueen: model.modelId.includes('gemini'),
      onStepFinish: event => logToolInformation(session.id, event),
    });

    // Stream text and accumulate result
    const finalText = await streamText(result.textStream, outputStrategy);

    // Handle response messages and update history
    try {
      const responseMessages = await result.messages;
      if (responseMessages?.length > 0) {
        messageHistory.addToolMessages(session.id, responseMessages);
      }
    } catch (error) {
      logger.error('Error adding response messages to history:', error);
    }

    outputStrategy.onFinish?.({ complete: true, sessionId: session.id });

    return {
      messages: messageHistory.getHistory(session.id),
      newMessage: finalText,
    };
  } catch (error) {
    logger.error('sendMessage:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);

    outputStrategy.onError?.(errorMessage);

    // Return on error
    return {
      messages: messageHistory.getHistory(session.id),
      newMessage: `Error: ${errorMessage}`,
    };
  }
}
