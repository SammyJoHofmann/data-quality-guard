import React, { useEffect, useState } from 'react';
import ForgeReconciler, {
  Text, Heading, Box, Inline, Stack, Badge, Button,
  DynamicTable, SectionMessage, Lozenge, xcss
} from '@forge/react';
import { invoke, view } from '@forge/bridge';

function safe(val) {
  if (val === null || val === undefined) return '';
  return String(val);
}

function safeNum(val) {
  return Number(val) || 0;
}

function getGrade(score) {
  const s = safeNum(score);
  if (s >= 90) return { grade: 'A', label: 'Sehr gut', color: 'success' };
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

const cardStyle = xcss({ backgroundColor: 'elevation.surface.raised', padding: 'space.200', borderRadius: 'border.radius' });
const statBox = xcss({ backgroundColor: 'elevation.surface', padding: 'space.150', borderColor: 'color.border', borderWidth: 'border.width', borderStyle: 'solid', borderRadius: 'border.radius' });

// === MAIN DASHBOARD ===

function ProjectDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    setLoading(true);
    setError(null);
    try { setData(await invoke('getProjectScore')); }
    catch (e) { setError(safe(e?.message || 'Fehler beim Laden')); }
    setLoading(false);
  }

  async function triggerScan() {
    setScanning(true);
    try { await invoke('triggerScan'); await loadData(); }
    catch (e) { setError('Scan fehlgeschlagen'); }
    setScanning(false);
  }

  if (loading) return <Text>{"Daten werden geladen..."}</Text>;

  if (error) return (
    <Stack space="space.200">
      <Heading size="large">{"Data Quality Guard"}</Heading>
      <SectionMessage appearance="warning"><Text>{safe(error)}</Text></SectionMessage>
      <Button appearance="primary" onClick={loadData}>{"Nochmal versuchen"}</Button>
    </Stack>
  );

  if (!data || !data.score) return (
    <Stack space="space.300">
      <Heading size="large">{"Data Quality Guard"}</Heading>
      <Box xcss={cardStyle}>
        <Stack space="space.200">
          <Text weight="bold">{"Was macht diese App?"}</Text>
          <Text>{"Data Quality Guard scannt automatisch alle Jira-Tickets in diesem Projekt und prueft:"}</Text>
          <Text>{"- Sind Tickets aktuell oder veraltet?"}</Text>
          <Text>{"- Fehlen wichtige Infos wie Beschreibung oder Zustaendiger?"}</Text>
          <Text>{"- Widersprechen sich Jira-Tickets und Confluence-Seiten?"}</Text>
          <Text>{"Am Ende bekommt das Projekt eine Note von 0-100."}</Text>
        </Stack>
      </Box>
      <Button appearance="primary" onClick={triggerScan} isLoading={scanning}>
        {scanning ? "Wird gescannt..." : "Ersten Scan starten"}
      </Button>
    </Stack>
  );

  const { score, findings } = data;
  const overall = Math.round(safeNum(score.overall_score));
  const fresh = Math.round(safeNum(score.staleness_score));
  const complete = Math.round(safeNum(score.completeness_score));
  const consist = Math.round(safeNum(score.consistency_score));
  const crossRef = Math.round(safeNum(score.cross_ref_score));
  const items = safeNum(score.total_issues);
  const findCount = safeNum(score.findings_count);
  const grade = getGrade(overall);

  const findingsHead = { cells: [
    { key: 'sev', content: 'Schwere' },
    { key: 'ticket', content: 'Ticket' },
    { key: 'problem', content: 'Problem' },
  ]};

  const findingsRows = (findings || []).slice(0, 20).map((f, i) => ({
    key: safe(i),
    cells: [
      { key: 's' + i, content: <Lozenge appearance={getSevColor(f.severity)}>{safe(f.severity)}</Lozenge> },
      { key: 't' + i, content: <Text weight="bold">{safe(f.item_key)}</Text> },
      { key: 'p' + i, content: <Text>{safe(f.message)}</Text> },
    ],
  }));

  return (
    <Stack space="space.300">
      {/* HEADER */}
      <Inline spread="space-between" alignBlock="center">
        <Heading size="large">{"Data Quality Guard"}</Heading>
        <Button appearance="primary" onClick={triggerScan} isLoading={scanning}>
          {scanning ? "Scannt..." : "Erneut scannen"}
        </Button>
      </Inline>

      {/* GESAMT-NOTE */}
      <Box xcss={cardStyle}>
        <Stack space="space.150">
          <Inline space="space.200" alignBlock="center">
            <Heading size="xxlarge">{safe(overall)}</Heading>
            <Stack space="space.050">
              <Lozenge appearance={grade.color} isBold>{"Note " + grade.grade + " — " + grade.label}</Lozenge>
              <Text size="small">{safe(items) + " Tickets gescannt, " + safe(findCount) + " Probleme gefunden"}</Text>
            </Stack>
          </Inline>
        </Stack>
      </Box>

      {/* KATEGORIEN */}
      <Inline space="space.100">
        <Box xcss={statBox}>
          <Stack space="space.050" alignInline="center">
            <Text size="small">{"Aktualitaet"}</Text>
            <Text weight="bold" size="large">{safe(fresh)}</Text>
            <Text size="small">{"Sind Tickets aktuell?"}</Text>
          </Stack>
        </Box>
        <Box xcss={statBox}>
          <Stack space="space.050" alignInline="center">
            <Text size="small">{"Vollstaendigkeit"}</Text>
            <Text weight="bold" size="large">{safe(complete)}</Text>
            <Text size="small">{"Fehlen Infos?"}</Text>
          </Stack>
        </Box>
        <Box xcss={statBox}>
          <Stack space="space.050" alignInline="center">
            <Text size="small">{"Konsistenz"}</Text>
            <Text weight="bold" size="large">{safe(consist)}</Text>
            <Text size="small">{"Widerspruche?"}</Text>
          </Stack>
        </Box>
        <Box xcss={statBox}>
          <Stack space="space.050" alignInline="center">
            <Text size="small">{"Querverweise"}</Text>
            <Text weight="bold" size="large">{safe(crossRef)}</Text>
            <Text size="small">{"Tote Links?"}</Text>
          </Stack>
        </Box>
      </Inline>

      {/* FINDINGS */}
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
    </Stack>
  );
}

// === ISSUE PANEL ===

function IssuePanel() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    invoke('getIssueQuality').then(setData).catch(console.error).finally(() => setLoading(false));
  }, []);

  if (loading) return <Text>{"Wird geprueft..."}</Text>;
  if (!data || !data.findings || data.findings.length === 0) {
    return <Lozenge appearance="success" isBold>{"Keine Probleme"}</Lozenge>;
  }

  return (
    <Stack space="space.100">
      <Lozenge appearance={safeNum(data.score) >= 60 ? 'inprogress' : 'removed'} isBold>
        {safe(safeNum(data.score)) + "/100"}
      </Lozenge>
      {data.findings.slice(0, 5).map((f, i) => (
        <Text key={safe(i)}>{safe(f.severity) + ": " + safe(f.message)}</Text>
      ))}
    </Stack>
  );
}

// === CONFLUENCE OVERVIEW ===

function ConfluenceDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    invoke('getDashboardData').then(setData).catch(console.error).finally(() => setLoading(false));
  }, []);

  if (loading) return <Text>{"Lade Uebersicht..."}</Text>;
  const scores = data?.scores || [];
  if (scores.length === 0) return (
    <Stack space="space.200">
      <Heading size="large">{"Data Quality Guard"}</Heading>
      <Text>{"Noch keine Daten. Scans laufen automatisch jede Stunde."}</Text>
    </Stack>
  );

  const avg = Math.round(scores.reduce((s, r) => s + safeNum(r.overall_score), 0) / scores.length);
  const tHead = { cells: [
    { key: 'p', content: 'Projekt' },
    { key: 's', content: 'Note' },
    { key: 'f', content: 'Probleme' },
  ]};
  const tRows = scores.map((s, i) => {
    const g = getGrade(s.overall_score);
    return {
      key: safe(i),
      cells: [
        { key: 'p' + i, content: <Text weight="bold">{safe(s.project_key)}</Text> },
        { key: 's' + i, content: <Lozenge appearance={g.color} isBold>{safe(Math.round(safeNum(s.overall_score))) + " (" + g.grade + ")"}</Lozenge> },
        { key: 'f' + i, content: <Badge appearance={safeNum(s.findings_count) > 0 ? 'important' : 'default'}>{safe(safeNum(s.findings_count))}</Badge> },
      ],
    };
  });

  return (
    <Stack space="space.300">
      <Heading size="large">{"Data Quality Guard — Alle Projekte"}</Heading>
      <Box xcss={cardStyle}>
        <Text weight="bold">{"Durchschnitt: " + safe(avg) + "/100 | " + safe(scores.length) + " Projekte"}</Text>
      </Box>
      <DynamicTable head={tHead} rows={tRows} />
    </Stack>
  );
}

// === ROUTER ===

function App() {
  const [ctx, setCtx] = useState(null);
  useEffect(() => { view.getContext().then(setCtx).catch(console.error); }, []);
  if (!ctx) return <Text>{"Laden..."}</Text>;
  const mk = safe(ctx.moduleKey);
  if (mk.includes('issue-panel')) return <IssuePanel />;
  if (mk.includes('confluence')) return <ConfluenceDashboard />;
  return <ProjectDashboard />;
}

ForgeReconciler.render(<React.StrictMode><App /></React.StrictMode>);
