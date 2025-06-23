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
