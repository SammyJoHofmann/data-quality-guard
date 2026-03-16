// ============================================================
// FILE: schema.ts
// PATH: src/db/schema.ts
// PROJECT: DataQualityGuard
// PURPOSE: Forge SQL database schema definitions
// ============================================================

import sql from '@forge/sql';

export const SCHEMA = {
  scanResults: `
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
  `,

  projectScores: `
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
  `,

  contradictions: `
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
  `,

  scanHistory: `
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
  `,

  config: `
    CREATE TABLE IF NOT EXISTS app_config (
      config_key VARCHAR(100) PRIMARY KEY,
      config_value TEXT NOT NULL,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `
};

export async function initializeDatabase(): Promise<void> {
  console.log('[DB] Initializing database schema...');
  for (const [name, ddl] of Object.entries(SCHEMA)) {
    try {
      await sql.prepare(ddl).execute();
      console.log(`[DB] Table "${name}" ready`);
    } catch (err) {
      console.error(`[DB] Error creating table "${name}":`, err);
    }
  }
  console.log('[DB] Schema initialization complete');
}
