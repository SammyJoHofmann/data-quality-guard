// ============================================================
// FILE: App.jsx
// PATH: static/frontend/src/App.jsx
// PROJECT: DataQualityGuard — Custom UI
// PURPOSE: Premium Dashboard mit eigenem Design
// ============================================================

import React, { useEffect, useState } from 'react';
import { invoke, view, router } from '@forge/bridge';

// === HELPERS ===
const safe = (v) => (v == null ? '' : String(v));
const safeNum = (v) => Number(v) || 0;

function getGrade(score) {
  const s = safeNum(score);
  if (s >= 90) return { grade: 'A', label: 'Ausgezeichnet', cls: 'dq-grade-a' };
  if (s >= 75) return { grade: 'B', label: 'Gut', cls: 'dq-grade-b' };
  if (s >= 60) return { grade: 'C', label: 'Befriedigend', cls: 'dq-grade-c' };
  if (s >= 40) return { grade: 'D', label: 'Mangelhaft', cls: 'dq-grade-d' };
  return { grade: 'F', label: 'Kritisch', cls: 'dq-grade-f' };
}

function getBarColor(score) {
  const s = safeNum(score);
  if (s >= 80) return 'var(--dq-grade-a)';
  if (s >= 60) return 'var(--dq-grade-c)';
  if (s >= 40) return 'var(--dq-grade-d)';
  return 'var(--dq-grade-f)';
}

function getSevLabel(sev) {
  if (sev === 'critical') return 'Kritisch';
  if (sev === 'high') return 'Hoch';
  if (sev === 'medium') return 'Mittel';
  return 'Niedrig';
}

function getSevCls(sev) {
  if (sev === 'critical') return 'dq-sev-critical';
  if (sev === 'high') return 'dq-sev-high';
  if (sev === 'medium') return 'dq-sev-medium';
  return 'dq-sev-low';
}

function getCheckLabel(t) {
  if (!t) return '';
  if (t.includes('stale')) return 'Veraltet';
  if (t.includes('no_description') || t.includes('missing_description') || t.includes('completeness')) return 'Unvollständig';
  if (t.includes('no_assignee') || t.includes('unassigned')) return 'Nicht zugewiesen';
  if (t.includes('no_labels')) return 'Keine Labels';
  if (t.includes('no_priority')) return 'Keine Priorität';
  if (t.includes('consistency') || t.includes('contradiction')) return 'Widerspruch';
  if (t.includes('cross_ref')) return 'Defekter Verweis';
  if (t.includes('lost_knowledge')) return 'Verlorenes Wissen';
  if (t.includes('sprint_readiness')) return 'Nicht Sprint-bereit';
  if (t.includes('stale_doc')) return 'Doku veraltet';
  return t;
}

function getRecommendation(f) {
  const t = safe(f.check_type);
  const sev = safe(f.severity);
  if (t.includes('stale')) return sev === 'critical' ? 'Sofort schließen oder aktualisieren' : 'Aktualisieren oder schließen';
  if (t.includes('no_description') || t.includes('completeness')) return 'Beschreibung mit Kontext hinzufügen';
  if (t.includes('no_assignee')) return sev === 'critical' || sev === 'high' ? 'Dringend: Verantwortlichen zuweisen!' : 'Verantwortlichen zuweisen';
  if (t.includes('no_labels')) return 'Labels für Kategorisierung vergeben';
  if (t.includes('no_priority')) return 'Priorität setzen';
  if (t.includes('lost_knowledge')) return 'Aktivem Teammitglied zuweisen';
  if (t.includes('sprint_readiness')) return 'Pflichtfelder vor Sprint ergänzen';
  if (t.includes('stale_doc')) return 'Confluence-Seite aktualisieren';
  if (t.includes('contradiction') || t.includes('consistency')) return 'Doku aktualisieren — Widerspruch beheben';
  if (t.includes('cross_ref')) return 'Verlinkung prüfen und korrigieren';
  if (t.includes('workflow')) return 'Workflow prüfen — Nacharbeit?';
  if (t.includes('overloaded')) return 'Aufgaben umverteilen';
  if (t.includes('spillover')) return 'Sprint-Überlauf klären';
  return 'Prüfen und beheben';
}

function formatDate(d) {
  if (!d) return '';
  try {
    const dt = new Date(d);
    if (isNaN(dt.getTime())) return d;
    return `${String(dt.getDate()).padStart(2, '0')}.${String(dt.getMonth() + 1).padStart(2, '0')}.${dt.getFullYear()} ${String(dt.getHours()).padStart(2, '0')}:${String(dt.getMinutes()).padStart(2, '0')}`;
  } catch { return d; }
}

function formatDateShort(d) {
  if (!d) return '';
  try { const dt = new Date(d); return `${String(dt.getDate()).padStart(2, '0')}.${String(dt.getMonth() + 1).padStart(2, '0')}`; }
  catch { return ''; }
}

// === SETTINGS PANEL ===
function SettingsPanel({ onClose }) {
  const [apiKey, setApiKey] = useState('');
  const [aiEnabled, setAiEnabled] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    invoke('getSettings').then(s => {
      if (s) { setApiKey(safe(s.apiKey)); setAiEnabled(s.aiEnabled === true || s.aiEnabled === 'true'); }
      setLoaded(true);
    }).catch(() => setLoaded(true));
  }, []);

  const handleSave = async () => {
    setSaving(true); setMsg(null);
    try { await invoke('saveSettings', { apiKey, aiEnabled }); setMsg({ ok: true, text: 'Einstellungen gespeichert!' }); }
    catch (e) { setMsg({ ok: false, text: 'Fehler: ' + safe(e?.message) }); }
    setSaving(false);
  };

  const handleDelete = async () => {
    setSaving(true);
    try { await invoke('deleteApiKey'); setApiKey(''); setAiEnabled(false); setMsg({ ok: true, text: 'API-Key gelöscht.' }); }
    catch (e) { setMsg({ ok: false, text: 'Fehler: ' + safe(e?.message) }); }
    setSaving(false);
  };

  if (!loaded) return <div className="dq-loading"><div className="dq-loading-spinner" /><span>Lade Einstellungen...</span></div>;

  return (
    <div className="dq-app">
      <div className="dq-header">
        <h1>Einstellungen</h1>
        <button className="dq-btn dq-btn-subtle" onClick={onClose}>Zurück zum Dashboard</button>
      </div>

      <div className="dq-settings-card">
        <h3 style={{ marginBottom: 4, fontSize: 16, fontWeight: 700 }}>KI-Analyse (optional)</h3>
        <p style={{ fontSize: 13, color: 'var(--dq-text-subtle)', marginBottom: 16 }}>
          Die App funktioniert ohne KI-Key (regelbasiert). Mit Key werden zusätzlich semantische Widersprüche erkannt.
        </p>

        <div className="dq-form-group">
          <label className="dq-form-label">Claude API-Key</label>
          <input className="dq-form-input" type="password" placeholder="sk-ant-..." value={apiKey} onChange={e => setApiKey(e.target.value)} />
          <div className="dq-form-hint">Kostenlos erstellen auf console.anthropic.com</div>
        </div>

        <div className="dq-toggle-row" style={{ marginBottom: 16 }}>
          <label className="dq-toggle">
            <input type="checkbox" checked={aiEnabled} onChange={() => setAiEnabled(!aiEnabled)} />
            <span className="dq-toggle-track" />
          </label>
          <span style={{ fontSize: 14 }}>{aiEnabled ? 'KI-Analyse aktiviert' : 'KI-Analyse deaktiviert'}</span>
        </div>

        {!aiEnabled && (
          <div className="dq-info-box" style={{ marginBottom: 16 }}>
            <strong>Ohne KI:</strong> Fehlende Felder, Staleness, Workflow-Anomalien.
            <br /><strong>Mit KI:</strong> Zusätzlich semantische Widerspruchserkennung Jira ↔ Confluence.
          </div>
        )}

        <div style={{ display: 'flex', gap: 8 }}>
          <button className="dq-btn dq-btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? <><span className="spinner" /> Speichert...</> : 'Speichern'}
          </button>
          {apiKey && <button className="dq-btn dq-btn-danger" onClick={handleDelete} disabled={saving}>API-Key löschen</button>}
        </div>
      </div>

      {msg && <div className={msg.ok ? 'dq-success-box' : 'dq-info-box'} style={{ borderColor: msg.ok ? '#abf5d1' : '#ffd1cc', background: msg.ok ? '#e3fcef' : '#ffebe6', color: msg.ok ? '#006644' : '#de350b' }}>{msg.text}</div>}

      <div className="dq-settings-card" style={{ marginTop: 16 }}>
        <h4 style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>So funktioniert die App</h4>
        <ol style={{ paddingLeft: 20, fontSize: 13, color: 'var(--dq-text-subtle)', lineHeight: 1.8 }}>
          <li>Scannt automatisch alle Jira-Tickets und Confluence-Seiten</li>
          <li>Regelbasiert: Fehlende Beschreibungen, Zuständige, veraltete Tickets</li>
          <li>Cross-Referenz: Prüft Confluence-Verweise auf existierende Tickets</li>
          <li>Mit KI: Erkennt inhaltliche Widersprüche zwischen Doku und Tickets</li>
          <li>Ergebnis: Qualitätsnote (A–F) mit konkreten Empfehlungen</li>
        </ol>
      </div>
    </div>
  );
}

// === MAIN DASHBOARD ===
function ProjectDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [page, setPage] = useState(0);
  const perPage = 15;

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true); setError(null);
    try { setData(await invoke('getProjectScore')); }
    catch (e) { setError(safe(e?.message || 'Fehler beim Laden')); }
    setLoading(false);
  };

  const triggerScan = async () => {
    setScanning(true);
    try { await invoke('runScan'); await loadData(); }
    catch (e) { setError(safe(e?.message)); }
    setScanning(false);
  };

  if (showSettings) return <SettingsPanel onClose={() => { setShowSettings(false); loadData(); }} />;

  if (loading) return <div className="dq-loading"><div className="dq-loading-spinner" /><span>Lade Dashboard...</span></div>;

  if (error) return (
    <div className="dq-app">
      <div className="dq-info-box" style={{ background: '#ffebe6', borderColor: '#ffd1cc', color: '#de350b' }}>Fehler: {error}</div>
      <button className="dq-btn dq-btn-primary" onClick={loadData} style={{ marginTop: 12 }}>Erneut laden</button>
    </div>
  );

  if (!data || !data.score) return (
    <div className="dq-app">
      <div className="dq-header"><h1>Data Quality Guard</h1>
        <button className="dq-btn dq-btn-primary" onClick={triggerScan} disabled={scanning}>
          {scanning ? <><span className="spinner" /> Scannt...</> : 'Ersten Scan starten'}
        </button>
      </div>
      <div className="dq-info-box">Noch keine Daten vorhanden. Starte den ersten Scan um die Qualität deines Projekts zu analysieren.</div>
    </div>
  );

  const score = Math.round(safeNum(data.score.overall_score));
  const grade = getGrade(score);
  const findings = data.findings || [];
  const history = data.history || [];
  const contradictions = data.contradictions || [];
  const items = safeNum(data.score.total_issues);
  const findCount = safeNum(data.score.findings_count);
  const calculatedAt = data.score.calculated_at;

  const cats = [
    { name: 'Aktualität', score: safeNum(data.score.staleness_score), desc: 'Wie aktuell sind eure Tickets?' },
    { name: 'Vollständigkeit', score: safeNum(data.score.completeness_score), desc: 'Sind alle Pflichtfelder ausgefüllt?' },
    { name: 'Konsistenz', score: safeNum(data.score.consistency_score), desc: 'Stimmen Jira und Confluence überein?' },
    { name: 'Querverweise', score: safeNum(data.score.cross_ref_score), desc: 'Funktionieren alle Verlinkungen?' },
  ];

  // Severity counts
  const sevCounts = { critical: 0, high: 0, medium: 0, low: 0 };
  findings.forEach(f => { const s = safe(f.severity); if (sevCounts[s] !== undefined) sevCounts[s]++; else sevCounts.low++; });

  // Pagination
  const totalPages = Math.ceil(findings.length / perPage);
  const pagedFindings = findings.slice(page * perPage, (page + 1) * perPage);

  return (
    <div className="dq-app">
      {/* HEADER */}
      <div className="dq-header">
        <h1>Data Quality Guard</h1>
        <div className="dq-header-actions">
          <button className="dq-btn dq-btn-subtle" onClick={() => setShowSettings(true)}>Einstellungen</button>
          <button className="dq-btn dq-btn-primary" onClick={triggerScan} disabled={scanning}>
            {scanning ? <><span className="spinner" /> Scannt...</> : 'Erneut scannen'}
          </button>
        </div>
      </div>

      {/* SCORE HERO */}
      <div className="dq-score-hero">
        <div className="dq-score-circle">
          <span className="dq-score-number">{score}</span>
          <span className="dq-score-label">Score</span>
        </div>
        <div className="dq-score-info">
          <h2>Note: {grade.grade} — {grade.label}</h2>
          <p>{findCount} Probleme in {items} Tickets gefunden</p>
          <div className="dq-score-meta">
            <span className="dq-score-meta-item">Letzter Scan: {formatDate(calculatedAt)}</span>
            {data.aiStatus?.configured && <span className="dq-score-meta-item">KI aktiv</span>}
          </div>
        </div>
      </div>

      {/* CATEGORIES */}
      <div className="dq-categories">
        {cats.map(c => {
          const catGrade = getGrade(c.score);
          const rounded = Math.round(c.score);
          return (
            <div className="dq-cat-card" key={c.name}>
              <div className="dq-cat-header">
                <span className="dq-cat-name">{c.name}</span>
                <span className="dq-cat-score" style={{ color: getBarColor(c.score) }}>{rounded}</span>
              </div>
              <span className={`dq-grade ${catGrade.cls}`} style={{ fontSize: 12, width: 22, height: 22 }}>{catGrade.grade}</span>
              <div className="dq-cat-bar">
                <div className="dq-cat-bar-fill" style={{ width: `${rounded}%`, background: getBarColor(c.score) }} />
              </div>
              <div className="dq-cat-desc">{c.desc}</div>
            </div>
          );
        })}
      </div>

      {/* TREND */}
      {history.length > 1 && (
        <div className="dq-section">
          <div className="dq-section-header">
            <span className="dq-section-title">Trend-Verlauf</span>
          </div>
          <div className="dq-trend-row">
            {history.slice(0, 14).reverse().map((h, i) => {
              const hScore = Math.round(safeNum(h.overall_score));
              const hGrade = getGrade(hScore);
              return (
                <div className="dq-trend-bar" key={i}>
                  <span className="dq-trend-value" style={{ background: getBarColor(hScore) + '20', color: getBarColor(hScore) }}>{hScore}</span>
                  <span className="dq-trend-date">{formatDateShort(h.calculated_at)}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* CONTRADICTIONS */}
      {contradictions.length > 0 && (
        <div className="dq-section">
          <div className="dq-section-header">
            <span className="dq-section-title">Widersprüche</span>
            <span className="dq-section-count">{contradictions.length}</span>
          </div>
          {contradictions.map((c, i) => (
            <div className="dq-contradiction" key={i}>
              <div className="dq-contradiction-header">
                <span className="dq-contradiction-badge">Widerspruch</span>
                <strong>{safe(c.source_key)} ↔ {safe(c.target_key)}</strong>
                {safeNum(c.confidence) > 0 && <span className="dq-contradiction-confidence">{Math.round(safeNum(c.confidence) * 100)}% Konfidenz</span>}
              </div>
              <div className="dq-contradiction-desc">{safe(c.description)}</div>
              {safe(c.page_title) && <div style={{ fontSize: 12, color: 'var(--dq-text-muted)' }}>Seite: {safe(c.page_title)}</div>}
              {safe(c.recommendation) && <div className="dq-contradiction-rec">Empfehlung: {safe(c.recommendation)}</div>}
            </div>
          ))}
        </div>
      )}

      {/* FINDINGS */}
      {findings.length > 0 ? (
        <div className="dq-section">
          <div className="dq-section-header">
            <span className="dq-section-title">Gefundene Probleme</span>
            <span className="dq-section-count">{findCount}</span>
          </div>

          <div className="dq-severity-bar">
            {sevCounts.critical > 0 && <span className="dq-sev-badge dq-sev-critical">{sevCounts.critical} Kritisch</span>}
            {sevCounts.high > 0 && <span className="dq-sev-badge dq-sev-high">{sevCounts.high} Hoch</span>}
            {sevCounts.medium > 0 && <span className="dq-sev-badge dq-sev-medium">{sevCounts.medium} Mittel</span>}
            {sevCounts.low > 0 && <span className="dq-sev-badge dq-sev-low">{sevCounts.low} Niedrig</span>}
          </div>

          <table className="dq-table">
            <thead>
              <tr>
                <th style={{ width: 80 }}>Schwere</th>
                <th style={{ width: 90 }}>Ticket</th>
                <th>Problem</th>
                <th style={{ width: 220 }}>Empfehlung</th>
              </tr>
            </thead>
            <tbody>
              {pagedFindings.map((f, i) => (
                <tr key={i}>
                  <td><span className={`dq-sev-badge ${getSevCls(f.severity)}`}>{getSevLabel(f.severity)}</span></td>
                  <td><a className="dq-ticket-link" href="#" onClick={e => { e.preventDefault(); router.navigate(`/browse/${safe(f.item_key)}`); }}>{safe(f.item_key)}</a></td>
                  <td className="dq-message">{safe(f.message) || getCheckLabel(f.check_type)}</td>
                  <td className="dq-rec">{getRecommendation(f)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {totalPages > 1 && (
            <div className="dq-pagination">
              {Array.from({ length: totalPages }, (_, i) => (
                <button key={i} className={`dq-page-btn ${i === page ? 'active' : ''}`} onClick={() => setPage(i)}>{i + 1}</button>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="dq-success-box" style={{ textAlign: 'center' }}>
          <strong>Alles in Ordnung!</strong> Keine Probleme gefunden.
        </div>
      )}

      {/* KI STATUS */}
      {!data.aiStatus?.configured && (
        <div className="dq-info-box" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>Tipp: API-Key hinterlegen für KI-gestützte Widerspruchserkennung</span>
          <button className="dq-btn dq-btn-subtle" onClick={() => setShowSettings(true)} style={{ borderColor: '#b3d4ff' }}>Jetzt einrichten</button>
        </div>
      )}

      {/* FOOTER */}
      <div className="dq-footer">
        <span>Letzter Scan: {formatDate(calculatedAt)}</span>
        <span>{items} Tickets gescannt</span>
      </div>
    </div>
  );
}

// === ISSUE PANEL (compact) ===
function IssuePanel() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => { invoke('getIssueQuality').then(setData).catch(console.error).finally(() => setLoading(false)); }, []);

  if (loading) return <div className="dq-loading"><div className="dq-loading-spinner" /><span>Prüfe...</span></div>;
  if (!data?.findings?.length) return <div style={{ padding: 8 }}><span className="dq-sev-badge" style={{ background: '#e3fcef', color: '#00875a' }}>Keine Probleme</span></div>;

  const issueScore = Math.round(safeNum(data.score));
  const issueGrade = getGrade(issueScore);

  return (
    <div style={{ padding: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <span className={`dq-grade ${issueGrade.cls}`}>{issueGrade.grade}</span>
        <span style={{ fontWeight: 700 }}>{issueScore}/100</span>
        <span style={{ fontSize: 12, color: 'var(--dq-text-subtle)' }}>{data.findings.length} Probleme</span>
      </div>
      {data.findings.slice(0, 3).map((f, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
          <span className={`dq-sev-badge ${getSevCls(f.severity)}`} style={{ fontSize: 11 }}>{getSevLabel(f.severity)}</span>
          <span style={{ fontSize: 12 }}>{safe(f.message) || getCheckLabel(f.check_type)}</span>
        </div>
      ))}
      {data.findings.length > 3 && <div style={{ fontSize: 11, color: 'var(--dq-text-muted)', marginTop: 4 }}>+{data.findings.length - 3} weitere</div>}
    </div>
  );
}

// === CONFLUENCE DASHBOARD ===
function ConfluenceDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => { invoke('getDashboardData').then(setData).catch(console.error).finally(() => setLoading(false)); }, []);

  if (loading) return <div className="dq-loading"><div className="dq-loading-spinner" /><span>Lade Übersicht...</span></div>;

  const scores = data?.scores || [];
  if (!scores.length) return (
    <div className="dq-app">
      <h1 style={{ marginBottom: 16 }}>Data Quality Guard — Alle Projekte</h1>
      <div className="dq-info-box">Noch keine Daten. Scans laufen automatisch stündlich.</div>
    </div>
  );

  const avg = Math.round(scores.reduce((sum, s) => sum + safeNum(s.overall_score), 0) / scores.length);
  const avgGrade = getGrade(avg);

  return (
    <div className="dq-app">
      <h1 style={{ marginBottom: 16 }}>Data Quality Guard — Alle Projekte</h1>
      <div className="dq-score-hero" style={{ marginBottom: 24 }}>
        <div className="dq-score-circle"><span className="dq-score-number">{avg}</span><span className="dq-score-label">Schnitt</span></div>
        <div className="dq-score-info">
          <h2>Durchschnitt: {avgGrade.grade}</h2>
          <p>{scores.length} Projekte, {scores.reduce((s, r) => s + safeNum(r.findings_count), 0)} Probleme insgesamt</p>
        </div>
      </div>
      <table className="dq-table">
        <thead><tr><th>Projekt</th><th>Note</th><th>Aktualität</th><th>Vollständigkeit</th><th>Konsistenz</th><th>Querverweise</th><th>Probleme</th></tr></thead>
        <tbody>
          {scores.map((s, i) => {
            const sScore = Math.round(safeNum(s.overall_score));
            const sGrade = getGrade(sScore);
            return (
              <tr key={i}>
                <td><strong>{safe(s.project_key)}</strong></td>
                <td><span className={`dq-grade ${sGrade.cls}`} style={{ fontSize: 12, width: 22, height: 22 }}>{sGrade.grade}</span> {sScore}</td>
                <td>{Math.round(safeNum(s.staleness_score))}</td>
                <td>{Math.round(safeNum(s.completeness_score))}</td>
                <td>{Math.round(safeNum(s.consistency_score))}</td>
                <td>{Math.round(safeNum(s.cross_ref_score))}</td>
                <td><span className="dq-sev-badge dq-sev-critical">{safeNum(s.findings_count)}</span></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// === ROUTER ===
export default function App() {
  const [ctx, setCtx] = useState(null);
  useEffect(() => { view.getContext().then(setCtx).catch(console.error); }, []);

  if (!ctx) return <div className="dq-loading"><div className="dq-loading-spinner" /><span>Laden...</span></div>;

  const mk = safe(ctx.moduleKey);
  if (mk.includes('issue-panel')) return <IssuePanel />;
  if (mk.includes('confluence')) return <ConfluenceDashboard />;
  return <ProjectDashboard />;
}
