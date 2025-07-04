import { LanguageModelV1, streamText } from 'ai';
import { OutputStrategy } from './conversation.dto';
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

// Add performance optimization utilities
const intentCache = new Map<string, ToolIntentResult>();
const ragCache = new Map<string, { context: string; timestamp: number }>();
const RAG_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Hash function for caching
function hashMessage(message: string): string {
  return Buffer.from(message.toLowerCase().trim())
    .toString('base64')
    .slice(0, 16);
}

// Optimized intent detection with caching
async function optimizedIntentDetection(
  message: string
): Promise<ToolIntentResult> {
  const messageHash = hashMessage(message);

  if (intentCache.has(messageHash)) {
    return intentCache.get(messageHash)!;
  }

  const result = await intentDetector.detectToolIntent(message);
  intentCache.set(messageHash, result);

  // Clean cache periodically (keep last 100 entries)
  if (intentCache.size > 100) {
    const entries = Array.from(intentCache.entries());
    intentCache.clear();
    entries.slice(-50).forEach(([key, value]) => intentCache.set(key, value));
  }

  return result;
}

// Optimized RAG processing with caching
async function optimizedRagProcessing(
  session: Session,
  message: string,
  intentResult: ToolIntentResult,
  clientTimezone: string
): Promise<{ context: string; ragApplied: boolean }> {
  if (!intentResult.requiresTools || !intentResult.detectedTools) {
    return { context: '', ragApplied: false };
  }

  const cacheKey = `${session.id}:${hashMessage(message)}:${clientTimezone}`;
  const cached = ragCache.get(cacheKey);

  if (cached && Date.now() - cached.timestamp < RAG_CACHE_TTL) {
    return { context: cached.context, ragApplied: true };
  }

  const ragPromises: Promise<{ type: string; content: string }>[] = [];

  // Parallel RAG processing - collect just the context, not full prompts
  if (isToolDetected(intentResult.detectedTools, 'email')) {
    ragPromises.push(
      embeddingService
        .searchEmails(session.id, message)
        .then(results => {
          if (results && results.length > 0) {
            const content = results.map(r => r.content).join('\n\n---\n\n');
            return { type: 'email', content };
          }
          return { type: 'email', content: '' };
        })
        .catch(error => {
          logger.warn('Email RAG failed:', error);
          return { type: 'email', content: '' };
        })
    );
  }

  if (isToolDetected(intentResult.detectedTools, 'calendar')) {
    ragPromises.push(
      (async () => {
        try {
          const timeRange = extractTimeRange(message, clientTimezone);

          if (timeRange) {
            const calendarResults = await getCalendarEventsByTimeRange(
              session.id,
              session.email,
              timeRange.from,
              timeRange.to,
              10
            );

            if (calendarResults && calendarResults.length > 0) {
              const content = calendarResults
                .map(
                  r =>
                    `(${r.start_time} to ${r.end_time}) [${r.title}] ${r.description}`
                )
                .join('\n\n---\n\n');
              return { type: 'calendar', content };
            }
          } else {
            const searchResults = await embeddingService.searchCalendarEvents(
              session.id,
              message
            );
            if (searchResults && searchResults.length > 0) {
              const content = searchResults
                .map(r => r.content)
                .join('\n\n---\n\n');
              return { type: 'calendar', content };
            }
          }
        } catch (error) {
          logger.warn('Calendar RAG failed:', error);
        }
        return { type: 'calendar', content: '' };
      })()
    );
  }

  const ragResults = await Promise.all(ragPromises);
  const validResults = ragResults.filter(r => r.content.length > 0);

  if (validResults.length === 0) {
    return { context: '', ragApplied: false };
  }

  // Build a single, unified context prompt
  const contextSections = validResults.map(r => {
    if (r.type === 'email') {
      return `Email Context:\n${r.content}`;
    } else if (r.type === 'calendar') {
      return `Calendar Context:\n${r.content}`;
    }
    return r.content;
  });

  const unifiedContext = contextSections.join('\n\n---\n\n');
  const context = `Based on the following context, please answer the question (time responses using timezone ${clientTimezone}) or use tools.\n\nContext:\n${unifiedContext}\n\nQuestion: ${message}`;
  const ragApplied = true;

  if (ragApplied) {
    ragCache.set(cacheKey, { context, timestamp: Date.now() });

    // Clean cache periodically
    if (ragCache.size > 50) {
      const entries = Array.from(ragCache.entries());
      ragCache.clear();
      entries.slice(-25).forEach(([key, value]) => ragCache.set(key, value));
    }
  }

  return { context, ragApplied };
}

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

    try {
      await mastraMemoryService.saveMessage(
        'user',
        session.id,
        session.id,
        userMessage
      );
    } catch (saveError) {
      logger.warn(
        `[${session.id}] RAG: Failed to save user message (non-critical)`,
        {
          error: saveError,
          sessionId: session.id,
        }
      );
    }

    const result = streamText({
      model,
      messages: [
        {
          role: 'user',
          content: userMessage,
        },
      ],
    });

    const finalText = await readTextStream(result.textStream, outputStrategy);

    // Save assistant message for session state (best effort)
    try {
      await mastraMemoryService.saveMessage(
        'assistant',
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
  intentResult: ToolIntentResult,
  outputStrategy: OutputStrategy,
  augmentedMessage: string,
  orchestration: Awaited<ReturnType<typeof getOrCreateUserOrchestration>>
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
    const startTime = Date.now();
    let accumulatedText = '';
    const response = await agent.stream(augmentedMessage, {
      resourceId: memoryContext.resourceId,
      threadId: memoryContext.threadId,
      maxRetries: 0,
      maxSteps: 2,
      onFinish: result => {
        const duration = Date.now() - startTime;
        logger.info(`[${session.id}] Stream took ${duration} ms`);
      },
    });

    for await (const chunk of response.fullStream) {
      if (chunk.type === 'text-delta') {
        accumulatedText += chunk.textDelta;
        outputStrategy.onChunk?.(chunk.textDelta, accumulatedText);
      }
    }

    outputStrategy.onFinish?.({ complete: true, sessionId: session.id });

    const messages = [
      { role: 'user', content: augmentedMessage },
      { role: 'assistant', content: accumulatedText },
    ];

    return {
      messages,
      newMessage: accumulatedText,
    };
  } catch (error) {
    logger.error('sendMessage with agent orchestration:', error);
    const errorMessage =
      error instanceof Error ? error.message : safePreview(error, 500).preview;

    outputStrategy.onError?.(errorMessage);

    // Get fallback history based on memory system
    const messages = [
      { role: 'user', content: augmentedMessage },
      { role: 'assistant', content: `Error: ${errorMessage}` },
    ];

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

  // 1. Detect client timezone and datetime (fast operation)
  let clientTimezone = 'UTC';
  let clientDateTime: string | null = null;
  if (requestHeaders) {
    try {
      clientTimezone = await detectClientTimezone(requestHeaders);
      clientDateTime = extractClientDateTime(requestHeaders);
    } catch (error) {
      logger.warn('Failed to detect client timezone:', error);
    }
  }

  // 2. Add datetime information if available
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

  // 3. Add time range information if detected
  const timeRange = extractTimeRange(message, clientTimezone);
  if (timeRange) {
    augmentedMessage = `${augmentedMessage}\n\n[Query Time Range: ${timeRange.from} to ${timeRange.to}, Timezone: ${clientTimezone}]`;
  }

  // 4. Parallel processing of expensive operations
  const intentDetectionStartTime = Date.now();
  const [intentResult, orchestration] = await Promise.all([
    optimizedIntentDetection(message),
    getOrCreateUserOrchestration(session),
  ]);

  const intentDetectionDuration = Date.now() - intentDetectionStartTime;
  logger.info(
    `[${session.id}] Intent detection + orchestration took ${intentDetectionDuration}ms.`
  );

  // Log the actual intent detection result for debugging
  logger.info(`[${session.id}] Intent detection result:`, {
    requiresTools: intentResult.requiresTools,
    detectedTools: intentResult.detectedTools,
    confidence: intentResult.confidence?.toFixed(3),
    message: message.substring(0, 100) + (message.length > 100 ? '...' : ''),
  });

  // 5. RAG processing in parallel (if needed)
  const ragStartTime = Date.now();
  const { context: ragContext, ragApplied } = await optimizedRagProcessing(
    session,
    message,
    intentResult,
    clientTimezone
  );

  if (ragApplied) {
    const ragDuration = Date.now() - ragStartTime;
    logger.info(`[${session.id}] RAG processing took ${ragDuration}ms.`);
    augmentedMessage += ragContext;
  }

  // 6. Route to appropriate handler
  if (ragApplied) {
    logger.info(
      `[${session.id}] RAG flow: handleRagStream with cached context`
    );
    return handleRagStream(session, model, outputStrategy, augmentedMessage);
  }

  // Agent flow: handleSwarmStream uses pre-loaded orchestration
  return handleSwarmStream(
    session,
    intentResult,
    outputStrategy,
    augmentedMessage,
    orchestration
  );
}
