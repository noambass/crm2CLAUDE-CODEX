import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';

// GPT-4o-mini for chat with tools (fast, cost-effective)
export function createChatModel(apiKey) {
  return createOpenAI({ apiKey })('gpt-4o-mini');
}

// Claude Haiku for BI SQL generation (strong reasoning)
export function createBiModel(apiKey) {
  return createAnthropic({ apiKey })('claude-3-5-haiku-20241022');
}
