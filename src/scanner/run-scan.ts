// ============================================================
// FILE: run-scan.ts
// PATH: src/scanner/run-scan.ts
// PROJECT: DataQualityGuard
// PURPOSE: Complete project scan — Jira + Confluence + KI
// ============================================================

import { getProjectIssues } from './jira-scanner';
import { getAllSpaces, getSpacePages, getPageContent, extractJiraKeys } from './confluence-scanner';
import { analyzeJiraStaleness, analyzeConfluenceStaleness } from '../analyzers/staleness';
import { analyzeCompleteness } from '../analyzers/completeness';
import { analyzeCrossReferences } from '../analyzers/cross-reference';
import { calculateProjectScore } from '../analyzers/score-calculator';
import { analyzeWithLLM, parseLLMResult } from '../ai/llm-client';
import { upsertScanResult, saveProjectScore, clearProjectResults, startScan, completeScan, saveContradiction } from '../db/queries';
import { Finding, ProjectScore, Contradiction } from './types';
import { generateId, extractTextFromADF, keywordOverlap, stripHtml } from '../utils/helpers';

export async function runProjectScan(projectKey: string): Promise<ProjectScore> {
  const scanId = generateId('scan');
  console.log(`[Scan] Starting full scan for ${projectKey} (${scanId})`);

  try {
    await startScan(scanId, projectKey, 'full');
  } catch { /* table might not exist on first run */ }

  const allFindings: Finding[] = [];
  let totalItems = 0;

  // === 1. JIRA SCAN ===
  const issues = await getProjectIssues(projectKey);
  totalItems += issues.length;
  console.log(`[Scan] ${projectKey}: ${issues.length} Jira issues`);

  // Jira Analyzers
  allFindings.push(...analyzeJiraStaleness(issues, projectKey));
  allFindings.push(...analyzeCompleteness(issues, projectKey));

  // === 2. CONFLUENCE SCAN ===
  let allPages: any[] = [];
  const pageContents = new Map<string, string>();

  try {
    const spaces = await getAllSpaces();
    // Match spaces by exact key or word-boundary name match
    const matchingSpaces = spaces.filter(s => {
      if (s.key?.toUpperCase() === projectKey.toUpperCase()) return true;
      const regex = new RegExp(`\\b${projectKey}\\b`, 'i');
      return regex.test(s.name || '');
    });

    for (const space of matchingSpaces.slice(0, 3)) {
      const pages = await getSpacePages(space.id);
      allPages.push(...pages);

      // Get content for cross-references (limit to 30 pages for performance)
      for (const page of pages.slice(0, 30)) {
        try {
          const content = await getPageContent(page.id);
          if (content) pageContents.set(page.id, content);
        } catch { /* skip failed pages */ }
      }
    }

    totalItems += allPages.length;
    console.log(`[Scan] ${projectKey}: ${allPages.length} Confluence pages from ${matchingSpaces.length} spaces`);

    // Confluence Staleness
    allFindings.push(...analyzeConfluenceStaleness(allPages, projectKey));

    // Cross-References (Confluence → Jira)
    allFindings.push(...analyzeCrossReferences(issues, allPages, pageContents, projectKey));

  } catch (err) {
    console.log(`[Scan] Confluence scan failed (may not be installed): ${err}`);
  }

  // === 3. KI ANALYSIS (Widerspruchserkennung) ===
  try {
    const contradictions = await runAIAnalysis(issues, allPages, pageContents, projectKey);
    for (const c of contradictions) {
      allFindings.push({
        id: c.id,
        itemType: 'jira_issue',
        itemKey: c.sourceKey,
        projectKey,
        checkType: 'consistency',
        score: Math.round((1 - c.confidence) * 100),
        severity: c.confidence >= 0.9 ? 'critical' : c.confidence >= 0.7 ? 'high' : 'medium',
        message: `Contradiction with ${c.targetKey}: ${c.description}`,
        details: c.recommendation
      });
      try { await saveContradiction(c); } catch { /* first run may fail */ }
    }
  } catch (err) {
    console.log(`[Scan] AI analysis skipped: ${err}`);
  }

  console.log(`[Scan] ${projectKey}: ${allFindings.length} total findings`);

  // === 4. SAVE RESULTS ===
  try { await clearProjectResults(projectKey); } catch { /* ok */ }

  for (const finding of allFindings.slice(0, 200)) {
    try { await upsertScanResult(finding); } catch { /* skip failed */ }
  }

  // === 5. CALCULATE SCORE ===
  const hasConfluence = allPages.length > 0;
  const score = calculateProjectScore(allFindings, projectKey, totalItems, hasConfluence);

  try { await saveProjectScore(score); } catch { /* ok */ }
  try { await completeScan(scanId, totalItems, allFindings.length); } catch { /* ok */ }

  console.log(`[Scan] ${projectKey}: Score = ${score.overallScore}/100 (${allFindings.length} findings, ${totalItems} items)`);
  return score;
}

/**
 * KI-based contradiction detection using the funnel approach:
 * 1. Keyword overlap filter (free, fast)
 * 2. LLM analysis only for candidates (paid, slow)
 */
async function runAIAnalysis(
  issues: any[],
  pages: any[],
  pageContents: Map<string, string>,
  projectKey: string
): Promise<Contradiction[]> {
  const contradictions: Contradiction[] = [];
  if (pageContents.size === 0 || issues.length === 0) return contradictions;

  // Build text map for Jira issues
  const issueTexts = new Map<string, string>();
  for (const issue of issues) {
    const desc = extractTextFromADF(issue.fields?.description);
    if (desc && desc.length > 20) {
      issueTexts.set(issue.key, `${issue.fields?.summary || ''} ${desc}`);
    }
  }

  // Find candidate pairs using keyword overlap (Stage 1)
  const candidates: { issueKey: string; pageId: string; overlap: number }[] = [];

  for (const [pageId, htmlContent] of pageContents.entries()) {
    const pageText = stripHtml(htmlContent);
    const referencedKeys = extractJiraKeys(htmlContent);

    for (const key of referencedKeys) {
      if (!key.startsWith(projectKey + '-')) continue;
      const issueText = issueTexts.get(key);
      if (!issueText) continue;

      const overlap = keywordOverlap(issueText, pageText);
      if (overlap > 0.1) {
        candidates.push({ issueKey: key, pageId, overlap });
      }
    }
  }

  // Sort by overlap, take top 5 candidates for LLM analysis (Stage 2)
  candidates.sort((a, b) => b.overlap - a.overlap);
  const topCandidates = candidates.slice(0, 5);

  console.log(`[AI] ${candidates.length} candidates found, analyzing top ${topCandidates.length} with LLM`);

  for (const candidate of topCandidates) {
    const issueText = issueTexts.get(candidate.issueKey) || '';
    const pageHtml = pageContents.get(candidate.pageId) || '';
    const pageText = stripHtml(pageHtml).substring(0, 3000);
    const page = pages.find((p: any) => p.id === candidate.pageId);
    const pageTitle = page?.title || candidate.pageId;

    try {
      const llmResult = await analyzeWithLLM(
        issueText,
        pageText,
        candidate.issueKey,
        `Confluence: "${pageTitle}"`
      );

      const parsed = parseLLMResult(llmResult.content);
      for (const c of parsed) {
        contradictions.push({
          id: generateId('contra'),
          sourceType: 'jira_issue',
          sourceKey: candidate.issueKey,
          targetType: 'confluence_page',
          targetKey: candidate.pageId,
          contradictionType: c.category || 'factual',
          confidence: c.confidence || 0.7,
          description: c.explanation || 'Contradiction detected',
          recommendation: c.recommendation
        });
      }
    } catch (err) {
      console.log(`[AI] LLM analysis failed for ${candidate.issueKey}: ${err}`);
    }
  }

  return contradictions;
}
