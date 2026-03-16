// ============================================================
// FILE: index.jsx
// PATH: src/frontend/index.jsx
// PROJECT: DataQualityGuard
// PURPOSE: Premium UI — Professional Dashboard Design
// ============================================================

import React, { useEffect, useState } from 'react';
import ForgeReconciler, {
  Text, Heading, Box, Inline, Stack, Badge, Button,
  Table, Head, Row, Cell, SectionMessage, Lozenge,
  ProgressBar, Spinner, xcss
} from '@forge/react';
import { invoke, view } from '@forge/bridge';

// === DESIGN TOKENS (Atlassian Design System) ===

const pageStyle = xcss({
  maxWidth: '960px',
});

const heroCardStyle = xcss({
  backgroundColor: 'elevation.surface.raised',
  boxShadow: 'elevation.shadow.raised',
  padding: 'space.300',
  borderRadius: 'border.radius',
});

const scoreCardStyle = xcss({
  backgroundColor: 'elevation.surface',
  padding: 'space.200',
  borderColor: 'color.border',
  borderWidth: 'border.width',
  borderStyle: 'solid',
  borderRadius: 'border.radius',
  minWidth: '120px',
  ':hover': {
    backgroundColor: 'elevation.surface.hovered',
  },
});

const mainScoreStyle = xcss({
  backgroundColor: 'color.background.brand.bold',
  padding: 'space.300',
  borderRadius: 'border.radius',
  minWidth: '140px',
});

const sectionStyle = xcss({
  backgroundColor: 'elevation.surface.raised',
  boxShadow: 'elevation.shadow.raised',
  padding: 'space.250',
  borderRadius: 'border.radius',
});

const statCardStyle = xcss({
  backgroundColor: 'elevation.surface',
  padding: 'space.150',
  borderColor: 'color.border',
  borderWidth: 'border.width',
  borderStyle: 'solid',
  borderRadius: 'border.radius',
  minWidth: '100px',
});

const trendItemStyle = xcss({
  backgroundColor: 'elevation.surface',
  padding: 'space.100',
  borderRadius: 'border.radius',
  borderColor: 'color.border',
  borderWidth: 'border.width',
  borderStyle: 'solid',
  minWidth: '52px',
});

const emptyStateStyle = xcss({
  backgroundColor: 'elevation.surface.raised',
  boxShadow: 'elevation.shadow.raised',
  padding: 'space.400',
  borderRadius: 'border.radius',
});

const confluenceHeroStyle = xcss({
  backgroundColor: 'color.background.discovery.bold',
  padding: 'space.300',
  borderRadius: 'border.radius',
});

// === HELPERS ===

function getScoreInfo(score) {
  if (score >= 90) return { label: 'Excellent', appearance: 'success', emoji: 'A+' };
  if (score >= 80) return { label: 'Good', appearance: 'success', emoji: 'A' };
  if (score >= 60) return { label: 'Fair', appearance: 'inprogress', emoji: 'B' };
  if (score >= 40) return { label: 'Poor', appearance: 'moved', emoji: 'C' };
  if (score >= 20) return { label: 'Bad', appearance: 'removed', emoji: 'D' };
  return { label: 'Critical', appearance: 'removed', emoji: 'F' };
}

function getSeverityAppearance(severity) {
  const map = { critical: 'removed', high: 'moved', medium: 'inprogress', low: 'default', info: 'default' };
  return map[severity] || 'default';
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleString('de-DE', {
    day: '2-digit', month: '2-digit', year: '2-digit',
    hour: '2-digit', minute: '2-digit'
  });
}

// === PREMIUM SCORE CARD ===

function ScoreCard({ label, score }) {
  const info = getScoreInfo(score);
  const rounded = Math.round(score);
  return (
    <Box xcss={scoreCardStyle}>
      <Stack space="space.100" alignInline="center">
        <Text size="small" weight="bold" color="color.text.subtlest">{label}</Text>
        <Heading size="large">{rounded}</Heading>
        <ProgressBar value={rounded / 100} appearance={rounded >= 60 ? 'success' : 'default'} />
        <Lozenge appearance={info.appearance} isBold>{info.label}</Lozenge>
      </Stack>
    </Box>
  );
}

// === MAIN SCORE HERO ===

function MainScoreHero({ score, trend }) {
  const info = getScoreInfo(score);
  const rounded = Math.round(score);
  return (
    <Box xcss={mainScoreStyle}>
      <Stack space="space.100" alignInline="center">
        <Text size="small" weight="bold" color="color.text.inverse">Overall Score{trend}</Text>
        <Text color="color.text.inverse"><Heading size="xxlarge">{rounded}</Heading></Text>
        <Lozenge appearance={info.appearance} isBold>{info.emoji} {info.label}</Lozenge>
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
      setError('Failed to load quality data.');
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
      <Box xcss={emptyStateStyle}>
        <Stack space="space.200" alignInline="center">
          <Spinner size="large" />
          <Text weight="bold">Analyzing project data quality...</Text>
        </Stack>
      </Box>
    );
  }

  if (error) {
    return (
      <Box xcss={pageStyle}>
        <Stack space="space.200">
          <Heading size="large">Data Quality Guard</Heading>
          <SectionMessage appearance="error"><Text>{error}</Text></SectionMessage>
          <Button appearance="primary" onClick={loadData}>Retry</Button>
        </Stack>
      </Box>
    );
  }

  if (!data?.score) {
    return (
      <Box xcss={emptyStateStyle}>
        <Stack space="space.300" alignInline="center">
          <Heading size="large">Data Quality Guard</Heading>
          <Text>Analyze your project's Jira tickets and Confluence pages for data quality issues.</Text>
          <Stack space="space.100" alignInline="center">
            <Text size="small" color="color.text.subtlest">Checks: Freshness | Completeness | Consistency | Cross-References</Text>
          </Stack>
          <Button appearance="primary" onClick={triggerScan} isLoading={scanning}>
            {scanning ? 'Scanning...' : 'Run First Scan'}
          </Button>
        </Stack>
      </Box>
    );
  }

  const { score, findings, history } = data;
  const prev = history?.[1]?.overall_score;
  const trendDiff = prev != null ? Math.round(score.overall_score - prev) : null;
  const trendText = trendDiff != null ? (trendDiff > 0 ? ` (+${trendDiff})` : trendDiff < 0 ? ` (${trendDiff})` : '') : '';

  // Severity counts
  const severityCounts = { critical: 0, high: 0, medium: 0, low: 0 };
  (findings || []).forEach(f => { severityCounts[f.severity] = (severityCounts[f.severity] || 0) + 1; });

  return (
    <Box xcss={pageStyle}>
      <Stack space="space.300">

        {/* HEADER */}
        <Inline spread="space-between" alignBlock="center">
          <Stack space="space.050">
            <Heading size="large">Data Quality Guard</Heading>
            {score.calculated_at && (
              <Text size="small" color="color.text.subtlest">Last scan: {formatDate(score.calculated_at)}</Text>
            )}
          </Stack>
          <Button appearance="primary" onClick={triggerScan} isLoading={scanning}>
            {scanning ? 'Scanning...' : 'Rescan Now'}
          </Button>
        </Inline>

        {/* SCORE CARDS */}
        <Box xcss={heroCardStyle}>
          <Inline space="space.200" alignBlock="stretch">
            <MainScoreHero score={score.overall_score} trend={trendText} />
            <ScoreCard label="Freshness" score={score.staleness_score} />
            <ScoreCard label="Completeness" score={score.completeness_score} />
            <ScoreCard label="Consistency" score={score.consistency_score} />
            <ScoreCard label="Cross-Refs" score={score.cross_ref_score} />
          </Inline>
        </Box>

        {/* STATS BAR */}
        <Inline space="space.200">
          <Box xcss={statCardStyle}>
            <Stack space="space.050" alignInline="center">
              <Text size="small" color="color.text.subtlest">Items Scanned</Text>
              <Text weight="bold" size="large">{score.total_issues}</Text>
            </Stack>
          </Box>
          <Box xcss={statCardStyle}>
            <Stack space="space.050" alignInline="center">
              <Text size="small" color="color.text.subtlest">Total Findings</Text>
              <Text weight="bold" size="large">{score.findings_count}</Text>
            </Stack>
          </Box>
          {severityCounts.critical > 0 && (
            <Box xcss={statCardStyle}>
              <Stack space="space.050" alignInline="center">
                <Text size="small" color="color.text.subtlest">Critical</Text>
                <Badge appearance="removed">{severityCounts.critical}</Badge>
              </Stack>
            </Box>
          )}
          {severityCounts.high > 0 && (
            <Box xcss={statCardStyle}>
              <Stack space="space.050" alignInline="center">
                <Text size="small" color="color.text.subtlest">High</Text>
                <Badge appearance="moved">{severityCounts.high}</Badge>
              </Stack>
            </Box>
          )}
          {severityCounts.medium > 0 && (
            <Box xcss={statCardStyle}>
              <Stack space="space.050" alignInline="center">
                <Text size="small" color="color.text.subtlest">Medium</Text>
                <Badge appearance="inprogress">{severityCounts.medium}</Badge>
              </Stack>
            </Box>
          )}
          {severityCounts.low > 0 && (
            <Box xcss={statCardStyle}>
              <Stack space="space.050" alignInline="center">
                <Text size="small" color="color.text.subtlest">Low</Text>
                <Badge appearance="default">{severityCounts.low}</Badge>
              </Stack>
            </Box>
          )}
        </Inline>

        {/* TREND HISTORY */}
        {history?.length > 1 && (
          <Box xcss={sectionStyle}>
            <Stack space="space.150">
              <Heading size="small">Score Trend</Heading>
              <Inline space="space.100">
                {history.slice(0, 14).reverse().map((h, i) => {
                  const s = Math.round(Number(h.overall_score));
                  const info = getScoreInfo(s);
                  return (
                    <Box key={i} xcss={trendItemStyle}>
                      <Stack space="space.025" alignInline="center">
                        <Text size="small" weight="bold">{s}</Text>
                        <Lozenge appearance={info.appearance}>{info.emoji}</Lozenge>
                        <Text size="small" color="color.text.subtlest">
                          {new Date(h.calculated_at).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })}
                        </Text>
                      </Stack>
                    </Box>
                  );
                })}
              </Inline>
            </Stack>
          </Box>
        )}

        {/* FINDINGS TABLE */}
        {findings?.length > 0 && (
          <Box xcss={sectionStyle}>
            <Stack space="space.150">
              <Inline spread="space-between" alignBlock="center">
                <Heading size="small">Findings ({findings.length})</Heading>
              </Inline>
              <Table>
                <Head>
                  <Cell><Text weight="bold">Severity</Text></Cell>
                  <Cell><Text weight="bold">Category</Text></Cell>
                  <Cell><Text weight="bold">Item</Text></Cell>
                  <Cell><Text weight="bold">Description</Text></Cell>
                </Head>
                {findings.slice(0, 25).map((f, i) => (
                  <Row key={i}>
                    <Cell>
                      <Lozenge appearance={getSeverityAppearance(f.severity)} isBold>
                        {f.severity.toUpperCase()}
                      </Lozenge>
                    </Cell>
                    <Cell>
                      <Lozenge appearance="default">{(f.check_type || '').replace('_', ' ')}</Lozenge>
                    </Cell>
                    <Cell><Text weight="bold">{f.item_key}</Text></Cell>
                    <Cell><Text>{f.message}</Text></Cell>
                  </Row>
                ))}
              </Table>
            </Stack>
          </Box>
        )}

        {findings?.length === 0 && (
          <Box xcss={sectionStyle}>
            <SectionMessage appearance="confirmation">
              <Text weight="bold">All clear! No data quality issues found in this project.</Text>
            </SectionMessage>
          </Box>
        )}
      </Stack>
    </Box>
  );
}

// === ISSUE PANEL (compact for side panel) ===

function IssuePanel() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    invoke('getIssueQuality').then(setData).catch(() => setData(null)).finally(() => setLoading(false));
  }, []);

  if (loading) return <Spinner size="small" />;
  if (!data || !data.findings || data.findings.length === 0) {
    return (
      <Inline space="space.100" alignBlock="center">
        <Lozenge appearance="success" isBold>Pass</Lozenge>
        <Text size="small" color="color.text.subtlest">No quality issues</Text>
      </Inline>
    );
  }

  const info = getScoreInfo(data.score);
  return (
    <Stack space="space.100">
      <Inline space="space.100" alignBlock="center">
        <Lozenge appearance={info.appearance} isBold>{data.score}/100</Lozenge>
        <Text size="small" color="color.text.subtlest">{data.findings.length} issue{data.findings.length > 1 ? 's' : ''}</Text>
      </Inline>
      {data.findings.slice(0, 5).map((f, i) => (
        <Inline key={i} space="space.050" alignBlock="center">
          <Lozenge appearance={getSeverityAppearance(f.severity)}>{f.severity}</Lozenge>
          <Text size="small">{f.message}</Text>
        </Inline>
      ))}
    </Stack>
  );
}

// === CONFLUENCE DASHBOARD (multi-project overview) ===

function ConfluenceDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    invoke('getDashboardData').then(setData).catch(() => setData(null)).finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <Box xcss={emptyStateStyle}>
        <Stack space="space.200" alignInline="center">
          <Spinner size="large" />
          <Text>Loading quality overview...</Text>
        </Stack>
      </Box>
    );
  }

  const scores = data?.scores || [];

  if (scores.length === 0) {
    return (
      <Box xcss={emptyStateStyle}>
        <Stack space="space.300" alignInline="center">
          <Heading size="large">Data Quality Guard</Heading>
          <Text>Organization-wide data quality overview across all Jira projects.</Text>
          <Text size="small" color="color.text.subtlest">Scans run automatically every hour. Trigger manual scans from any Jira project page.</Text>
        </Stack>
      </Box>
    );
  }

  const avgScore = Math.round(scores.reduce((s, r) => s + Number(r.overall_score), 0) / scores.length);
  const criticalCount = scores.filter(s => Number(s.overall_score) < 40).length;
  const totalFindings = scores.reduce((s, r) => s + Number(r.findings_count || 0), 0);
  const avgInfo = getScoreInfo(avgScore);

  return (
    <Stack space="space.300">
      {/* Hero Section */}
      <Box xcss={confluenceHeroStyle}>
        <Inline space="space.400" alignBlock="center">
          <Stack space="space.100" alignInline="center">
            <Text size="small" weight="bold" color="color.text.inverse">Organization Average</Text>
            <Heading size="xxlarge"><Text color="color.text.inverse">{avgScore}</Text></Heading>
            <Lozenge appearance={avgInfo.appearance} isBold>{avgInfo.emoji} {avgInfo.label}</Lozenge>
          </Stack>
          <Stack space="space.100">
            <Inline space="space.200">
              <Box xcss={statCardStyle}>
                <Stack space="space.050" alignInline="center">
                  <Text size="small" color="color.text.subtlest">Projects</Text>
                  <Text weight="bold" size="large">{scores.length}</Text>
                </Stack>
              </Box>
              <Box xcss={statCardStyle}>
                <Stack space="space.050" alignInline="center">
                  <Text size="small" color="color.text.subtlest">Findings</Text>
                  <Text weight="bold" size="large">{totalFindings}</Text>
                </Stack>
              </Box>
              {criticalCount > 0 && (
                <Box xcss={statCardStyle}>
                  <Stack space="space.050" alignInline="center">
                    <Text size="small" color="color.text.subtlest">Critical</Text>
                    <Badge appearance="removed">{criticalCount}</Badge>
                  </Stack>
                </Box>
              )}
            </Inline>
          </Stack>
        </Inline>
      </Box>

      {/* Projects Table */}
      <Box xcss={sectionStyle}>
        <Stack space="space.150">
          <Heading size="small">Projects by Quality Score</Heading>
          <Table>
            <Head>
              <Cell><Text weight="bold">Project</Text></Cell>
              <Cell><Text weight="bold">Score</Text></Cell>
              <Cell><Text weight="bold">Grade</Text></Cell>
              <Cell><Text weight="bold">Freshness</Text></Cell>
              <Cell><Text weight="bold">Completeness</Text></Cell>
              <Cell><Text weight="bold">Consistency</Text></Cell>
              <Cell><Text weight="bold">Findings</Text></Cell>
            </Head>
            {scores.map((s, i) => {
              const sc = Number(s.overall_score);
              const info = getScoreInfo(sc);
              return (
                <Row key={i}>
                  <Cell><Text weight="bold">{s.project_key}</Text></Cell>
                  <Cell><Text weight="bold">{Math.round(sc)}</Text></Cell>
                  <Cell><Lozenge appearance={info.appearance} isBold>{info.emoji} {info.label}</Lozenge></Cell>
                  <Cell><Text>{Math.round(Number(s.staleness_score))}</Text></Cell>
                  <Cell><Text>{Math.round(Number(s.completeness_score))}</Text></Cell>
                  <Cell><Text>{Math.round(Number(s.consistency_score))}</Text></Cell>
                  <Cell><Badge appearance={Number(s.findings_count) > 0 ? 'important' : 'default'}>{s.findings_count}</Badge></Cell>
                </Row>
              );
            })}
          </Table>
        </Stack>
      </Box>
    </Stack>
  );
}

// === ERROR BOUNDARY ===

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary]', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <SectionMessage appearance="error">
          <Text>Something went wrong. Please refresh the page.</Text>
        </SectionMessage>
      );
    }
    return this.props.children;
  }
}

// === MAIN ROUTER ===

function App() {
  const [context, setContext] = useState(null);

  useEffect(() => {
    view.getContext().then(setContext).catch(() => setContext({ moduleKey: 'project' }));
  }, []);

  if (!context) {
    return (
      <Stack space="space.200" alignInline="center">
        <Spinner size="large" />
      </Stack>
    );
  }

  const moduleKey = context.moduleKey || '';
  if (moduleKey.includes('issue-panel')) return <IssuePanel />;
  if (moduleKey.includes('confluence')) return <ConfluenceDashboard />;
  return <ProjectDashboard />;
}

ForgeReconciler.render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
