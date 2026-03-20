import Anthropic from "@anthropic-ai/sdk";

let _client: Anthropic | null = null;

export function getAI(): Anthropic {
  if (!_client) {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error("ANTHROPIC_API_KEY environment variable is not set");
    }
    _client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return _client;
}

// Keep backward-compatible export
export const getOpenAI = getAI;
export default { get: getAI };
