import React, { useEffect, useState } from 'react';
import { invoke, view, router } from '@forge/bridge';

const safe = (v) => (v == null ? '' : String(v));
const safeNum = (v) => Number(v) || 0;

function getGrade(score) {
  const s = safeNum(score);
  if (s >= 90) return { g: 'A', l: 'Ausgezeichnet', c: 'grade-a', color: 'var(--grade-a)' };
  if (s >= 75) return { g: 'B', l: 'Gut', c: 'grade-b', color: 'var(--grade-b)' };
  if (s >= 60) return { g: 'C', l: 'Befriedigend', c: 'grade-c', color: 'var(--grade-c)' };
  if (s >= 40) return { g: 'D', l: 'Mangelhaft', c: 'grade-d', color: 'var(--grade-d)' };
  return { g: 'F', l: 'Kritisch', c: 'grade-f', color: 'var(--grade-f)' };
}

function sevLabel(s) {
  if (s === 'critical') return 'Kritisch';
  if (s === 'high') return 'Hoch';
  if (s === 'medium') return 'Mittel';
  return 'Niedrig';
}

function sevCls(s) {
  if (s === 'critical') return 'sev-critical';
  if (s === 'high') return 'sev-high';
  if (s === 'medium') return 'sev-medium';
  return 'sev-low';
}

function recommend(f) {
  const t = safe(f.check_type), s = safe(f.severity);
  if (t.includes('stale')) return s === 'critical' ? 'Sofort schließen oder aktualisieren' : 'Aktualisieren oder schließen';
  if (t.includes('no_description') || t.includes('completeness')) return 'Beschreibung hinzufügen';
  if (t.includes('no_assignee')) return s === 'critical' || s === 'high' ? 'Dringend zuweisen!' : 'Zuweisen';
  if (t.includes('no_labels')) return 'Labels vergeben';
  if (t.includes('no_priority')) return 'Priorität setzen';
  if (t.includes('lost_knowledge')) return 'Aktivem Mitglied zuweisen';
  if (t.includes('sprint_readiness')) return 'Pflichtfelder ergänzen';
  if (t.includes('stale_doc')) return 'Confluence aktualisieren';
  if (t.includes('contradiction') || t.includes('consistency')) return 'Widerspruch beheben';
  if (t.includes('cross_ref')) return 'Verlinkung korrigieren';
  if (t.includes('workflow')) return 'Workflow prüfen';
  if (t.includes('overloaded')) return 'Aufgaben umverteilen';
  if (t.includes('spillover')) return 'Sprint-Überlauf klären';
  return 'Prüfen';
}

function fmtDate(d) {
  if (!d) return '–';
  try {
    const dt = new Date(d);
    if (isNaN(dt.getTime())) return d;
    const dd = String(dt.getDate()).padStart(2, '0');
    const mm = String(dt.getMonth() + 1).padStart(2, '0');
    return `${dd}.${mm}.${dt.getFullYear()} ${String(dt.getHours()).padStart(2, '0')}:${String(dt.getMinutes()).padStart(2, '0')}`;
  } catch { return d; }
}

function fmtShort(d) {
  if (!d) return '';
  try { const dt = new Date(d); return `${String(dt.getDate()).padStart(2, '0')}.${String(dt.getMonth() + 1).padStart(2, '0')}`; }
  catch { return ''; }
}

// SVG Score Ring
function ScoreRing({ score, size = 88, stroke = 6 }) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (safeNum(score) / 100) * circ;
  const grade = getGrade(score);
  return (
    <div className="score-ring" style={{ width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle className="score-ring-bg" cx={size / 2} cy={size / 2} r={r} />
        <circle className="score-ring-fill" cx={size / 2} cy={size / 2} r={r}
          stroke={grade.color} strokeDasharray={circ} strokeDashoffset={offset} />
      </svg>
      <div className="score-ring-text">
        <span className="score-value" style={{ color: grade.color }}>{Math.round(safeNum(score))}</span>
        <span className="score-max">/100</span>
      </div>
    </div>
  );
}

// SVG Icons (inline, no external deps)
const IconSettings = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>;
const IconScan = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 12a9 9 0 1 1-6.219-8.56"/><polyline points="21 3 21 12 12 12"/></svg>;
const IconBack = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="m15 18-6-6 6-6"/></svg>;

// === SETTINGS ===
function Settings({ onClose }) {
  const [key, setKey] = useState('');
  const [provider, setProvider] = useState('gemini');
  const [ai, setAi] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    invoke('getSettings').then(s => {
      if (s) {
        setKey(safe(s.apiKey));
        setProvider(safe(s.provider) || 'gemini');
        setAi(s.aiEnabled === true || s.aiEnabled === 'true');
      }
      setReady(true);
    }).catch(() => setReady(true));
  }, []);

  const providerPlaceholder = provider === 'gemini' ? 'AIza...' : provider === 'claude' ? 'sk-ant-...' : 'sk-...';

  const save = async () => {
    setSaving(true); setMsg(null);
    try { await invoke('saveSettings', { apiKey: key, provider, aiEnabled: ai }); setMsg({ ok: true, t: 'Gespeichert' }); }
    catch (e) { setMsg({ ok: false, t: safe(e?.message) }); }
    setSaving(false);
  };

  const del = async () => {
    setSaving(true);
    try { await invoke('deleteApiKey'); setKey(''); setAi(false); setMsg({ ok: true, t: 'API-Key gelöscht' }); }
    catch (e) { setMsg({ ok: false, t: safe(e?.message) }); }
    setSaving(false);
  };

  if (!ready) return <div className="loading"><div className="loading-ring" /><span className="loading-text">Lade Einstellungen...</span></div>;

  return (
    <div className="app">
      <div className="header">
        <button className="btn btn-secondary" onClick={onClose}><IconBack /> Zurück</button>
        <span className="header-title">Einstellungen</span>
        <div />
      </div>

      <div className="settings-card">
        <h3>KI-Analyse</h3>
        <p className="subtitle">Ohne Key: regelbasierte Analyse. Mit Key: zusätzlich semantische Widerspruchserkennung.</p>
        <div className="form-group">
          <label className="form-label" htmlFor="apikey">API-Key</label>
          <input id="apikey" className="form-input" type="password" placeholder={providerPlaceholder} value={key} onChange={e => setKey(e.target.value)} />
        </div>
        <div className="form-group">
          <label className="form-label">KI-Anbieter</label>
          <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
            {[
              { id: 'gemini', name: 'Google Gemini', hint: 'Günstig, Free Tier' },
              { id: 'claude', name: 'Claude', hint: 'Beste Textanalyse' },
              { id: 'openai', name: 'OpenAI', hint: 'GPT-4o-mini' },
            ].map(p => (
              <label key={p.id} style={{
                flex: 1, padding: '10px 12px', borderRadius: 'var(--radius-sm)',
                border: `1px solid ${provider === p.id ? 'var(--c-accent)' : 'var(--c-border)'}`,
                background: provider === p.id ? 'var(--c-accent-subtle)' : 'var(--c-surface)',
                cursor: 'pointer', transition: 'all 150ms ease'
              }}>
                <input type="radio" name="provider" value={p.id} checked={provider === p.id}
                  onChange={() => setProvider(p.id)} style={{ display: 'none' }} />
                <div style={{ fontSize: 13, fontWeight: 600 }}>{p.name}</div>
                <div style={{ fontSize: 11, color: 'var(--c-text-tertiary)' }}>{p.hint}</div>
              </label>
            ))}
          </div>
          <div className="form-hint">
            {provider === 'gemini' && 'Kostenlos erstellen auf aistudio.google.com'}
            {provider === 'claude' && 'Erstellen auf console.anthropic.com'}
            {provider === 'openai' && 'Erstellen auf platform.openai.com'}
          </div>
        </div>
        <div className="toggle-row" style={{ marginBottom: 20 }}>
          <label className="toggle"><input type="checkbox" checked={ai} onChange={() => setAi(!ai)} /><span className="toggle-track" /></label>
          <span className="toggle-label">{ai ? 'KI aktiv' : 'KI deaktiviert'}</span>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? <><span className="spinner" /> Speichert</> : 'Speichern'}</button>
          {key && <button className="btn btn-danger" onClick={del} disabled={saving}>Key löschen</button>}
        </div>
      </div>

      {msg && <div className={`info-box ${msg.ok ? 'info-box-green' : 'info-box-red'}`}>{msg.t}</div>}

      <div className="settings-card">
        <h3 style={{ fontSize: 14 }}>So funktioniert Data Quality Guard</h3>
        <ol style={{ paddingLeft: 18, fontSize: 13, color: 'var(--c-text-secondary)', lineHeight: 2, marginTop: 8 }}>
          <li>Scannt Jira-Tickets und Confluence-Seiten automatisch</li>
          <li>Prüft Vollständigkeit, Aktualität und Konsistenz</li>
          <li>Erkennt Widersprüche zwischen Dokumentation und Tickets</li>
          <li>Berechnet Qualitätsnote (A–F) mit konkreten Empfehlungen</li>
        </ol>
      </div>
    </div>
  );
}

// === MAIN DASHBOARD ===
function Dashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState(null);
  const [settings, setSettings] = useState(false);
  const [pg, setPg] = useState(0);
  const [sevFilter, setSevFilter] = useState('all');
  const pp = 15;

  useEffect(() => { load(); }, []);
  const load = async () => { setLoading(true); setError(null); setSevFilter('all'); try { setData(await invoke('getProjectScore')); } catch (e) { setError(safe(e?.message || 'Fehler')); } setLoading(false); };
  const scan = async () => { setScanning(true); try { await invoke('triggerScan'); await load(); } catch (e) { setError(safe(e?.message)); } setScanning(false); };

  if (settings) return <Settings onClose={() => { setSettings(false); load(); }} />;
  if (loading) return <div className="loading"><div className="loading-ring" /><span className="loading-text">Lade Dashboard...</span></div>;
  if (error) return <div className="app"><div className="info-box info-box-red">{error}</div><button className="btn btn-primary" onClick={load} style={{ marginTop: 12 }}>Erneut laden</button></div>;

  if (!data?.score) return (
    <div className="app">
      <div className="header"><span className="header-title">Data Quality Guard</span><button className="btn btn-primary" onClick={scan} disabled={scanning}>{scanning ? <><span className="spinner" /> Scannt...</> : <><IconScan /> Ersten Scan starten</>}</button></div>
      <div className="empty"><div className="empty-title">Noch keine Daten</div><div className="empty-desc">Starte den ersten Scan um die Qualität deines Projekts zu analysieren.</div></div>
    </div>
  );

  const score = Math.round(safeNum(data.score.overall_score));
  const grade = getGrade(score);
  const findings = data.findings || [];
  const history = data.history || [];
  const contras = data.contradictions || [];
  const items = safeNum(data.score.total_issues);
  const fc = safeNum(data.score.findings_count);

  const cats = [
    { n: 'Aktualität', s: safeNum(data.score.staleness_score), d: 'Wie aktuell sind die Tickets?' },
    { n: 'Vollständigkeit', s: safeNum(data.score.completeness_score), d: 'Alle Pflichtfelder ausgefüllt?' },
    { n: 'Konsistenz', s: safeNum(data.score.consistency_score), d: 'Jira ↔ Confluence stimmig?' },
    { n: 'Querverweise', s: safeNum(data.score.cross_ref_score), d: 'Verlinkungen intakt?' },
  ];

  const sc = data.severityCounts || (() => {
    const counts = { critical: 0, high: 0, medium: 0, low: 0 };
    findings.forEach(f => { const k = safe(f.severity); if (counts[k] !== undefined) counts[k]++; else counts.low++; });
    return counts;
  })();

  const filtered = sevFilter === 'all' ? findings : findings.filter(f => safe(f.severity) === sevFilter);
  const totalPg = Math.ceil(filtered.length / pp);
  const paged = filtered.slice(pg * pp, (pg + 1) * pp);

  return (
    <div className="app">
      {/* Header */}
      <div className="header">
        <span className="header-title">Data Quality Guard</span>
        <div className="header-actions">
          <button className="btn btn-secondary" onClick={() => setSettings(true)}><IconSettings /> Einstellungen</button>
          <button className="btn btn-primary" onClick={scan} disabled={scanning}>{scanning ? <><span className="spinner" /> Scannt...</> : <><IconScan /> Scannen</>}</button>
        </div>
      </div>

      {/* Score Hero */}
      <div className="score-hero">
        <ScoreRing score={score} />
        <div className="score-details">
          <h2>Note {grade.g} — {grade.l}</h2>
          <p>{fc} Probleme in {items} Tickets</p>
          <div className="score-meta">
            <span className="score-meta-item">{fmtDate(data.score.calculated_at)}</span>
            {data.aiStatus?.configured && <span className="score-meta-item" style={{ color: 'var(--c-accent)' }}>KI aktiv</span>}
          </div>
        </div>
      </div>

      {/* Categories */}
      <div className="categories">
        {cats.map(c => {
          const cg = getGrade(c.s);
          const r = Math.round(c.s);
          return (
            <div className="cat-card" key={c.n}>
              <div className="cat-top">
                <span className="cat-label">{c.n}</span>
                <span className={`grade ${cg.c}`}>{cg.g}</span>
              </div>
              <span className="cat-value" style={{ color: cg.color }}>{r}</span>
              <div className="cat-bar"><div className="cat-bar-fill" style={{ width: `${r}%`, background: cg.color }} /></div>
              <div className="cat-desc">{c.d}</div>
            </div>
          );
        })}
      </div>

      {/* Trend */}
      {history.length > 1 && (
        <div className="section">
          <div className="section-head"><span className="section-title">Trend</span></div>
          <div className="trend-row">
            {history.slice(0, 14).reverse().map((h, i) => {
              const hs = Math.round(safeNum(h.overall_score));
              const hg = getGrade(hs);
              return <div className="trend-item" key={i}><span className="trend-val" style={{ background: hg.color + '15', color: hg.color }}>{hs}</span><span className="trend-date">{fmtShort(h.calculated_at)}</span></div>;
            })}
          </div>
        </div>
      )}

      {/* Contradictions */}
      {contras.length > 0 && (
        <div className="section">
          <div className="section-head"><span className="section-title">Widersprüche</span><span className="section-count">{contras.length}</span></div>
          {contras.map((c, i) => (
            <div className="contra" key={i}>
              <div className="contra-head">
                <span className="contra-badge">Widerspruch</span>
                <span className="contra-keys">{safe(c.source_key)} ↔ {safe(c.target_key)}</span>
                {safeNum(c.confidence) > 0 && <span className="contra-conf">{Math.round(safeNum(c.confidence) * 100)}%</span>}
              </div>
              <div className="contra-desc">{safe(c.description)}</div>
              {safe(c.page_title) && <div className="contra-page">Seite: {safe(c.page_title)}</div>}
              {safe(c.recommendation) && <div className="contra-rec">{safe(c.recommendation)}</div>}
            </div>
          ))}
        </div>
      )}

      {/* Top Actions */}
      {findings.length > 0 && (
        <div className="section" style={{ marginBottom: 16 }}>
          <div className="section-head"><span className="section-title">Sofort handeln</span></div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {findings.filter(f => f.severity === 'critical' || f.severity === 'high').slice(0, 3).map((f, i) => (
              <div key={i} style={{ flex: '1 1 250px', padding: 12, background: 'var(--c-surface)', border: '1px solid var(--c-border)', borderLeft: `3px solid ${f.severity === 'critical' ? 'var(--c-red)' : 'var(--c-amber)'}`, borderRadius: 'var(--radius)' }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: f.severity === 'critical' ? 'var(--c-red)' : 'var(--c-amber)', marginBottom: 4 }}>{safe(f.item_key).includes('-') ? safe(f.item_key) : 'Confluence'}</div>
                <div style={{ fontSize: 13 }}>{recommend(f)}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Findings */}
      {findings.length > 0 ? (
        <div className="section">
          <div className="section-head">
            <span className="section-title">Probleme</span>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <button className="btn btn-secondary" onClick={() => {
                const csv = ['Schwere;Ticket;Problem;Empfehlung',
                  ...findings.map(f => `${sevLabel(f.severity)};${safe(f.item_key)};${safe(f.message).replace(/;/g, ',')};${recommend(f)}`)
                ].join('\n');
                const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url; a.download = `dqg-report-${new Date().toISOString().slice(0,10)}.csv`;
                a.click(); URL.revokeObjectURL(url);
              }} style={{ fontSize: 12, padding: '4px 10px' }}>CSV Export</button>
              <span className="section-count">{fc}</span>
            </div>
          </div>
          <div className="sev-row">
            <button className={`sev ${sevFilter === 'all' ? 'sev-all-active' : ''}`} onClick={() => { setSevFilter('all'); setPg(0); }}>Alle {fc}</button>
            {sc.critical > 0 && <button className={`sev sev-critical ${sevFilter === 'critical' ? 'sev-active' : ''}`} onClick={() => { setSevFilter('critical'); setPg(0); }}>{sc.critical} Kritisch</button>}
            {sc.high > 0 && <button className={`sev sev-high ${sevFilter === 'high' ? 'sev-active' : ''}`} onClick={() => { setSevFilter('high'); setPg(0); }}>{sc.high} Hoch</button>}
            {sc.medium > 0 && <button className={`sev sev-medium ${sevFilter === 'medium' ? 'sev-active' : ''}`} onClick={() => { setSevFilter('medium'); setPg(0); }}>{sc.medium} Mittel</button>}
            {sc.low > 0 && <button className={`sev sev-low ${sevFilter === 'low' ? 'sev-active' : ''}`} onClick={() => { setSevFilter('low'); setPg(0); }}>{sc.low} Niedrig</button>}
          </div>
          <table className="tbl">
            <thead><tr><th style={{ width: 76 }}>Schwere</th><th style={{ width: 80 }}>Ticket</th><th>Problem</th><th style={{ width: 190 }}>Empfehlung</th><th style={{ width: 36 }}></th></tr></thead>
            <tbody>
              {paged.map((f, i) => (
                <tr key={i}>
                  <td><span className={`sev ${sevCls(f.severity)}`}>{sevLabel(f.severity)}</span></td>
                  <td>
                    {safe(f.item_key).includes('-') ? (
                      <a className="tbl-link" href="#" onClick={e => { e.preventDefault(); router.navigate(`/browse/${safe(f.item_key)}`); }}>{safe(f.item_key)}</a>
                    ) : (
                      <span style={{ fontSize: 12, color: 'var(--c-text-tertiary)' }}>Seite</span>
                    )}
                  </td>
                  <td className="tbl-msg">{safe(f.message) || safe(f.check_type)}</td>
                  <td className="tbl-rec">{recommend(f)}</td>
                  <td>
                    <button className="btn-dismiss" onClick={async () => {
                      await invoke('dismissFinding', { findingId: safe(f.id) });
                      load();
                    }} title="Als erledigt markieren">×</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {totalPg > 1 && <div className="pages">{Array.from({ length: totalPg }, (_, i) => <button key={i} className={`page-btn ${i === pg ? 'active' : ''}`} onClick={() => setPg(i)}>{i + 1}</button>)}</div>}
        </div>
      ) : (
        <div className="info-box info-box-green" style={{ justifyContent: 'center' }}>Keine Probleme gefunden.</div>
      )}

      {/* AI hint */}
      {!data.aiStatus?.configured && (
        <div className="info-box info-box-blue">
          <span>KI-Widerspruchserkennung verfügbar</span>
          <button className="btn btn-secondary" onClick={() => setSettings(true)} style={{ flexShrink: 0 }}>Einrichten</button>
        </div>
      )}

      <div className="footer"><span>Scan: {fmtDate(data.score.calculated_at)}</span><span>{items} Tickets</span></div>
    </div>
  );
}

// === ISSUE PANEL ===
function IssuePanel() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => { invoke('getIssueQuality').then(setData).catch(console.error).finally(() => setLoading(false)); }, []);
  if (loading) return <div className="loading" style={{ padding: 20 }}><div className="loading-ring" /></div>;
  if (!data?.findings?.length) return <div style={{ padding: 10 }}><span className="sev" style={{ background: 'var(--c-green-subtle)', color: 'var(--c-green)' }}>Keine Probleme</span></div>;
  const s = Math.round(safeNum(data.score)), g = getGrade(s);
  return (
    <div style={{ padding: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <span className={`grade ${g.c}`}>{g.g}</span>
        <span style={{ fontWeight: 650, fontSize: 14 }}>{s}/100</span>
        <span style={{ fontSize: 12, color: 'var(--c-text-tertiary)' }}>{data.findings.length} Probleme</span>
      </div>
      {data.findings.slice(0, 3).map((f, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
          <span className={`sev ${sevCls(f.severity)}`} style={{ fontSize: 10 }}>{sevLabel(f.severity)}</span>
          <span style={{ fontSize: 12 }}>{safe(f.message) || safe(f.check_type)}</span>
        </div>
      ))}
      {data.findings.length > 3 && <div style={{ fontSize: 11, color: 'var(--c-text-tertiary)', marginTop: 4 }}>+{data.findings.length - 3} weitere</div>}
    </div>
  );
}

// === CONFLUENCE ===
function Confluence() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => { invoke('getDashboardData').then(setData).catch(console.error).finally(() => setLoading(false)); }, []);
  if (loading) return <div className="loading"><div className="loading-ring" /><span className="loading-text">Lade Übersicht...</span></div>;
  const scores = data?.scores || [];
  if (!scores.length) return <div className="app"><div className="header"><span className="header-title">Data Quality Guard</span></div><div className="empty"><div className="empty-title">Keine Daten</div><div className="empty-desc">Scans laufen automatisch stündlich.</div></div></div>;
  const avg = Math.round(scores.reduce((a, s) => a + safeNum(s.overall_score), 0) / scores.length);
  const ag = getGrade(avg);
  return (
    <div className="app">
      <div className="header"><span className="header-title">Data Quality Guard — Übersicht</span></div>
      <div className="score-hero">
        <ScoreRing score={avg} />
        <div className="score-details"><h2>Durchschnitt: {ag.g}</h2><p>{scores.length} Projekte, {scores.reduce((a, s) => a + safeNum(s.findings_count), 0)} Probleme</p></div>
      </div>
      <table className="tbl">
        <thead><tr><th>Projekt</th><th>Note</th><th>Aktualität</th><th>Vollständigkeit</th><th>Konsistenz</th><th>Probleme</th></tr></thead>
        <tbody>
          {scores.map((s, i) => { const ss = Math.round(safeNum(s.overall_score)), sg = getGrade(ss); return (
            <tr key={i}><td style={{ fontWeight: 650 }}>{safe(s.project_key)}</td><td><span className={`grade ${sg.c}`}>{sg.g}</span> {ss}</td><td>{Math.round(safeNum(s.staleness_score))}</td><td>{Math.round(safeNum(s.completeness_score))}</td><td>{Math.round(safeNum(s.consistency_score))}</td><td><span className="sev sev-critical">{safeNum(s.findings_count)}</span></td></tr>
          ); })}
        </tbody>
      </table>
    </div>
  );
}

// === ROUTER ===
export default function App() {
  const [ctx, setCtx] = useState(null);
  useEffect(() => { view.getContext().then(setCtx).catch(console.error); }, []);
  if (!ctx) return <div className="loading"><div className="loading-ring" /><span className="loading-text">Laden...</span></div>;
  const mk = safe(ctx.moduleKey);
  if (mk.includes('issue-panel')) return <IssuePanel />;
  if (mk.includes('confluence')) return <Confluence />;
  return <Dashboard />;
}
