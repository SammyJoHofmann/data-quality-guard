// ============================================================
// FILE: llm-client.ts
// PATH: src/ai/llm-client.ts
// PROJECT: DataQualityGuard
// PURPOSE: Dual LLM client — Forge LLMs API + external Claude fallback
// ============================================================

import api from '@forge/api';
import { withRetry } from '../utils/helpers';

interface LLMResponse {
  content: string;
  model: string;
  source: 'forge' | 'external' | 'none';
}

const CONTRADICTION_SYSTEM_PROMPT = `You are a precise text analyst for quality assurance in software projects.

TASK: Compare two texts from different sources (Jira tickets and Confluence pages) and identify REAL contradictions.

RULES:
1. A contradiction exists ONLY when two statements DIRECTLY conflict
2. Different levels of detail are NOT contradictions
3. Supplementary information is NOT a contradiction
4. Be CONSERVATIVE: when in doubt, do NOT report a contradiction

CATEGORIES: factual, requirement, status, scope, timeline, responsibility

RESPOND ONLY WITH THIS JSON FORMAT — no other text:
{
  "contradictions_found": true/false,
  "contradictions": [
    {
      "category": "factual|requirement|status|scope|timeline|responsibility",
      "severity": "critical|high|medium|low",
      "confidence": 0.0-1.0,
      "source_excerpt": "Quote from source A",
      "target_excerpt": "Quote from source B",
      "explanation": "Why these statements contradict",
      "recommendation": "What should be done"
    }
  ]
}`;

/**
 * Analyzes two texts for contradictions using LLM.
 * Tries Forge LLMs API first, falls back to external Claude API.
 */
export async function analyzeWithLLM(
  textA: string,
  textB: string,
  sourceA: string,
  sourceB: string
): Promise<LLMResponse> {
  const userPrompt = `SOURCE A (${sourceA}):\n${textA.substring(0, 3000)}\n\nSOURCE B (${sourceB}):\n${textB.substring(0, 3000)}`;

  // Try Forge LLMs API first
  try {
    return await callForgeLLM(userPrompt);
  } catch (err) {
    console.log('[LLM] Forge LLMs unavailable, trying external API...');
  }

  // Fallback to external Claude API
  try {
    return await withRetry(() => callExternalClaude(userPrompt));
  } catch (err) {
    console.error('[LLM] All LLM sources failed:', err);
    return { content: '{"contradictions_found": false, "contradictions": []}', model: 'none', source: 'none' };
  }
}

async function callForgeLLM(_userPrompt: string): Promise<LLMResponse> {
  // @forge/llm is EAP only — not available for production.
  // When GA, replace this with actual Forge LLMs API call.
  throw new Error('Forge LLMs API not available — using external Claude API fallback');
}

async function callExternalClaude(userPrompt: string): Promise<LLMResponse> {
  // Get API key from Forge config table (fallback)
  let apiKey = '';
  try {
    const { getConfig } = await import('../db/queries');
    apiKey = await getConfig('anthropic_api_key', '');
  } catch {
    // DB might not be ready
  }

  if (!apiKey) {
    throw new Error('No Anthropic API key configured. Set it via admin settings.');
  }

  const response = await api.fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      system: CONTRADICTION_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userPrompt }],
      temperature: 0.1
    }),
  });

  if (!response.ok) {
    throw new Error(`Claude API error: ${response.status}`);
  }

  const data = await response.json() as any;
  return {
    content: data.content?.[0]?.text || '',
    model: 'claude-sonnet-4',
    source: 'external'
  };
}

/**
 * Parses LLM JSON response and filters by confidence.
 */
export function parseLLMResult(raw: string, minConfidence = 0.7): any[] {
  try {
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return [];
    const parsed = JSON.parse(jsonMatch[0]);
    if (!parsed.contradictions_found || !parsed.contradictions) return [];
    return parsed.contradictions.filter((c: any) =>
      c.confidence >= minConfidence && c.explanation?.length > 10
    );
  } catch {
    return [];
  }
}
