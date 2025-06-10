# Agent Swarm

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-v20+-green.svg)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3+-blue.svg)](https://www.typescriptlang.org/)

A powerful AI Agent Swarm application built with TypeScript, featuring both interactive console chat and HTTP API interfaces for seamless AI interaction using Anthropic's Claude model.

## 🚀 Features

- **Interactive Console Chat**: Beautiful terminal-based chat interface with Claude
- **HTTP API Server**: RESTful API with streaming support for web applications
- **Message History**: Persistent conversation history per session
- **Multiple Output Strategies**: Unified architecture supporting console, SSE, and collected outputs
- **TypeScript**: Full type safety and modern development experience
- **Streaming Support**: Real-time AI response streaming for both console and API
- **Model Context Protocol (MCP)**: Advanced AI model integration

## 📋 Prerequisites

- Node.js v20 or higher
- npm or yarn package manager
- Anthropic API key

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

   Edit `.env` and add your Anthropic API key:

   ```
   ANTHROPIC_API_KEY=your_api_key_here
   ```

## 🚀 Usage

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
- Response: `{ "status": "ok", "timestamp": "ISO-date" }`

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
```

## 🏗️ Architecture

The project follows a clean, modular architecture with the Strategy Pattern for output handling:

```
src/
├── messages/
│   ├── types.ts              # OutputStrategy interface definitions
│   ├── output-strategies.ts  # Console, SSE, and Collect output implementations
│   ├── chat.ts              # Unified sendMessage function with streaming
│   └── history.ts           # Message history management
├── config/
│   └── index.ts             # Configuration management
├── utils/
│   └── logger.ts            # Winston-based logging utility
├── index.ts                 # Interactive console interface
└── api-server.ts           # Express HTTP API server
```

### Output Strategies

- **SSEOutput**: Server-Sent Events for real-time web streaming
- **CollectOutput**: Collects complete responses for non-streaming APIs

## 🔧 Development

### Build the project

```bash
npm run build
# or
make build
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

## 📚 Scripts

| Script             | Description            |
| ------------------ | ---------------------- |
| `npm run dev`      | Start HTTP API server  |
| `npm run api`      | Start HTTP API server  |
| `npm run build`    | Build for production   |
| `npm run start`    | Start production build |
| `npm test`         | Run test suite         |
| `npm run lint`     | Run ESLint             |
| `npm run lint:fix` | Fix ESLint issues      |

## 🎯 Key Technologies

- **TypeScript**: Type-safe development
- **Anthropic AI SDK**: Claude model integration
- **Express.js**: HTTP API framework
- **Winston**: Structured logging
- **Zod**: Runtime type validation
- **Model Context Protocol (MCP)**: Advanced AI capabilities

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b fear/amazing-feature`
3. Commit your changes: `git commit -m 'feat: Add amazing feature'`
4. Push to the branch: `git push origin feat/amazing-feature`
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 👤 Author

**Sam Wang**

- GitHub: [@samwang0723](https://github.com/samwang0723)

## 🙏 Acknowledgments

- [Anthropic](https://anthropic.com/) for the Claude AI model
- [Model Context Protocol](https://modelcontextprotocol.io/) for advanced AI integration
- The TypeScript and Node.js communities

---

⭐ **Star this repository if you find it helpful!**
