// ============================================================
// FILE: schema.ts
// PATH: src/db/schema.ts
// PROJECT: DataQualityGuard
// PURPOSE: Forge SQL database schema using migrationRunner
// ============================================================

import { migrationRunner } from '@forge/sql';

const CREATE_SCAN_RESULTS = `
  CREATE TABLE IF NOT EXISTS scan_results (
    id VARCHAR(64) PRIMARY KEY,
    item_type VARCHAR(20) NOT NULL,
    item_key VARCHAR(100) NOT NULL,
    project_key VARCHAR(50) NOT NULL,
    check_type VARCHAR(50) NOT NULL,
    score DECIMAL(5,2) NOT NULL DEFAULT 100.00,
    severity VARCHAR(20) NOT NULL DEFAULT 'info',
    message TEXT,
    details TEXT,
    scanned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_project (project_key),
    INDEX idx_item (item_key),
    INDEX idx_type (check_type),
    INDEX idx_severity (severity)
  )
`;

const CREATE_PROJECT_SCORES = `
  CREATE TABLE IF NOT EXISTS project_scores (
    project_key VARCHAR(50) NOT NULL,
    overall_score DECIMAL(5,2) NOT NULL DEFAULT 100.00,
    staleness_score DECIMAL(5,2) NOT NULL DEFAULT 100.00,
    completeness_score DECIMAL(5,2) NOT NULL DEFAULT 100.00,
    consistency_score DECIMAL(5,2) NOT NULL DEFAULT 100.00,
    cross_ref_score DECIMAL(5,2) NOT NULL DEFAULT 100.00,
    total_issues INT NOT NULL DEFAULT 0,
    findings_count INT NOT NULL DEFAULT 0,
    calculated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (project_key, calculated_at),
    INDEX idx_project_time (project_key, calculated_at)
  )
`;

const CREATE_CONTRADICTIONS = `
  CREATE TABLE IF NOT EXISTS contradictions (
    id VARCHAR(64) PRIMARY KEY,
    source_type VARCHAR(20) NOT NULL,
    source_key VARCHAR(100) NOT NULL,
    target_type VARCHAR(20) NOT NULL,
    target_key VARCHAR(100) NOT NULL,
    contradiction_type VARCHAR(50) NOT NULL,
    confidence DECIMAL(3,2) NOT NULL DEFAULT 0.50,
    description TEXT,
    recommendation TEXT,
    detected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    resolved BOOLEAN DEFAULT FALSE,
    INDEX idx_source (source_key),
    INDEX idx_target (target_key)
  )
`;

const CREATE_SCAN_HISTORY = `
  CREATE TABLE IF NOT EXISTS scan_history (
    scan_id VARCHAR(64) PRIMARY KEY,
    project_key VARCHAR(50) NOT NULL,
    scan_type VARCHAR(30) NOT NULL DEFAULT 'full',
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP NULL,
    items_scanned INT DEFAULT 0,
    findings_count INT DEFAULT 0,
    status VARCHAR(20) DEFAULT 'running',
    INDEX idx_project_scan (project_key, started_at)
  )
`;

const CREATE_APP_CONFIG = `
  CREATE TABLE IF NOT EXISTS app_config (
    config_key VARCHAR(100) PRIMARY KEY,
    config_value TEXT NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )
`;

// Forge SQL requires migrationRunner for DDL operations
const migrations = migrationRunner
  .enqueue('v001_create_scan_results', CREATE_SCAN_RESULTS)
  .enqueue('v002_create_project_scores', CREATE_PROJECT_SCORES)
  .enqueue('v003_create_contradictions', CREATE_CONTRADICTIONS)
  .enqueue('v004_create_scan_history', CREATE_SCAN_HISTORY)
  .enqueue('v005_create_app_config', CREATE_APP_CONFIG)
  .enqueue('v006_add_dismissed_column', `ALTER TABLE scan_results ADD COLUMN dismissed BOOLEAN DEFAULT FALSE`)
  .enqueue('v007_add_ai_enhanced_column', `ALTER TABLE scan_results ADD COLUMN ai_enhanced BOOLEAN DEFAULT FALSE`)
  .enqueue('v008_add_contradiction_page_title', `ALTER TABLE contradictions ADD COLUMN page_title VARCHAR(500) NULL`)
  .enqueue('v009_create_ai_analysis', `
    CREATE TABLE IF NOT EXISTS ai_analysis (
      id VARCHAR(64) PRIMARY KEY,
      project_key VARCHAR(50) NOT NULL,
      item_key VARCHAR(100) NOT NULL,
      analysis_type VARCHAR(50) NOT NULL,
      input_summary TEXT,
      result TEXT NOT NULL,
      confidence DECIMAL(3,2) DEFAULT 0.50,
      model VARCHAR(50),
      source VARCHAR(20),
      tokens_used INT DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_project_ai (project_key),
      INDEX idx_item_ai (item_key)
    )
  `);

let initialized = false;

export async function initializeDatabase(): Promise<void> {
  if (initialized) return;
  console.log('[DB] Running migrations...');
  try {
    const result = await migrations.run();
    console.log('[DB] Migrations complete:', result);
    initialized = true;
  } catch (err: any) {
    // Migrations may already be applied
    if (err?.message?.includes('already been applied')) {
      console.log('[DB] Migrations already applied');
      initialized = true;
    } else {
      console.error('[DB] Migration error:', err);
    }
  }
}
