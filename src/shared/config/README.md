# Application Configuration

This directory contains the core configuration files for the application.

## 1. LLM Model Configuration

This configuration, located in `src/shared/config/models.ts`, defines the Large Language Models (LLMs) available to the application.

### Model Selection

The application supports multiple LLM providers. The primary model is selected using the `LLM_MODEL` environment variable. Individual agents can also specify a model to override the default.

#### Available Models

- **Anthropic Claude**
  - `claude-3-5-sonnet` (Default)
  - `claude-3-5-haiku`
- **OpenAI GPT**
  - `gpt-4o`
  - `gpt-4o-mini`
- **Google Gemini**
  - `gemini-2.5-flash`
  - `gemini-2.0-flash`

#### Configuration Example

```bash
# Use Claude 3.5 Sonnet (default)
LLM_MODEL=claude-3-5-sonnet

# Use GPT-4o
LLM_MODEL=gpt-4o

# Use Gemini 2.5 Flash
LLM_MODEL=gemini-2.5-flash
```

### API Keys

Ensure the appropriate API keys are set as environment variables for the models you intend to use.

```bash
# For Anthropic models
ANTHROPIC_API_KEY=your_anthropic_api_key

# For OpenAI models
OPENAI_API_KEY=your_openai_api_key

# For Google models
GOOGLE_API_KEY=your_google_api_key
```

### Adding New Models

To add a new model:

1.  Add the model configuration to the `MODEL_CONFIGS` object in `src/shared/config/models.ts`.
2.  Ensure the provider is supported in the `createModelByKey()` function.
3.  Update this documentation.

## 2. Agent System Configuration

The agent system, defined in `src/shared/config/agents.ts`, configures the routing receptionist and all specialized agents.

### Receptionist

The `receptionist` is a specialized agent responsible for routing user requests to the appropriate agent. Its configuration includes its name, description, and core operational instructions.

- `model`: Specifies the LLM to use for routing logic (e.g., `gemini-2.5-flash`).

### Agents

The `agents` array contains configurations for each specialized agent.

#### AgentConfig Properties

- `id`: Unique identifier for the agent (e.g., `restaurant_recommendation`).
- `name`: Display name for the agent.
- `description`: A short summary of the agent's capabilities.
- `mcpServers`: An array of MCP server names this agent can connect to.
- `systemPromptFile`: The filename (without extension) in `src/shared/prompts/` containing the agent's system prompt.
- `model`: (Optional) The specific LLM this agent should use, overriding the global default.
- `enabled`: Whether the agent is currently active.
- `requiresAuth`: If `true`, the agent requires user authentication.
- `routingKeywords`: Keywords to help the receptionist route requests to this agent.
- `routingDescription`: A description used to generate the routing tool for the receptionist.

### Adding a New Agent

1.  Add a new `AgentConfig` object to the `agents` array in `agents.ts`.
2.  Create the corresponding system prompt file in `src/shared/prompts/`.
3.  Add its transfer tool to the receptionist's instructions.
4.  Ensure any required MCP servers are configured.

## 3. MCP Server Configuration

Mission Control Plane (MCP) servers, defined in `src/shared/config/mcp.ts`, provide agents with tools and capabilities.

Each server configuration is defined by an object in the `mcpServers` array and configured via environment variables.

- `name`: Unique name for the MCP server (e.g., `restaurant-booking`). Referenced in agent configs.
- `url`: The base URL for the MCP server (`*_MCP_URL`).
- `healthUrl`: The health check endpoint for the server (`*_MCP_HEALTH_URL`).
- `enabled`: Whether the server is active (`*_MCP_ENABLED`).
- `requiresAuth`: If `true`, requests to this server require authentication.

### Adding a New MCP Server

1.  Add a new server object to the `mcpServers` array in `mcp.ts`.
2.  Define the corresponding environment variables for its configuration.

## 4. General Application Configuration

The file `src/shared/config/index.ts` holds general configuration for the application, managed through environment variables.

### Logging

- `LOG_LEVEL`: Sets the application's log level (e.g., `info`, `debug`).

### Database (PostgreSQL)

- `DB_USER`: Database user.
- `DB_PASSWORD`: Database password.
- `DB_HOST`: Database host.
- `DB_PORT`: Database port.
- `DB_NAME`: Database name.

### Temporal

- `TEMPORAL_ADDRESS`: Temporal frontend address.
- `TEMPORAL_NAMESPACE`: Temporal namespace.
- `TEMPORAL_TASK_QUEUE`: Default task queue name.
- `TEMPORAL_CONNECT_TIMEOUT`: Connection timeout in ms.
- `TEMPORAL_RPC_TIMEOUT`: RPC timeout in ms.

# Mastra Configuration

This directory contains the Mastra framework configuration for the agent system. Mastra provides persistent memory, agent orchestration, and tool management capabilities.

## Configuration Files

### `mastra.ts`

Main Mastra configuration file that sets up:

- **Memory System**: User-scoped persistent memory with working memory for preferences
- **Agent Options**: Default settings for Mastra agents
- **Memory Patterns**: Consistent resource and thread ID patterns
- **Best Practices**: Guidelines for using Mastra effectively

## Key Components

### Memory System

```typescript
// Create Mastra memory instance
const memory = createMastraMemory();

// User-scoped resource and thread patterns
const resourceId = memoryPatterns.getResourceId(userId); // "user:123"
const threadId = memoryPatterns.getThreadId(sessionId); // "session:abc"
```

**Features:**

- ✅ User-scoped persistent memory
- ✅ Working memory for user preferences and context
- ✅ Structured data with Zod schemas
- ✅ Automatic cleanup and retention policies

### Working Memory Schema

Structured user profile data stored persistently:

```typescript
interface UserProfileSchema {
  name?: string;
  location?: string;
  timezone?: string;
  preferences: {
    communicationStyle?: 'formal' | 'casual' | 'technical';
    projectGoal?: string;
    preferredLanguage?: string;
    // ... more preferences
  };
  sessionState: {
    lastTaskDiscussed?: string;
    openQuestions?: string[];
    currentContext?: string;
    lastAgentUsed?: string;
  };
}
```

### Memory Patterns

Consistent patterns for resource and thread identification:

- **User Scope**: `user:{userId}` - Persistent across all sessions
- **Thread Scope**: `session:{sessionId}` - Conversation-specific context
- **Organization Scope**: `org:{orgId}:user:{userId}` - Multi-tenant support

## Best Practices

### 1. Memory Design

**✅ Do:**

- Use Zod schemas for structured data
- Keep working memory structure flat and simple
- Use consistent naming conventions
- Scope memory to users for data isolation

**❌ Don't:**

- Store large amounts of data in working memory
- Use complex nested structures
- Mix different data types in the same fields

### 2. Agent Configuration

**✅ Do:**

- Always scope agents to users
- Use descriptive resource and thread IDs
- Enable automatic cleanup
- Monitor memory usage

**❌ Don't:**

- Share agents between users
- Use generic or unclear identifiers
- Forget to clean up inactive sessions

### 3. Tool Integration

**✅ Do:**

- Update working memory when tools provide relevant context
- Use structured data for tool results
- Log tool usage for debugging
- Handle errors gracefully

**❌ Don't:**

- Store sensitive data in working memory
- Update memory on every tool call
- Ignore memory update failures

## Usage Examples

### Basic Setup

```typescript
import { createMastraMemory, memoryPatterns } from '@/shared/config/mastra';

// Create memory instance
const memory = createMastraMemory();

// Create memory config for user
const memoryConfig = {
  resourceId: memoryPatterns.getResourceId(userId),
  threadId: memoryPatterns.getThreadId(sessionId),
};
```

### Agent Creation

```typescript
import { defaultAgentOptions } from '@/shared/config/mastra';

const agent = new Agent({
  name: 'user-assistant',
  instructions: 'You are a helpful assistant...',
  model: defaultAgentOptions.model,
  memory: {
    userId,
    resourceId: memoryPatterns.getResourceId(userId),
  },
});
```

### Working Memory Updates

```typescript
// Update user preferences
await memory.updateWorkingMemory(
  {
    threadId: memoryPatterns.getThreadId(sessionId),
    resourceId: memoryPatterns.getResourceId(userId),
  },
  {
    preferences: {
      communicationStyle: 'technical',
      preferredLanguage: 'en',
    },
  }
);

// Update session state
await memory.updateWorkingMemory(
  {
    threadId: memoryPatterns.getThreadId(sessionId),
    resourceId: memoryPatterns.getResourceId(userId),
  },
  {
    sessionState: {
      lastTaskDiscussed: 'API optimization',
      currentContext: 'technical-discussion',
    },
  }
);
```

## Memory Monitoring

The configuration includes utilities for monitoring memory usage:

```typescript
import { memoryMonitoring } from '@/shared/config/mastra';

// Get current memory stats
const stats = memoryMonitoring.getMemoryStats();

// Log memory usage
memoryMonitoring.logMemoryUsage('agent-creation');

// Check memory limits
const withinLimits = memoryMonitoring.checkMemoryLimits(1024); // 1GB limit
```

## Configuration Options

### Memory Settings

```typescript
export const mastraConfig = {
  memory: {
    enableAutoCleanup: true,
    cleanupIntervalHours: 24,
    batchSize: 100,
    maxConcurrentOperations: 10,
  },
  agents: {
    defaultTimeoutMs: 30000,
    maxAgentsPerUser: 10,
    enableAgentPersistence: true,
  },
  features: {
    enableWorkingMemory: true,
    enableCrossSessionMemory: true,
  },
};
```

### Working Memory Templates

Pre-defined templates for different use cases:

- `userProfile`: Basic user information and preferences
- `businessContext`: Company and project information
- `technicalContext`: Development environment and preferences

## Migration Notes

### From Session-Based to User-Scoped Memory

The system has migrated from session-based memory to user-scoped persistent memory:

**Before:**

- Memory tied to sessions
- Lost on session end
- No cross-session context

**After:**

- Memory tied to users
- Persistent across sessions
- Rich working memory with preferences
- Structured data with schemas

### Memory Storage

Mastra Memory handles storage automatically. The configuration uses:

- In-memory storage for development
- Configurable storage adapters for production
- Working memory for structured user data
- Automatic cleanup and retention

## Troubleshooting

### Common Issues

1. **Memory not persisting**

   - Check resource and thread ID patterns
   - Verify user ID is consistent
   - Ensure memory configuration is valid

2. **High memory usage**

   - Monitor with `memoryMonitoring.logMemoryUsage()`
   - Check cleanup settings
   - Review working memory size

3. **Schema validation errors**
   - Verify data matches `userProfileSchema`
   - Check for required fields
   - Validate data types

### Debug Logging

Enable debug logging in development:

```typescript
// Set LOG_LEVEL=debug in environment
const config = {
  development: {
    enableDebugLogs: true,
    enableMemoryInspection: true,
  },
};
```

## Performance Considerations

### Optimization Tips

1. **Memory Efficiency**

   - Use structured data over free-form text
   - Implement cleanup schedules
   - Monitor memory usage regularly
   - Use batch operations for multiple updates

2. **Agent Performance**

   - Cache agents per user
   - Implement connection pooling
   - Use appropriate timeouts
   - Monitor agent lifecycle

3. **Scaling Considerations**
   - Plan for multiple users
   - Implement proper cleanup
   - Use monitoring and alerting
   - Consider memory limits per user

## Security

### Data Protection

- Working memory may contain personal preferences
- Resource IDs isolate user data
- No sensitive data in working memory
- Proper cleanup of inactive sessions
- Audit logging for memory operations

### Access Control

- User-scoped resource patterns prevent data leakage
- Thread-based isolation for conversations
- Proper validation of memory configurations
- Error handling without data exposure

## Future Enhancements

Planned improvements:

- [ ] Vector search integration for semantic memory
- [ ] Cross-agent memory sharing with permissions
- [ ] Memory compression for long-term storage
- [ ] Advanced analytics on memory usage
- [ ] Integration with external storage systems
