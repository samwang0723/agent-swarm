import { LanguageModelV1 } from 'ai';
import { messageHistory } from '@messages/history';
import { OutputStrategy } from '@messages/types';
import logger from '@utils/logger';
import { Agent, Hive } from 'agentswarm';
import { ChatContext, createMultiServiceAgent } from '@/agents';
import { z } from 'zod';
import { join } from 'path';
import { readFileSync } from 'fs';

// Load system prompt from file
function loadSystemPrompt(domain: string): string {
  try {
    // Use process.cwd() to get the project root, then navigate to config
    const promptPath = join(process.cwd(), `src/config/prompts/${domain}.txt`);
    return readFileSync(promptPath, 'utf-8').trim();
  } catch (error) {
    logger.error('Failed to load system prompt from file:', error);
    // Fallback to a basic prompt if file loading fails
    return `You are a professional ${domain} assistant with access to various tools and services.`;
  }
}

// Helper function to create and configure the swarm
function createSwarm(model: LanguageModelV1) {
  const recommendationAgent = createMultiServiceAgent(
    ['restaurant-booking', 'time'],
    loadSystemPrompt('restaurant-recommendation')
  );

  const receptionistAgent = new Agent<ChatContext>({
    name: 'Receptionist',
    description: 'Routes user queries to appropriate agents',
    instructions:
      'You help users by routing them to the appropriate agent, DO NOT report all the handover steps, just report the final result.',
    tools: {
      transfer_to_recommendation: {
        type: 'handover',
        description: 'Transfer to recommendation agent',
        parameters: z.object({
          topic: z.string().describe('Restaurant preference topic'),
        }),
        execute: async ({ topic }) => ({
          agent: recommendationAgent,
          context: { topic },
        }),
      },
    },
  });

  const hive = new Hive<ChatContext>({
    queen: receptionistAgent,
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
      event.toolResults.map(
        (tr: any) => `${tr.toolName}: ${JSON.stringify(tr.result)}`
      )
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
      messageHistory.addToolMessages(userId, responseMessages);
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
  model: LanguageModelV1,
  message: string,
  userId: string,
  outputStrategy: OutputStrategy
) {
  // Add user message to history and get current history
  messageHistory.addUserMessage(userId, message);
  const history = messageHistory.getHistory(userId);

  // Create swarm and start streaming
  const swarm = createSwarm(model);

  try {
    const result = swarm.streamText({
      messages: history,
      returnToQueen: true,
      onStepFinish: logToolInformation,
    });

    // Handle output lifecycle - start
    handleOutputLifecycle(outputStrategy, userId, 'start');

    // Stream text and accumulate result
    const finalText = await streamText(result.textStream, outputStrategy);

    // Handle response messages and update history
    await handleResponseMessages(userId, result);

    // Handle output lifecycle - finish
    handleOutputLifecycle(outputStrategy, userId, 'finish');

    return {
      messages: messageHistory.getHistory(userId),
      newMessage: finalText,
    };
  } catch (error) {
    logger.error('sendMessage', error);
    const errorMessage = error instanceof Error ? error.message : String(error);

    // Handle output lifecycle - error
    handleOutputLifecycle(outputStrategy, userId, 'error', errorMessage);

    // Return on error
    return {
      messages: messageHistory.getHistory(userId),
      newMessage: `Error: ${errorMessage}`,
    };
  }
}
