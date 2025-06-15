export interface AgentConfig {
  id: string;
  name: string;
  description: string;
  mcpServers: string[];
  systemPromptFile: string;
  additionalInstructions?: string;
  enabled?: boolean;
  requiresAuth?: boolean;
  routingKeywords?: string[];
  routingDescription?: string;
}

export interface ReceptionistConfig {
  name: string;
  description: string;
  instructions: string;
}

export interface AgentSystemConfig {
  receptionist: ReceptionistConfig;
  agents: AgentConfig[];
}

export const agentSystemConfig: AgentSystemConfig = {
  receptionist: {
    name: 'Receptionist',
    description: 'Routes user queries to appropriate agents',
    instructions: `You are a helpful receptionist. Provide a brief, friendly initial response acknowledging the user's request but not mentioning you are tranfer to another agent, then immediately transfer to the appropriate agent and execute the task. Do not provide any commentary about the transfer process or tool usage - let the specialist agent handle the task silently. If the user's request is not related to the agents's domain, transfer back to the receptionist.`,
  },
  agents: [
    {
      id: 'restaurant-recommendation',
      name: 'Restaurant Recommendation Agent',
      description: 'Handles restaurant recommendations',
      mcpServers: ['restaurant-booking', 'time'],
      systemPromptFile: 'restaurant-recommendation',
      additionalInstructions:
        '\n\nCRITICAL: STAY COMPLETELY SILENT while using tools. Do not output ANY text until you have the complete restaurant recommendation ready. No explanations, no progress updates, no commentary. Work silently and only speak once with the final result.',
      enabled: true,
      requiresAuth: false,
      routingKeywords: [
        'restaurant',
        'food',
        'dining',
        'eat',
        'meal',
        'book',
        'reservation',
        'cuisine',
      ],
      routingDescription:
        'Call this tool to transfer to the restaurant recommendation agent. This agent can handle restaurant searches, recommendations, and booking assistance.',
    },
    {
      id: 'google-gmail-assistant',
      name: 'Google Gmail Assistant Agent',
      description: 'Handles Gmail query service',
      mcpServers: ['google-assistant'],
      systemPromptFile: 'google-assistant',
      enabled: true,
      requiresAuth: true,
      routingKeywords: [
        'gmail',
        'email',
        'google',
        'inbox',
        'mail',
        'send',
        'message',
      ],
      routingDescription:
        'Call this tool to transfer to the google assistant. This agent can handle Gmail and Google services related queries.',
    },
    // Add more agents here as needed
    // {
    //   id: 'browser-booking',
    //   name: 'Browser Booking Agent',
    //   description: 'Handles browser-based booking automation',
    //   mcpServers: ['browser-booking'],
    //   systemPromptFile: 'browser-booking',
    //   enabled: false,
    //   requiresAuth: false,
    //   routingKeywords: ['book', 'browser', 'automate', 'web'],
    //   routingDescription:
    //     'Call this tool to transfer to the browser booking agent for automated web bookings.',
    // },
  ],
};
