# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Core Commands
- **Development**: `bun run dev` - Start development server with auto-reload
- **Build**: `bun run build` - Build for production
- **Test**: `bun test` - Run test suite
- **Lint**: `bun run lint` - Run linting checks
- **Lint Fix**: `bun run lint:fix` - Auto-fix linting issues

### Service Commands
- **API Server**: `bun src/index.ts` - Start API server directly
- **Temporal Worker**: `tsx src/features/tasks/temporal.worker.ts` - Start Temporal worker

### Docker Commands
- **Build API**: `make docker-build-api` - Build API container
- **Build Worker**: `make docker-build-worker` - Build Temporal worker container

### Infrastructure
- **Start Services**: Navigate to `src/shared/infrastructure` and run `docker-compose up -d`
- **Initialize Database**: Use `init-temporal-db.sh` script for Temporal database setup

## High-Level Architecture

### Core Framework
This is an AI Agent Swarm application built with TypeScript, Hono, and the AgentSwarm framework. It implements a Queen Agent pattern where a receptionist routes users to specialized agents.

### Key Architectural Components

#### 1. Configuration-Driven Agent System
- **Agent Configuration**: `src/shared/config/agents.ts` - Declarative agent definitions with routing keywords
- **Agent Factory**: `src/features/agents/agent.factory.ts` - Singleton factory for agent creation
- **Agent Registry**: `src/features/agents/agent.registry.ts` - Manages agent lifecycle and handover tools
- **MCP Configuration**: `src/shared/config/mcp.ts` - Model Context Protocol server configurations

#### 2. Agent Routing Pattern
- **Receptionist Agent**: Routes user queries to appropriate specialized agents based on keywords
- **Handover Tools**: Automatically generated transfer tools for seamless agent switching
- **Bidirectional Transfers**: Agents can transfer back to receptionist when needed

#### 3. MCP Tool Integration
- **Tool Registry**: Centralizes MCP server connections and tool availability
- **Authentication Flow**: Handles OAuth tokens for MCP servers requiring auth
- **Multi-Service Agents**: Agents can use tools from multiple MCP servers simultaneously

#### 4. Feature-Based Architecture
```
src/features/
├── agents/          # Agent system (factory, registry, swarm integration)
├── conversations/   # Chat history and conversation management
├── emails/          # Email services and data access
├── embeddings/      # Vector embeddings for content
├── mcp/            # MCP client and service integration
├── tasks/          # Temporal workflows and activities
└── users/          # User management and authentication
```

#### 5. Infrastructure Layer
- **Database**: PostgreSQL with vector embedding support
- **Temporal**: Workflow orchestration for async tasks
- **Authentication**: Google OAuth 2.0 with JWT sessions
- **Output Strategies**: Streaming (SSE) and collected response patterns

### Key Design Patterns

#### Agent Configuration Pattern
Instead of hardcoded agent creation, agents are defined declaratively:

```typescript
// src/shared/config/agents.ts
{
  id: 'restaurant_recommendation',
  name: 'Restaurant Recommendation Agent',
  mcpServers: ['restaurant-booking', 'time'],
  systemPromptFile: 'restaurant-recommendation',
  routingKeywords: ['restaurant', 'food', 'dining'],
  model: 'claude-3-5-sonnet'
}
```

#### Strategy Pattern for Output
- **HonoSSEOutput**: Server-Sent Events for streaming responses
- **CollectOutput**: Collects complete responses for non-streaming APIs

#### Session Management
- User sessions maintain conversation history and authentication state
- Session-based tool authorization for MCP servers requiring auth

### Critical Implementation Details

#### Agent Creation Flow
1. Configuration validation against available MCP servers
2. Automatic handover tool generation based on routing keywords
3. System prompt loading from `src/shared/prompts/`
4. MCP tool integration with authentication handling

#### Authentication Architecture
- Google OAuth flow with callback handling
- JWT session tokens for API access
- Optional authentication middleware for flexible endpoint protection
- Automatic token passing to MCP servers requiring authentication

#### Temporal Integration
- Async task processing with workflows and activities
- Worker service runs independently from API server
- Database initialization scripts for Temporal schema

### Environment Configuration
Key environment variables:
- `ANTHROPIC_API_KEY` - For Claude models
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` - OAuth setup
- `DATABASE_URL` - PostgreSQL connection
- `TEMPORAL_ADDRESS` - Temporal service connection
- MCP server URLs and enablement flags

### Testing and Quality
- ESLint with TypeScript configuration
- Jest for testing framework
- Strict TypeScript configuration
- Professional software architect standards (see .cursor/rules/architect.mdc)

## Development Workflow

1. **Setup**: Run `bun install` and configure environment variables
2. **Infrastructure**: Start Docker services in `src/shared/infrastructure/`
3. **Development**: Use `bun run dev` for live development
4. **Agent Addition**: Add configuration to `agents.ts` - no code changes needed
5. **Testing**: Use provided test commands and health endpoints
6. **Building**: Use `bun run build` before deployment

## Key Files to Understand
- `src/index.ts` - Hono server entry point and route definitions
- `src/shared/config/agents.ts` - Agent system configuration
- `src/features/agents/agent.factory.ts` - Agent creation logic
- `src/shared/config/mcp.ts` - MCP server configurations
- `src/features/conversations/conversation.service.ts` - Core conversation handling