// ============================================================
// FILE: helpers.ts
// PATH: src/utils/helpers.ts
// PROJECT: DataQualityGuard
// PURPOSE: Utility functions
// ============================================================

export function generateId(prefix: string): string {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).substring(2, 8);
  return `${prefix}_${ts}_${rand}`;
}

export function daysSince(dateString: string): number {
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return 0;
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

export function severityFromScore(score: number): 'critical' | 'high' | 'medium' | 'low' | 'info' {
  if (score <= 20) return 'critical';
  if (score <= 40) return 'high';
  if (score <= 60) return 'medium';
  if (score <= 80) return 'low';
  return 'info';
}

export function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

export function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return str.substring(0, maxLen - 3) + '...';
}

/** Extracts plain text from Jira ADF (Atlassian Document Format) objects */
export function extractTextFromADF(adf: any): string {
  if (typeof adf === 'string') return adf;
  if (!adf || !adf.content) return '';
  let text = '';
  function walk(nodes: any[]) {
    for (const node of nodes) {
      if (node.type === 'text') text += (node.text || '') + ' ';
      if (node.type === 'hardBreak') text += '\n';
      if (node.content) walk(node.content);
    }
  }
  walk(adf.content);
  return text.trim();
}

/** Validates a Jira project key format */
export function isValidProjectKey(key: string): boolean {
  return /^[A-Z][A-Z0-9]{1,9}$/.test(key);
}

/** Safe number for SQL LIMIT */
export function safeLimit(limit: number, max = 200): number {
  return Math.min(Math.max(1, Math.floor(Number(limit) || 50)), max);
}

/** Keyword extraction for text similarity (stopwords removed) */
export function extractKeywords(text: string): string[] {
  const stopwords = new Set([
    'der', 'die', 'das', 'und', 'oder', 'ein', 'eine', 'ist', 'sind',
    'wird', 'werden', 'hat', 'haben', 'für', 'mit', 'von', 'auf', 'aus',
    'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'have',
    'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should',
    'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by', 'from', 'this',
    'that', 'not', 'but', 'and', 'or', 'if', 'then', 'than', 'so', 'as',
    'we', 'our', 'you', 'your', 'they', 'their', 'it', 'its', 'can', 'all'
  ]);
  return text
    .toLowerCase()
    .replace(/[^a-zäöüß0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2 && !stopwords.has(w));
}

/** Jaccard similarity between two texts (keyword overlap) */
export function keywordOverlap(textA: string, textB: string): number {
  const kwA = new Set(extractKeywords(textA));
  const kwB = new Set(extractKeywords(textB));
  if (kwA.size === 0 || kwB.size === 0) return 0;
  const intersection = new Set([...kwA].filter(x => kwB.has(x)));
  const union = new Set([...kwA, ...kwB]);
  return intersection.size / union.size;
}

/** Retry wrapper with exponential backoff */
export async function withRetry<T>(fn: () => Promise<T>, maxRetries = 3, baseDelay = 1000): Promise<T> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err: any) {
      if (attempt === maxRetries - 1) throw err;
      const isRetryable = err?.status === 429 || err?.status === 500 || err?.status === 529;
      if (!isRetryable) throw err;
      await new Promise(r => setTimeout(r, Math.pow(2, attempt) * baseDelay));
    }
  }
  throw new Error('Max retries exceeded');
}
