# Agent Swarm

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-v20+-green.svg)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3+-blue.svg)](https://www.typescriptlang.org/)
[![Bun](https://img.shields.io/badge/Bun-1.0+-hotpink.svg)](https://bun.sh/)

A powerful AI Agent Swarm application built with TypeScript and Hono, featuring intelligent agent routing using the AgentSwarm framework, MCP (Model Context Protocol) tool integration, Google OAuth authentication, and unified output strategies for seamless AI interaction.

![Screenshot 2025-06-12 at 4 55 46 PM](https://github.com/user-attachments/assets/42b1661a-1e4e-495d-8d85-d9e8fb83f566)

## 🚀 Features

- **🤖 AgentSwarm Integration**: Built on the AgentSwarm framework with Hive/Swarm architecture
- **👑 Queen Agent Pattern**: Business logic agent that routes to specialized worker agents
- **🔌 MCP Tool Integration**: Extensible Model Context Protocol support for external services
- **🔐 Google OAuth Authentication**: Secure authentication with Google account integration and Gmail API access
- **🌐 RESTful API Server**: User-based API with streaming and non-streaming endpoints, built with Hono
- **📚 Message History**: Persistent conversation history per authenticated user with tool call tracking
- **🎯 Unified Output Strategies**: Strategy pattern supporting SSE streaming and collected outputs
- **⚡ Real-time Streaming**: Live AI response streaming with Server-Sent Events
- **🍽️ Restaurant Booking**: Built-in restaurant search and booking capabilities
- **📊 Interactive Web Interface**: Built-in web interface for easy testing and interaction
- **🔧 TypeScript**: Full type safety and modern development experience
- **📈 Extensible Architecture**: Easy to add new agents and MCP tools
- **⚙️ Configuration-Driven**: NEW! Declarative agent setup - add agents without code changes
- **🛡️ Auto-Validation**: NEW! Comprehensive configuration validation with detailed error messages
- **🔄 Smart Routing**: NEW! Automatic handover tool generation based on keywords

## 🏗️ Architecture Overview

             +-----------------------------+
             |  User Question (NL Prompt)  |
             +-----------------------------+
                          |
                          v
         +--------------------------------------+
         | LLM-Orchestrator (your backend API)  |
         | - Parses intent                      |
         | - Embedding search (if needed)       |
         | - SQL query / summarization          |
         +------------------+-------------------+
                            |
                +-----------+------------+
                |    Embedding Layer     |
                |  (Postgres + pgvector) |
                +------------------------+
                            |
                +-----------+------------+
                |      Data Store        |
                | (emails, events, etc.) |
                +------------------------+

The Agent Swarm uses the AgentSwarm framework with a sophisticated multi-agent architecture:

### AgentSwarm Integration

- **Hive/Swarm Pattern**: Uses AgentSwarm's Hive to spawn and manage agent swarms
- **Queen Agent**: Business logic agent serves as the entry point and router
- **Worker Agents**: Specialized agents for different domains (restaurant recommendations, etc.)
- **Swarm Caching**: Persistent swarms per user session for context continuity

### Agent Hierarchy

- **Business Logic Agent (Queen)**: Routes user queries and manages the overall conversation flow
- **Receptionist Agent**: Provides friendly initial responses and transfers to specialists
- **Recommendation Agent**: Handles restaurant recommendations and bookings with MCP tools
- **Custom Agents**: Easily add new specialized agents for different domains

### MCP Tool System

- **Tool Registry**: Centralized management of MCP tools from multiple servers
- **Multi-Service Agents**: Agents that can use tools from multiple MCP servers simultaneously
- **Dynamic Tool Loading**: Tools are loaded dynamically from configured MCP servers
- **Health Monitoring**: Continuous health checks for MCP server availability

### Authentication System

- **Google OAuth 2.0**: Secure authentication with Google accounts
- **Gmail API Integration**: Access to Gmail for enhanced functionality
- **Session Management**: JWT-based session tokens with cookie and Bearer token support
- **CORS Protection**: Proper CORS configuration for web applications

### Output Strategy Pattern

- **Unified Streaming**: Single source of truth for AI response generation
- **SSE Streaming**: Server-Sent Events for real-time web streaming
- **Collected Responses**: Complete response collection for non-streaming APIs
- **Extensible**: Easy to add new output methods (WebSocket, file, etc.)

## 📋 Prerequisites

- Node.js v20 or higher
- Bun package manager
- Anthropic API key
- Google Cloud Console project with OAuth 2.0 credentials
- MCP servers (optional, for extended functionality)

## 🛠️ Installation

1. **Clone the repository**:

   ```bash
   git clone https://github.com/samwang0723/agent-swarm.git
   cd agent-swarm
   ```

2. **Install dependencies**:

   ```bash
   bun install
   # or using make
   make install
   ```

3. **Set up Google OAuth**:

   - Create a project in [Google Cloud Console](https://console.cloud.google.com/)
   - Enable the Gmail API and Google+ API
   - Create OAuth 2.0 credentials (Client ID and Client Secret)
   - Add authorized redirect URIs: `http://localhost:3000/api/v1/auth/google/callback`

4. **Set up environment variables**:

   Create a `.env` file with your configuration:

   ```env
   # Anthropic API
   ANTHROPIC_API_KEY=your_anthropic_api_key_here

   # Server Configuration
   PORT=3000
   NODE_ENV=development

   # Google OAuth Configuration
   GOOGLE_CLIENT_ID=your_google_client_id
   GOOGLE_CLIENT_SECRET=your_google_client_secret
   GOOGLE_REDIRECT_URI=http://localhost:3000/api/v1/auth/google/callback

   # Restaurant Booking MCP Server
   RESTAURANT_BOOKING_MCP_URL=http://localhost:3000/mcp
   RESTAURANT_BOOKING_MCP_HEALTH_URL=http://localhost:3000/health
   RESTAURANT_BOOKING_MCP_ENABLED=true

   # Time MCP Server
   TIME_MCP_URL=http://localhost:3000/mcp
   TIME_MCP_HEALTH_URL=http://localhost:3000/health
   TIME_MCP_ENABLED=true
   ```

## 🚀 Usage

### Start the Application

The application serves as both API server and includes a web interface:

```bash
bun run dev
# or
make dev
```

The server will start on `http://localhost:3000` with:

- **Web Interface**: `http://localhost:3000` - Interactive chat interface
- **API Documentation**: `http://localhost:3000/api/v1/docs` - API documentation
- **Authentication**: `http://localhost:3000/api/v1/auth/google` - Google OAuth login

### Authentication Flow

1. **Navigate to Google Auth**: `GET /api/v1/auth/google`
2. **Complete OAuth Flow**: Redirected to Google for consent
3. **Receive Session Token**: Callback provides session token
4. **Use APIs**: Include token in Authorization header or as cookie

### HTTP API Server

#### Authentication Endpoints

**GET /api/v1/auth/google**

- Initiate Google OAuth authentication
- Redirects to Google consent screen

**GET /api/v1/auth/google/callback**

- Handle Google OAuth callback
- Returns session token and user information

#### Chat Endpoints (Require Authentication)

**GET /api/v1/chat/history**

- Get chat history for authenticated user
- Headers: `Authorization: Bearer <token>` or session cookie
- Response: `{ "userId": "string", "messageCount": number, "pairCount": number, "messages": [...] }`

**DELETE /api/v1/chat/history**

- Clear chat history for authenticated user
- Headers: `Authorization: Bearer <token>` or session cookie
- Response: `{ "message": "History cleared", "userId": "string" }`

**POST /api/v1/chat/stream**

- Streaming chat endpoint with Server-Sent Events (SSE)
- Headers: `Authorization: Bearer <token>` or session cookie
- Request body: `{ "message": "your message" }`
- Response: SSE stream with real-time AI responses

**POST /api/v1/chat**

- Non-streaming chat endpoint
- Headers: `Authorization: Bearer <token>` or session cookie
- Request body: `{ "message": "your message" }`
- Response: `{ "response": "complete AI response", "messageCount": number }`

#### System Endpoints

**GET /api/v1/health**

- Health check endpoint with MCP server status
- Response: `{ "status": "ok", "timestamp": "ISO-date", "mcp": {...}, "tools": {...} }`

### Example API Usage

```bash
# 1. Authenticate with Google (opens browser)
curl http://localhost:3000/api/v1/auth/google

# 2. Use the session token from callback in subsequent requests
TOKEN="your_session_token_here"

# Streaming chat
curl -X POST http://localhost:3000/api/v1/chat/stream \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"message": "Find me a romantic restaurant for a date tonight in Taipei"}'

# Non-streaming chat
curl -X POST http://localhost:3000/api/v1/chat \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"message": "Hello, Claude!"}'

# Get chat history
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/api/v1/chat/history

# Clear chat history
curl -X DELETE -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/api/v1/chat/history
```

## 🤖 Agent System

### New Configuration-Driven Architecture

The Agent Swarm now uses a **modern, configuration-driven architecture** that makes agent management simple, scalable, and maintainable. The system automatically handles agent creation, routing, and tool integration based on declarative configuration.

### Key Components

- **Configuration Layer** (`src/config/agents.ts`): Declarative agent definitions
- **Agent Registry** (`src/agents/registry.ts`): Manages agent lifecycle and handover tools
- **Agent Factory** (`src/agents/factory.ts`): Singleton factory for creating agent systems
- **Business Logic Agent** (`src/agents/business-logic.ts`): Simplified 3-line entry point

### AgentSwarm Integration

The system seamlessly integrates with AgentSwarm's Hive/Swarm pattern:

```typescript
// Simple agent creation - everything is handled automatically
const agent = createBusinessLogicAgent(accessToken);

// Create a hive with the configured agent system
const hive = new Hive<ChatContext>({
  queen: agent, // This is actually the receptionist that routes to specialists
  defaultModel: model,
  defaultContext: { topic: null },
});

// Spawn a swarm for handling conversations
const swarm = hive.spawnSwarm();
```

### How It Works

#### 1. Declarative Agent Configuration

Define agents in `src/config/agents.ts` without writing complex code:

```typescript
export const agentSystemConfig: AgentSystemConfig = {
  receptionist: {
    name: 'Receptionist',
    description: 'Routes user queries to appropriate agents',
    instructions: 'You are a helpful receptionist...',
  },
  agents: [
    {
      id: 'restaurant-recommendation',
      name: 'Restaurant Recommendation Agent',
      description: 'Handles restaurant recommendations and bookings',
      mcpServers: ['restaurant-booking', 'time'],
      systemPromptFile: 'restaurant-recommendation',
      enabled: true,
      requiresAuth: false,
      routingKeywords: ['restaurant', 'food', 'dining', 'eat'],
      routingDescription: 'Transfer to restaurant agent for dining assistance',
    },
    // More agents...
  ],
};
```

#### 2. Automatic Agent Creation

The system automatically:

- ✅ Validates configurations against available MCP servers
- ✅ Creates specialized agents with proper MCP tool integration
- ✅ Generates handover tools for intelligent routing
- ✅ Sets up bidirectional transfers between agents
- ✅ Handles authentication and access tokens
- ✅ Provides comprehensive logging and error handling

#### 3. Intelligent Routing

The receptionist agent automatically gets handover tools based on your configuration:

```typescript
// Automatically generated based on agent config
transfer_to_restaurant_recommendation: {
  type: 'handover',
  description: 'Transfer to restaurant agent for dining assistance',
  parameters: z.object({
    topic: z.string().describe('User requested topic'),
  }),
  execute: async ({ topic }) => ({
    agent: restaurantAgent, // Automatically created
    context: { topic },
  }),
}
```

### Agent Architecture

#### Business Logic Agent (Entry Point)

Now incredibly simple - just 3 lines:

```typescript
export default function createBusinessLogicAgent(
  accessToken?: string
): Agent<ChatContext> {
  const factory = AgentFactory.getInstance();
  return factory.createBusinessLogicAgent(accessToken);
}
```

#### Receptionist Agent (Router)

Automatically created with handover tools for all enabled agents:

- Routes user queries to appropriate specialists
- Uses routing keywords for intelligent decisions
- Provides friendly initial responses
- Handles transfers seamlessly

#### Specialized Agents

Created automatically based on configuration:

- **Multi-Service Agents**: Use tools from multiple MCP servers
- **Authentication Handling**: Automatic OAuth token management
- **Bidirectional Handovers**: Can transfer back to receptionist
- **Custom Instructions**: Support for additional prompt instructions

### System Prompts

Agents use system prompts loaded from `src/config/prompts/`:

```typescript
// Automatically loaded based on systemPromptFile in config
const prompt = loadSystemPrompt('restaurant-recommendation');
```

Available prompts:

- `restaurant-recommendation.txt` - For restaurant recommendation agents
- `google-assistant.txt` - For Gmail and Google services
- `browser-booking.txt` - For browser-based booking automation
- Add your own prompt files as needed

### Benefits of New Architecture

🎯 **Maintainability**: Configuration-driven approach makes changes easy  
🔧 **Extensibility**: Add new agents without modifying existing code  
✅ **Reliability**: Comprehensive validation prevents runtime errors  
📊 **Observability**: Rich logging and statistics for monitoring  
🏗️ **Scalability**: Clean architecture supports growth  
🛡️ **Type Safety**: Full TypeScript support prevents bugs

### Migration from Legacy Code

**Before** (120+ lines of complex code):

```typescript
export default function createBusinessLogicAgent(accessToken?: string) {
  // Complex manual agent creation
  // Manual handover tool setup
  // Error-prone configuration
  // Mixed concerns
  // Hard to extend
}
```

**After** (3 lines + configuration):

```typescript
export default function createBusinessLogicAgent(
  accessToken?: string
): Agent<ChatContext> {
  const factory = AgentFactory.getInstance();
  return factory.createBusinessLogicAgent(accessToken);
}
```

The complexity moved to:

- **Declarative configuration** (`src/config/agents.ts`)
- **Reusable registry system** (`src/agents/registry.ts`)
- **Factory pattern** (`src/agents/factory.ts`)
- **Utility functions** (`src/agents/utils.ts`)

## 🔌 MCP Tool Integration

### Available MCP Servers

#### Restaurant Booking Tools

- **search_restaurants**: Search for restaurants based on location, cuisine, mood, and event type
- **get_restaurant_details**: Get detailed information about specific restaurants
- **get_booking_instructions**: Get reservation instructions for restaurants
- **check_availability**: Check reservation availability
- **make_reservation**: Attempt to make restaurant reservations

#### Time Tools

- Basic time and date utilities

### MCP Server Configuration

MCP servers are configured in `src/config/mcp.ts`:

```typescript
export const mcpServers: McpServerConfig[] = [
  {
    name: 'restaurant-booking',
    url: process.env.RESTAURANT_BOOKING_MCP_URL || 'http://localhost:3000/mcp',
    healthUrl:
      process.env.RESTAURANT_BOOKING_MCP_HEALTH_URL ||
      'http://localhost:3000/health',
    enabled: process.env.RESTAURANT_BOOKING_MCP_ENABLED !== 'false',
  },
  {
    name: 'time',
    url: process.env.TIME_MCP_URL || 'http://localhost:3000/mcp',
    healthUrl:
      process.env.TIME_MCP_HEALTH_URL || 'http://localhost:3000/health',
    enabled: process.env.TIME_MCP_ENABLED !== 'false',
  },
  // Add more servers here
];
```

## 🏗️ Project Structure

```
src/
├── routes/
│   ├── index.ts              # API route definitions and versioning
│   ├── auth.ts              # Google OAuth authentication routes
│   ├── chat.ts              # Chat endpoints with authentication
│   ├── health.ts            # Health check and system status
│   └── README.md            # API documentation
├── middleware/
│   ├── auth.ts              # Authentication middleware and session management
│   └── cors.ts              # CORS configuration
├── agents/
│   ├── index.ts              # Agent creation factories and types
│   ├── convert.ts           # MCP tool to agent tool conversion
│   ├── business-logic.ts    # Business logic agent entry point (3 lines!)
│   ├── registry.ts          # Agent registry for lifecycle management
│   ├── factory.ts           # Singleton factory for agent system creation
│   ├── utils.ts             # Validation and utility functions
│   └── README.md            # Agent system documentation
├── messages/
│   ├── types.ts              # OutputStrategy interface definitions
│   ├── output-strategies.ts  # SSE and output implementations
│   ├── chat.ts              # Unified sendMessage function with AgentSwarm
│   ├── history.ts           # Message history management
│   └── prompt.ts            # System prompt loading utilities
├── tools/
│   ├── index.ts             # Tool registry singleton
│   ├── mcp-registry.ts      # MCP server management
│   └── mcp-client.ts        # MCP client implementation
├── config/
│   ├── index.ts             # Configuration management
│   ├── mcp.ts               # MCP server configuration
│   ├── agents.ts            # Agent system configuration (NEW!)
│   └── prompts/             # System prompt files
│       ├── restaurant-recommendation.txt
│       ├── google-assistant.txt
│       └── browser-booking.txt
├── utils/
│   └── logger.ts            # Winston-based logging utility
└── index.ts                 # Hono server with authentication
public/
└── index.html               # Interactive web interface
```

### Key Architecture Changes

**New Configuration-Driven Files:**

- `src/config/agents.ts` - **Declarative agent definitions** (replaces complex code)
- `src/agents/registry.ts` - **Agent lifecycle management** (validation, creation, routing)
- `src/agents/factory.ts` - **Singleton factory pattern** (centralized creation)
- `src/agents/utils.ts` - **Validation and utilities** (configuration helpers)
- `src/agents/README.md` - **Comprehensive documentation** (architecture guide)

**Simplified Files:**

- `src/agents/business-logic.ts` - **Reduced from 120+ lines to 3 lines**
- Agent creation now handled by configuration instead of manual code

**Enhanced Structure:**

- Clear separation of concerns
- Configuration-driven approach
- Comprehensive validation
- Type-safe implementations
- Extensive documentation

## ➕ Adding New Agents with MCP Tools

The Agent Swarm now uses a **configuration-driven approach** that makes adding new agents incredibly simple. Instead of writing complex code, you just need to configure your agent declaratively.

### Overview: 4 Simple Steps

1. **Configure MCP Server** - Add server configuration
2. **Create System Prompt** - Write agent instructions
3. **Add Agent Configuration** - Declare agent in config
4. **Test** - Everything else is automatic!

### Step 1: Configure Your MCP Server

Add your MCP server configuration to `src/config/mcp.ts`:

```typescript
export const mcpServers: McpServerConfig[] = [
  {
    name: 'restaurant-booking',
    url: process.env.RESTAURANT_BOOKING_MCP_URL || 'http://localhost:3000/mcp',
    healthUrl:
      process.env.RESTAURANT_BOOKING_MCP_HEALTH_URL ||
      'http://localhost:3000/health',
    enabled: process.env.RESTAURANT_BOOKING_MCP_ENABLED !== 'false',
  },
  {
    name: 'time',
    url: process.env.TIME_MCP_URL || 'http://localhost:3000/mcp',
    healthUrl:
      process.env.TIME_MCP_HEALTH_URL || 'http://localhost:3000/health',
    enabled: process.env.TIME_MCP_ENABLED !== 'false',
  },
  // Add more servers here
];
```

Add environment variables to your `.env` file:

```env
RESTAURANT_BOOKING_MCP_URL=http://localhost:3000/mcp
RESTAURANT_BOOKING_MCP_HEALTH_URL=http://localhost:3000/health
RESTAURANT_BOOKING_MCP_ENABLED=true
TIME_MCP_URL=http://localhost:3000/mcp
TIME_MCP_HEALTH_URL=http://localhost:3000/health
TIME_MCP_ENABLED=true
YOUR_SERVICE_MCP_URL=http://localhost:3003/mcp
YOUR_SERVICE_MCP_HEALTH_URL=http://localhost:3003/health
YOUR_SERVICE_MCP_ENABLED=true
```

### Step 2: Create System Prompt

Create a system prompt file at `src/config/prompts/your-service.txt`:

```
You are a specialized assistant for [your domain] services.
Your primary role is to help users with [specific tasks].

Guidelines:
- Be helpful and accurate
- Use the available tools effectively
- Provide clear explanations

Available tools allow you to:
- [List your tool capabilities here]
```

### Step 3: Add Agent Configuration

This is where the magic happens! Simply add your agent to `src/config/agents.ts`:

```typescript
export const agentSystemConfig: AgentSystemConfig = {
  // ... existing config
  agents: [
    // ... existing agents
    {
      id: 'your-service',
      name: 'Your Service Agent',
      description: 'Handles your service related queries',
      mcpServers: ['your-service-name'], // Must match MCP server name
      systemPromptFile: 'your-service', // Prompt file name (without .txt)
      enabled: true,
      requiresAuth: false, // Set to true if authentication needed
      routingKeywords: ['service', 'help', 'support', 'your-domain'],
      routingDescription:
        'Transfer to your service agent for specialized assistance',
      additionalInstructions: '\n\nRemember to be extra helpful!', // Optional
    },
  ],
};
```

### Step 4: Test Your Integration

That's it! 🎉 The system automatically:

- ✅ **Validates** your configuration against available MCP servers
- ✅ **Creates** the specialized agent with all MCP tools
- ✅ **Generates** handover tools for routing based on keywords
- ✅ **Sets up** bidirectional transfers (agent ↔ receptionist)
- ✅ **Handles** authentication if required
- ✅ **Provides** comprehensive logging and error handling

Just start the application and test:

```bash
bun run dev
```

Navigate to `http://localhost:3000` and try queries containing your routing keywords!

### What Happens Automatically

When you add an agent configuration, the system automatically:

1. **Agent Creation**: Creates a multi-service agent with your specified MCP servers
2. **Tool Integration**: Loads all tools from your MCP servers
3. **Routing Setup**: Creates `transfer_to_your_service` handover tool
4. **Receptionist Update**: Adds your agent to the receptionist's available transfers
5. **Bidirectional Handovers**: Allows your agent to transfer back to receptionist
6. **Validation**: Ensures all MCP servers exist and are available
7. **Authentication**: Handles OAuth tokens if `requiresAuth: true`
8. **Logging**: Provides detailed logs for debugging and monitoring

### Advanced Configuration Options

```typescript
{
  id: 'advanced-agent',
  name: 'Advanced Service Agent',
  description: 'Handles complex service operations',
  mcpServers: ['service-1', 'service-2'], // Multiple MCP servers
  systemPromptFile: 'advanced-service',
  additionalInstructions: '\n\nSpecial instructions here...',
  enabled: true,
  requiresAuth: true, // Requires Google OAuth
  routingKeywords: ['advanced', 'complex', 'service'],
  routingDescription: 'Transfer for advanced service operations requiring authentication',
}
```

### Migration from Legacy Approach

**Before** (Old approach - 7 complex steps):

- Manual agent creation with factory functions
- Complex handover tool setup
- Manual business logic agent modification
- Error-prone code changes

**After** (New approach - 4 simple steps):

- Declarative configuration
- Automatic validation and setup
- No code changes required
- Type-safe and error-resistant

### Debugging New Agents

Enable debug logging to see the agent creation process:

```bash
LOG_LEVEL=debug bun run dev
```

Check the health endpoint for agent status:

```bash
curl http://localhost:3000/api/v1/health
```

The system provides detailed logs showing:

- Configuration validation results
- Agent creation success/failure
- MCP server connectivity
- Handover tool generation
- Transfer operations

### Example: Weather Agent

Here's a complete example of adding a weather agent:

**1. MCP Server Config** (`src/config/mcp.ts`):

```typescript
{
  name: 'weather-api',
  url: 'http://localhost:3004/mcp',
  healthUrl: 'http://localhost:3004/health',
  enabled: true,
  requiresAuth: false,
}
```

**2. System Prompt** (`src/config/prompts/weather.txt`):

```
You are a weather assistant that provides accurate weather information.
Use the weather tools to get current conditions and forecasts.
Always provide temperature in both Celsius and Fahrenheit.
```

**3. Agent Configuration** (`src/config/agents.ts`):

```typescript
{
  id: 'weather',
  name: 'Weather Assistant',
  description: 'Provides weather information and forecasts',
  mcpServers: ['weather-api'],
  systemPromptFile: 'weather',
  enabled: true,
  requiresAuth: false,
  routingKeywords: ['weather', 'forecast', 'temperature', 'rain', 'sunny'],
  routingDescription: 'Transfer to weather assistant for weather information',
}
```

**4. Test**:

```bash
bun run dev
# Try: "What's the weather like today?"
```

Done! Your weather agent is now fully integrated and ready to use. 🌤️

## 🔧 Development

### Build the project

```bash
bun run build
# or
make build
```

### Run in development mode

```bash
bun run dev
# or
make dev
```

### Run tests

```bash
bun test
# or
make test
```

### Linting

```bash
bun run lint
# or
make lint

# Auto-fix linting issues
bun run lint:fix
# or
make lint-fix
```

### Clean build artifacts

```bash
make clean
```

## 🎯 Output Strategies

The application uses a Strategy Pattern for handling different output methods:

### Available Strategies

- **SSEOutput**: Server-Sent Events for web streaming with user session management
- **CollectOutput**: Collect complete responses for non-streaming APIs

### Creating Custom Output Strategies

Implement the `OutputStrategy` interface:

```typescript
import { OutputStrategy } from '@messages/types';

export class CustomOutput implements OutputStrategy {
  onChunk(chunk: string, accumulated: string): void {
    // Handle streaming chunks
  }

  onStart?(data: { userId: string; streaming: boolean }): void {
    // Handle stream start
  }

  onFinish?(data: { complete: boolean; userId: string }): void {
    // Handle stream completion
  }

  onError?(error: string): void {
    // Handle errors
  }
}
```

## 📚 API Reference

### Core Functions

#### `sendMessage(model, message, userId, outputStrategy)`

Unified function for sending messages to the AgentSwarm.

**Parameters:**

- `model`: LanguageModelV1 - The AI model instance
- `message`: string - User message
- `userId`: string - User identifier (from authentication)
- `outputStrategy`: OutputStrategy - Output handling strategy

**Returns:** Promise with message history and new response

### Authentication

#### `requireAuth` - Authentication Middleware

Protects routes requiring authentication. Supports both Bearer tokens and session cookies.

#### `optionalAuth` - Optional Authentication Middleware

Allows both authenticated and unauthenticated requests.

### Tool Registry

#### `toolRegistry.getTools()`

Get all available tools from all MCP servers.

#### `toolRegistry.getServerTools(serverName)`

Get tools from a specific MCP server.

#### `toolRegistry.getStatus()`

Get connection status of all MCP servers.

#### `toolRegistry.getToolNames()`

Get list of all available tool names.

### Database Schema

```mermaid
erDiagram
  users ||--o{ integrations : has
  users ||--o{ emails : owns
  users ||--o{ messages : owns
  users ||--o{ calendar_events : owns
  users ||--o{ embeddings : owns
  users ||--o{ summaries : owns

  emails ||--o| embeddings : feeds
  messages ||--o| embeddings : feeds
  calendar_events ||--o| embeddings : feeds

  embeddings {
    UUID id
    UUID user_id
    TEXT source_type
    UUID source_id
    TEXT content
    VECTOR[] embedding
    TIMESTAMP created_at
  }
```

## 🔍 Troubleshooting

### Common Issues

1. **Google OAuth Configuration**

   - Verify Google Client ID and Secret in environment variables
   - Check redirect URI matches Google Console configuration
   - Ensure Gmail API is enabled in Google Cloud Console

2. **Authentication Issues**

   - Check if session token is included in requests
   - Verify Bearer token format: `Authorization: Bearer <token>`
   - Check cookie configuration for browser-based requests

3. **MCP Server Connection Failed**

   - Check if your MCP server is running
   - Verify the URL and health endpoint in `src/config/mcp.ts`
   - Check firewall and network settings
   - Review logs for connection errors

4. **Agent Not Routing Correctly**

   - Verify the transfer function in the business logic agent
   - Check system prompts and instructions
   - Review logs for routing decisions and tool calls

5. **Tools Not Available**
   - Check MCP server configuration in `src/config/mcp.ts`
   - Verify environment variables
   - Check tool registry status: `GET /api/v1/health` endpoint
   - Review MCP server health endpoints

### Debug Mode

Enable debug logging by setting log level:

```bash
DEBUG=* bun run dev
```

Check the `/api/v1/health` endpoint for detailed system status:

```bash
curl http://localhost:3000/api/v1/health
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Built with [AgentSwarm](https://github.com/K-Mistele/swarm) framework
- Powered by [Vercel AI SDK](https://ai-sdk.dev/docs/introduction) framework
- MCP (Model Context Protocol) integration for extensible tool support
- Hono for HTTP API server functionality
- Google OAuth 2.0 for secure authentication

---

⭐ **Star this repository if you find it helpful!**
