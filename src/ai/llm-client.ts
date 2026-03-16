// ============================================================
// FILE: llm-client.ts
// PATH: src/ai/llm-client.ts
// PROJECT: DataQualityGuard
// PURPOSE: LLM client with Forge LLMs API + external Claude fallback
// ============================================================

import api, { fetch } from '@forge/api';
import { getConfig } from '../db/queries';

interface LLMResponse {
  content: string;
  model: string;
  source: 'forge' | 'external';
}

/**
 * Tries Forge LLMs API first (data stays on Atlassian).
 * Falls back to external Claude API if Forge LLMs unavailable.
 */
export async function analyzWithLLM(prompt: string): Promise<LLMResponse> {
  try {
    return await callForgeLLM(prompt);
  } catch (err) {
    console.log('[LLM] Forge LLMs unavailable, trying external API...');
    try {
      return await callExternalClaude(prompt);
    } catch (extErr) {
      console.error('[LLM] Both LLM sources failed:', extErr);
      return {
        content: 'LLM analysis unavailable. Using rule-based analysis only.',
        model: 'none',
        source: 'forge'
      };
    }
  }
}

async function callForgeLLM(prompt: string): Promise<LLMResponse> {
  // Forge LLMs API (EAP) — import dynamically to avoid errors if not available
  const { chat } = await import('@forge/llm');
  const response = await chat({
    model: 'claude-sonnet-4-20250514',
    messages: [{ role: 'user', content: prompt }],
  });

  return {
    content: response.message?.content || '',
    model: 'claude-sonnet-4',
    source: 'forge'
  };
}

async function callExternalClaude(prompt: string): Promise<LLMResponse> {
  const apiKey = await getConfig('anthropic_api_key', '');
  if (!apiKey) {
    throw new Error('No Anthropic API key configured');
  }

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!response.ok) {
    throw new Error(`Claude API error: ${response.status}`);
  }

  const data = await response.json();
  const text = data.content?.[0]?.text || '';

  return {
    content: text,
    model: 'claude-sonnet-4',
    source: 'external'
  };
}

export function buildContradictionPrompt(
  jiraText: string,
  confluenceText: string,
  jiraKey: string,
  pageTitle: string
): string {
  return `You are a data quality analyst. Compare these two texts from the same project and identify any contradictions or inconsistencies.

JIRA TICKET (${jiraKey}):
${jiraText.substring(0, 2000)}

CONFLUENCE PAGE ("${pageTitle}"):
${confluenceText.substring(0, 2000)}

Respond in JSON format:
{
  "hasContradiction": true/false,
  "confidence": 0.0-1.0,
  "contradictions": [
    {
      "type": "status_mismatch|requirement_conflict|date_discrepancy|technical_inconsistency",
      "description": "Brief description of the contradiction",
      "recommendation": "What should be done to resolve this"
    }
  ]
}

If no contradictions found, return: {"hasContradiction": false, "confidence": 1.0, "contradictions": []}`;
}
