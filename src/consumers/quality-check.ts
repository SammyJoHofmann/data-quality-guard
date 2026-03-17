// ============================================================
// FILE: quality-check.ts
// PATH: src/consumers/quality-check.ts
// PROJECT: DataQualityGuard
// PURPOSE: Async event consumer that performs quality checks per project
// ============================================================

import { getProjectIssues } from '../scanner/jira-scanner';
import { getAllSpaces, getSpacePages, getPageContent } from '../scanner/confluence-scanner';
import { analyzeJiraStaleness, analyzeConfluenceStaleness } from '../analyzers/staleness';
import { analyzeCompleteness } from '../analyzers/completeness';
import { analyzeCrossReferences } from '../analyzers/cross-reference';
import { calculateProjectScore } from '../analyzers/score-calculator';
import { upsertScanResult, saveProjectScore, clearProjectResults, startScan, completeScan } from '../db/queries';
import { initializeDatabase } from '../db/schema';
import { Finding } from '../scanner/types';

export async function handler(event: any): Promise<void> {
  const { scanId, projectKey, scanType } = event;
  console.log(`[QualityCheck] Processing ${projectKey} (scan: ${scanId})`);

  await initializeDatabase();
  await startScan(scanId, projectKey, scanType || 'full');

  try {
    // 1. Scan Jira issues
    const issues = await getProjectIssues(projectKey);
    console.log(`[QualityCheck] ${projectKey}: ${issues.length} issues`);

    // 2. Scan Confluence pages (find matching spaces)
    const spaces = await getAllSpaces();
    const matchingSpaces = spaces.filter(s =>
      s.key.toUpperCase() === projectKey.toUpperCase() ||
      s.name.toUpperCase().includes(projectKey.toUpperCase())
    );

    let allPages: any[] = [];
    const pageContents = new Map<string, string>();

    for (const space of matchingSpaces.slice(0, 3)) {
      const pages = await getSpacePages(space.id);
      allPages.push(...pages);

      // Get content for cross-reference analysis (limit to first 50 pages)
      for (const page of pages.slice(0, 50)) {
        const content = await getPageContent(page.id);
        if (content) {
          pageContents.set(page.id, content);
        }
      }
    }
    console.log(`[QualityCheck] ${projectKey}: ${allPages.length} Confluence pages`);

    // 3. Run analyzers
    const allFindings: Finding[] = [];

    // Staleness
    allFindings.push(...await analyzeJiraStaleness(issues, projectKey));
    allFindings.push(...analyzeConfluenceStaleness(allPages, projectKey));

    // Completeness
    allFindings.push(...analyzeCompleteness(issues, projectKey));

    // Cross-references
    allFindings.push(...analyzeCrossReferences(issues, allPages, pageContents, projectKey));

    console.log(`[QualityCheck] ${projectKey}: ${allFindings.length} findings`);

    // 4. Clear old results and save new ones
    await clearProjectResults(projectKey);
    for (const finding of allFindings) {
      await upsertScanResult(finding);
    }

    // 5. Calculate and save project score
    const totalItems = issues.length + allPages.length;
    const score = calculateProjectScore(allFindings, projectKey, totalItems);
    await saveProjectScore(score);

    console.log(`[QualityCheck] ${projectKey}: Score = ${score.overallScore}/100`);

    // 6. Mark scan as complete
    await completeScan(scanId, totalItems, allFindings.length);

  } catch (err) {
    console.error(`[QualityCheck] Error scanning ${projectKey}:`, err);
  }
}
