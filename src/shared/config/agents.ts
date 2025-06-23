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
  model?: string;
}

export interface ReceptionistConfig {
  name: string;
  description: string;
  instructions: string;
  model?: string;
}

export interface AgentSystemConfig {
  receptionist: ReceptionistConfig;
  agents: AgentConfig[];
}

export const agentSystemConfig: AgentSystemConfig = {
  receptionist: {
    name: 'Receptionist',
    description:
      'Routes user queries to appropriate agents and execute the tool',
    instructions: `# ROLE
You are an intelligent routing receptionist that connects users to specialized agents.

# CORE BEHAVIOR
1. ACKNOWLEDGE: Provide a brief, friendly response to the user's request
2. ANALYZE: Determine which agent best matches the user's needs
3. ROUTE: IMMEDIATELY transfer to the appropriate agent using the available transfer tools
4. EXECUTE: Ensure the handover executes the tools successfully

# CRITICAL RULES
- NEVER mention you are transferring to another agent
- NO commentary about the transfer process
- NO explanations about tool usage
- MUST complete the handover by executing the appropriate transfer tool
- The specialist agent will handle all further communication
- NEVER make up the tool name, always use the exact tool name

# AVAILABLE TRANSFER TOOLS
Use ONLY these tools for routing:
- transfer_to_restaurant-recommendation()
- transfer_to_google-gmail-assistant() 
- transfer_to_food-delivery()`,
    model: 'gemini-2.5-flash',
  },
  agents: [
    {
      id: 'restaurant_recommendation',
      name: 'Restaurant Recommendation Agent',
      description: 'Handles restaurant recommendations',
      mcpServers: ['restaurant-booking', 'time'],
      systemPromptFile: 'restaurant-recommendation',
      model: 'claude-3-5-sonnet',
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
        'reservation',
        'cuisine',
      ],
      routingDescription:
        'Call this tool to transfer to the restaurant recommendation agent. This agent can handle restaurant searches, recommendations, and booking assistance.',
    },
    {
      id: 'google_gmail_assistant',
      name: 'Google Gmail Assistant Agent',
      description: 'Handles Gmail query service',
      mcpServers: ['google-assistant', 'time'],
      systemPromptFile: 'google-assistant',
      model: 'gemini-2.5-flash',
      additionalInstructions:
        '\n\nCRITICAL: STAY COMPLETELY SILENT while using tools. Do not output ANY text until you have the complete mail search ready. No explanations, no progress updates, no commentary. Work silently and only speak once with the final result.',
      enabled: true,
      requiresAuth: true,
      routingKeywords: ['gmail', 'email', 'inbox', 'mail', 'message'],
      routingDescription:
        'Call this tool to transfer to the mail assistant. This agent can handle mail services related queries.',
    },
    // {
    //   id: 'food_delivery',
    //   name: 'Food Delivery Agent',
    //   description: 'Handles food delivery platform search automation',
    //   mcpServers: ['browser'],
    //   systemPromptFile: 'food-delivery',
    //   model: 'gemini-2.0-flash',
    //   additionalInstructions:
    //     '\n\nCRITICAL: STAY COMPLETELY SILENT while using tools. Do not output ANY text until you have the complete result ready. No explanations, no progress updates, no commentary. Work silently and only speak once with the final result.',
    //   enabled: true,
    //   requiresAuth: false,
    //   routingKeywords: [
    //     'food',
    //     'delivery',
    //     'uber',
    //     'ubereats',
    //     'doordash',
    //     'grubhub',
    //     'foodpanda',
    //   ],
    //   routingDescription:
    //     'Call this tool to transfer to the food delivery searchagent.',
    // },
    // Add more agents here as needed
  ],
};
