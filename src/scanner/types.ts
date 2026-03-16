// ============================================================
// FILE: types.ts
// PATH: src/scanner/types.ts
// PROJECT: DataQualityGuard
// PURPOSE: Type definitions for scanner and analyzer modules
// ============================================================

export interface JiraIssue {
  key: string;
  id: string;
  fields: {
    summary: string;
    description: string | null;
    status: { name: string; statusCategory: { key: string } };
    assignee: { displayName: string; accountId: string } | null;
    reporter: { displayName: string; accountId: string } | null;
    created: string;
    updated: string;
    priority: { name: string } | null;
    issuetype: { name: string };
    labels: string[];
    components: { name: string }[];
    resolution: { name: string } | null;
    project: { key: string; name: string };
  };
}

export interface JiraProject {
  key: string;
  name: string;
  id: string;
  projectTypeKey: string;
}

export interface ConfluencePage {
  id: string;
  title: string;
  spaceId: string;
  status: string;
  version: {
    number: number;
    createdAt: string;
    authorId: string;
  };
  body?: {
    storage?: { value: string };
  };
  _links?: {
    webui?: string;
  };
}

export interface ConfluenceSpace {
  id: string;
  key: string;
  name: string;
  type: string;
  status: string;
}

export interface Finding {
  id: string;
  itemType: 'jira_issue' | 'confluence_page';
  itemKey: string;
  projectKey: string;
  checkType: string;
  score: number;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  message: string;
  details?: string;
}

export interface ProjectScore {
  projectKey: string;
  overallScore: number;
  stalenessScore: number;
  completenessScore: number;
  consistencyScore: number;
  crossRefScore: number;
  totalIssues: number;
  findingsCount: number;
}

export interface ScanResult {
  scanId: string;
  projectKey: string;
  issues: JiraIssue[];
  pages: ConfluencePage[];
  findings: Finding[];
  score: ProjectScore;
}

export interface Contradiction {
  id: string;
  sourceType: string;
  sourceKey: string;
  targetType: string;
  targetKey: string;
  contradictionType: string;
  confidence: number;
  description: string;
  recommendation?: string;
}
