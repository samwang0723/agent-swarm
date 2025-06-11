import { loadSystemPrompt } from '@/messages/prompt';
import { ChatContext, createMultiServiceAgent } from '.';
import { Agent } from 'agentswarm';
import { z } from 'zod';

export default function createBusinessLogicAgent() {
  const recommendationAgent = createMultiServiceAgent(
    ['restaurant-booking', 'time'],
    loadSystemPrompt('restaurant-recommendation') +
      '\n\nCRITICAL: STAY COMPLETELY SILENT while using tools. Do not output ANY text until you have the complete restaurant recommendation ready. No explanations, no progress updates, no commentary. Work silently and only speak once with the final result.'
  );

  const transferToRecommendation = {
    type: 'handover',
    description:
      'Call this tool to transfer the call to the recommendation agent',
    parameters: z.object({
      topic: z.string().describe('Restaurant preference topic'),
    }),
    execute: async () => ({ agent: recommendationAgent }),
  } as const;

  // Receptionist top-level agent
  const receptionistAgent = new Agent<ChatContext>({
    name: 'Receptionist',
    description: 'Routes user queries to appropriate agents',
    instructions:
      "You are a helpful receptionist. Provide a brief, friendly initial response acknowledging the user's request, then immediately transfer to the appropriate agent. Do not provide any commentary about the transfer process or tool usage - let the specialist agent handle the task silently.",
    tools: {
      transfer_to_recommendation: transferToRecommendation,
    },
  });

  const transferToReceptionist = {
    type: 'handover',
    description: 'Call this tool to transfer the call to the receptionist',
    parameters: z.object({}),
    execute: async () => ({ agent: receptionistAgent }),
  } as const;

  // Handover tool to transfer back to the receptionist agent
  recommendationAgent.tools!['transfer_to_receptionist'] =
    transferToReceptionist;

  return receptionistAgent;
}
