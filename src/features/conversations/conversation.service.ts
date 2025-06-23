import { LanguageModelV1, streamText } from 'ai';
import { messageHistory } from './history.service';
import { OutputStrategy } from './conversation.dto';
import logger from '@/shared/utils/logger';
import { Session } from '@/shared/middleware/auth';
import { getOrCreateSwarm } from '@/features/agents/agent.swarm';
import { embeddingService } from '@/features/embeddings';
import { Message } from './conversation.dto';
import { logToolInformation } from './conversation.util';

const shouldSearchEmails = (message: string): boolean => {
  const keywords = [
    'email',
    'mail',
    'inbox',
    'gmail',
    'outlook',
    'sender',
    'recipient',
    'subject',
  ];
  const lowerCaseMessage = message.toLowerCase();
  return keywords.some(keyword => lowerCaseMessage.includes(keyword));
};

// Helper function to handle text streaming with efficient accumulation
async function readTextStream(
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

async function handleRagStream(
  session: Session,
  model: LanguageModelV1,
  history: Message[],
  outputStrategy: OutputStrategy
) {
  try {
    outputStrategy.onStart?.({ sessionId: session.id, streaming: true });

    const result = streamText({
      model,
      messages: history,
    });

    const finalText = await readTextStream(result.textStream, outputStrategy);
    messageHistory.addAssistantMessage(session.id, finalText);

    outputStrategy.onFinish?.({ complete: true, sessionId: session.id });

    return {
      messages: messageHistory.getHistory(session.id),
      newMessage: finalText,
    };
  } catch (error) {
    logger.error('sendMessage with RAG:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);

    outputStrategy.onError?.(errorMessage);

    return {
      messages: messageHistory.getHistory(session.id),
      newMessage: `Error: ${errorMessage}`,
    };
  }
}

async function handleSwarmStream(
  session: Session,
  model: LanguageModelV1,
  history: Message[],
  outputStrategy: OutputStrategy
) {
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
    const finalText = await readTextStream(result.textStream, outputStrategy);

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
    logger.error('sendMessage with swarm:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);

    outputStrategy.onError?.(errorMessage);

    // Return on error
    return {
      messages: messageHistory.getHistory(session.id),
      newMessage: `Error: ${errorMessage}`,
    };
  }
}

export async function sendMessage(
  session: Session,
  model: LanguageModelV1,
  message: string,
  outputStrategy: OutputStrategy
) {
  let augmentedMessage = message;
  let ragApplied = false;

  // RAG: Retrieve context from embeddings if intent is matched
  if (shouldSearchEmails(message)) {
    const searchResults = await embeddingService.searchEmails(
      session.id,
      message
    );

    if (searchResults && searchResults.length > 0) {
      const context = searchResults.map(r => r.content).join('\n\n---\n\n');
      augmentedMessage = `Based on the following context from emails, please answer question or use tools.\n\nContext:\n${context}\n\nQuestion: ${message}`;
      logger.info({
        message: 'Augmented user message with email context.',
        userId: session.id,
        resultsCount: searchResults.length,
      });
      ragApplied = true;
    }
  }

  logger.info(`Augmented message: ${augmentedMessage}`);

  // Add user message to history and get current history
  messageHistory.addUserMessage(session.id, augmentedMessage);
  const history = messageHistory.getHistory(session.id);

  if (ragApplied) {
    return handleRagStream(session, model, history, outputStrategy);
  }

  return handleSwarmStream(session, model, history, outputStrategy);
}
