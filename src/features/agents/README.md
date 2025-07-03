# Mastra Agent System

A flexible, configuration-driven agent system built on [Mastra framework](https://mastra.ai) that supports dynamic agent creation, routing, and persistent memory management.

## Architecture Overview

The agent system is built on Mastra and consists of several key components:

- **Configuration Layer** (`@/shared/config/agents.ts`): Declarative agent definitions
- **User Orchestration** (`agent.swarm.ts`): Manages user-specific agent sessions with persistent memory
- **Agent Factory** (`agent.factory.ts`): Creates and configures agent registries
- **Agent Registry** (`agent.repository.ts`): Manages agent lifecycle, tools, and handovers
- **Agent Service** (`agent.service.ts`): Factory functions for creating different agent types
- **Memory Service** (`mastra.memory.ts`): Handles persistent memory across conversations
- **MCP Adapter** (`mastra.adapter.ts`): Converts MCP tools to Mastra tools
- **DTOs** (`agent.dto.ts`): Type definitions and interfaces

## How It Works

### Core Flow

```mermaid
graph TB
    subgraph "User Session"
        User[👤 User Request] --> ConversationService[🎮 Conversation Service]
        ConversationService --> Orchestration{🏢 User Orchestration}
    end

    subgraph "Agent Creation (First Time)"
        Orchestration -->|New User| Factory[🏭 Agent Factory]
        Factory --> Registry[📋 Agent Registry]
        Registry --> Receptionist[👑 Receptionist Agent]
        Registry --> Specialists[⚙️ Specialized Agents]
        Factory --> Memory[🧠 Mastra Memory]
    end

    subgraph "Conversation Flow"
        Orchestration -->|Existing User| Cached[💾 Cached Agents]
        Cached --> ActiveAgent{🎯 Active Agent}
        Receptionist --> ActiveAgent

        ActiveAgent --> MastraAgent[🤖 Mastra Agent.stream]
        MastraAgent --> Tools[🛠️ Available Tools]

        Tools --> FunctionTool[⚡ Function Tools<br/>MCP Server Calls]
        Tools --> HandoverTool[🔄 Handover Tools<br/>Agent Transfer]
    end

    subgraph "Tool Execution"
        FunctionTool --> MCPServer[🌐 MCP Server]
        MCPServer --> ToolResult[📊 Tool Result]

        HandoverTool --> AgentSwitch[🔀 Agent Switch]
        AgentSwitch --> NewAgent[🎯 New Active Agent]
        NewAgent --> NewTools[🛠️ New Tool Set]
    end

    subgraph "Memory & Context"
        MastraAgent --> MemoryUpdate[💾 Update Memory]
        MemoryUpdate --> PersistentMemory[(🗄️ Persistent Memory<br/>User Scoped)]
        ToolResult --> ContextUpdate[🔄 Update Context]
        AgentSwitch --> ContextUpdate
    end

    subgraph "Response"
        ToolResult --> Response[📝 Agent Response]
        NewTools --> Response
        Response --> StreamToUser[📡 Stream to User]
    end

    style Receptionist fill:#e1f5fe
    style Specialists fill:#f3e5f5
    style MastraAgent fill:#e8f5e8
    style PersistentMemory fill:#fff3e0
    style AgentSwitch fill:#ffebee
```

### Agent Handover Mechanism

The system uses Mastra tools for seamless agent handovers:

```mermaid
sequenceDiagram
    participant User
    participant Orchestration as User Orchestration
    participant Receptionist as Receptionist Agent
    participant Restaurant as Restaurant Agent
    participant Memory as Mastra Memory
    participant MCP as MCP Servers

    User->>Orchestration: "Find me a romantic restaurant"
    Orchestration->>Memory: Load user context
    Memory-->>Orchestration: Previous conversations

    rect rgb(240, 248, 255)
        Note over Orchestration,Receptionist: Phase 1: Receptionist Processing
        Orchestration->>Receptionist: agent.stream(message, context)
        Receptionist->>Receptionist: Analyze request
        Note over Receptionist: Available tools:<br/>transfer_to_restaurant<br/>transfer_to_google<br/>transfer_to_*
        Receptionist->>Receptionist: Execute: transfer_to_restaurant
        Receptionist-->>Orchestration: Handover result
    end

    rect rgb(248, 255, 248)
        Note over Orchestration,Restaurant: Phase 2: Agent Switch
        Orchestration->>Orchestration: Switch to restaurant agent
        Orchestration->>Restaurant: agent.stream(handover_context)
        Restaurant->>Restaurant: Process restaurant query
        Note over Restaurant: Available tools:<br/>search_restaurants<br/>book_restaurant<br/>get_current_time<br/>transfer_back_to_receptionist
    end

    rect rgb(255, 248, 240)
        Note over Restaurant,MCP: Phase 3: Tool Execution
        Restaurant->>MCP: search_restaurants(location, cuisine)
        MCP-->>Restaurant: Restaurant results
        Restaurant->>Memory: Update conversation context
        Restaurant-->>User: "I found several romantic restaurants..."
    end
```

## Key Components

### 1. User Orchestration (`agent.swarm.ts`)

Manages user-specific agent sessions with persistent memory:

```typescript
// Get or create user orchestration
const orchestration = await getOrCreateUserOrchestration(session, model);

// Process message through active agent
const response = await processUserMessage(
  userId,
  message,
  sessionId,
  orchestration.memoryContext,
  orchestration.receptionistAgent
);
```

**Features:**

- ✅ User-scoped agent instances
- ✅ Persistent memory across sessions
- ✅ Automatic cleanup of inactive users
- ✅ Session management and caching

### 2. Agent Registry (`agent.repository.ts`)

Creates and manages the agent ecosystem:

```typescript
class AgentRegistry {
  // Creates receptionist + specialized agents
  // Generates handover tools automatically
  // Sets up bidirectional transfers
  // Manages memory configuration
}
```

**Features:**

- ✅ Configuration-driven agent creation
- ✅ Automatic handover tool generation
- ✅ MCP tool integration via adapter
- ✅ Memory-aware agent setup

### 3. Memory Service (`mastra.memory.ts`)

Handles persistent, user-scoped memory:

```typescript
// Initialize user memory
await mastraMemoryService.initializeUserMemory(userId);

// Save conversation context
await mastraMemoryService.saveUserMessage(userId, threadId, message);
await mastraMemoryService.saveAssistantMessage(userId, threadId, response);

// Retrieve conversation history
const { messages, workingMemory } = await mastraMemoryService.getUserMemory(
  userId,
  threadId
);
```

**Features:**

- ✅ User-scoped persistent memory
- ✅ Working memory for user preferences
- ✅ Thread-based conversation management
- ✅ Memory cleanup and retention policies

### 4. MCP Adapter (`mastra.adapter.ts`)

Converts MCP tools to Mastra-compatible tools:

```typescript
// Convert single server tools
const mastraTools = convertMcpToolsToMastraTools(mcpTools, serverName);

// Convert multi-server tools with prefixes
const allTools = convertMultiServerMcpToolsToMastraTools(toolsByServer);
```

**Features:**

- ✅ JSON Schema to Zod conversion
- ✅ Access token injection
- ✅ Server prefixing for tool conflicts
- ✅ Error handling and logging

## Configuration

### Agent Configuration Example

```typescript
export const agentSystemConfig: AgentSystemConfig = {
  receptionist: {
    name: 'Receptionist',
    description: 'Routes user queries to appropriate agents',
    instructions:
      'You are a helpful receptionist that routes users to the right specialist.',
  },
  agents: [
    {
      id: 'restaurant',
      name: 'Restaurant Expert',
      description: 'Handles restaurant recommendations and bookings',
      mcpServers: ['restaurant-booking', 'time'],
      systemPromptFile: 'restaurant-recommendation',
      enabled: true,
      routingKeywords: ['restaurant', 'food', 'dining', 'eat'],
      routingDescription:
        'Transfer to restaurant expert for dining recommendations',
    },
    {
      id: 'google',
      name: 'Google Assistant',
      description: 'Handles Google services and searches',
      mcpServers: ['google-assistant'],
      systemPromptFile: 'google-assistant',
      enabled: true,
      routingKeywords: ['search', 'google', 'calendar', 'drive'],
      routingDescription: 'Transfer to Google assistant for Google services',
    },
  ],
};
```

## Usage

### Basic Setup

```typescript
import { getOrCreateUserOrchestration } from '@/features/agents/agent.swarm';
import { createModelByKey } from '@/shared/config/models';

// Get language model
const model = createModelByKey();
if (!model) throw new Error('Failed to create model');

// Get user orchestration
const orchestration = await getOrCreateUserOrchestration(session, model);

// Process user message
const response = await processUserMessage(
  session.id,
  userMessage,
  session.id,
  orchestration.memoryContext,
  orchestration.receptionistAgent
);
```

### Advanced Usage with Memory

```typescript
import { mastraMemoryService } from '@/features/agents/mastra.memory';

// Initialize user memory
await mastraMemoryService.initializeUserMemory(userId);

// Get conversation history
const { messages, workingMemory } = await mastraMemoryService.getUserMemory(
  userId,
  sessionId
);

// Update user preferences
await mastraMemoryService.updateWorkingMemory(userId, sessionId, {
  preferences: {
    preferredLanguage: 'en',
    communicationStyle: 'concise',
  },
});
```

## Adding New Agents

### Step 1: Configure MCP Server

Add your MCP server to `src/shared/config/mcp.ts`:

```typescript
export const mcpServers: McpServerConfig[] = [
  // ... existing servers
  {
    name: 'weather-service',
    url: process.env.WEATHER_MCP_URL || 'http://localhost:3002/mcp',
    healthUrl:
      process.env.WEATHER_MCP_HEALTH_URL || 'http://localhost:3002/health',
    enabled: process.env.WEATHER_MCP_ENABLED !== 'false',
    requiresAuth: false,
  },
];
```

### Step 2: Create System Prompt

Create `src/shared/prompts/weather.txt`:

```
You are a weather specialist assistant with access to comprehensive weather services.

Your primary role is to help users with:
- Current weather conditions
- Weather forecasts
- Weather alerts and warnings
- Climate information

Use the available weather tools effectively and provide clear, actionable information.
Always include relevant details like temperature, conditions, and timing.
```

### Step 3: Add Agent Configuration

Update `src/shared/config/agents.ts`:

```typescript
export const agentSystemConfig: AgentSystemConfig = {
  // ... existing config
  agents: [
    // ... existing agents
    {
      id: 'weather',
      name: 'Weather Specialist',
      description: 'Provides weather information and forecasts',
      mcpServers: ['weather-service'],
      systemPromptFile: 'weather',
      enabled: true,
      requiresAuth: false,
      routingKeywords: ['weather', 'forecast', 'temperature', 'rain', 'storm'],
      routingDescription:
        'Transfer to weather specialist for weather information',
    },
  ],
};
```

### Step 4: Test

The system will automatically:

- ✅ Validate the configuration
- ✅ Create the weather agent with MCP tools
- ✅ Generate handover tools (`transfer_to_weather`)
- ✅ Set up bidirectional transfers
- ✅ Integrate with memory system

## Agent Flow Examples

### Example 1: Restaurant Recommendation

```
User: "Find me a romantic restaurant for tonight"

1. User Orchestration loads cached agents
2. Receptionist Agent analyzes request
3. Executes transfer_to_restaurant tool
4. Restaurant Agent becomes active
5. Restaurant Agent calls search_restaurants
6. MCP server returns results
7. Restaurant Agent responds with recommendations
8. Memory service saves conversation
```

### Example 2: Cross-Agent Handover

```
User: "Book that restaurant and add it to my calendar"

1. Restaurant Agent handles booking
2. Recognizes calendar need
3. Executes transfer_to_google tool
4. Google Agent becomes active
5. Google Agent calls calendar tools
6. Updates user's calendar
7. Responds with confirmation
8. Can transfer back to receptionist
```

## Memory Architecture

### User-Scoped Memory

```typescript
// Memory is scoped by user ID
const resourceId = `user:${userId}`;
const threadId = `session:${sessionId}`;

// Each user has their own memory space
const memoryContext = {
  resourceId, // user:12345
  threadId, // session:abc123
  userId, // 12345
};
```

### Working Memory

```typescript
interface UserProfileSchema {
  name?: string;
  location?: string;
  timezone?: string;
  preferences: {
    communicationStyle?: string;
    projectGoal?: string;
    preferredLanguage: string;
    // ... more preferences
  };
  sessionState: {
    lastTaskDiscussed?: string;
    openQuestions: string[];
    currentContext?: string;
    lastAgentUsed?: string;
  };
}
```

## Benefits of Mastra Architecture

🚀 **Performance**: Direct agent streaming with Mastra's optimized runtime  
🧠 **Memory**: Persistent, user-scoped memory across all conversations  
🔧 **Extensibility**: Easy to add new agents without code changes  
✅ **Reliability**: Built-in error handling and recovery  
📊 **Observability**: Comprehensive logging and statistics  
🛡️ **Type Safety**: Full TypeScript support throughout  
🎯 **Maintainability**: Clean separation of concerns

## Monitoring & Statistics

```typescript
// Get orchestration statistics
const stats = getOrchestrationStats();
console.log(`Active users: ${stats.activeUsers}`);
console.log(`Memory usage: ${stats.memoryUsage}`);

// Get agent registry statistics
const agentStats = registry.getAgentStats();
console.log(`Enabled agents: ${agentStats.enabled}/${agentStats.total}`);
```

## Migration from Legacy AgentSwarm

The system has been completely migrated from AgentSwarm to Mastra:

### Before (AgentSwarm)

- Session-based swarm caching
- Complex hive/swarm abstraction
- Manual tool wrapping
- Limited memory capabilities

### After (Mastra)

- User-scoped orchestration
- Direct Mastra agent usage
- Automatic MCP tool conversion
- Persistent memory system
- Configuration-driven setup

## Debugging

Enable debug logging:

```bash
LOG_LEVEL=debug npm run dev
```

This shows:

- Agent creation and initialization
- Memory operations and context
- Tool execution and handovers
- User orchestration lifecycle

## Performance Considerations

- **User Caching**: Agents cached per user for performance
- **Lazy Loading**: Agents created only when needed
- **Memory Cleanup**: Automatic cleanup of inactive users
- **Tool Optimization**: Efficient MCP tool conversion and caching
- **Context Management**: Minimal context passing for speed

## Memory Management

### Working Memory in Mastra

Working memory in Mastra is **automatically managed** by agents during conversations. Unlike traditional systems where you manually update memory, Mastra handles working memory updates automatically when agents interact with users.

#### How Working Memory Works

1. **Automatic Updates**: Working memory is updated automatically when agents with proper memory configuration interact with users
2. **Schema-Based**: Working memory follows the defined schema in your memory configuration
3. **User-Scoped**: Each user has their own working memory space using `resourceId`
4. **Thread-Scoped**: Conversations are organized by `threadId` for context isolation

#### Proper Usage Pattern

```typescript
// ✅ CORRECT: Let agents update working memory naturally
const response = await agent.stream('Remember I prefer vegetarian meals', {
  resourceId: 'user_123', // User-specific memory space
  threadId: 'preferences_thread', // Conversation thread
});

// Working memory is automatically updated by the agent
const memory = await memoryService.getWorkingMemory(
  'user_123',
  'preferences_thread'
);
```

#### Important: Mastra Agent API Format

Mastra agents expect a **string message** as the first parameter, not an array of messages:

```typescript
// ✅ CORRECT: Mastra agent.stream() API
await agent.stream(messageString, {
  resourceId: memoryPatterns.getResourceId(userId),
  threadId: memoryPatterns.getThreadId(sessionId),
});

// ❌ INCORRECT: Don't pass messages array
await agent.stream({
  messages: [...], // This will cause errors
  resourceId: ...,
  threadId: ...
});
```

#### What NOT to Do

```typescript
// ❌ INCORRECT: Trying to manually update working memory
// This doesn't work because Mastra doesn't provide direct memory update methods
await memoryService.updateWorkingMemory(userId, threadId, {
  preferences: { dietary: 'vegetarian' },
});
```

#### Memory Configuration Requirements

For working memory to update automatically, ensure:

1. **Agent Memory Configuration**: Agents must be created with the shared Memory instance

```typescript
const agent = new Agent({
  name: 'Assistant',
  memory: createMastraMemory(), // ✅ Pass actual Memory instance
  // ... other config
});

// ❌ WRONG: Don't pass configuration objects
const agent = new Agent({
  name: 'Assistant',
  memory: { userId, resourceId }, // This causes errors!
  // ... other config
});
```

2. **User Scoping at Call Time**: Include `resourceId` and `threadId` in agent calls for user-specific memory

```typescript
await agent.stream(message, {
  resourceId: memoryPatterns.getResourceId(userId), // User-specific memory
  threadId: memoryPatterns.getThreadId(sessionId), // Session-specific thread
});
```

3. **Schema Definition**: Define working memory schema in the shared Memory configuration

```typescript
const memory = new Memory({
  options: {
    workingMemory: {
      enabled: true,
      scope: 'resource',
      schema: userProfileSchema, // Zod schema for structure
    },
  },
});
```

#### 🔑 **Key Architecture Points**

- **Shared Memory Instance**: All agents share the same Memory instance for consistency
- **User Scoping**: User isolation happens through `resourceId` patterns at call time
- **Thread Scoping**: Conversation isolation through `threadId` patterns at call time
- **Automatic Management**: Mastra handles saving/loading messages and updating working memory

#### Memory Patterns

The system uses consistent patterns for memory identifiers:

- **Resource ID**: `user:{userId}` - Scopes memory to individual users
- **Thread ID**: `session:{sessionId}` - Scopes conversations to specific threads

#### Reading Working Memory

You can read current working memory state:

```typescript
// Get current working memory for a user/thread
const workingMemory = await memoryService.getWorkingMemory(userId, threadId);

// Get memory context for agent calls
const memoryContext = await registry.getAgentMemoryContext(userId, sessionId);
```

#### Debugging Memory Issues

Use the provided utilities to diagnose memory configuration:

```typescript
// Check if memory configuration is valid
const validation = memoryService.validateMemoryConfiguration();
if (!validation.isValid) {
  console.log('Issues:', validation.issues);
  console.log('Recommendations:', validation.recommendations);
}

// Get guidance on proper usage
const guidance = memoryService.getWorkingMemoryGuidance();
console.log(guidance.bestPractices);
```

#### Memory Service Methods

The `MastraMemoryService` provides these key methods:

- `getWorkingMemory(userId, threadId)` - Read current working memory
- `initializeUserMemory(userId, template?)` - Prepare memory for first use
- `getUserThreads(userId)` - Get all conversation threads for a user
- `getWorkingMemoryGuidance()` - Get usage guidelines
- `validateMemoryConfiguration()` - Check setup

## Agent Configuration

### Environment Variables

```env
USE_MASTRA=true                    # Enable Mastra agent system
LLM_MODEL=gpt-4o-mini             # Default model for agents
MASTRA_MEMORY_SCHEMA=mastra       # PostgreSQL schema for memory
MASTRA_MEMORY_RETENTION_DAYS=30   # Memory retention period
```

### Creating Agents

```typescript
// Basic agent creation
const agent = createBasicMastraAgent({
  name: 'assistant',
  instructions: 'You are a helpful assistant...',
  model: openai('gpt-4o-mini'),
  tools: [...tools],
  memory: memoryCfg,
});
```

### Adding Tools

Agents can use tools from MCP servers:

```typescript
const serverTools = toolRegistry.getServerTools('calendar-server');
const mastraTools = convertMcpToolsToMastraTools(serverTools);

const agent = createBasicMastraAgent({
  // ... other config
  tools: mastraTools,
});
```

## Multi-Agent Orchestration

### Agent Swarm

The agent swarm provides multi-agent coordination:

```typescript
// Create user orchestration
const orchestration = await getOrCreateUserOrchestration(session, model);

// Process message through orchestration
const response = await processUserMessage(
  userId,
  message,
  sessionId,
  memoryContext,
  receptionistAgent
);
```

### Handover System

Agents can transfer conversations to specialized agents:

```typescript
// Transfer to calendar agent
const handoverTool = createTool({
  id: 'transfer_to_calendar',
  description: 'Transfer to calendar agent for scheduling tasks',
  execute: async ({ context }) => ({
    handover: true,
    targetAgent: 'calendar',
    context: { topic: context.topic },
  }),
});
```

## Best Practices

### Memory Management

- Always include `resourceId` and `threadId` in agent calls
- Let agents update working memory naturally through conversations
- Use consistent memory patterns for user and thread identification
- Define clear working memory schemas with Zod

### Agent Design

- Keep agent instructions focused and specific
- Use descriptive tool names and descriptions
- Implement proper error handling for tool calls
- Log agent interactions for debugging

### Performance

- Use singleton patterns for shared resources (memory, models)
- Implement proper connection pooling for databases
- Cache frequently accessed agent configurations
- Monitor memory usage and implement cleanup policies

### Security

- Validate all inputs to agent tools
- Implement proper access controls for user data
- Use secure storage for sensitive configuration
- Follow OAuth flows for external service access

## Troubleshooting

### Common Issues and Solutions

#### 1. Agent Shows "no memory" Configuration

**Symptom**: Logs show `"memory": "no memory"` and agents don't have persistent memory.

**Solution**:

```typescript
// ✅ CORRECT: Ensure memory is initialized before agent creation
const memory = createMastraMemory();
const agent = createBasicMastraAgent({
  name: 'agent-name',
  instructions: 'Your instructions...',
  model: yourModel,
  memory: memory, // Pass the actual Memory instance
});

// ❌ INCORRECT: Don't pass memory config objects
const agent = createBasicMastraAgent({
  // ...
  memory: { resource: 'user:123', thread: 'session:456' }, // This won't work
});
```

#### 2. API Call Errors (AI_APICallError)

**Symptom**: `AI_APICallError` with Anthropic/OpenAI API calls.

**Common Causes & Solutions**:

1. **API Key Issues**:

   ```bash
   # Check environment variables
   export ANTHROPIC_API_KEY="sk-ant-api..."
   export OPENAI_API_KEY="sk-proj-..."
   ```

2. **Model Configuration Issues**:

   ```typescript
   // ✅ CORRECT: Use proper model configuration
   const model = createModel(); // From your models config

   // ❌ INCORRECT: Don't use undefined or misconfigured models
   const model = undefined; // Will cause API errors
   ```

3. **System Prompt Issues**:

   ```typescript
   // ✅ CORRECT: Keep system prompts reasonable length
   const instructions = `You are a helpful assistant...`; // Keep under 4000 chars

   // ❌ INCORRECT: Don't use extremely long system prompts
   const instructions = `${'Very long prompt...'.repeat(1000)}`; // May cause API errors
   ```

#### 3. Empty Text Streams

**Symptom**: Agent stream returns empty text, logs show `"finalTextLength": 0`.

**Solution**:

```typescript
// ✅ CORRECT: Use proper stream handling with fallback
const streamResult = await agent.stream(userMessage, {
  memory: {
    thread: sessionId,
    resource: userId,
  },
  temperature: 0.7,
  maxSteps: 10,
  maxRetries: 3,
});

// Read text stream with fallback
let finalText = await readTextStream(streamResult.textStream, outputStrategy);

// Fallback to textPromise if stream is empty
if (finalText.length === 0 && streamResult.textPromise) {
  finalText = await streamResult.textPromise;
}

// Final fallback message
if (finalText.length === 0) {
  finalText =
    'I apologize, but I encountered an issue processing your request. Please try again.';
}
```

#### 4. Memory Configuration Issues

**Symptom**: Memory operations fail or agents don't remember context.

**Solution**:

```typescript
// ✅ CORRECT: Proper memory configuration
const memory = createMastraMemory(); // Creates singleton instance
const agent = createBasicMastraAgent({
  name: 'agent-name',
  instructions: 'Your instructions...',
  model: yourModel,
  memory: memory, // Pass actual Memory instance
});

// Use proper memory parameters in stream calls
const response = await agent.stream(message, {
  memory: {
    thread: sessionId, // Thread for conversation context
    resource: userId, // Resource for user-specific memory
  },
});
```

#### 5. Agent Creation Failures

**Symptom**: "Failed to create Mastra agent" errors.

**Debugging Steps**:

1. Check memory initialization:

   ```typescript
   // Validate memory instance
   const memory = createMastraMemory();
   console.log('Memory methods:', Object.keys(memory));
   console.log('Has createThread:', !!memory.createThread);
   console.log('Has query:', !!memory.query);
   ```

2. Check model configuration:

   ```typescript
   // Validate model instance
   const model = createModel();
   console.log('Model ID:', model.modelId);
   console.log('Provider:', model.provider);
   ```

3. Check agent creation:
   ```typescript
   // Enable debug logging
   logger.debug('Creating agent with config:', {
     hasModel: !!config.model,
     hasMemory: !!config.memory,
     hasTools: !!config.tools,
   });
   ```

### Best Practices for Mastra Implementation

#### 1. Following Latest Mastra API (v0.1.x)

```typescript
// ✅ CORRECT: Latest Mastra stream API
const response = await agent.stream(messageString, {
  memory: {
    thread: sessionId,
    resource: userId,
  },
  temperature: 0.7,
  maxSteps: 10,
  maxRetries: 3,
  toolChoice: 'auto',
});

// ❌ INCORRECT: Old API format
const response = await agent.stream({
  messages: [{ role: 'user', content: messageString }],
  resourceId: userId,
  threadId: sessionId,
});
```

#### 2. Memory Management

```typescript
// ✅ CORRECT: Singleton memory instance
const memory = createMastraMemory(); // Creates singleton
const agent1 = createBasicMastraAgent({ ..., memory });
const agent2 = createBasicMastraAgent({ ..., memory }); // Reuses same instance

// ❌ INCORRECT: Multiple memory instances
const agent1 = createBasicMastraAgent({ ..., memory: createMastraMemory() });
const agent2 = createBasicMastraAgent({ ..., memory: createMastraMemory() }); // Creates new instance
```

#### 3. Error Handling

```typescript
// ✅ CORRECT: Comprehensive error handling
try {
  const response = await agent.stream(message, options);
  let finalText = await readTextStream(response.textStream, outputStrategy);

  // Handle empty responses
  if (finalText.length === 0) {
    finalText =
      (await response.textPromise) || 'Sorry, I encountered an issue.';
  }

  return finalText;
} catch (error) {
  logger.error('Agent stream failed:', {
    error: error instanceof Error ? error.message : String(error),
    options,
  });
  throw error;
}
```

#### 4. Environment Configuration

```bash
# Required environment variables
USE_MASTRA=true
DATABASE_URL=postgresql://user:pass@localhost:5432/database
ANTHROPIC_API_KEY=sk-ant-api...
OPENAI_API_KEY=sk-proj-...

# Optional configuration
MASTRA_MEMORY_SCHEMA=mastra
MASTRA_MEMORY_RETENTION_DAYS=30
MASTRA_WORKFLOW_MAX_STEPS=10
```

### Testing Your Mastra Configuration

```typescript
// Test memory configuration
const memory = createMastraMemory();
console.log('Memory instance:', !!memory);
console.log('Memory methods:', Object.keys(memory));

// Test agent creation
const agent = createBasicMastraAgent({
  name: 'test-agent',
  instructions: 'You are a test assistant.',
  model: createModel(),
  memory: memory,
});
console.log('Agent created:', !!agent);
console.log('Agent has stream:', !!agent.stream);

// Test stream call
const response = await agent.stream('Hello', {
  memory: {
    thread: 'test-session',
    resource: 'test-user',
  },
});
console.log('Stream response:', !!response.textStream);
```

### Migration from Legacy Implementation

If you're migrating from a legacy implementation:

1. **Update Stream API Calls**:

   - Change from `agent.stream(messages, options)` to `agent.stream(messageString, options)`
   - Update memory parameter structure
   - Add proper error handling

2. **Memory Configuration**:

   - Use singleton memory instances
   - Update resource/thread ID patterns
   - Remove manual memory update calls

3. **Agent Creation**:
   - Pass actual Memory instances, not config objects
   - Validate agent creation with proper logging
   - Use consistent naming patterns

## Performance Optimization

### 1. Connection Pooling

```typescript
// PostgreSQL connection pooling is handled automatically by the singleton pattern
const memory = createMastraMemory(); // Reuses connection pool
```

### 2. Memory Cleanup

```typescript
// Enable automatic cleanup
const mastraConfig = {
  memory: {
    enableAutoCleanup: true,
    retentionDays: 30,
  },
};
```

### 3. Batch Operations

```typescript
// Use batch operations for multiple memory operations
const operations = [
  () => memoryService.saveUserMessage(userId, sessionId, message1),
  () => memoryService.saveUserMessage(userId, sessionId, message2),
];
await Promise.all(operations);
```

For more details, see the [official Mastra documentation](https://mastra.ai/en/reference/agents/stream).
