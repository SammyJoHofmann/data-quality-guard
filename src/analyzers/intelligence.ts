// ============================================================
// FILE: intelligence.ts
// PATH: src/analyzers/intelligence.ts
// PROJECT: DataQualityGuard
// PURPOSE: Intelligente Analysen — Stale Docs, Lost Knowledge,
//          Sprint Readiness, KI-gestützte Widerspruchserkennung
// ============================================================

import { JiraIssue, ConfluencePage, Finding } from '../scanner/types';
import { extractJiraKeys } from '../scanner/confluence-scanner';
import { generateId, daysSince, stripHtml } from '../utils/helpers';
import { analyzeContradiction } from '../ai/llm-client';
import { saveContradiction } from '../db/queries';

// ===================================================================
// Hauptfunktion — orchestriert alle Intelligence-Checks
// ===================================================================

export async function runIntelligenceChecks(
  issues: JiraIssue[],
  pages: ConfluencePage[],
  pageContents: Map<string, string>,
  projectKey: string,
  aiEnabled: boolean
): Promise<Finding[]> {
  const allFindings: Finding[] = [];

  try {
    // 1. Veraltete Dokumentation erkennen
    const staleFindings = await detectStaleDocumentation(issues, pages, pageContents, projectKey);
    allFindings.push(...staleFindings);

    // 2. Verlorenes Wissen erkennen
    const lostFindings = await detectLostKnowledge(issues, projectKey);
    allFindings.push(...lostFindings);

    // 3. Sprint-Readiness prüfen
    const sprintFindings = await checkSprintReadiness(issues, projectKey);
    allFindings.push(...sprintFindings);

    // 4. Regelbasierte Widerspruchserkennung (immer aktiv)
    const ruleCandidates = findContradictionCandidates(issues, pages, pageContents);
    if (ruleCandidates.length > 0) {
      for (const candidate of ruleCandidates.slice(0, 20)) {
        // Regelbasierter Widerspruchs-Hinweis (ohne KI)
        const isDone = issues.find(i => i.key === candidate.jiraKey)?.fields.status.statusCategory.key === 'done';
        if (isDone) {
          const contradictionId = generateId('rule_contra');

          // In contradictions-Tabelle speichern (damit Frontend sie anzeigen kann)
          await saveContradiction({
            id: contradictionId,
            sourceType: 'jira_issue',
            sourceKey: candidate.jiraKey,
            targetType: 'confluence_page',
            targetKey: candidate.pageId,
            contradictionType: 'rule_based',
            confidence: 0.6,
            description: `Möglicher Widerspruch: Ticket ${candidate.jiraKey} (erledigt) beschreibt Änderungen die Seite "${candidate.pageTitle}" widersprechen könnten`,
            recommendation: `Confluence-Seite "${candidate.pageTitle}" prüfen und aktualisieren`,
            pageTitle: candidate.pageTitle,
          });

          allFindings.push({
            id: contradictionId,
            itemType: 'confluence_page',
            itemKey: candidate.pageId,
            projectKey,
            checkType: 'consistency',
            score: 35,
            severity: candidate.sharedKeywords.length >= 5 ? 'high' : 'medium',
            message: `Möglicher Widerspruch: Seite "${candidate.pageTitle}" könnte veraltet sein — Ticket ${candidate.jiraKey} (erledigt) beschreibt Änderungen zum gleichen Thema (${candidate.sharedKeywords.slice(0, 5).join(', ')})`,
          });
        }
      }
      console.log(`[Intelligence] ${ruleCandidates.length} regelbasierte Widerspruchs-Kandidaten gefunden`);
    }

    // 5. KI-Widerspruchsanalyse (nur wenn aktiviert)
    if (aiEnabled) {
      const aiFindings = await runAIContradictionAnalysis(issues, pages, pageContents, projectKey);
      allFindings.push(...aiFindings);
    }

    console.log(`[Intelligence] ${allFindings.length} Findings generiert für ${projectKey}`);
  } catch (err) {
    console.error('[Intelligence] Fehler bei Intelligence-Checks:', err);
  }

  return allFindings;
}

// ===================================================================
// Stale Documentation — Confluence-Seiten die auf geschlossene
// Tickets verweisen (= potenziell veraltet)
// ===================================================================

export async function detectStaleDocumentation(
  issues: JiraIssue[],
  pages: ConfluencePage[],
  pageContents: Map<string, string>,
  projectKey: string
): Promise<Finding[]> {
  const findings: Finding[] = [];

  try {
    // Index aller geschlossenen/erledigten Issues
    const closedIssueKeys = new Set(
      issues
        .filter(i => i.fields.status.statusCategory.key === 'done')
        .map(i => i.key)
    );

    if (closedIssueKeys.size === 0) return findings;

    for (const page of pages) {
      try {
        const content = pageContents.get(page.id) || '';
        if (!content) continue;

        const referencedKeys = extractJiraKeys(content);
        const closedRefs = referencedKeys.filter(k => closedIssueKeys.has(k));

        if (closedRefs.length === 0) continue;

        // Seite wurde seit > 30 Tagen nicht aktualisiert?
        const lastUpdate = page.version?.createdAt;
        if (!lastUpdate) continue;

        const daysSinceUpdate = daysSince(lastUpdate);
        if (daysSinceUpdate < 30) continue;

        const score = Math.max(10, 100 - (closedRefs.length * 15) - (daysSinceUpdate > 90 ? 20 : 0));
        const severity = closedRefs.length >= 3 ? 'high' : 'medium';

        findings.push({
          id: generateId('stale'),
          itemType: 'confluence_page',
          itemKey: page.id,
          projectKey,
          checkType: 'stale_documentation',
          score,
          severity,
          message: `Seite "${page.title}" verweist auf ${closedRefs.length} geschlossene Tickets und wurde seit ${daysSinceUpdate} Tagen nicht aktualisiert`,
          details: JSON.stringify({
            closedReferences: closedRefs,
            daysSinceUpdate,
            pageTitle: page.title,
          }),
        });
      } catch (pageErr) {
        console.warn(`[Intelligence] Fehler bei Seite ${page.id}:`, pageErr);
      }
    }
  } catch (err) {
    console.error('[Intelligence] Fehler bei detectStaleDocumentation:', err);
  }

  return findings;
}

// ===================================================================
// Lost Knowledge — Tickets ohne aktiven Assignee, älter als 60 Tage,
// die noch offen sind (Wissen geht verloren)
// ===================================================================

export async function detectLostKnowledge(
  issues: JiraIssue[],
  projectKey: string
): Promise<Finding[]> {
  const findings: Finding[] = [];

  try {
    for (const issue of issues) {
      try {
        const statusKey = issue.fields.status.statusCategory.key;
        // Nur offene/in-progress Issues
        if (statusKey === 'done') continue;

        // Kein Assignee
        if (issue.fields.assignee) continue;

        // Älter als 60 Tage
        const age = daysSince(issue.fields.created);
        if (age < 60) continue;

        // Kein Update seit > 30 Tagen
        const daysSinceUpdated = daysSince(issue.fields.updated);
        if (daysSinceUpdated < 30) continue;

        const score = Math.max(5, 100 - (age > 180 ? 50 : age > 90 ? 30 : 15) - (daysSinceUpdated > 90 ? 20 : 10));
        const severity = age > 180 ? 'high' : 'medium';

        findings.push({
          id: generateId('lost'),
          itemType: 'jira_issue',
          itemKey: issue.key,
          projectKey,
          checkType: 'lost_knowledge',
          score,
          severity,
          message: `Ticket ${issue.key} ("${issue.fields.summary}") ist seit ${age} Tagen offen, hat keinen Bearbeiter und wurde seit ${daysSinceUpdated} Tagen nicht aktualisiert`,
          details: JSON.stringify({
            issueKey: issue.key,
            summary: issue.fields.summary,
            ageDays: age,
            daysSinceUpdated,
            issueType: issue.fields.issuetype.name,
            status: issue.fields.status.name,
          }),
        });
      } catch (issueErr) {
        console.warn(`[Intelligence] Fehler bei Issue ${issue.key}:`, issueErr);
      }
    }
  } catch (err) {
    console.error('[Intelligence] Fehler bei detectLostKnowledge:', err);
  }

  return findings;
}

// ===================================================================
// Sprint Readiness — Sprint-Tickets ohne Beschreibung, Assignee
// oder Priorität (nicht bereit für den Sprint)
// ===================================================================

export async function checkSprintReadiness(
  issues: JiraIssue[],
  projectKey: string
): Promise<Finding[]> {
  const findings: Finding[] = [];

  try {
    for (const issue of issues) {
      try {
        const statusKey = issue.fields.status.statusCategory.key;
        // Nur offene/in-progress Issues prüfen
        if (statusKey === 'done') continue;

        // Only check tickets marked for current sprint
        const labels = (issue.fields.labels || []).map((l: string) => l.toLowerCase());
        const isInSprint = labels.some(l => l.includes('sprint'));
        if (!isInSprint) continue;

        const problems: string[] = [];

        // Keine Beschreibung
        if (!issue.fields.description || issue.fields.description.trim().length < 10) {
          problems.push('keine Beschreibung');
        }

        // Kein Assignee
        if (!issue.fields.assignee) {
          problems.push('kein Bearbeiter zugewiesen');
        }

        // Keine Priorität
        if (!issue.fields.priority || issue.fields.priority.name === 'None') {
          problems.push('keine Priorität gesetzt');
        }

        if (problems.length === 0) continue;

        const score = Math.max(10, 100 - (problems.length * 25));
        const severity = problems.length >= 3 ? 'high' : problems.length >= 2 ? 'medium' : 'low';

        findings.push({
          id: generateId('sprint'),
          itemType: 'jira_issue',
          itemKey: issue.key,
          projectKey,
          checkType: 'sprint_readiness',
          score,
          severity,
          message: `Ticket ${issue.key} ist nicht sprint-bereit: ${problems.join(', ')}`,
          details: JSON.stringify({
            issueKey: issue.key,
            summary: issue.fields.summary,
            problems,
            status: issue.fields.status.name,
            issueType: issue.fields.issuetype.name,
          }),
        });
      } catch (issueErr) {
        console.warn(`[Intelligence] Fehler bei Sprint-Check ${issue.key}:`, issueErr);
      }
    }
  } catch (err) {
    console.error('[Intelligence] Fehler bei checkSprintReadiness:', err);
  }

  return findings;
}

// ===================================================================
// KI-Widerspruchsanalyse — Keyword-Vorfilter → LLM
// ===================================================================

export async function runAIContradictionAnalysis(
  issues: JiraIssue[],
  pages: ConfluencePage[],
  pageContents: Map<string, string>,
  projectKey: string
): Promise<Finding[]> {
  const findings: Finding[] = [];

  try {
    const candidates = findContradictionCandidates(issues, pages, pageContents);
    console.log(`[Intelligence] ${candidates.length} Widerspruchs-Kandidaten gefunden für KI-Analyse`);

    // Maximal 10 Kandidaten an LLM senden (Token-Budget)
    const toAnalyze = candidates.slice(0, 10);

    for (const candidate of toAnalyze) {
      try {
        const result = await analyzeContradiction(
          candidate.jiraText,
          candidate.confluenceText,
          candidate.jiraKey,
          candidate.pageTitle
        );

        if (!result.hasContradiction || result.contradictions.length === 0) continue;

        for (const contradiction of result.contradictions) {
          const contradictionId = generateId('ai_contra');

          // In DB speichern
          await saveContradiction({
            id: contradictionId,
            sourceType: 'jira_issue',
            sourceKey: candidate.jiraKey,
            targetType: 'confluence_page',
            targetKey: candidate.pageId,
            contradictionType: contradiction.type,
            confidence: result.confidence,
            description: contradiction.description,
            recommendation: contradiction.recommendation,
          });

          findings.push({
            id: contradictionId,
            itemType: 'jira_issue',
            itemKey: candidate.jiraKey,
            projectKey,
            checkType: 'ai_contradiction',
            score: Math.max(5, Math.round((1 - result.confidence) * 100)),
            severity: result.confidence >= 0.8 ? 'high' : result.confidence >= 0.5 ? 'medium' : 'low',
            message: `KI-Widerspruch erkannt zwischen ${candidate.jiraKey} und Seite "${candidate.pageTitle}": ${contradiction.description}`,
            details: JSON.stringify({
              jiraKey: candidate.jiraKey,
              pageTitle: candidate.pageTitle,
              pageId: candidate.pageId,
              contradictionType: contradiction.type,
              confidence: result.confidence,
              recommendation: contradiction.recommendation,
              aiEnhanced: true,
            }),
          });
        }
      } catch (candidateErr) {
        console.warn(`[Intelligence] KI-Analyse fehlgeschlagen für ${candidate.jiraKey}:`, candidateErr);
      }
    }
  } catch (err) {
    console.error('[Intelligence] Fehler bei runAIContradictionAnalysis:', err);
  }

  return findings;
}

// ===================================================================
// Keyword-Vorfilter für Widersprüche
// Findet Issue-Page-Paare die gemeinsame Keywords haben
// ===================================================================

interface ContradictionCandidate {
  jiraKey: string;
  jiraText: string;
  pageId: string;
  pageTitle: string;
  confluenceText: string;
  sharedKeywords: string[];
}

export function findContradictionCandidates(
  issues: JiraIssue[],
  pages: ConfluencePage[],
  pageContents: Map<string, string>
): ContradictionCandidate[] {
  const candidates: ContradictionCandidate[] = [];

  try {
    // ALLE Issues prüfen — auch Done-Tickets beschreiben Änderungen
    // die Confluence-Seiten widersprechen können
    for (const page of pages) {
      const rawContent = pageContents.get(page.id) || '';
      if (!rawContent || rawContent.length < 50) continue;

      const pageText = stripHtml(rawContent).toLowerCase();
      const referencedKeys = extractJiraKeys(rawContent);

      // Auch Seiten OHNE direkte Referenz prüfen (Keyword-Match)
      for (const issue of issues) {
        // Entweder Seite referenziert das Issue, oder starkes Keyword-Matching
        const isReferenced = referencedKeys.includes(issue.key);

        const descRaw = issue.fields.description;
        const descStr = typeof descRaw === 'string' ? descRaw : JSON.stringify(descRaw || '');
        const issueText = [
          issue.fields.summary || '',
          descStr,
        ].join(' ').toLowerCase();

        // Keyword-Matching: mindestens 3 gemeinsame relevante Wörter
        const sharedKeywords = findSharedKeywords(issueText, pageText);
        if (!isReferenced && sharedKeywords.length < 3) continue;
        if (isReferenced && sharedKeywords.length < 2) continue;

        candidates.push({
          jiraKey: issue.key,
          jiraText: [issue.fields.summary, issue.fields.description || ''].join('\n'),
          pageId: page.id,
          pageTitle: page.title,
          confluenceText: stripHtml(rawContent).substring(0, 3000),
          sharedKeywords,
        });
      }
    }
  } catch (err) {
    console.error('[Intelligence] Fehler bei findContradictionCandidates:', err);
  }

  // Nach Anzahl gemeinsamer Keywords sortieren (beste zuerst)
  return candidates.sort((a, b) => b.sharedKeywords.length - a.sharedKeywords.length);
}

// ===================================================================
// Hilfs-Funktion: Gemeinsame relevante Keywords finden
// ===================================================================

const STOP_WORDS = new Set([
  'the', 'is', 'at', 'which', 'on', 'a', 'an', 'and', 'or', 'but',
  'in', 'with', 'to', 'for', 'of', 'not', 'no', 'this', 'that',
  'it', 'be', 'as', 'are', 'was', 'were', 'been', 'has', 'have',
  'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should',
  'may', 'can', 'from', 'by', 'we', 'he', 'she', 'they', 'you',
  'der', 'die', 'das', 'und', 'oder', 'aber', 'ist', 'sind', 'ein',
  'eine', 'des', 'dem', 'den', 'von', 'zu', 'für', 'mit', 'auf',
  'aus', 'nach', 'bei', 'über', 'unter', 'vor', 'zwischen', 'nicht',
  'auch', 'noch', 'nur', 'wie', 'wenn', 'dann', 'kann', 'wird',
]);

function findSharedKeywords(textA: string, textB: string): string[] {
  const wordsA = new Set(
    textA.split(/\s+/).filter(w => w.length > 3 && !STOP_WORDS.has(w))
  );
  const wordsB = new Set(
    textB.split(/\s+/).filter(w => w.length > 3 && !STOP_WORDS.has(w))
  );

  const shared: string[] = [];
  for (const word of wordsA) {
    if (wordsB.has(word)) {
      shared.push(word);
    }
  }

  return shared;
}
