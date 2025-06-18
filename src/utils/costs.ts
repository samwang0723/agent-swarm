type Cost = {
  prompt: number;
  completion: number;
};

// Prices are per million tokens
const MODEL_COSTS: Record<string, Cost> = {
  // Anthropic
  'claude-3-5-sonnet-20241022': { prompt: 3, completion: 15 },
  'claude-3-5-haiku-20241022': { prompt: 0.8, completion: 4 },
  'claude-3-opus-20240229': { prompt: 15, completion: 75 },
  'claude-3-sonnet-20240229': { prompt: 3, completion: 15 },
  'claude-3-haiku-20240307': { prompt: 0.25, completion: 1.25 },

  // OpenAI
  'gpt-4o': { prompt: 5, completion: 15 },
  'gpt-4o-mini': { prompt: 0.15, completion: 0.6 },

  // Google
  'gemini-2.5-flash-preview-05-20': { prompt: 0.15, completion: 0.6 },
  'gemini-2.0-flash': { prompt: 0.15, completion: 0.6 },
};

export function calculateCost(
  modelName: string,
  promptTokens: number,
  completionTokens: number
): number | null {
  const cost = MODEL_COSTS[modelName];
  if (!cost) {
    return null;
  }

  const promptCost = (promptTokens / 1_000_000) * cost.prompt;
  const completionCost = (completionTokens / 1_000_000) * cost.completion;

  return promptCost + completionCost;
}
