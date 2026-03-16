// ============================================================
// FILE: index.jsx
// PATH: src/frontend/index.jsx
// PROJECT: DataQualityGuard
// PURPOSE: Main UI entry point for all Forge modules
// ============================================================

import React, { useEffect, useState } from 'react';
import ForgeReconciler, {
  Text, Heading, Box, Inline, Stack, Badge, Button,
  Table, Head, Row, Cell, SectionMessage, Lozenge, ProgressBar
} from '@forge/react';
import { invoke, view } from '@forge/bridge';

// === HELPERS ===

function getScoreInfo(score) {
  if (score >= 90) return { label: 'Excellent', appearance: 'success' };
  if (score >= 80) return { label: 'Good', appearance: 'success' };
  if (score >= 60) return { label: 'Fair', appearance: 'inprogress' };
  if (score >= 40) return { label: 'Poor', appearance: 'moved' };
  return { label: 'Critical', appearance: 'removed' };
}

function getSeverityAppearance(severity) {
  const map = { critical: 'removed', high: 'moved', medium: 'inprogress', low: 'default' };
  return map[severity] || 'default';
}

// === PROJECT DASHBOARD (Jira Project Page) ===

function ProjectDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    setLoading(true);
    try {
      const result = await invoke('getProjectScore');
      setData(result);
    } catch (err) {
      console.error('Load failed:', err);
    }
    setLoading(false);
  }

  async function triggerScan() {
    setScanning(true);
    try {
      const result = await invoke('triggerScan');
      console.log('Scan result:', result);
      await loadData();
    } catch (err) {
      console.error('Scan failed:', err);
    }
    setScanning(false);
  }

  if (loading) return <Text>Loading quality data...</Text>;

  if (!data?.score) {
    return (
      <Stack space="space.200">
        <Heading size="large">Data Quality Guard</Heading>
        <SectionMessage appearance="information">
          <Text>No quality data yet. Run your first scan to get started.</Text>
        </SectionMessage>
        <Button appearance="primary" onClick={triggerScan} isLoading={scanning}>
          Run First Scan
        </Button>
      </Stack>
    );
  }

  const { score, findings, history } = data;
  const prev = history?.[1]?.overall_score;
  const trend = prev != null ? (score.overall_score > prev ? ' ↑' : score.overall_score < prev ? ' ↓' : ' →') : '';

  return (
    <Stack space="space.300">
      <Inline spread="space-between" alignBlock="center">
        <Heading size="large">Data Quality Guard</Heading>
        <Button appearance="primary" onClick={triggerScan} isLoading={scanning}>Rescan Now</Button>
      </Inline>

      <Box padding="space.200" backgroundColor="color.background.neutral">
        <Inline space="space.400" alignBlock="center">
          <Stack space="space.050" alignInline="center">
            <Text size="small" weight="bold">Overall{trend}</Text>
            <Heading size="xlarge">{score.overall_score}</Heading>
            <Lozenge appearance={getScoreInfo(score.overall_score).appearance}>
              {getScoreInfo(score.overall_score).label}
            </Lozenge>
          </Stack>
          <Stack space="space.050" alignInline="center">
            <Text size="small">Freshness</Text>
            <Text weight="bold">{score.staleness_score}</Text>
          </Stack>
          <Stack space="space.050" alignInline="center">
            <Text size="small">Completeness</Text>
            <Text weight="bold">{score.completeness_score}</Text>
          </Stack>
          <Stack space="space.050" alignInline="center">
            <Text size="small">Consistency</Text>
            <Text weight="bold">{score.consistency_score}</Text>
          </Stack>
          <Stack space="space.050" alignInline="center">
            <Text size="small">Cross-Refs</Text>
            <Text weight="bold">{score.cross_ref_score}</Text>
          </Stack>
        </Inline>
      </Box>

      <Inline space="space.300">
        <Text><Badge appearance="primary">{score.total_issues}</Badge> Items scanned</Text>
        <Text><Badge appearance={score.findings_count > 0 ? 'important' : 'default'}>{score.findings_count}</Badge> Findings</Text>
      </Inline>

      {findings?.length > 0 && (
        <Stack space="space.100">
          <Heading size="medium">Top Findings</Heading>
          <Table>
            <Head>
              <Cell><Text weight="bold">Severity</Text></Cell>
              <Cell><Text weight="bold">Item</Text></Cell>
              <Cell><Text weight="bold">Issue</Text></Cell>
            </Head>
            {findings.slice(0, 15).map((f, i) => (
              <Row key={i}>
                <Cell><Lozenge appearance={getSeverityAppearance(f.severity)}>{f.severity}</Lozenge></Cell>
                <Cell><Text>{f.item_key}</Text></Cell>
                <Cell><Text>{f.message}</Text></Cell>
              </Row>
            ))}
          </Table>
        </Stack>
      )}
    </Stack>
  );
}

// === ISSUE PANEL (Jira Issue) ===

function IssuePanel() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    invoke('getIssueQuality').then(setData).catch(console.error).finally(() => setLoading(false));
  }, []);

  if (loading) return <Text>Checking quality...</Text>;
  if (!data || data.findings?.length === 0) {
    return <Lozenge appearance="success">No issues found</Lozenge>;
  }

  return (
    <Stack space="space.100">
      <Text weight="bold">Quality: <Badge appearance={data.score >= 60 ? 'default' : 'important'}>{data.score}/100</Badge></Text>
      {data.findings.map((f, i) => (
        <Box key={i} padding="space.050">
          <Lozenge appearance={getSeverityAppearance(f.severity)}>{f.severity}</Lozenge>
          <Text> {f.message}</Text>
        </Box>
      ))}
    </Stack>
  );
}

// === CONFLUENCE DASHBOARD (Global Page) ===

function ConfluenceDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    invoke('getDashboardData').then(setData).catch(console.error).finally(() => setLoading(false));
  }, []);

  if (loading) return <Text>Loading quality overview...</Text>;

  const scores = data?.scores || [];

  if (scores.length === 0) {
    return (
      <Stack space="space.200">
        <Heading size="large">Data Quality Guard — All Projects</Heading>
        <SectionMessage appearance="information">
          <Text>No quality data yet. Scans run automatically every hour, or trigger one from a Jira project page.</Text>
        </SectionMessage>
      </Stack>
    );
  }

  const avgScore = Math.round(scores.reduce((s, r) => s + Number(r.overall_score), 0) / scores.length);

  return (
    <Stack space="space.300">
      <Heading size="large">Data Quality Guard — All Projects</Heading>
      <Box padding="space.200" backgroundColor="color.background.neutral">
        <Text weight="bold">Average Score: <Badge>{avgScore}/100</Badge> | Projects: <Badge>{scores.length}</Badge></Text>
      </Box>
      <Table>
        <Head>
          <Cell><Text weight="bold">Project</Text></Cell>
          <Cell><Text weight="bold">Score</Text></Cell>
          <Cell><Text weight="bold">Findings</Text></Cell>
        </Head>
        {scores.map((s, i) => (
          <Row key={i}>
            <Cell><Text weight="bold">{s.project_key}</Text></Cell>
            <Cell><Lozenge appearance={getScoreInfo(Number(s.overall_score)).appearance}>{s.overall_score} — {getScoreInfo(Number(s.overall_score)).label}</Lozenge></Cell>
            <Cell><Badge appearance={Number(s.findings_count) > 0 ? 'important' : 'default'}>{s.findings_count}</Badge></Cell>
          </Row>
        ))}
      </Table>
    </Stack>
  );
}

// === MAIN: Render based on module context ===

function App() {
  const [context, setContext] = useState(null);

  useEffect(() => {
    view.getContext().then(setContext).catch(console.error);
  }, []);

  if (!context) return <Text>Loading...</Text>;

  // Determine which component to render based on module key
  const moduleKey = context.moduleKey || '';

  if (moduleKey.includes('issue-panel')) return <IssuePanel />;
  if (moduleKey.includes('confluence')) return <ConfluenceDashboard />;
  return <ProjectDashboard />;
}

ForgeReconciler.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
