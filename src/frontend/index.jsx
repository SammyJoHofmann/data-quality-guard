// ============================================================
// FILE: index.jsx
// PATH: src/frontend/index.jsx
// PROJECT: DataQualityGuard
// PURPOSE: Frontend UI — Jira Dashboard, Issue Panel, Confluence Overview
// ============================================================

import React, { useEffect, useState } from 'react';
import ForgeReconciler, {
  Text, Heading, Box, Inline, Stack, Badge, Button,
  DynamicTable, SectionMessage, Lozenge, xcss,
  ProgressBar, Link
} from '@forge/react';
import { invoke, view } from '@forge/bridge';

// === SAFE CONVERTERS (alle DB-Werte müssen durch diese Funktionen) ===

function safe(val) {
  if (val === null || val === undefined) return '';
  return String(val);
}

function safeNum(val) {
  return Number(val) || 0;
}

// === GRADING ===

function getGrade(score) {
  const s = safeNum(score);
  if (s >= 90) return { grade: 'A', label: 'Ausgezeichnet', color: 'success' };
  if (s >= 75) return { grade: 'B', label: 'Gut', color: 'success' };
  if (s >= 60) return { grade: 'C', label: 'Befriedigend', color: 'inprogress' };
  if (s >= 40) return { grade: 'D', label: 'Mangelhaft', color: 'moved' };
  return { grade: 'F', label: 'Kritisch', color: 'removed' };
}

function getSevColor(sev) {
  const s = safe(sev);
  if (s === 'critical') return 'removed';
  if (s === 'high') return 'moved';
  if (s === 'medium') return 'inprogress';
  return 'default';
}

function getSevLabel(sev) {
  const s = safe(sev);
  if (s === 'critical') return 'Kritisch';
  if (s === 'high') return 'Hoch';
  if (s === 'medium') return 'Mittel';
  if (s === 'low') return 'Niedrig';
  return 'Info';
}

function getCheckLabel(checkType) {
  const t = safe(checkType);
  if (t.includes('stale') || t.includes('staleness')) return 'Ticket veraltet';
  if (t.includes('no_description') || t.includes('missing_description')) return 'Beschreibung fehlt';
  if (t.includes('no_assignee') || t.includes('unassigned')) return 'Nicht zugewiesen';
  if (t.includes('no_priority')) return 'Keine Priorität gesetzt';
  if (t.includes('completeness')) return 'Unvollständig';
  if (t.includes('consistency') || t.includes('contradiction')) return 'Widerspruch gefunden';
  if (t.includes('cross_ref') || t.includes('broken_link')) return 'Defekter Verweis';
  if (t.includes('duplicate')) return 'Mögliches Duplikat';
  return safe(checkType);
}

function getRecommendation(finding) {
  const t = safe(finding.check_type);
  const m = safe(finding.message);
  const sev = safe(finding.severity);

  // Spezifische Empfehlungen basierend auf check_type UND Kontext
  if (t.includes('stale') || t.includes('staleness')) {
    if (m.includes('Seite') || m.includes('page')) return 'Confluence-Seite prüfen und aktualisieren oder als veraltet markieren';
    if (sev === 'critical') return 'Ticket sofort schließen oder aktualisieren — seit über 90 Tagen unberührt';
    return 'Ticket aktualisieren oder schließen — bei Bedarf neu priorisieren';
  }
  if (t.includes('no_description') || t.includes('missing_description') || t.includes('completeness')) {
    if (m.includes('Done') || m.includes('Fertig')) return 'Nachträglich Beschreibung ergänzen für Nachvollziehbarkeit';
    return 'Beschreibung mit Akzeptanzkriterien und Kontext hinzufügen';
  }
  if (t.includes('no_assignee') || t.includes('unassigned')) {
    if (sev === 'critical' || sev === 'high') return 'Dringend: Verantwortlichen zuweisen — High-Priority ohne Bearbeiter!';
    return 'Verantwortlichen zuweisen damit Aufgabe bearbeitet werden kann';
  }
  if (t.includes('no_priority')) return 'Priorität setzen um Backlog-Planung zu ermöglichen';
  if (t.includes('no_labels') || t.includes('missing_labels')) return 'Labels vergeben für bessere Kategorisierung und Filterung';
  if (t.includes('lost_knowledge') || t.includes('orphan')) return 'Ticket einem aktiven Teammitglied zuweisen — ehemaliger Bearbeiter nicht mehr verfügbar';
  if (t.includes('sprint_readiness') || t.includes('not_ready')) return 'Fehlende Pflichtfelder ergänzen bevor das Ticket in den Sprint kommt';
  if (t.includes('stale_documentation') || t.includes('stale_doc')) return 'Confluence-Seite aktualisieren — referenzierte Tickets sind abgeschlossen';
  if (t.includes('contradiction') || t.includes('consistency')) return 'Widerspruch zwischen Jira und Confluence beheben — Doku aktualisieren';
  if (t.includes('cross_ref') || t.includes('broken_link')) return 'Verlinkung prüfen — Ziel existiert nicht mehr oder hat anderen Status';
  if (t.includes('workflow') || t.includes('regression')) return 'Workflow prüfen — Ticket wurde zurückgestuft, mögliche Nacharbeit';
  if (t.includes('overloaded') || t.includes('bottleneck')) return 'Aufgaben umverteilen — Bearbeiter hat zu viele offene Tickets';
  if (t.includes('spillover')) return 'Sprint-Überlauf klären — Ticket war nicht im Sprint abgeschlossen';
  if (t.includes('due_date') || t.includes('overdue')) return 'Fälligkeitsdatum prüfen und anpassen';
  return 'Problem prüfen und entsprechend beheben';
}

function formatDate(dateStr) {
  const d = safe(dateStr);
  if (!d) return '';
  try {
    const dt = new Date(d);
    if (isNaN(dt.getTime())) return d;
    const day = String(dt.getDate()).padStart(2, '0');
    const month = String(dt.getMonth() + 1).padStart(2, '0');
    const year = dt.getFullYear();
    const hours = String(dt.getHours()).padStart(2, '0');
    const minutes = String(dt.getMinutes()).padStart(2, '0');
    return day + '.' + month + '.' + year + ' um ' + hours + ':' + minutes;
  } catch {
    return d;
  }
}

function formatDateShort(dateStr) {
  const d = safe(dateStr);
  if (!d) return '';
  try {
    const dt = new Date(d);
    if (isNaN(dt.getTime())) return d;
    const day = String(dt.getDate()).padStart(2, '0');
    const month = String(dt.getMonth() + 1).padStart(2, '0');
    return day + '.' + month;
  } catch {
    return d;
  }
}

// === STYLES ===

const cardStyle = xcss({
  backgroundColor: 'elevation.surface.raised',
  padding: 'space.200',
  borderRadius: 'border.radius',
});

const scoreCardStyle = xcss({
  backgroundColor: 'elevation.surface.raised',
  padding: 'space.300',
  borderRadius: 'border.radius',
});

const categoryCardStyle = xcss({
  backgroundColor: 'elevation.surface',
  padding: 'space.200',
  borderColor: 'color.border',
  borderWidth: 'border.width',
  borderStyle: 'solid',
  borderRadius: 'border.radius',
});

const historyBadgeStyle = xcss({
  backgroundColor: 'elevation.surface',
  padding: 'space.100',
  borderColor: 'color.border',
  borderWidth: 'border.width',
  borderStyle: 'solid',
  borderRadius: 'border.radius',
});

const sevSummaryStyle = xcss({
  backgroundColor: 'elevation.surface.raised',
  padding: 'space.150',
  borderRadius: 'border.radius',
});

const contradictionCardStyle = xcss({
  backgroundColor: 'elevation.surface.raised',
  padding: 'space.200',
  borderRadius: 'border.radius',
  borderColor: 'color.border.danger',
  borderWidth: 'border.width',
  borderStyle: 'solid',
});

// === CATEGORY CARD ===

function CategoryCard({ name, score, description }) {
  const s = safeNum(score);
  const progressValue = s / 100;
  const grade = getGrade(s);

  return (
    <Box xcss={categoryCardStyle}>
      <Stack space="space.100">
        <Text weight="bold">{safe(name)}</Text>
        <Inline space="space.100" alignBlock="center">
          <Text size="large" weight="bold">{safe(s)}</Text>
          <Lozenge appearance={grade.color}>{safe(grade.grade)}</Lozenge>
        </Inline>
        <ProgressBar ariaLabel={safe(name) + ': ' + safe(s) + ' von 100'} value={progressValue} />
        <Text size="small" color="color.text.subtlest">{safe(description)}</Text>
      </Stack>
    </Box>
  );
}

// === WIDERSPRÜCHE-SEKTION ===

function ContradictionsSection({ contradictions, aiStatus }) {
  const safeContradictions = (contradictions || []);
  const safeAiStatus = aiStatus || { enabled: false, configured: false };

  // Keine Widersprüche und KI aktiv → nichts anzeigen
  if (safeContradictions.length === 0 && safeAiStatus.configured) {
    return null;
  }

  // Keine Widersprüche, kein API-Key → Hinweis
  if (safeContradictions.length === 0 && !safeAiStatus.configured) {
    return (
      <SectionMessage appearance="information">
        <Text>{"Für tiefere Widerspruchsanalyse einen Claude API-Key in den Einstellungen hinterlegen."}</Text>
      </SectionMessage>
    );
  }

  // Widersprüche vorhanden → Rote Karten
  return (
    <Stack space="space.150">
      <Heading size="medium">{"Widersprüche (" + safe(safeContradictions.length) + ")"}</Heading>
      {safeContradictions.map((c, i) => (
        <Box key={'contradiction-' + safe(i)} xcss={contradictionCardStyle}>
          <Stack space="space.100">
            <Inline space="space.100" alignBlock="center">
              <Lozenge appearance="removed" isBold>{"Widerspruch"}</Lozenge>
              <Text weight="bold">{safe(c.source_key) + " \u2194 " + safe(c.target_key)}</Text>
              {safeNum(c.confidence) > 0 ? (
                <Lozenge appearance="default">{safe(Math.round(safeNum(c.confidence) * 100)) + "% Konfidenz"}</Lozenge>
              ) : null}
            </Inline>
            <Text>{safe(c.description)}</Text>
            {safe(c.page_title) ? (
              <Text size="small" color="color.text.subtlest">{"Seite: " + safe(c.page_title)}</Text>
            ) : null}
            {safe(c.recommendation) ? (
              <Text size="small" color="color.text.accent.blue">{"Empfehlung: " + safe(c.recommendation)}</Text>
            ) : null}
          </Stack>
        </Box>
      ))}
    </Stack>
  );
}

// === MAIN DASHBOARD (Jira Project Page) ===

function ProjectDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      setData(await invoke('getProjectScore'));
    } catch (e) {
      setError(safe(e?.message || 'Fehler beim Laden der Daten'));
    }
    setLoading(false);
  }

  async function triggerScan() {
    setScanning(true);
    setError(null);
    try {
      await invoke('triggerScan');
      await loadData();
    } catch (e) {
      setError('Scan fehlgeschlagen: ' + safe(e?.message || 'Unbekannter Fehler'));
    }
    setScanning(false);
  }

  // --- Loading ---
  if (loading) {
    return (
      <Stack space="space.200">
        <Heading size="large">{"Data Quality Guard"}</Heading>
        <ProgressBar ariaLabel="Daten werden geladen" isIndeterminate />
        <Text>{"Daten werden geladen..."}</Text>
      </Stack>
    );
  }

  // --- Error ---
  if (error) {
    return (
      <Stack space="space.200">
        <Heading size="large">{"Data Quality Guard"}</Heading>
        <SectionMessage appearance="warning">
          <Text>{safe(error)}</Text>
        </SectionMessage>
        <Button appearance="primary" onClick={loadData}>{"Nochmal versuchen"}</Button>
      </Stack>
    );
  }

  // --- Empty State (kein Score vorhanden) ---
  if (!data || !data.score) {
    return (
      <Stack space="space.300">
        <Heading size="large">{"Data Quality Guard"}</Heading>
        <Box xcss={cardStyle}>
          <Stack space="space.200">
            <Heading size="medium">{"Was macht diese App?"}</Heading>
            <Text>{"Data Quality Guard analysiert automatisch alle Jira-Tickets in diesem Projekt und bewertet die Datenqualität anhand von vier Kategorien:"}</Text>
            <Stack space="space.100">
              <Text>{"\u2022 Aktualität: Sind die Tickets noch aktuell oder seit Wochen nicht bearbeitet?"}</Text>
              <Text>{"\u2022 Vollständigkeit: Haben alle Tickets eine Beschreibung, einen Verantwortlichen und eine Priorität?"}</Text>
              <Text>{"\u2022 Konsistenz: Widersprechen sich Informationen zwischen Jira und Confluence?"}</Text>
              <Text>{"\u2022 Querverweise: Funktionieren alle Verlinkungen zwischen Tickets und Seiten?"}</Text>
            </Stack>
            <Text>{"Am Ende bekommt das Projekt eine Gesamtnote von 0 bis 100 Punkten."}</Text>
          </Stack>
        </Box>
        <Button appearance="primary" onClick={triggerScan} isLoading={scanning}>
          {scanning ? "Wird gescannt..." : "Ersten Scan starten"}
        </Button>
      </Stack>
    );
  }

  // --- Data present ---
  const { score, findings, history } = data;
  const overall = Math.round(safeNum(score.overall_score));
  const fresh = Math.round(safeNum(score.staleness_score));
  const complete = Math.round(safeNum(score.completeness_score));
  const consist = Math.round(safeNum(score.consistency_score));
  const crossRef = Math.round(safeNum(score.cross_ref_score));
  const items = safeNum(score.total_issues);
  const findCount = safeNum(score.findings_count);
  const calculatedAt = safe(score.calculated_at);
  const grade = getGrade(overall);

  // Trend from history
  const safeHistory = (history || []).map(h => ({
    overall_score: safeNum(h.overall_score),
    calculated_at: safe(h.calculated_at),
    findings_count: safeNum(h.findings_count),
  }));
  const prevScore = safeHistory.length > 1 ? Math.round(safeHistory[1].overall_score) : null;
  let trendArrow = '';
  let trendText = '';
  if (prevScore !== null) {
    const diff = overall - prevScore;
    if (diff > 0) {
      trendArrow = '\u2191';
      trendText = '+' + safe(diff) + ' seit letztem Scan';
    } else if (diff < 0) {
      trendArrow = '\u2193';
      trendText = safe(diff) + ' seit letztem Scan';
    } else {
      trendArrow = '\u2192';
      trendText = 'Unverändert seit letztem Scan';
    }
  }

  // Severity counts
  const safeFindings = (findings || []);
  const sevCounts = { critical: 0, high: 0, medium: 0, low: 0 };
  safeFindings.forEach(f => {
    const sev = safe(f.severity);
    if (sev === 'critical') sevCounts.critical++;
    else if (sev === 'high') sevCounts.high++;
    else if (sev === 'medium') sevCounts.medium++;
    else sevCounts.low++;
  });

  // Findings table
  const findingsHead = {
    cells: [
      { key: 'sev', content: 'Schwere' },
      { key: 'ticket', content: 'Ticket' },
      { key: 'problem', content: 'Problem' },
      { key: 'rec', content: 'Empfehlung' },
    ],
  };

  const findingsRows = safeFindings.slice(0, 25).map((f, i) => ({
    key: 'finding-' + safe(i),
    cells: [
      {
        key: 'sev-' + safe(i),
        content: (
          <Lozenge appearance={getSevColor(f.severity)} isBold>
            {getSevLabel(f.severity)}
          </Lozenge>
        ),
      },
      {
        key: 'ticket-' + safe(i),
        content: (
          <Text>
            <Link href={'/browse/' + safe(f.item_key)}>{safe(f.item_key)}</Link>
          </Text>
        ),
      },
      {
        key: 'problem-' + safe(i),
        content: <Text>{safe(f.message) || getCheckLabel(f.check_type)}</Text>,
      },
      {
        key: 'rec-' + safe(i),
        content: <Text size="small">{getRecommendation(f)}</Text>,
      },
    ],
  }));

  return (
    <Stack space="space.300">
      {/* 1. HEADER */}
      <Inline spread="space-between" alignBlock="center">
        <Heading size="large">{"Data Quality Guard"}</Heading>
        <Button appearance="primary" onClick={triggerScan} isLoading={scanning}>
          {scanning ? "Scannt..." : "Erneut scannen"}
        </Button>
      </Inline>

      {/* 2. GESAMT-SCORE CARD */}
      <Box xcss={scoreCardStyle}>
        <Inline space="space.300" alignBlock="center">
          <Stack space="space.050" alignInline="center">
            <Heading size="xxlarge">{safe(overall)}</Heading>
            <Lozenge appearance={grade.color} isBold>
              {"Note " + safe(grade.grade) + " \u2014 " + safe(grade.label)}
            </Lozenge>
          </Stack>
          <Stack space="space.100">
            <Text>{safe(items) + " Tickets gescannt, " + safe(findCount) + " Probleme gefunden"}</Text>
            {trendArrow ? (
              <Inline space="space.050" alignBlock="center">
                <Text weight="bold" size="large">{safe(trendArrow)}</Text>
                <Text size="small">{safe(trendText)}</Text>
              </Inline>
            ) : null}
          </Stack>
        </Inline>
      </Box>

      {/* 3. VIER KATEGORIE-KARTEN */}
      <Inline space="space.100">
        <CategoryCard
          name="Aktualität"
          score={fresh}
          description="Sind Tickets aktuell oder seit Wochen unberührt?"
        />
        <CategoryCard
          name="Vollständigkeit"
          score={complete}
          description="Haben alle Tickets Beschreibung, Verantwortlichen und Priorität?"
        />
        <CategoryCard
          name="Konsistenz"
          score={consist}
          description="Widersprechen sich Informationen zwischen Jira und Confluence?"
        />
        <CategoryCard
          name="Querverweise"
          score={crossRef}
          description="Funktionieren alle Verlinkungen zwischen Tickets und Seiten?"
        />
      </Inline>

      {/* 4. TREND-VERLAUF */}
      {safeHistory.length > 1 ? (
        <Stack space="space.150">
          <Heading size="medium">{"Trend-Verlauf"}</Heading>
          <Inline space="space.100">
            {safeHistory.slice(0, 14).reverse().map((h, i) => {
              const hScore = Math.round(safeNum(h.overall_score));
              const hGrade = getGrade(hScore);
              return (
                <Box key={'hist-' + safe(i)} xcss={historyBadgeStyle}>
                  <Stack space="space.025" alignInline="center">
                    <Lozenge appearance={hGrade.color}>{safe(hScore)}</Lozenge>
                    <Text size="small">{formatDateShort(h.calculated_at)}</Text>
                  </Stack>
                </Box>
              );
            })}
          </Inline>
        </Stack>
      ) : null}

      {/* 5. FINDINGS-TABELLE */}
      {findingsRows.length > 0 ? (
        <Stack space="space.150">
          <Heading size="medium">{"Gefundene Probleme (" + safe(findCount) + ")"}</Heading>
          <DynamicTable head={findingsHead} rows={findingsRows} rowsPerPage={10} />
        </Stack>
      ) : (
        <SectionMessage appearance="confirmation">
          <Text weight="bold">{"Alles in Ordnung! Keine Probleme gefunden."}</Text>
        </SectionMessage>
      )}

      {/* 6. SEVERITY-ZUSAMMENFASSUNG */}
      {findCount > 0 ? (
        <Box xcss={sevSummaryStyle}>
          <Inline space="space.200" alignBlock="center">
            {sevCounts.critical > 0 ? (
              <Lozenge appearance="removed" isBold>{safe(sevCounts.critical) + " Kritisch"}</Lozenge>
            ) : null}
            {sevCounts.high > 0 ? (
              <Lozenge appearance="moved" isBold>{safe(sevCounts.high) + " Hoch"}</Lozenge>
            ) : null}
            {sevCounts.medium > 0 ? (
              <Lozenge appearance="inprogress">{safe(sevCounts.medium) + " Mittel"}</Lozenge>
            ) : null}
            {sevCounts.low > 0 ? (
              <Lozenge appearance="default">{safe(sevCounts.low) + " Niedrig"}</Lozenge>
            ) : null}
          </Inline>
        </Box>
      ) : null}

      {/* 7. WIDERSPRÜCHE */}
      <ContradictionsSection
        contradictions={data.contradictions || []}
        aiStatus={data.aiStatus || { enabled: false, configured: false }}
      />

      {/* 8. SCAN-INFO */}
      <Box xcss={cardStyle}>
        <Inline space="space.200">
          <Text size="small" color="color.text.subtlest">
            {"Letzter Scan: " + (calculatedAt ? formatDate(calculatedAt) : "Unbekannt")}
          </Text>
          <Text size="small" color="color.text.subtlest">
            {safe(items) + " Tickets gescannt"}
          </Text>
        </Inline>
      </Box>

      {/* 9. KI-STATUS-HINWEIS */}
      <Box xcss={cardStyle}>
        <Inline space="space.200" alignBlock="center">
          <Text size="small" color="color.text.subtlest">
            {data.aiStatus?.configured
              ? "KI-Analyse aktiv — Widersprüche werden automatisch erkannt"
              : "Tipp: Claude API-Key in den Einstellungen hinterlegen für KI-Widerspruchserkennung"}
          </Text>
        </Inline>
      </Box>
    </Stack>
  );
}

// === ISSUE PANEL (kompakt) ===

function IssuePanel() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    invoke('getIssueQuality')
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <Stack space="space.100">
        <ProgressBar ariaLabel="Wird geladen" isIndeterminate />
        <Text size="small">{"Wird geprüft..."}</Text>
      </Stack>
    );
  }

  if (!data || !data.findings || data.findings.length === 0) {
    return (
      <Lozenge appearance="success" isBold>{"Keine Probleme gefunden"}</Lozenge>
    );
  }

  const issueScore = safeNum(data.score);
  const issueGrade = getGrade(issueScore);

  return (
    <Stack space="space.100">
      <Inline space="space.100" alignBlock="center">
        <Lozenge appearance={issueGrade.color} isBold>
          {safe(Math.round(issueScore)) + "/100"}
        </Lozenge>
        <Text size="small">{safe(data.findings.length) + " Probleme"}</Text>
      </Inline>
      {data.findings.slice(0, 3).map((f, i) => (
        <Inline key={'issue-finding-' + safe(i)} space="space.100" alignBlock="center">
          <Lozenge appearance={getSevColor(f.severity)}>
            {getSevLabel(f.severity)}
          </Lozenge>
          <Text size="small">{safe(f.message) || getCheckLabel(f.check_type)}</Text>
        </Inline>
      ))}
      {data.findings.length > 3 ? (
        <Text size="small" color="color.text.subtlest">
          {"+" + safe(data.findings.length - 3) + " weitere Probleme"}
        </Text>
      ) : null}
    </Stack>
  );
}

// === CONFLUENCE DASHBOARD ===

function ConfluenceDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    invoke('getDashboardData')
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <Stack space="space.200">
        <Heading size="large">{"Data Quality Guard"}</Heading>
        <ProgressBar ariaLabel="Lade Übersicht" isIndeterminate />
        <Text>{"Lade Übersicht..."}</Text>
      </Stack>
    );
  }

  const scores = data?.scores || [];

  if (scores.length === 0) {
    return (
      <Stack space="space.200">
        <Heading size="large">{"Data Quality Guard \u2014 Alle Projekte"}</Heading>
        <SectionMessage appearance="information">
          <Text>{"Noch keine Daten vorhanden. Scans laufen automatisch jede Stunde. Du kannst auch in einem Jira-Projekt manuell einen Scan starten."}</Text>
        </SectionMessage>
      </Stack>
    );
  }

  const avg = Math.round(
    scores.reduce((sum, r) => sum + safeNum(r.overall_score), 0) / scores.length
  );
  const avgGrade = getGrade(avg);
  const totalFindings = scores.reduce((sum, r) => sum + safeNum(r.findings_count), 0);

  const tableHead = {
    cells: [
      { key: 'project', content: 'Projekt' },
      { key: 'score', content: 'Gesamtnote' },
      { key: 'fresh', content: 'Aktualität' },
      { key: 'complete', content: 'Vollständigkeit' },
      { key: 'consist', content: 'Konsistenz' },
      { key: 'crossref', content: 'Querverweise' },
      { key: 'findings', content: 'Probleme' },
    ],
  };

  const tableRows = scores.map((s, i) => {
    const rowScore = Math.round(safeNum(s.overall_score));
    const rowGrade = getGrade(rowScore);
    return {
      key: 'proj-' + safe(i),
      cells: [
        {
          key: 'project-' + safe(i),
          content: <Text weight="bold">{safe(s.project_key)}</Text>,
        },
        {
          key: 'score-' + safe(i),
          content: (
            <Lozenge appearance={rowGrade.color} isBold>
              {safe(rowScore) + " (" + safe(rowGrade.grade) + ")"}
            </Lozenge>
          ),
        },
        {
          key: 'fresh-' + safe(i),
          content: <Text>{safe(Math.round(safeNum(s.staleness_score)))}</Text>,
        },
        {
          key: 'complete-' + safe(i),
          content: <Text>{safe(Math.round(safeNum(s.completeness_score)))}</Text>,
        },
        {
          key: 'consist-' + safe(i),
          content: <Text>{safe(Math.round(safeNum(s.consistency_score)))}</Text>,
        },
        {
          key: 'crossref-' + safe(i),
          content: <Text>{safe(Math.round(safeNum(s.cross_ref_score)))}</Text>,
        },
        {
          key: 'findings-' + safe(i),
          content: (
            <Badge appearance={safeNum(s.findings_count) > 0 ? 'important' : 'default'}>
              {safe(safeNum(s.findings_count))}
            </Badge>
          ),
        },
      ],
    };
  });

  return (
    <Stack space="space.300">
      {/* Header */}
      <Heading size="large">{"Data Quality Guard \u2014 Alle Projekte"}</Heading>

      {/* Durchschnitt */}
      <Box xcss={scoreCardStyle}>
        <Inline space="space.200" alignBlock="center">
          <Stack space="space.050" alignInline="center">
            <Heading size="xlarge">{safe(avg)}</Heading>
            <Lozenge appearance={avgGrade.color} isBold>
              {"Durchschnitt: " + safe(avgGrade.grade)}
            </Lozenge>
          </Stack>
          <Stack space="space.050">
            <Text>{safe(scores.length) + " Projekte"}</Text>
            <Text size="small">{safe(totalFindings) + " Probleme insgesamt"}</Text>
          </Stack>
        </Inline>
      </Box>

      {/* Tabelle */}
      <DynamicTable head={tableHead} rows={tableRows} rowsPerPage={15} />
    </Stack>
  );
}

// === ROUTER ===

function App() {
  const [ctx, setCtx] = useState(null);

  useEffect(() => {
    view.getContext().then(setCtx).catch(console.error);
  }, []);

  if (!ctx) {
    return (
      <Stack space="space.100">
        <ProgressBar ariaLabel="Laden" isIndeterminate />
        <Text>{"Laden..."}</Text>
      </Stack>
    );
  }

  const mk = safe(ctx.moduleKey);
  if (mk.includes('issue-panel')) return <IssuePanel />;
  if (mk.includes('confluence')) return <ConfluenceDashboard />;
  return <ProjectDashboard />;
}

ForgeReconciler.render(<React.StrictMode><App /></React.StrictMode>);
