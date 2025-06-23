# Agent System

A flexible, configuration-driven agent system that supports dynamic agent creation, routing, and management through a centralized registry.

## Architecture Overview

The agent system consists of several key components:

- **Configuration Layer** (`@/shared/config/agents.ts`): Declarative agent definitions for the entire system.
- **Controller** (`@/features/agents/agent.controller.ts`): Manages swarm instances, caching, and logging.
- **Service Layer** (`@/features/agents/agent.service.ts`): Contains factory functions for creating different types of agents.
- **Factory** (`@/features/agents/agent.factory.ts`): A singleton factory for creating the core `AgentRegistry`.
- **Repository/Registry** (`@/features/agents/agent.repository.ts`): Manages agent lifecycle, tool creation, and handovers based on the configuration.
- **DTOs** (`@/features/agents/agent.dto.ts`): Data Transfer Objects and type definitions for the agent system.
- **Agent Utilities** (`@/features/agents/agent.util.ts`): Utility functions for converting MCP tools for agent use.
- **Shared Utilities** (`@/shared/utils/agent.ts`): System-wide utilities for configuration validation and generation.

## Key Features

✅ **Declarative Configuration**: Define agents in JSON-like configuration  
✅ **Automatic Validation**: Validates configurations against available MCP servers  
✅ **Dynamic Routing**: Auto-generated handover tools based on configuration  
✅ **Bidirectional Handovers**: Agents can transfer back to receptionist  
✅ **Extensible**: Easy to add new agents without code changes  
✅ **Type Safety**: Full TypeScript support with proper typing  
✅ **Comprehensive Logging**: Detailed logging for debugging and monitoring, managed by the `AgentController`.

## Configuration

### Agent Configuration Schema

```typescript
interface AgentConfig {
  id: string; // Unique identifier
  name: string; // Human-readable name
  description: string; // Agent description
  mcpServers: string[]; // MCP servers this agent uses
  systemPromptFile: string; // Prompt file name (without .txt)
  additionalInstructions?: string; // Extra instructions appended to prompt
  enabled?: boolean; // Whether agent is active (default: true)
  requiresAuth?: boolean; // Whether agent needs authentication
  routingKeywords?: string[]; // Keywords for routing decisions
  routingDescription?: string; // Description for handover tool
}
```

### Example Configuration (`@/shared/config/agents.ts`)

```typescript
export const agentSystemConfig: AgentSystemConfig = {
  receptionist: {
    name: 'Receptionist',
    description: 'Routes user queries to appropriate agents',
    instructions: 'You are a helpful receptionist...',
  },
  agents: [
    {
      id: 'recommendation',
      name: 'Restaurant Recommendation Agent',
      description: 'Handles restaurant recommendations and bookings',
      mcpServers: ['restaurant-booking', 'time'],
      systemPromptFile: 'restaurant-recommendation',
      additionalInstructions: '\n\nCRITICAL: STAY COMPLETELY SILENT...',
      enabled: true,
      requiresAuth: false,
      routingKeywords: ['restaurant', 'food', 'dining', 'eat'],
      routingDescription: 'Transfer to restaurant recommendation agent',
    },
    // More agents...
  ],
};
```

## Usage

The agent system is managed by the `AgentController`, which handles the lifecycle of agent swarms.

### Getting a Swarm Instance

The `getOrCreateSwarm` function in `agent.controller.ts` is the primary way to get a swarm. It caches swarms by session ID to maintain state across requests.

```typescript
import { getOrCreateSwarm } from '@/features/agents/agent.controller';
import { getCurrentModelInfo } from '@/shared/config/models';
import { Session } from '@/shared/middleware/auth';
import { createModel } from 'ai';

// Assume you have a session object and a language model
const session: Session = { id: 'some-session-id', accessToken: '...' };
const modelInfo = getCurrentModelInfo();
const model = createModel({ provider: modelInfo.key });

// Get or create a swarm for the session
const swarm = getOrCreateSwarm(session, model);

// Now you can use the swarm to interact with the agents
const response = await swarm.run('Hello, I need a restaurant recommendation.');
```

### How it Works

The `getOrCreateSwarm` function uses `createHiveSwarm` internally, which demonstrates the core setup process:

```typescript
import { LanguageModelV1 } from 'ai';
import { ChatContext, ExtendedHive, ExtendedSwarm } from './agent.dto';
import { createBusinessLogicAgent } from './agent.service';

// Helper function to create and configure the swarm (from agent.controller.ts)
function createHiveSwarm(
  model: LanguageModelV1,
  accessToken?: string
): ExtendedSwarm<ChatContext> {
  const hive = new ExtendedHive<ChatContext>({
    queen: createBusinessLogicAgent(accessToken), // The "receptionist" agent
    defaultModel: model,
    defaultContext: { topic: null },
  });

  return hive.spawnSwarm();
}
```

This setup involves:

1.  **`createBusinessLogicAgent`**: Creates the receptionist agent, which is the "queen" of the swarm. This function is the primary entry point, defined in `agent.service.ts`.
2.  **`ExtendedHive`**: An extension of the base `Hive` from the `agentswarm` library, defined in `agent.dto.ts`.
3.  **`hive.spawnSwarm()`**: Spawns an `ExtendedSwarm` instance, which is ready to handle user requests.

## Adding New Agents

### Step 1: Configure MCP Server

Add your MCP server to `src/shared/config/mcp.ts`:

```typescript
export const mcpServers: McpServerConfig[] = [
  // ... existing servers
  {
    name: 'your-service',
    url: process.env.YOUR_SERVICE_MCP_URL || 'http://localhost:3001/mcp',
    healthUrl:
      process.env.YOUR_SERVICE_MCP_HEALTH_URL || 'http://localhost:3001/health',
    enabled: process.env.YOUR_SERVICE_MCP_ENABLED !== 'false',
    requiresAuth: false,
  },
];
```

### Step 2: Create System Prompt

Create `src/shared/prompts/your-service.txt`:

```
You are a specialized assistant for [your domain] services.

Your primary role is to help users with [specific tasks].
Use the available tools effectively and provide clear explanations.

Available tools allow you to:
- [List tool capabilities]
```

### Step 3: Add Agent Configuration

Update `src/shared/config/agents.ts`:

```typescript
export const agentSystemConfig: AgentSystemConfig = {
  // ... existing config
  agents: [
    // ... existing agents
    {
      id: 'your-service',
      name: 'Your Service Agent',
      description: 'Handles your service related queries',
      mcpServers: ['your-service'],
      systemPromptFile: 'your-service',
      enabled: true,
      requiresAuth: false,
      routingKeywords: ['service', 'help', 'support'],
      routingDescription: 'Transfer to your service agent for specialized help',
    },
  ],
};
```

### Step 4: Test

That's it! The system will automatically:

- Validate the configuration
- Create the agent with MCP tools
- Generate handover tools for routing
- Set up bidirectional transfers

## Utilities

### Configuration Validation

Located in `src/shared/utils/agent.ts`.

```typescript
import { validateAgentSystemConfig } from '@/shared/utils/agent';
import { agentSystemConfig } from '@/shared/config/agents';

const validation = validateAgentSystemConfig(agentSystemConfig);
if (!validation.valid) {
  console.error('Configuration errors:', validation.errors);
}
```

### Agent Template Generation

Located in `src/shared/utils/agent.ts`.

```typescript
import { generateAgentTemplate } from '@/shared/utils/agent';

const newAgent = generateAgentTemplate(
  'weather',
  'Weather Assistant',
  ['weather-api'],
  {
    routingKeywords: ['weather', 'forecast', 'temperature'],
    requiresAuth: false,
  }
);
```

### Finding Agents by Keywords

Located in `src/shared/utils/agent.ts`.

```typescript
import { findAgentsByKeyword } from '@/shared/utils/agent';
import { agentSystemConfig } from '@/shared/config/agents';

const restaurantAgents = findAgentsByKeyword(agentSystemConfig, 'restaurant');
```

## Migration from Legacy Code

The old monolithic `business-logic.ts` file has been refactored into a modular, configuration-driven architecture:

- **Configuration**: `src/shared/config/agents.ts`
- **Controller**: `src/features/agents/agent.controller.ts`
- **Service**: `src/features/agents/agent.service.ts`
- **Factory**: `src/features/agents/agent.factory.ts`
- **Repository**: `src/features/agents/agent.repository.ts`
- **Utilities**: `src/features/agents/agent.util.ts` & `src/shared/utils/agent.ts`

### Before (120+ lines of complex, hardcoded logic)

```typescript
export default function createBusinessLogicAgent(accessToken?: string) {
  // Set access token on tool registry during agent creation
  if (accessToken) {
    toolRegistry.setAccessTokenForAll(accessToken);
  }

  let recommendationAgent;
  let googleAssistantAgent;

  try {
    // ... 50+ lines of agent creation
  } catch (error) {
    // ... error handling
  }

  const transferToRecommendation = {
    // ... 20+ lines of handover tool creation
  };

  // ... more complex logic
  return receptionistAgent;
}
```

### After (Clean, simple, and factory-driven)

The main entry point in `src/features/agents/agent.service.ts`:

```typescript
import { Agent } from 'agentswarm';
import { AgentFactory } from '@/features/agents/agent.factory';
import { ChatContext } from './agent.dto';

/**
 * Creates and configures the business logic agent system using the AgentFactory.
 */
const createBusinessLogicAgent = (accessToken?: string): Agent<ChatContext> => {
  const factory = AgentFactory.getInstance();
  return factory.createBusinessLogicAgent(accessToken);
};

export { createBusinessLogicAgent };
```

## Benefits

🎯 **Maintainability**: Configuration-driven approach makes changes easy  
🔧 **Extensibility**: Add new agents without modifying existing code  
✅ **Reliability**: Comprehensive validation prevents runtime errors  
📊 **Observability**: Rich logging and statistics for monitoring  
🏗️ **Scalability**: Clean architecture supports growth  
🛡️ **Type Safety**: Full TypeScript support prevents bugs

## Debugging

Enable debug logging by setting log level:

```bash
LOG_LEVEL=debug npm run dev
```

This will show detailed information about:

- Agent creation process
- Handover tool generation
- Transfer operations
- Configuration validation

## Performance

The new system is more efficient than the legacy approach:

- **Lazy Loading**: Agents created only when needed
- **Validation**: Fail-fast with clear error messages
- **Caching**: Factory singleton prevents duplicate work
- **Memory**: Better resource management with proper cleanup and swarm caching.

## Testing

```typescript
import { AgentFactory } from '@/features/agents/agent.factory';
import { agentSystemConfig } from '@/shared/config/agents';
import { createBusinessLogicAgent } from '@/features/agents/agent.service';
import { validateAgentSystemConfig } from '@/shared/utils/agent';

describe('Agent System', () => {
  beforeEach(() => {
    AgentFactory.getInstance().reset();
  });

  it('should create agents from configuration', () => {
    const agent = createBusinessLogicAgent();
    expect(agent).toBeDefined();
  });

  it('should validate configuration', () => {
    const validation = validateAgentSystemConfig(agentSystemConfig);
    expect(validation.valid).toBe(true);
  });
});
```
