import { LanguageModelV1, streamText } from 'ai';
import { OutputStrategy, Message } from './conversation.dto';
import logger from '../../shared/utils/logger';
import { Session } from '../../shared/middleware/auth';
import { getOrCreateUserOrchestration } from '../agents/agent.swarm';
import { mastraMemoryService } from '../agents/mastra.memory';
import { embeddingService } from '../embeddings';
import { getCalendarEventsByTimeRange } from '../calendar/calendar.repository';
import {
  extractTimeRange,
  detectClientTimezone,
  extractClientDateTime,
  isToolDetected,
  mapIntentToAgent,
  safePreview,
} from './conversation.util';
// Import intent detection services
import { CompositeIntentDetector } from '../../shared/intent/compositeIntentDetector.service';
import { PatternIntentDetector } from '../../shared/intent/patternIntentDetector.service';
import { KeywordIntentDetector } from '../../shared/intent/keywordIntentDetector.service';
import type {
  IToolIntentDetector,
  ToolIntentResult,
} from '../intent/intentDetector.service';

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
  outputStrategy: OutputStrategy,
  userMessage: string
) {
  try {
    outputStrategy.onStart?.({ sessionId: session.id, streaming: true });

    // Save the current user message for session state (best effort)
    logger.debug(`[${session.id}] RAG: Saving user message for session state`, {
      messageLength: userMessage.length,
      messagePreview: safePreview(userMessage, 100).preview,
    });

    try {
      await mastraMemoryService.saveUserMessage(
        session.id,
        session.id,
        userMessage
      );
      logger.debug(`[${session.id}] RAG: User message saved successfully`);
    } catch (saveError) {
      logger.warn(
        `[${session.id}] RAG: Failed to save user message (non-critical)`,
        {
          error: saveError,
          sessionId: session.id,
        }
      );
      // Don't throw - this is non-critical for RAG flows
    }

    // For RAG flows, we don't need full conversation history - we use the current message
    // with RAG context. This is different from agent flows where history matters.
    logger.debug(`[${session.id}] RAG: Using current message for LLM call`);

    // Create a simple message array with just the current user message
    const historyMessages: Message[] = [
      {
        role: 'user',
        content: userMessage,
      },
    ];

    logger.debug(`[${session.id}] RAG: Prepared messages for LLM`, {
      messageCount: historyMessages.length,
      messageLength: userMessage.length,
    });

    const result = streamText({
      model,
      messages: historyMessages,
      // maxTokens: 500,
      // temperature: 0.7,
    });

    const finalText = await readTextStream(result.textStream, outputStrategy);

    // Save assistant message for session state (best effort)
    try {
      await mastraMemoryService.saveAssistantMessage(
        session.id,
        session.id,
        finalText
      );
    } catch (saveError) {
      logger.warn(
        `[${session.id}] RAG: Failed to save assistant message (non-critical)`,
        {
          error: saveError,
          sessionId: session.id,
        }
      );
      // Don't throw - this is non-critical for RAG flows
    }

    outputStrategy.onFinish?.({ complete: true, sessionId: session.id });

    // For RAG flows, return a simple conversation with the current interaction
    // RAG is stateless - it doesn't need full conversation history
    const messages = [
      { role: 'user', content: userMessage },
      { role: 'assistant', content: finalText },
    ];

    return {
      messages,
      newMessage: finalText,
    };
  } catch (error) {
    logger.error('sendMessage with RAG:', error);
    const errorMessage =
      error instanceof Error ? error.message : safePreview(error, 500).preview;

    outputStrategy.onError?.(errorMessage);

    // For RAG flows, return a simple conversation with the current interaction
    const messages = [
      { role: 'user', content: userMessage },
      { role: 'assistant', content: `Error: ${errorMessage}` },
    ];

    return {
      messages,
      newMessage: `Error: ${errorMessage}`,
    };
  }
}

async function handleSwarmStream(
  session: Session,
  model: LanguageModelV1,
  intentResult: ToolIntentResult,
  outputStrategy: OutputStrategy,
  augmentedMessage: string
) {
  let selectedAgentId: string | undefined;
  let memoryContext:
    | {
        resourceId: string;
        threadId: string;
      }
    | undefined;

  try {
    outputStrategy.onStart?.({ sessionId: session.id, streaming: true });

    // Use Mastra workflow orchestration
    const orchestration = await getOrCreateUserOrchestration(session);

    // Extract memory context from orchestration
    memoryContext = orchestration.memoryContext;
    if (!memoryContext) {
      throw new Error(`Memory context not available for session ${session.id}`);
    }

    // Check if we should route to a specific agent based on intent
    let targetAgent = orchestration.receptionistAgent;
    selectedAgentId = 'receptionist';
    if (intentResult.requiresTools && intentResult.detectedTools) {
      const agentId = mapIntentToAgent(intentResult.detectedTools);
      if (agentId && orchestration.agents[agentId]) {
        targetAgent = orchestration.agents[agentId];
        selectedAgentId = agentId;
        logger.info(
          `[${session.id}] Routing to specific agent ${agentId} based on intent`
        );
      } else {
        logger.warn(
          `[${session.id}] Could not find agent ${agentId}, using receptionist`,
          {
            requestedAgent: agentId,
            availableAgents: Object.keys(orchestration.agents),
            detectedTools: intentResult.detectedTools,
          }
        );
      }
    }

    // The targetAgent is now correctly typed as MastraAgent
    if (!targetAgent || typeof targetAgent.stream !== 'function') {
      logger.error(
        `[${session.id}] Target agent does not have a valid stream method`,
        {
          selectedAgentId,
          agentMethods: targetAgent ? Object.keys(targetAgent) : [],
          hasStream: !!(targetAgent && targetAgent.stream),
          streamType: targetAgent && typeof targetAgent.stream,
        }
      );
      throw new Error(`Agent ${selectedAgentId} does not support streaming`);
    }

    // Type the agent properly for Mastra stream API
    const agent = targetAgent;

    // Use the augmented message (with RAG context) for the agent
    // Mastra agents handle conversation history automatically through memory
    // Pass memory context as second parameter for proper tool execution
    const streamResult = await agent.stream(augmentedMessage, {
      resourceId: memoryContext.resourceId,
      threadId: memoryContext.threadId,
    });

    // Stream text and accumulate result
    const finalText = await readTextStream(
      streamResult.textStream,
      outputStrategy
    );

    outputStrategy.onFinish?.({ complete: true, sessionId: session.id });

    // Get updated messages from Mastra memory
    const { messages } = await mastraMemoryService.getUserMemory(
      session.id,
      session.id
    );

    return {
      messages,
      newMessage: finalText,
    };
  } catch (error) {
    logger.error('sendMessage with agent orchestration:', error);
    const errorMessage =
      error instanceof Error ? error.message : safePreview(error, 500).preview;

    outputStrategy.onError?.(errorMessage);

    // Get fallback history based on memory system
    const messages = (
      await mastraMemoryService.getUserMemory(session.id, session.id)
    ).messages;

    return {
      messages,
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

  // Route to appropriate handler based on RAG vs agent flow
  if (ragApplied) {
    // RAG flow: handleRagStream saves user message and fetches history internally for LLM call
    return handleRagStream(session, model, outputStrategy, augmentedMessage);
  }

  // Agent flow: handleSwarmStream uses Mastra's automatic memory management
  return handleSwarmStream(
    session,
    model,
    intentResult,
    outputStrategy,
    augmentedMessage
  );
}
