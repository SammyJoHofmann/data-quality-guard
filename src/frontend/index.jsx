// ============================================================
// FILE: index.jsx
// PATH: src/frontend/index.jsx
// PROJECT: DataQualityGuard
// PURPOSE: Main UI — Dashboard, Issue Panel, Confluence Overview
// ============================================================

import React, { useEffect, useState } from 'react';
import ForgeReconciler, {
  Text, Heading, Box, Inline, Stack, Badge, Button,
  Table, Head, Row, Cell, SectionMessage, Lozenge,
  ProgressBar, Spinner
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
  const map = { critical: 'removed', high: 'moved', medium: 'inprogress', low: 'default', info: 'default' };
  return map[severity] || 'default';
}

function getTrendText(current, previous) {
  if (previous == null) return '';
  const diff = Math.round(current - previous);
  if (diff > 0) return ` (+${diff})`;
  if (diff < 0) return ` (${diff})`;
  return ' (=)';
}

// === SCORE CARD ===

function ScoreCard({ label, score, showBar }) {
  const info = getScoreInfo(score);
  return (
    <Box padding="space.150">
      <Stack space="space.050" alignInline="center">
        <Text size="small">{label}</Text>
        <Text weight="bold" size="large">{Math.round(score)}</Text>
        {showBar && <ProgressBar value={score / 100} appearance={score >= 60 ? 'success' : 'default'} />}
        <Lozenge appearance={info.appearance} isBold>{info.label}</Lozenge>
      </Stack>
    </Box>
  );
}

// === PROJECT DASHBOARD ===

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
      const result = await invoke('getProjectScore');
      setData(result);
    } catch (err) {
      setError('Failed to load quality data. Try refreshing the page.');
    }
    setLoading(false);
  }

  async function triggerScan() {
    setScanning(true);
    setError(null);
    try {
      await invoke('triggerScan');
      await loadData();
    } catch (err) {
      setError('Scan failed. Please try again.');
    }
    setScanning(false);
  }

  if (loading) {
    return (
      <Stack space="space.200" alignInline="center">
        <Spinner size="large" />
        <Text>Loading quality data...</Text>
      </Stack>
    );
  }

  if (error) {
    return (
      <Stack space="space.200">
        <Heading size="large">Data Quality Guard</Heading>
        <SectionMessage appearance="error"><Text>{error}</Text></SectionMessage>
        <Button appearance="primary" onClick={loadData}>Retry</Button>
      </Stack>
    );
  }

  if (!data?.score) {
    return (
      <Stack space="space.200">
        <Heading size="large">Data Quality Guard</Heading>
        <SectionMessage appearance="information">
          <Text>No quality data yet. Run your first scan to analyze this project's data quality.</Text>
        </SectionMessage>
        <Button appearance="primary" onClick={triggerScan} isLoading={scanning}>
          {scanning ? 'Scanning...' : 'Run First Scan'}
        </Button>
      </Stack>
    );
  }

  const { score, findings, history } = data;
  const prev = history?.[1]?.overall_score;
  const trend = getTrendText(score.overall_score, prev);

  return (
    <Stack space="space.300">
      <Inline spread="space-between" alignBlock="center">
        <Heading size="large">Data Quality Guard</Heading>
        <Button appearance="primary" onClick={triggerScan} isLoading={scanning}>
          {scanning ? 'Scanning...' : 'Rescan Now'}
        </Button>
      </Inline>

      {/* Score Overview */}
      <Box padding="space.200" backgroundColor="color.background.neutral">
        <Inline space="space.300" alignBlock="center">
          <Stack space="space.050" alignInline="center">
            <Text size="small" weight="bold">Overall{trend}</Text>
            <Heading size="xlarge">{Math.round(score.overall_score)}</Heading>
            <ProgressBar value={score.overall_score / 100} appearance={score.overall_score >= 60 ? 'success' : 'default'} />
            <Lozenge appearance={getScoreInfo(score.overall_score).appearance} isBold>
              {getScoreInfo(score.overall_score).label}
            </Lozenge>
          </Stack>
          <ScoreCard label="Freshness" score={score.staleness_score} showBar />
          <ScoreCard label="Completeness" score={score.completeness_score} showBar />
          <ScoreCard label="Consistency" score={score.consistency_score} showBar />
          <ScoreCard label="Cross-Refs" score={score.cross_ref_score} showBar />
        </Inline>
      </Box>

      {/* Stats */}
      <Inline space="space.300">
        <Text><Badge appearance="primary">{score.total_issues}</Badge> Items scanned</Text>
        <Text><Badge appearance={score.findings_count > 0 ? 'important' : 'default'}>{score.findings_count}</Badge> Findings</Text>
      </Inline>

      {/* Findings Table */}
      {findings?.length > 0 && (
        <Stack space="space.100">
          <Heading size="medium">Top Findings</Heading>
          <Table>
            <Head>
              <Cell><Text weight="bold">Severity</Text></Cell>
              <Cell><Text weight="bold">Item</Text></Cell>
              <Cell><Text weight="bold">Issue</Text></Cell>
            </Head>
            {findings.slice(0, 20).map((f, i) => (
              <Row key={i}>
                <Cell><Lozenge appearance={getSeverityAppearance(f.severity)} isBold>{f.severity.toUpperCase()}</Lozenge></Cell>
                <Cell><Text weight="bold">{f.item_key}</Text></Cell>
                <Cell><Text>{f.message}</Text></Cell>
              </Row>
            ))}
          </Table>
        </Stack>
      )}

      {findings?.length === 0 && (
        <SectionMessage appearance="confirmation">
          <Text>No issues found. Your project data quality is excellent!</Text>
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
    invoke('getIssueQuality').then(setData).catch(() => setData(null)).finally(() => setLoading(false));
  }, []);

  if (loading) return <Spinner size="small" />;
  if (!data || !data.findings || data.findings.length === 0) {
    return <Lozenge appearance="success" isBold>No issues found</Lozenge>;
  }

  return (
    <Stack space="space.100">
      <Text weight="bold">Quality: <Badge appearance={data.score >= 60 ? 'default' : 'important'}>{data.score}/100</Badge></Text>
      {data.findings.map((f, i) => (
        <Inline key={i} space="space.050">
          <Lozenge appearance={getSeverityAppearance(f.severity)}>{f.severity}</Lozenge>
          <Text>{f.message}</Text>
        </Inline>
      ))}
    </Stack>
  );
}

// === CONFLUENCE DASHBOARD ===

function ConfluenceDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    invoke('getDashboardData').then(setData).catch(() => setData(null)).finally(() => setLoading(false));
  }, []);

  if (loading) return <Stack space="space.200" alignInline="center"><Spinner size="large" /><Text>Loading...</Text></Stack>;

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
  const criticalCount = scores.filter(s => Number(s.overall_score) < 40).length;

  return (
    <Stack space="space.300">
      <Heading size="large">Data Quality Guard — All Projects</Heading>
      <Box padding="space.200" backgroundColor="color.background.neutral">
        <Inline space="space.300">
          <Text weight="bold">Avg Score: <Badge appearance={avgScore >= 60 ? 'default' : 'important'}>{avgScore}/100</Badge></Text>
          <Text>Projects: <Badge>{scores.length}</Badge></Text>
          {criticalCount > 0 && <Text><Badge appearance="important">{criticalCount}</Badge> Critical</Text>}
        </Inline>
      </Box>
      <Table>
        <Head>
          <Cell><Text weight="bold">Project</Text></Cell>
          <Cell><Text weight="bold">Score</Text></Cell>
          <Cell><Text weight="bold">Fresh</Text></Cell>
          <Cell><Text weight="bold">Complete</Text></Cell>
          <Cell><Text weight="bold">Findings</Text></Cell>
        </Head>
        {scores.map((s, i) => (
          <Row key={i}>
            <Cell><Text weight="bold">{s.project_key}</Text></Cell>
            <Cell><Lozenge appearance={getScoreInfo(Number(s.overall_score)).appearance} isBold>{s.overall_score}</Lozenge></Cell>
            <Cell><Text>{s.staleness_score}</Text></Cell>
            <Cell><Text>{s.completeness_score}</Text></Cell>
            <Cell><Badge appearance={Number(s.findings_count) > 0 ? 'important' : 'default'}>{s.findings_count}</Badge></Cell>
          </Row>
        ))}
      </Table>
    </Stack>
  );
}

// === MAIN ROUTER ===

function App() {
  const [context, setContext] = useState(null);

  useEffect(() => {
    view.getContext().then(setContext).catch(() => setContext({ moduleKey: 'project' }));
  }, []);

  if (!context) return <Stack space="space.200" alignInline="center"><Spinner size="large" /></Stack>;

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
