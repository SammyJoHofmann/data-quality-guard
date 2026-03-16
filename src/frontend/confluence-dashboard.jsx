// ============================================================
// FILE: confluence-dashboard.jsx
// PATH: src/frontend/confluence-dashboard.jsx
// PROJECT: DataQualityGuard
// PURPOSE: Confluence global page — overview of all project scores
// ============================================================

import React, { useEffect, useState } from 'react';
import ForgeReconciler, { Text, Heading, Stack, Table, Head, Row, Cell, Lozenge, Box, Badge, SectionMessage } from '@forge/react';
import { invoke } from '@forge/bridge';

function getScoreAppearance(score) {
  if (score >= 80) return 'success';
  if (score >= 60) return 'inprogress';
  if (score >= 40) return 'moved';
  return 'removed';
}

function getScoreLabel(score) {
  if (score >= 90) return 'Excellent';
  if (score >= 80) return 'Good';
  if (score >= 60) return 'Fair';
  if (score >= 40) return 'Poor';
  return 'Critical';
}

function App() {
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
          <Text>No quality data available yet. Scans run automatically every hour, or you can trigger one from a Jira project page.</Text>
        </SectionMessage>
      </Stack>
    );
  }

  const avgScore = Math.round(scores.reduce((sum, s) => sum + Number(s.overall_score), 0) / scores.length);
  const criticalCount = scores.filter(s => Number(s.overall_score) < 40).length;
  const totalFindings = scores.reduce((sum, s) => sum + Number(s.findings_count || 0), 0);

  return (
    <Stack space="space.300">
      <Heading size="large">Data Quality Guard — All Projects</Heading>

      {/* Summary */}
      <Box padding="space.200" backgroundColor="color.background.neutral">
        <Stack space="space.100">
          <Text weight="bold">
            Average Score: <Badge appearance={avgScore >= 60 ? 'default' : 'important'}>{avgScore}/100</Badge>
            {' | '}
            Projects: <Badge>{scores.length}</Badge>
            {' | '}
            Total Findings: <Badge appearance={totalFindings > 0 ? 'important' : 'default'}>{totalFindings}</Badge>
            {criticalCount > 0 && (
              <Text> | <Badge appearance="important">{criticalCount}</Badge> Critical Projects</Text>
            )}
          </Text>
        </Stack>
      </Box>

      {/* Projects Table */}
      <Table>
        <Head>
          <Cell><Text weight="bold">Project</Text></Cell>
          <Cell><Text weight="bold">Overall</Text></Cell>
          <Cell><Text weight="bold">Freshness</Text></Cell>
          <Cell><Text weight="bold">Complete</Text></Cell>
          <Cell><Text weight="bold">Consistent</Text></Cell>
          <Cell><Text weight="bold">Cross-Ref</Text></Cell>
          <Cell><Text weight="bold">Findings</Text></Cell>
        </Head>
        {scores.map((s, i) => (
          <Row key={i}>
            <Cell><Text weight="bold">{s.project_key}</Text></Cell>
            <Cell>
              <Lozenge appearance={getScoreAppearance(Number(s.overall_score))}>
                {s.overall_score} — {getScoreLabel(Number(s.overall_score))}
              </Lozenge>
            </Cell>
            <Cell><Text>{s.staleness_score}</Text></Cell>
            <Cell><Text>{s.completeness_score}</Text></Cell>
            <Cell><Text>{s.consistency_score}</Text></Cell>
            <Cell><Text>{s.cross_ref_score}</Text></Cell>
            <Cell>
              <Badge appearance={Number(s.findings_count) > 0 ? 'important' : 'default'}>
                {s.findings_count}
              </Badge>
            </Cell>
          </Row>
        ))}
      </Table>
    </Stack>
  );
}

ForgeReconciler.render(<App />);
