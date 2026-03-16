// ============================================================
// FILE: project-dashboard.jsx
// PATH: src/frontend/project-dashboard.jsx
// PROJECT: DataQualityGuard
// PURPOSE: Jira project page — main quality dashboard
// ============================================================

import React, { useEffect, useState } from 'react';
import ForgeReconciler, { Text, Heading, Box, Inline, Stack, Badge, Button, Table, Head, Row, Cell, SectionMessage, Lozenge, ProgressBar } from '@forge/react';
import { invoke } from '@forge/bridge';

const SCORE_COLORS = {
  excellent: 'green',
  good: 'green',
  fair: 'yellow',
  poor: 'orange',
  critical: 'red',
};

function getScoreInfo(score) {
  if (score >= 90) return { label: 'Excellent', appearance: 'success' };
  if (score >= 80) return { label: 'Good', appearance: 'success' };
  if (score >= 60) return { label: 'Fair', appearance: 'inprogress' };
  if (score >= 40) return { label: 'Poor', appearance: 'moved' };
  return { label: 'Critical', appearance: 'removed' };
}

function getSeverityAppearance(severity) {
  switch (severity) {
    case 'critical': return 'removed';
    case 'high': return 'moved';
    case 'medium': return 'inprogress';
    case 'low': return 'default';
    default: return 'default';
  }
}

function ScoreGauge({ score, label }) {
  const info = getScoreInfo(score);
  return (
    <Box padding="space.200" backgroundColor="color.background.neutral">
      <Stack space="space.100" alignInline="center">
        <Text size="small" weight="bold">{label}</Text>
        <Heading size="xlarge">{score}</Heading>
        <ProgressBar value={score / 100} appearance={info.appearance === 'success' ? 'success' : info.appearance === 'removed' ? 'danger' : 'default'} />
        <Lozenge appearance={info.appearance}>{info.label}</Lozenge>
      </Stack>
    </Box>
  );
}

function App() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const result = await invoke('getProjectScore');
      setData(result);
    } catch (err) {
      console.error('Failed to load:', err);
    }
    setLoading(false);
  }

  async function triggerScan() {
    setScanning(true);
    try {
      await invoke('triggerScan');
      // Reload after a short delay
      setTimeout(loadData, 3000);
    } catch (err) {
      console.error('Scan failed:', err);
    }
    setScanning(false);
  }

  if (loading) {
    return <Text>Loading quality data...</Text>;
  }

  if (!data?.score) {
    return (
      <Stack space="space.200">
        <Heading size="large">Data Quality Guard</Heading>
        <SectionMessage appearance="information">
          <Text>No quality data available yet. Run your first scan to get started.</Text>
        </SectionMessage>
        <Button appearance="primary" onClick={triggerScan} isLoading={scanning}>
          Run First Scan
        </Button>
      </Stack>
    );
  }

  const { score, findings, history } = data;
  const prevScore = history?.[1]?.overall_score;
  const trend = prevScore != null
    ? (score.overall_score > prevScore ? ' ↑' : score.overall_score < prevScore ? ' ↓' : ' →')
    : '';

  return (
    <Stack space="space.300">
      {/* Header */}
      <Inline spread="space-between" alignBlock="center">
        <Heading size="large">Data Quality Guard</Heading>
        <Button appearance="primary" onClick={triggerScan} isLoading={scanning}>
          Rescan Now
        </Button>
      </Inline>

      {/* Score Overview */}
      <Inline space="space.200">
        <ScoreGauge score={score.overall_score} label={`Overall${trend}`} />
        <ScoreGauge score={score.staleness_score} label="Freshness" />
        <ScoreGauge score={score.completeness_score} label="Completeness" />
        <ScoreGauge score={score.consistency_score} label="Consistency" />
        <ScoreGauge score={score.cross_ref_score} label="Cross-Refs" />
      </Inline>

      {/* Stats */}
      <Inline space="space.400">
        <Text><Badge appearance="primary">{score.total_issues}</Badge> Items scanned</Text>
        <Text><Badge appearance={score.findings_count > 0 ? 'important' : 'default'}>{score.findings_count}</Badge> Findings</Text>
      </Inline>

      {/* Findings Table */}
      {findings && findings.length > 0 && (
        <Stack space="space.100">
          <Heading size="medium">Top Findings</Heading>
          <Table>
            <Head>
              <Cell><Text weight="bold">Severity</Text></Cell>
              <Cell><Text weight="bold">Item</Text></Cell>
              <Cell><Text weight="bold">Issue</Text></Cell>
              <Cell><Text weight="bold">Score</Text></Cell>
            </Head>
            {findings.slice(0, 15).map((f, i) => (
              <Row key={i}>
                <Cell>
                  <Lozenge appearance={getSeverityAppearance(f.severity)}>
                    {f.severity}
                  </Lozenge>
                </Cell>
                <Cell><Text>{f.item_key}</Text></Cell>
                <Cell><Text>{f.message}</Text></Cell>
                <Cell><Text>{f.score}/100</Text></Cell>
              </Row>
            ))}
          </Table>
        </Stack>
      )}
    </Stack>
  );
}

ForgeReconciler.render(<App />);
