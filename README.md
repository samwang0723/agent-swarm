# Agent Swarm

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-v20+-green.svg)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3+-blue.svg)](https://www.typescriptlang.org/)

A powerful AI Agent Swarm application built with TypeScript, featuring intelligent agent routing, MCP (Model Context Protocol) tool integration, and unified output strategies for seamless AI interaction across multiple interfaces.

## 🚀 Features

- **🤖 Agent Swarm Architecture**: Multi-agent system with intelligent routing and specialized agents
- **🔌 MCP Tool Integration**: Extensible Model Context Protocol support for external services
- **💬 Interactive Console Chat**: Beautiful terminal-based chat interface
- **🌐 HTTP API Server**: RESTful API with streaming support for web applications
- **📚 Message History**: Persistent conversation history per session
- **🎯 Unified Output Strategies**: Strategy pattern supporting console, SSE, and collected outputs
- **⚡ Real-time Streaming**: Live AI response streaming for both console and API
- **🍽️ Restaurant Booking**: Built-in restaurant search and booking capabilities
- **🔧 TypeScript**: Full type safety and modern development experience
- **📈 Extensible Architecture**: Easy to add new agents and MCP tools

## 🏗️ Architecture Overview

The Agent Swarm uses a sophisticated multi-agent architecture with the following key components:

### Agent Hierarchy

- **Receptionist Agent**: Routes user queries to appropriate specialized agents
- **Recommendation Agent**: Handles restaurant recommendations and bookings
- **Custom Agents**: Easily add new specialized agents for different domains

### MCP Tool System

- **Tool Registry**: Centralized management of MCP tools from multiple servers
- **Multi-Service Agents**: Agents that can use tools from multiple MCP servers
- **Dynamic Tool Loading**: Tools are loaded dynamically from configured MCP servers

### Output Strategy Pattern

- **Unified Streaming**: Single source of truth for AI response generation
- **Multiple Output Formats**: Console, Server-Sent Events, and collected responses
- **Extensible**: Easy to add new output methods (WebSocket, file, etc.)

## 📋 Prerequisites

- Node.js v20 or higher
- npm or yarn package manager
- Anthropic API key
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

3. **Set up environment variables**:

   ```bash
   cp .env.example .env
   ```

   Edit `.env` and add your configuration:

   ```
   ANTHROPIC_API_KEY=your_api_key_here

   # Restaurant Booking MCP Server
   RESTAURANT_BOOKING_MCP_URL=http://localhost:3001/mcp
   RESTAURANT_BOOKING_MCP_HEALTH_URL=http://localhost:3001/health
   RESTAURANT_BOOKING_MCP_ENABLED=true

   # Time MCP Server
   TIME_MCP_URL=http://localhost:3002/mcp
   TIME_MCP_HEALTH_URL=http://localhost:3002/health
   TIME_MCP_ENABLED=true
   ```

## 🚀 Usage

### Interactive Console Chat

Start the interactive console:

```bash
npm run chat
```

### HTTP API Server

Start the API server:

```bash
npm run api
```

The server will start on `http://localhost:3000` with the following endpoints:

#### Endpoints

**POST /chat/stream**

- Streaming chat endpoint with Server-Sent Events (SSE)
- Request body: `{ "message": "your message", "sessionId": "optional-session-id" }`
- Response: SSE stream with real-time AI responses

**POST /chat**

- Non-streaming chat endpoint
- Request body: `{ "message": "your message", "sessionId": "optional-session-id" }`
- Response: `{ "response": "complete AI response" }`

**GET /health**

- Health check endpoint
- Response: `{ "status": "ok", "timestamp": "ISO-date", "mcpServers": {...} }`

### Example API Usage

```bash
# Streaming chat
curl -X POST http://localhost:3000/chat/stream \
  -H "Content-Type: application/json" \
  -d '{"message": "Hello, Claude!", "sessionId": "user-123"}'

# Non-streaming chat
curl -X POST http://localhost:3000/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "Hello, Claude!", "sessionId": "user-123"}'

# Restaurant search example
curl -X POST http://localhost:3000/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "Find me a romantic restaurant for a date tonight in Taipei", "sessionId": "user-123"}'
```

## 🤖 Agent System

### Agent Types

#### 1. Multi-Service Agent

Uses tools from multiple MCP servers:

```typescript
const agent = createMultiServiceAgent(
  ['restaurant-booking', 'time'],
  'Custom system prompt'
);
```

#### 2. Adaptive Agent

Automatically uses all available MCP servers:

```typescript
const agent = createAdaptiveAgent('Custom system prompt');
```

#### 3. Single-Purpose Agent

Specialized for one MCP server:

```typescript
const agent = createSinglePurposeAgent(
  'restaurant-booking',
  'Custom system prompt',
  'restaurant-agent'
);
```

### System Prompts

Agents can use system prompts loaded from files in `src/config/prompts/`:

```typescript
// Load prompt from src/config/prompts/restaurant-recommendation.txt
const prompt = loadSystemPrompt('restaurant-recommendation');
```

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
    url: process.env.RESTAURANT_BOOKING_MCP_URL || 'http://localhost:3001/mcp',
    healthUrl:
      process.env.RESTAURANT_BOOKING_MCP_HEALTH_URL ||
      'http://localhost:3001/health',
    enabled: process.env.RESTAURANT_BOOKING_MCP_ENABLED !== 'false',
  },
  // Add more servers here
];
```

## 🏗️ Project Structure

```
src/
├── agents/
│   ├── index.ts              # Agent creation factories
│   └── convert.ts           # MCP tool to agent tool conversion
├── messages/
│   ├── types.ts              # OutputStrategy interface definitions
│   ├── output-strategies.ts  # Console, SSE, and Collect output implementations
│   ├── chat.ts              # Unified sendMessage function with streaming
│   └── history.ts           # Message history management
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
├── index.ts                 # Interactive console interface
└── api-server.ts           # Express HTTP API server
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
    url: process.env.YOUR_SERVICE_MCP_URL || 'http://localhost:3003/mcp',
    healthUrl:
      process.env.YOUR_SERVICE_MCP_HEALTH_URL || 'http://localhost:3003/health',
    enabled: process.env.YOUR_SERVICE_MCP_ENABLED !== 'false',
  },
];
```

### Step 3: Add Environment Variables

Update your `.env` file:

```
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

In your application code, create a specialized agent:

```typescript
import { createSinglePurposeAgent, createMultiServiceAgent } from '@/agents';

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

### Step 6: Update Agent Routing

Modify the receptionist agent in `src/messages/chat.ts` to route to your new agent:

```typescript
const receptionistAgent = new Agent<ChatContext>({
  name: 'Receptionist',
  description: 'Routes user queries to appropriate agents',
  instructions: 'You help users by routing them to the appropriate agent...',
  tools: {
    // ... existing transfers
    transfer_to_your_service: {
      type: 'handover',
      description: 'Transfer to your service agent',
      parameters: z.object({
        topic: z.string().describe('Your service topic'),
      }),
      execute: async ({ topic }) => ({
        agent: yourAgent,
        context: { topic },
      }),
    },
  },
});
```

### Step 7: Test Your Integration

1. Start your MCP server
2. Run the agent swarm: `npm run api` or `npm run chat`
3. Test queries related to your service domain

### Example: Adding a Weather Service

Here's a complete example of adding a weather service:

1. **MCP Configuration** (`src/config/mcp.ts`):

```typescript
{
  name: 'weather',
  url: process.env.WEATHER_MCP_URL || 'http://localhost:3004/mcp',
  healthUrl: process.env.WEATHER_MCP_HEALTH_URL || 'http://localhost:3004/health',
  enabled: process.env.WEATHER_MCP_ENABLED !== 'false',
}
```

2. **System Prompt** (`src/config/prompts/weather.txt`):

```
You are a professional weather assistant with access to real-time weather data.
Help users get accurate weather information and forecasts.
```

3. **Agent Creation**:

```typescript
const weatherAgent = createSinglePurposeAgent(
  'weather',
  loadSystemPrompt('weather'),
  'weather-assistant'
);
```

4. **Routing Integration**:

```typescript
transfer_to_weather: {
  type: 'handover',
  description: 'Transfer to weather agent for weather-related queries',
  parameters: z.object({
    topic: z.string().describe('Weather query topic'),
  }),
  execute: async ({ topic }) => ({
    agent: weatherAgent,
    context: { topic },
  }),
},
```

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

- **ConsoleOutput**: Terminal output with proper formatting
- **SSEOutput**: Server-Sent Events for web streaming
- **CollectOutput**: Collect complete responses for non-streaming APIs

### Creating Custom Output Strategies

Implement the `OutputStrategy` interface:

```typescript
import { OutputStrategy } from '@messages/types';

export class CustomOutput implements OutputStrategy {
  onChunk(chunk: string, accumulated: string): void {
    // Handle streaming chunks
  }

  onStart?(data: { sessionId: string; streaming: boolean }): void {
    // Handle stream start
  }

  onFinish?(data: { complete: boolean; sessionId: string }): void {
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

Unified function for sending messages to the agent swarm.

**Parameters:**

- `model`: LanguageModelV1 - The AI model instance
- `message`: string - User message
- `userId`: string - Session identifier
- `outputStrategy`: OutputStrategy - Output handling strategy

**Returns:** Promise with message history and new response

### Tool Registry

#### `toolRegistry.getTools()`

Get all available tools from all MCP servers.

#### `toolRegistry.getServerTools(serverName)`

Get tools from a specific MCP server.

#### `toolRegistry.getStatus()`

Get connection status of all MCP servers.

## 🔍 Troubleshooting

### Common Issues

1. **MCP Server Connection Failed**

   - Check if your MCP server is running
   - Verify the URL and health endpoint
   - Check firewall and network settings

2. **Agent Not Routing Correctly**

   - Verify the transfer function in the receptionist agent
   - Check system prompts and instructions
   - Review logs for routing decisions

3. **Tools Not Available**
   - Check MCP server configuration
   - Verify environment variables
   - Check tool registry status: `toolRegistry.getStatus()`

### Debug Mode

Enable debug logging:

```bash
DEBUG=* npm run api
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

- Built with [AgentSwarm](https://github.com/AI-Broker/agentswarm) framework
- Powered by [Anthropic's Claude](https://www.anthropic.com/) AI model
- MCP (Model Context Protocol) integration for extensible tool support

---

⭐ **Star this repository if you find it helpful!**
