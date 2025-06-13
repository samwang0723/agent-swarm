# Model Configuration

This directory contains configuration files for the LLM models used in the application.

## Model Selection

The application supports multiple LLM providers and models:

### Available Models

- **Anthropic Claude**

  - `claude-3-5-sonnet` - Claude 3.5 Sonnet (latest)
  - `claude-3-5-haiku` - Claude 3.5 Haiku (latest)

- **OpenAI GPT**
  - `gpt-4o` - GPT-4 Omni
  - `gpt-4o-mini` - GPT-4 Omni Mini

### Configuration

Configure the model by setting the `LLM_MODEL` environment variable:

```bash
# Use Claude 3.5 Sonnet (default)
LLM_MODEL=claude-3-5-sonnet

# Use GPT-4 Omni
LLM_MODEL=gpt-4o

# Use Claude 3.5 Haiku
LLM_MODEL=claude-3-5-haiku

# Use GPT-4 Omni Mini
LLM_MODEL=gpt-4o-mini
```

### API Keys

Make sure to set the appropriate API keys:

```bash
# For Anthropic models
ANTHROPIC_API_KEY=your_anthropic_api_key_here

# For OpenAI models
OPENAI_API_KEY=your_openai_api_key_here
```

### Logging

The application will log:

- Which model is being initialized
- Model initialization success/failure
- API key validation errors
- Model switching events

### API Endpoints

- `GET /api/v1/chat/models` - Get current model information and list all available models

Example response:

```json
{
  "current": {
    "key": "claude-3-5-sonnet",
    "provider": "anthropic",
    "modelName": "claude-3-5-sonnet-20241022",
    "isConfigured": true
  },
  "available": [
    {
      "key": "claude-3-5-sonnet",
      "provider": "anthropic",
      "modelName": "claude-3-5-sonnet-20241022",
      "isConfigured": true
    },
    {
      "key": "gpt-4o",
      "provider": "openai",
      "modelName": "gpt-4o",
      "isConfigured": true
    }
  ]
}
```

## Adding New Models

To add a new model:

1. Add the model configuration to `MODEL_CONFIGS` in `models.ts`
2. Ensure the provider is supported in the `createModel()` function
3. Update this documentation

Example:

```typescript
'new-model-key': {
  provider: 'anthropic', // or 'openai'
  modelName: 'actual-model-name',
  baseURL: 'https://api.provider.com/v1',
  apiKey: process.env.YOUR_API_KEY,
},
```
