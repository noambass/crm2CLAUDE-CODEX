import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';

export const openai = createOpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export const anthropic = createAnthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// GPT-4o-mini for chat with tools (fast, cost-effective)
export const chatModel = openai('gpt-4o-mini');

// Claude for BI SQL generation (strong reasoning)
export const biModel = anthropic('claude-3-5-haiku-20241022');
