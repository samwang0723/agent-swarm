# Agent Swarm

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-v20+-green.svg)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3+-blue.svg)](https://www.typescriptlang.org/)

A powerful AI Agent Swarm application built with TypeScript, featuring intelligent agent routing using the AgentSwarm framework, MCP (Model Context Protocol) tool integration, Google OAuth authentication, and unified output strategies for seamless AI interaction.

![Screenshot 2025-06-12 at 4 55 46 PM](https://github.com/user-attachments/assets/42b1661a-1e4e-495d-8d85-d9e8fb83f566)


## 🚀 Features

- **🤖 AgentSwarm Integration**: Built on the AgentSwarm framework with Hive/Swarm architecture
- **👑 Queen Agent Pattern**: Business logic agent that routes to specialized worker agents
- **🔌 MCP Tool Integration**: Extensible Model Context Protocol support for external services
- **🔐 Google OAuth Authentication**: Secure authentication with Google account integration and Gmail API access
- **🌐 RESTful API Server**: User-based API with streaming and non-streaming endpoints
- **📚 Message History**: Persistent conversation history per authenticated user with tool call tracking
- **🎯 Unified Output Strategies**: Strategy pattern supporting SSE streaming and collected outputs
- **⚡ Real-time Streaming**: Live AI response streaming with Server-Sent Events
- **🍽️ Restaurant Booking**: Built-in restaurant search and booking capabilities
- **📊 Interactive Web Interface**: Built-in web interface for easy testing and interaction
- **🔧 TypeScript**: Full type safety and modern development experience
- **📈 Extensible Architecture**: Easy to add new agents and MCP tools

## 🏗️ Architecture Overview

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
- npm package manager
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
   npm install
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
npm run dev
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

### AgentSwarm Architecture

The application uses the AgentSwarm framework's Hive/Swarm pattern:

```typescript
// Create a hive with a queen agent
const hive = new Hive<ChatContext>({
  queen: createBusinessLogicAgent(),
  defaultModel: model,
  defaultContext: { topic: null },
});

// Spawn a swarm for handling conversations
const swarm = hive.spawnSwarm();
```

### Agent Types

#### 1. Business Logic Agent (Queen)

The main entry point that routes to specialized agents:

```typescript
export default function createBusinessLogicAgent() {
  const recommendationAgent = createMultiServiceAgent(
    ['restaurant-booking', 'time'],
    loadSystemPrompt('restaurant-recommendation')
  );

  const receptionistAgent = new Agent<ChatContext>({
    name: 'Receptionist',
    description: 'Routes user queries to appropriate agents',
    tools: {
      transfer_to_recommendation: transferToRecommendation,
    },
  });

  return receptionistAgent;
}
```

#### 2. Multi-Service Agent

Uses tools from multiple MCP servers:

```typescript
const agent = createMultiServiceAgent(
  ['restaurant-booking', 'time'],
  'Custom system prompt'
);
```

#### 3. Adaptive Agent

Automatically uses all available MCP servers:

```typescript
const agent = createAdaptiveAgent('Custom system prompt');
```

#### 4. Single-Purpose Agent

Specialized for one MCP server:

```typescript
const agent = createSinglePurposeAgent(
  'restaurant-booking',
  'Custom system prompt',
  'restaurant-agent'
);
```

### System Prompts

Agents use system prompts loaded from files in `src/config/prompts/`:

```typescript
// Load prompt from src/config/prompts/restaurant-recommendation.txt
const prompt = loadSystemPrompt('restaurant-recommendation');
```

Available prompts:
- `restaurant-recommendation.txt` - For restaurant recommendation agents
- `browser-booking.txt` - For browser-based booking automation

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
│   └── business-logic.ts    # Business logic agent (Queen) implementation
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
│   └── prompts/             # System prompt files
├── utils/
│   └── logger.ts            # Winston-based logging utility
└── index.ts                 # Express server with authentication
public/
└── index.html               # Interactive web interface
```

## ➕ Adding New Agents with MCP Tools

### Step 1: Set Up Your MCP Server

First, ensure your MCP server is running and accessible. Your MCP server should expose:
- `/mcp` endpoint for tool definitions and execution
- `/health` endpoint for health checks

### Step 2: Configure the MCP Server

Add your MCP server configuration to `src/config/mcp.ts`:

```typescript
export const mcpServers: McpServerConfig[] = [
  // ... existing servers
  {
    name: 'your-service-name',
    url: process.env.YOUR_SERVICE_MCP_URL || 'http://localhost:3000/mcp',
    healthUrl:
      process.env.YOUR_SERVICE_MCP_HEALTH_URL || 'http://localhost:3000/health',
    enabled: process.env.YOUR_SERVICE_MCP_ENABLED !== 'false',
  },
];
```

### Step 3: Add Environment Variables

Update your `.env` file:

```env
YOUR_SERVICE_MCP_URL=http://localhost:3003/mcp
YOUR_SERVICE_MCP_HEALTH_URL=http://localhost:3003/health
YOUR_SERVICE_MCP_ENABLED=true
```

### Step 4: Create System Prompt (Optional)

Create a system prompt file at `src/config/prompts/your-domain.txt`:

```
You are a specialized assistant for [your domain] services.
Your primary role is to help users with [specific tasks].

Guidelines:
- Be helpful and accurate
- Use the available tools effectively
- Provide clear explanations

Available tools allow you to:
- [List tool capabilities]
```

### Step 5: Create Specialized Agent

Create a specialized agent using the factory functions:

```typescript
import { createSinglePurposeAgent, createMultiServiceAgent } from '@/agents';
import { loadSystemPrompt } from '@/messages/prompt';

// Option 1: Single-purpose agent
const yourAgent = createSinglePurposeAgent(
  'your-service-name',
  loadSystemPrompt('your-domain'),
  'your-agent-name'
);

// Option 2: Multi-service agent (includes your service + others)
const multiAgent = createMultiServiceAgent(
  ['your-service-name', 'restaurant-booking'],
  loadSystemPrompt('your-domain')
);
```

### Step 6: Update Business Logic Agent

Modify the business logic agent in `src/agents/business-logic.ts` to route to your new agent:

```typescript
const transferToYourService = {
  type: 'handover',
  description: 'Call this tool to transfer to your service agent',
  parameters: z.object({
    topic: z.string().describe('Your service topic'),
  }),
  execute: async ({ topic }: { topic: string }) => ({
    agent: yourAgent,
    context: { topic },
  }),
} as const;

// Add to receptionist agent tools
const receptionistAgent = new Agent<ChatContext>({
  name: 'Receptionist',
  description: 'Routes user queries to appropriate agents',
  instructions: '...',
  tools: {
    // ... existing transfers
    transfer_to_your_service: transferToYourService,
  },
});
```

### Step 7: Test Your Integration

1. Start your MCP server
2. Run the agent swarm: `npm run dev`
3. Authenticate via Google OAuth
4. Test queries related to your service domain using the web interface or API endpoints

## 🔧 Development

### Build the project

```bash
npm run build
# or
make build
```

### Run in development mode

```bash
npm run dev
# or
make dev
```

### Run tests

```bash
npm test
# or
make test
```

### Linting

```bash
npm run lint
# or
make lint

# Auto-fix linting issues
npm run lint:fix
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
DEBUG=* npm run dev
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
- Express.js for HTTP API server functionality
- Google OAuth 2.0 for secure authentication

---

⭐ **Star this repository if you find it helpful!**
