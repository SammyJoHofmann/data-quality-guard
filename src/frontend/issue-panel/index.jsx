// ============================================================
// FILE: issue-panel.jsx
// PATH: src/frontend/issue-panel.jsx
// PROJECT: DataQualityGuard
// PURPOSE: Jira issue panel — shows quality score per issue
// ============================================================

import React, { useEffect, useState } from 'react';
import ForgeReconciler, { Text, Stack, Lozenge, Box, Badge } from '@forge/react';
import { invoke } from '@forge/bridge';

function getSeverityAppearance(severity) {
  switch (severity) {
    case 'critical': return 'removed';
    case 'high': return 'moved';
    case 'medium': return 'inprogress';
    case 'low': return 'default';
    default: return 'default';
  }
}

function getScoreAppearance(score) {
  if (score >= 80) return 'success';
  if (score >= 60) return 'inprogress';
  if (score >= 40) return 'moved';
  return 'removed';
}

function App() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    invoke('getIssueQuality').then(setData).catch(console.error).finally(() => setLoading(false));
  }, []);

  if (loading) return <Text>Checking quality...</Text>;

  if (!data || data.findings?.length === 0) {
    return (
      <Box padding="space.100">
        <Lozenge appearance="success">No issues found</Lozenge>
      </Box>
    );
  }

  return (
    <Stack space="space.100">
      <Box padding="space.050">
        <Text weight="bold">
          Quality: <Badge appearance={data.score >= 60 ? 'default' : 'important'}>{data.score}/100</Badge>
        </Text>
      </Box>
      {data.findings.map((f, i) => (
        <Box key={i} padding="space.050">
          <Lozenge appearance={getSeverityAppearance(f.severity)}>{f.severity}</Lozenge>
          <Text> {f.message}</Text>
        </Box>
      ))}
    </Stack>
  );
}

ForgeReconciler.render(<App />);
