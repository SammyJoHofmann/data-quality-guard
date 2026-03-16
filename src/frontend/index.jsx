// ============================================================
// FILE: index.jsx
// PATH: src/frontend/index.jsx
// PROJECT: DataQualityGuard
// PURPOSE: Main UI entry point for all Forge modules
// ============================================================

import React, { useEffect, useState } from 'react';
import ForgeReconciler, {
  Text, Heading, Box, Inline, Stack, Badge, Button,
  DynamicTable, SectionMessage, Lozenge
} from '@forge/react';
import { invoke, view } from '@forge/bridge';

// === HELPERS ===

function getScoreInfo(score) {
  const s = Number(score) || 0;
  if (s >= 90) return { label: 'Excellent', appearance: 'success' };
  if (s >= 80) return { label: 'Good', appearance: 'success' };
  if (s >= 60) return { label: 'Fair', appearance: 'inprogress' };
  if (s >= 40) return { label: 'Poor', appearance: 'moved' };
  return { label: 'Critical', appearance: 'removed' };
}

function getSeverityAppearance(severity) {
  const sev = String(severity || 'info');
  const map = { critical: 'removed', high: 'moved', medium: 'inprogress', low: 'default', info: 'default' };
  return map[sev] || 'default';
}

// Safe string conversion — NEVER render raw DB values
function safe(val) {
  if (val === null || val === undefined) return '';
  return String(val);
}

function safeNum(val) {
  return Number(val) || 0;
}

// === PROJECT DASHBOARD (Jira Project Page) ===

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
      console.error('Load failed:', err);
      setError(safe(err?.message || 'Failed to load data'));
    }
    setLoading(false);
  }

  async function triggerScan() {
    setScanning(true);
    try {
      await invoke('triggerScan');
      await loadData();
    } catch (err) {
      console.error('Scan failed:', err);
    }
    setScanning(false);
  }

  if (loading) return <Text>{"Loading quality data..."}</Text>;

  if (error) {
    return (
      <Stack space="space.200">
        <Heading size="large">{"Data Quality Guard"}</Heading>
        <SectionMessage appearance="warning">
          <Text>{safe(error)}</Text>
        </SectionMessage>
        <Button appearance="primary" onClick={loadData}>{"Retry"}</Button>
      </Stack>
    );
  }

  if (!data || !data.score) {
    return (
      <Stack space="space.200">
        <Heading size="large">{"Data Quality Guard"}</Heading>
        <SectionMessage appearance="information">
          <Text>{"No quality data yet. Run your first scan to get started."}</Text>
        </SectionMessage>
        <Button appearance="primary" onClick={triggerScan} isLoading={scanning}>
          {"Run First Scan"}
        </Button>
      </Stack>
    );
  }

  const { score, findings, history } = data;
  const prev = history && history[1] && history[1].overall_score != null ? safeNum(history[1].overall_score) : null;
  const current = safeNum(score.overall_score);
  const trendArrow = prev != null ? (current > prev ? ' \u2191' : current < prev ? ' \u2193' : ' \u2192') : '';
  const overallInfo = getScoreInfo(current);
  const totalIssues = safeNum(score.total_issues);
  const findingsCount = safeNum(score.findings_count);

  // Build DynamicTable data for findings
  const findingsHead = {
    cells: [
      { key: 'severity', content: 'Severity' },
      { key: 'item', content: 'Item' },
      { key: 'issue', content: 'Issue' },
    ],
  };

  const findingsRows = (findings || []).slice(0, 15).map((f, i) => ({
    key: safe(i),
    cells: [
      {
        key: 'severity-' + safe(i),
        content: (
          <Lozenge appearance={getSeverityAppearance(f.severity)}>
            {safe(f.severity || 'info')}
          </Lozenge>
        ),
      },
      { key: 'item-' + safe(i), content: safe(f.item_key) },
      { key: 'issue-' + safe(i), content: safe(f.message) },
    ],
  }));

  return (
    <Stack space="space.300">
      <Inline spread="space-between" alignBlock="center">
        <Heading size="large">{"Data Quality Guard"}</Heading>
        <Button appearance="primary" onClick={triggerScan} isLoading={scanning}>{"Rescan Now"}</Button>
      </Inline>

      <Box padding="space.200" backgroundColor="color.background.neutral">
        <Inline space="space.400" alignBlock="center">
          <Stack space="space.050" alignInline="center">
            <Text size="small" weight="bold">{"Overall" + trendArrow}</Text>
            <Heading size="xlarge">{safe(Math.round(current))}</Heading>
            <Lozenge appearance={overallInfo.appearance}>
              {overallInfo.label}
            </Lozenge>
          </Stack>
          <Stack space="space.050" alignInline="center">
            <Text size="small">{"Freshness"}</Text>
            <Text weight="bold">{safe(Math.round(safeNum(score.staleness_score)))}</Text>
          </Stack>
          <Stack space="space.050" alignInline="center">
            <Text size="small">{"Completeness"}</Text>
            <Text weight="bold">{safe(Math.round(safeNum(score.completeness_score)))}</Text>
          </Stack>
          <Stack space="space.050" alignInline="center">
            <Text size="small">{"Consistency"}</Text>
            <Text weight="bold">{safe(Math.round(safeNum(score.consistency_score)))}</Text>
          </Stack>
          <Stack space="space.050" alignInline="center">
            <Text size="small">{"Cross-Refs"}</Text>
            <Text weight="bold">{safe(Math.round(safeNum(score.cross_ref_score)))}</Text>
          </Stack>
        </Inline>
      </Box>

      <Inline space="space.300">
        <Text><Badge appearance="primary">{safe(totalIssues)}</Badge>{" Items scanned"}</Text>
        <Text><Badge appearance={findingsCount > 0 ? 'important' : 'default'}>{safe(findingsCount)}</Badge>{" Findings"}</Text>
      </Inline>

      {findingsRows.length > 0 && (
        <Stack space="space.100">
          <Heading size="medium">{"Top Findings"}</Heading>
          <DynamicTable
            head={findingsHead}
            rows={findingsRows}
            isFixedSize
          />
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

  if (loading) return <Text>{"Checking quality..."}</Text>;
  if (!data || !data.findings || data.findings.length === 0) {
    return <Lozenge appearance="success">{"No issues found"}</Lozenge>;
  }

  const scoreNum = safeNum(data.score);

  return (
    <Stack space="space.100">
      <Text weight="bold">{"Quality: "}<Badge appearance={scoreNum >= 60 ? 'default' : 'important'}>{safe(scoreNum) + "/100"}</Badge></Text>
      {data.findings.map((f, i) => (
        <Box key={safe(i)} padding="space.050">
          <Lozenge appearance={getSeverityAppearance(f.severity)}>{safe(f.severity || 'info')}</Lozenge>
          <Text>{" " + safe(f.message)}</Text>
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

  if (loading) return <Text>{"Loading quality overview..."}</Text>;

  const scores = data?.scores || [];

  if (scores.length === 0) {
    return (
      <Stack space="space.200">
        <Heading size="large">{"Data Quality Guard \u2014 All Projects"}</Heading>
        <SectionMessage appearance="information">
          <Text>{"No quality data yet. Scans run automatically every hour, or trigger one from a Jira project page."}</Text>
        </SectionMessage>
      </Stack>
    );
  }

  const avgScore = Math.round(scores.reduce((sum, r) => sum + safeNum(r.overall_score), 0) / scores.length);

  const tableHead = {
    cells: [
      { key: 'project', content: 'Project' },
      { key: 'score', content: 'Score' },
      { key: 'findings', content: 'Findings' },
    ],
  };

  const tableRows = scores.map((s, i) => {
    const scoreVal = safeNum(s.overall_score);
    const findingsVal = safeNum(s.findings_count);
    const info = getScoreInfo(scoreVal);
    return {
      key: safe(i),
      cells: [
        { key: 'project-' + safe(i), content: safe(s.project_key) },
        {
          key: 'score-' + safe(i),
          content: (
            <Lozenge appearance={info.appearance}>
              {safe(scoreVal) + " \u2014 " + info.label}
            </Lozenge>
          ),
        },
        {
          key: 'findings-' + safe(i),
          content: (
            <Badge appearance={findingsVal > 0 ? 'important' : 'default'}>{safe(findingsVal)}</Badge>
          ),
        },
      ],
    };
  });

  return (
    <Stack space="space.300">
      <Heading size="large">{"Data Quality Guard \u2014 All Projects"}</Heading>
      <Box padding="space.200" backgroundColor="color.background.neutral">
        <Text weight="bold">{"Average Score: "}<Badge>{safe(avgScore) + "/100"}</Badge>{" | Projects: "}<Badge>{safe(scores.length)}</Badge></Text>
      </Box>
      <DynamicTable
        head={tableHead}
        rows={tableRows}
        isFixedSize
      />
    </Stack>
  );
}

// === MAIN: Render based on module context ===

function App() {
  const [context, setContext] = useState(null);

  useEffect(() => {
    view.getContext().then(setContext).catch(console.error);
  }, []);

  if (!context) return <Text>{"Loading..."}</Text>;

  // Determine which component to render based on module key
  const moduleKey = safe(context.moduleKey);

  if (moduleKey.includes('issue-panel')) return <IssuePanel />;
  if (moduleKey.includes('confluence')) return <ConfluenceDashboard />;
  return <ProjectDashboard />;
}

ForgeReconciler.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
