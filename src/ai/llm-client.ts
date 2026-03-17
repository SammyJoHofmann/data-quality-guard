// ============================================================
// FILE: llm-client.ts
// PATH: src/ai/llm-client.ts
// PROJECT: DataQualityGuard
// PURPOSE: Multi-Provider LLM Client (Claude, Gemini, OpenAI)
// ============================================================

import api from '@forge/api';

type Provider = 'claude' | 'gemini' | 'openai';

interface LLMConfig {
  provider: Provider;
  apiKey: string;
  model?: string;
}

export interface ContradictionResult {
  hasContradiction: boolean;
  confidence: number;
  contradictions: {
    type: string;
    description: string;
    recommendation: string;
  }[];
}

// Cache for availability check
let llmCache: { available: boolean; timestamp: number } | null = null;
const CACHE_TTL = 60000;

export async function isLLMAvailable(): Promise<boolean> {
  if (llmCache && Date.now() - llmCache.timestamp < CACHE_TTL) return llmCache.available;
  try {
    const { getConfig, getApiKey } = await import('../db/queries');
    const enabled = await getConfig('ai_enabled', 'false');
    const key = await getApiKey();
    const available = enabled === 'true' && key.length >= 10;
    llmCache = { available, timestamp: Date.now() };
    return available;
  } catch {
    llmCache = { available: false, timestamp: Date.now() };
    return false;
  }
}

export function invalidateLLMCache(): void {
  llmCache = null;
}

export async function getLLMConfig(): Promise<LLMConfig | null> {
  try {
    const { getConfig, getApiKey } = await import('../db/queries');
    const provider = (await getConfig('ai_provider', 'gemini')) as Provider;
    const apiKey = await getApiKey();
    if (!apiKey || apiKey.length < 10) return null;
    return { provider, apiKey };
  } catch {
    return null;
  }
}

// The system prompt for contradiction detection
const SYSTEM_PROMPT = `Du bist ein Datenqualitäts-Analyst. Deine Aufgabe: Finde inhaltliche Widersprüche zwischen einem Jira-Ticket und einer Confluence-Seite.

Antworte IMMER als JSON:
{
  "has_contradiction": true/false,
  "confidence": 0.0-1.0,
  "contradictions": [
    {
      "type": "factual|temporal|status|technical",
      "description": "Kurze Beschreibung des Widerspruchs auf Deutsch",
      "recommendation": "Konkrete Empfehlung was aktualisiert werden muss"
    }
  ]
}

Regeln:
- Nur ECHTE Widersprüche melden (nicht bloß fehlende Info)
- confidence 0.8+ = sicherer Widerspruch
- confidence 0.5-0.8 = wahrscheinlicher Widerspruch
- Immer Deutsch antworten
- Max 3 Widersprüche pro Vergleich`;

function buildUserPrompt(
  jiraText: string,
  confluenceText: string,
  jiraKey: string,
  pageTitle: string
): string {
  return `Jira-Ticket ${jiraKey}:
${jiraText.substring(0, 2000)}

Confluence-Seite "${pageTitle}":
${confluenceText.substring(0, 2000)}

Finde alle inhaltlichen Widersprüche zwischen dem Ticket und der Seite.`;
}

// === CLAUDE API ===
async function callClaude(config: LLMConfig, userPrompt: string): Promise<string> {
  const model = config.model || 'claude-haiku-4-5-20251001';
  const resp = await api.fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': config.apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: 500,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userPrompt }],
    }),
  });
  if (!resp.ok) {
    const errBody = await resp.text().catch(() => '');
    throw new Error(`Claude API ${resp.status}: ${errBody.substring(0, 200)}`);
  }
  const data = await resp.json();
  return data.content?.[0]?.text || '';
}

// === GEMINI API ===
async function callGemini(config: LLMConfig, userPrompt: string): Promise<string> {
  const model = config.model || 'gemini-2.5-flash';
  const resp = await api.fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${config.apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: [{ parts: [{ text: userPrompt }] }],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 500,
          responseMimeType: 'application/json',
        },
      }),
    }
  );
  if (!resp.ok) {
    const errBody = await resp.text().catch(() => '');
    throw new Error(`Gemini API ${resp.status}: ${errBody.substring(0, 200)}`);
  }
  const data = await resp.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

// === OPENAI API ===
async function callOpenAI(config: LLMConfig, userPrompt: string): Promise<string> {
  const model = config.model || 'gpt-4o-mini';
  const resp = await api.fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model,
      max_tokens: 500,
      temperature: 0.1,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
    }),
  });
  if (!resp.ok) {
    const errBody = await resp.text().catch(() => '');
    throw new Error(`OpenAI API ${resp.status}: ${errBody.substring(0, 200)}`);
  }
  const data = await resp.json();
  return data.choices?.[0]?.message?.content || '';
}

// === MAIN FUNCTION ===
export async function analyzeContradiction(
  jiraText: string,
  confluenceText: string,
  jiraKey: string,
  pageTitle: string
): Promise<ContradictionResult> {
  const config = await getLLMConfig();
  if (!config) return { hasContradiction: false, confidence: 0, contradictions: [] };

  const prompt = buildUserPrompt(jiraText, confluenceText, jiraKey, pageTitle);
  let rawResponse = '';

  try {
    switch (config.provider) {
      case 'claude':
        rawResponse = await callClaude(config, prompt);
        break;
      case 'gemini':
        rawResponse = await callGemini(config, prompt);
        break;
      case 'openai':
        rawResponse = await callOpenAI(config, prompt);
        break;
      default:
        rawResponse = await callGemini(config, prompt);
        break;
    }
  } catch (err: any) {
    console.error(`[LLM] ${config.provider} API call failed:`, err?.message);
    return { hasContradiction: false, confidence: 0, contradictions: [] };
  }

  // Parse JSON response
  try {
    // Extract JSON from response (may be wrapped in markdown code blocks)
    const jsonMatch = rawResponse.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return { hasContradiction: false, confidence: 0, contradictions: [] };

    const parsed = JSON.parse(jsonMatch[0]);
    return {
      hasContradiction: parsed.has_contradiction === true,
      confidence: Number(parsed.confidence) || 0,
      contradictions: (parsed.contradictions || []).map((c: any) => ({
        type: String(c.type || 'unknown'),
        description: String(c.description || ''),
        recommendation: String(c.recommendation || ''),
      })),
    };
  } catch {
    console.warn('[LLM] Failed to parse response:', rawResponse.substring(0, 200));
    return { hasContradiction: false, confidence: 0, contradictions: [] };
  }
}
