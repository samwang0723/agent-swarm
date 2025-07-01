import { LanguageModelV1, streamText } from 'ai';
import { messageHistory } from './history.service';
import { OutputStrategy } from './conversation.dto';
import logger from '@/shared/utils/logger';
import { Session } from '@/shared/middleware/auth';
import { getOrCreateSwarm } from '@/features/agents/agent.swarm';
import { embeddingService } from '@/features/embeddings';
import { getCalendarEventsByTimeRange } from '@/features/calendar/calendar.repository';
import { Message } from './conversation.dto';
import {
  logToolInformation,
  extractTimeRange,
  detectClientTimezone,
  extractClientDateTime,
} from './conversation.util';
// Import intent detection services
import { CompositeIntentDetector } from '@/shared/intent/compositeIntentDetector.service';
import { PatternIntentDetector } from '@/shared/intent/patternIntentDetector.service';
import { KeywordIntentDetector } from '@/shared/intent/keywordIntentDetector.service';
import type { IToolIntentDetector } from '@/features/intent/intentDetector.service';

// Create a singleton intent detector instance using composite pattern for best accuracy
const createIntentDetector = (): IToolIntentDetector => {
  const keywordDetector = new KeywordIntentDetector();
  const patternDetector = new PatternIntentDetector();

  // Use composite detector with weighted scoring
  // Pattern detector gets higher weight (0.7) as it's more sophisticated
  return new CompositeIntentDetector(
    [patternDetector, keywordDetector],
    [0.7, 0.3]
  );
};

// Global intent detector instance
const intentDetector = createIntentDetector();

// Helper function to check if a tool is detected in the intent result
const isToolDetected = (
  detectedTools: string[] | undefined,
  toolName: string
): boolean => {
  return detectedTools ? detectedTools.includes(toolName) : false;
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
      // maxTokens: 500,
      // temperature: 0.7,
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
  outputStrategy: OutputStrategy,
  requestHeaders?: Record<string, string | string[] | undefined>
) {
  let augmentedMessage = message;
  let ragApplied = false;

  // Detect client timezone and datetime if headers are provided
  let clientTimezone = 'UTC';
  let clientDateTime: string | null = null;
  if (requestHeaders) {
    try {
      clientTimezone = await detectClientTimezone(requestHeaders);
      clientDateTime = extractClientDateTime(requestHeaders);
    } catch (error) {
      logger.warn('Failed to detect client timezone:', error);
      // Continue with UTC as fallback
    }
  }

  // Append current datetime information if available
  if (clientDateTime) {
    const formattedDateTime = new Date(clientDateTime).toLocaleString('en-US', {
      timeZone: clientTimezone,
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      timeZoneName: 'short',
    });
    augmentedMessage = `${message}\n\n[Current datetime: ${formattedDateTime}]`;
  }

  // Check for time-sensitive messages and extract date range with timezone
  const timeRange = extractTimeRange(message, clientTimezone);
  if (timeRange) {
    logger.info({
      message: 'Detected time-sensitive message',
      userId: session.id,
      timeRange: `${timeRange.from} to ${timeRange.to}`,
      timezone: clientTimezone,
      originalMessage: message,
    });

    // Augment message with time range information (append to existing augmentation)
    augmentedMessage = `${augmentedMessage}\n\n[Query Time Range: ${timeRange.from} to ${timeRange.to}, Timezone: ${clientTimezone}]`;
  }

  // RAG: Retrieve context from embeddings if intent is matched
  // 4. Detect tool intent from transcript
  const intentDetectionStartTime = Date.now();
  const intentResult = await intentDetector.detectToolIntent(message);
  const intentDetectionDuration = Date.now() - intentDetectionStartTime;
  logger.info(
    `[${session.id}] Intent detection took ${intentDetectionDuration}ms.`
  );
  logger.debug(`[${session.id}] Tool intent detection result:`, {
    requiresTools: intentResult.requiresTools,
    detectedTools: intentResult.detectedTools,
    confidence: intentResult.confidence,
  });

  // Use intent detection to determine which tools to use for RAG
  if (intentResult.requiresTools && intentResult.detectedTools) {
    // Check if email tool is detected
    if (isToolDetected(intentResult.detectedTools, 'email')) {
      const searchResults = await embeddingService.searchEmails(
        session.id,
        message
      );

      if (searchResults && searchResults.length > 0) {
        const context = searchResults.map(r => r.content).join('\n\n---\n\n');
        augmentedMessage += `Based on the following context from emails, please answer question (time response using the timezone ${clientTimezone}) or use tools.\n\nContext:\n${context}\n\nQuestion: ${message}`;
        logger.info({
          message:
            'Augmented user message with email context via intent detection.',
          userId: session.id,
          resultsCount: searchResults.length,
          detectedTools: intentResult.detectedTools,
          confidence: intentResult.confidence,
        });
        ragApplied = true;
      }
    }

    // Check if calendar tool is detected
    if (isToolDetected(intentResult.detectedTools, 'calendar')) {
      // If timeRange is available, use direct database query
      if (timeRange) {
        const calendarResults = await getCalendarEventsByTimeRange(
          session.id,
          session.email,
          timeRange.from,
          timeRange.to,
          10
        );

        if (calendarResults && calendarResults.length > 0) {
          const context = calendarResults
            .map(
              r =>
                `(${r.start_time} to ${r.end_time}) [${r.title}] ${r.description}`
            )
            .join('\n\n---\n\n');
          augmentedMessage += `Based on the following context from your calendar events in the specified time range, please answer question (time response using the timezone ${clientTimezone}) or use tools.\n\nContext:\n${context}\n\nQuestion: ${message}`;
          logger.info({
            message:
              'Augmented user message with time-range calendar context via intent detection.',
            userId: session.id,
            resultsCount: calendarResults.length,
            timeRange: `${timeRange.from} to ${timeRange.to}`,
            detectedTools: intentResult.detectedTools,
            confidence: intentResult.confidence,
          });
          ragApplied = true;
        }
      } else {
        // Fallback to embedding search when no time range is provided
        const searchResults = await embeddingService.searchCalendarEvents(
          session.id,
          message
        );

        if (searchResults && searchResults.length > 0) {
          const context = searchResults.map(r => r.content).join('\n\n---\n\n');
          augmentedMessage += `Based on the following context from your calendar, please answer question (time response using the timezone ${clientTimezone}) or use tools.\n\nContext:\n${context}\n\nQuestion: ${message}`;
          logger.info({
            message:
              'Augmented user message with calendar context via intent detection.',
            userId: session.id,
            resultsCount: searchResults.length,
            detectedTools: intentResult.detectedTools,
            confidence: intentResult.confidence,
          });
          ragApplied = true;
        }
      }
    }
  }

  logger.debug(`Augmented message: ${augmentedMessage}`);

  // Add user message to history and get current history
  messageHistory.addUserMessage(session.id, augmentedMessage);
  const history = messageHistory.getHistory(session.id);

  if (ragApplied) {
    return handleRagStream(session, model, history, outputStrategy);
  }

  return handleSwarmStream(session, model, history, outputStrategy);
}
