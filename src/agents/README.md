# Agent System

A flexible, configuration-driven agent system that supports dynamic agent creation, routing, and management through a centralized registry.

## Architecture Overview

The agent system consists of several key components:

- **Configuration Layer** (`config/agents.ts`): Declarative agent definitions
- **Registry** (`registry.ts`): Manages agent lifecycle and handover tools
- **Factory** (`factory.ts`): Singleton factory for creating agent systems
- **Utilities** (`utils.ts`): Validation and helper functions
- **Business Logic** (`business-logic.ts`): Main entry point (simplified)

## Key Features

✅ **Declarative Configuration**: Define agents in JSON-like configuration  
✅ **Automatic Validation**: Validates configurations against available MCP servers  
✅ **Dynamic Routing**: Auto-generated handover tools based on configuration  
✅ **Bidirectional Handovers**: Agents can transfer back to receptionist  
✅ **Extensible**: Easy to add new agents without code changes  
✅ **Type Safety**: Full TypeScript support with proper typing  
✅ **Comprehensive Logging**: Detailed logging for debugging and monitoring  

## Configuration

### Agent Configuration Schema

```typescript
interface AgentConfig {
  id: string;                    // Unique identifier
  name: string;                  // Human-readable name
  description: string;           // Agent description
  mcpServers: string[];          // MCP servers this agent uses
  systemPromptFile: string;      // Prompt file name (without .txt)
  additionalInstructions?: string; // Extra instructions appended to prompt
  enabled?: boolean;             // Whether agent is active (default: true)
  requiresAuth?: boolean;        // Whether agent needs authentication
  routingKeywords?: string[];    // Keywords for routing decisions
  routingDescription?: string;   // Description for handover tool
}
```

### Example Configuration

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

### Basic Usage

```typescript
import createBusinessLogicAgent from '@/agents/business-logic';

// Create the agent system
const agent = createBusinessLogicAgent(accessToken);

// Use with AgentSwarm
const hive = new Hive<ChatContext>({
  queen: agent,
  defaultModel: model,
  defaultContext: { topic: null },
});
```

### Advanced Usage with Factory

```typescript
import { AgentFactory } from '@/agents/factory';

const factory = AgentFactory.getInstance();
const agent = factory.createBusinessLogicAgent(accessToken);

// Get registry for advanced operations
const registry = factory.getRegistry();
if (registry) {
  const stats = registry.getAgentStats();
  console.log(`${stats.enabled}/${stats.total} agents enabled`);
}
```

## Adding New Agents

### Step 1: Configure MCP Server

Add your MCP server to `src/config/mcp.ts`:

```typescript
export const mcpServers: McpServerConfig[] = [
  // ... existing servers
  {
    name: 'your-service',
    url: process.env.YOUR_SERVICE_MCP_URL || 'http://localhost:3001/mcp',
    healthUrl: process.env.YOUR_SERVICE_MCP_HEALTH_URL || 'http://localhost:3001/health',
    enabled: process.env.YOUR_SERVICE_MCP_ENABLED !== 'false',
    requiresAuth: false,
  },
];
```

### Step 2: Create System Prompt

Create `src/config/prompts/your-service.txt`:

```
You are a specialized assistant for [your domain] services.

Your primary role is to help users with [specific tasks].
Use the available tools effectively and provide clear explanations.

Available tools allow you to:
- [List tool capabilities]
```

### Step 3: Add Agent Configuration

Update `src/config/agents.ts`:

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

```typescript
import { validateAgentSystemConfig } from '@/agents/utils';

const validation = validateAgentSystemConfig(config);
if (!validation.valid) {
  console.error('Configuration errors:', validation.errors);
}
```

### Agent Template Generation

```typescript
import { generateAgentTemplate } from '@/agents/utils';

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

```typescript
import { findAgentsByKeyword } from '@/agents/utils';

const restaurantAgents = findAgentsByKeyword(config, 'restaurant');
```

## Migration from Legacy Code

The old `business-logic.ts` file (120 lines) has been replaced with:

- **Configuration**: `config/agents.ts` (declarative setup)
- **Registry**: `registry.ts` (agent management)  
- **Factory**: `factory.ts` (creation logic)
- **Utilities**: `utils.ts` (validation & helpers)
- **Main**: `business-logic.ts` (3 lines!)

### Before (120+ lines of complex code)

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

### After (Clean & Simple)

```typescript
export default function createBusinessLogicAgent(accessToken?: string): Agent<ChatContext> {
  const factory = AgentFactory.getInstance();
  return factory.createBusinessLogicAgent(accessToken);
}
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
- **Memory**: Better resource management with proper cleanup

## Testing

```typescript
import { AgentFactory } from '@/agents/factory';
import { agentSystemConfig } from '@/config/agents';

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