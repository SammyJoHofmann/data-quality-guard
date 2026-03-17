# Data Quality Guard -- Investor Briefing

**Hoffmann Digital Solutions (HDS)**
**Stand: 17. März 2026**
**Klassifikation: Vertraulich**

---

> Dieses Dokument ist eine kritische, ehrliche Analyse. Es ist kein Sales-Pitch.
> Alle Zahlen sind mit Quellen belegt oder als Schätzung gekennzeichnet.

---

## 1. Executive Summary

Data Quality Guard ist eine Atlassian Forge App, die Jira-Tickets und Confluence-Seiten automatisch auf inhaltliche Qualität prüft -- inklusive KI-gestützter Widerspruchserkennung zwischen beiden Systemen. Die Zielgruppe sind IT-Teams und Projektleiter in Unternehmen mit 50-10.000 Mitarbeitern, die Atlassian Cloud nutzen. Der Zeitpunkt ist günstig, weil Atlassian die erzwungene Cloud-Migration bis 2029 durchsetzt, das Forge-Ökosystem 0% Revenue Share bietet und kein bestehendes Marketplace-Produkt KI-gestützte Cross-Referenz-Analyse zwischen Jira und Confluence anbietet.

---

## 2. Das Problem

### Kosten schlechter Datenqualität

Unternehmen verlieren durchschnittlich **$12,9 Millionen pro Jahr** durch mangelhafte Datenqualität. Gartner beziffert die Bandbreite auf $12,9-15 Mio. jährlich für mittelgrosse bis grosse Unternehmen.

> Quelle: Gartner, "How to Improve Your Data Quality" (2024). Die Zahl stammt ursprünglich aus der Gartner Data Quality Market Survey und wird branchenweit zitiert.

### Atlassian-Marktdurchdringung

- **80%+ der Fortune 500** nutzen Atlassian-Produkte (Quelle: Atlassian/BusinessWire Pressemitteilungen)
- **300.000+ Kunden** weltweit (Quelle: Atlassian FY2024 Annual Report)
- Erzwungene **Cloud-Migration bis Februar 2029** für alle Server- und Data-Center-Kunden

### Das konkrete Problem im Alltag

| Symptom | Auswirkung |
|---------|------------|
| Veraltete Confluence-Seiten | Neü Mitarbeiter folgen falschen Anweisungen |
| Verwaiste Jira-Tickets | Sprint Planning basiert auf veraltetem Backlog |
| Widersprüche zwischen Docs und Tickets | Teams arbeiten mit unterschiedlichen Annahmen |
| Fehlende Pflichtfelder | Reporting und Dashboards liefern unvollständige Daten |
| Tickets von Ex-Mitarbeitern | Wissen geht verloren, niemand fühlt sich zuständig |

**Kernproblem:** Kein einziges Tool am Atlassian Marketplace prüft Jira UND Confluence zusammen auf inhaltliche Qualität und findet Widersprüche zwischen den Systemen.

---

## 3. Die Lösung

### Quality Score A-F mit 4 Kategorien

| Kategorie | Prüft | Ohne KI | Mit KI |
|-----------|--------|---------|--------|
| Completeness | Fehlende Felder, Beschreibungen, Labels | Ja | -- |
| Freshness | Veraltete Tickets/Seiten, Stale Issues | Ja | -- |
| Consistency | Workflow-Anomalien, Cross-Referenzen | Ja | Erweitert |
| Intelligence | Semantische Widersprüche, Duplikate | -- | Ja |

### 7 Analyse-Module (implementiert)

1. **Completeness Analyzer** -- Fehlende Pflichtfelder erkennen
2. **Staleness Analyzer** -- Veraltete Items nach konfigurierbaren Schwellenwerten
3. **Cross-Reference Analyzer** -- Jira <> Confluence Verlinkungen prüfen
4. **Advanced Checks** -- Workflow-Rückschritte, Sprint-Readiness, verwaiste Tickets
5. **Intelligence Module** -- KI-Widerspruchserkennung (Multi-Provider)
6. **Score Calculator** -- Gewichteter Gesamtscore A-F
7. **Confluence Scanner** -- Separate Content-Qualitätsprüfung

### KI-Integration (Multi-Provider)

- **Google Gemini** -- Kostengünstiger Standard (Free Tier verfügbar)
- **Anthropic Claude** -- Premium-Option für höchste Qualität
- **OpenAI GPT** -- Alternative für Unternehmen mit bestehenden OpenAI-Verträgen
- Bring Your Own Key (BYOK) -- Kunden nutzen eigene API-Keys
- **Kritische Anmerkung:** Die KI erkennt semantische Widersprüche, keine faktischen. Die Trefferquote hängt stark von der Qualität und Länge der Texte ab. Kurze Ticket-Beschreibungen liefern weniger zuverlässige Ergebnisse.

### Alleinstellungsmerkmal (USP)

Die Cross-Referenz zwischen Jira und Confluence mit KI-Widerspruchserkennung existiert in keinem anderen Marketplace-Produkt. Beispiel: "Confluence-Seite 'API-Dokumentation' beschreibt Port 8080, aber Ticket KAN-42 dokumentiert die Migration auf Port 3000."

### Weitere Features

- Rovo Agent für natürliche Sprach-Abfragen ("Zeige mir veraltete Tickets")
- Custom UI (React-basiert, kein Forge UI Kit -- volle Gestaltungsfreiheit)
- CSV-Export für Audit-Zwecke
- Scheduled Scans (stündlich/täglich)
- Dismiss-Funktion für bewusst akzeptierte Issues
- Schwellenwerte konfigurierbar

---

## 4. Technische Architektur

### Plattform: Atlassian Forge

| Eigenschaft | Detail |
|-------------|--------|
| Runtime | Node.js 22.x (Serverless, Forge-managed) |
| Hosting | Atlassian-Infrastruktur (kein eigener Server nötig) |
| Compliance | SOC 2, ISO 27001 automatisch geerbt von Atlassian |
| Revenue Share | **0% bis $1 Mio. Umsatz** (Forge-Vorteil gegenüber Connect) |
| Datenresidenz | Daten bleiben in Atlassians Cloud -- kein externer Datentransfer ausser an KI-APIs |

### Codebase (verifizierte Zahlen)

| Metrik | Wert |
|--------|------|
| TypeScript Source Files | 26 Dateien |
| Codezeilen (exkl. Tests) | ~3.500 Zeilen |
| Unit Tests | 71 Test Cases |
| Git Commits | 32 (19 Feature-Versionen) |
| Custom UI | React 18 + Forge Bridge |

### Architektur-Überblick

```
                     +-------------------+
                     | Custom UI (React) |
                     +--------+----------+
                              |
                     +--------v----------+
                     |  Forge Resolvers  |
                     |  (Jira/Confluence)|
                     +--------+----------+
                              |
              +---------------+---------------+
              |               |               |
     +--------v---+  +-------v------+  +-----v--------+
     | Analyzers  |  | Scanner      |  | Intelligence |
     | (7 Module) |  | (Jira+Conf.) |  | (LLM Client) |
     +--------+---+  +-------+------+  +-----+--------+
              |               |               |
     +--------v---------------v---------------v--------+
     |              Forge SQL (MySQL)                   |
     |        + Forge Secret Storage (API Keys)         |
     +--------------------------------------------------+
```

### Sicherheit

- API-Keys in **Forge Secret Storage** (verschlüsselt, nicht im Code)
- Rate-Limiting auf KI-API-Aufrufe
- Scan-Lock (verhindert parallele Scans desselben Projekts)
- Nur Lese-Berechtigungen auf Jira/Confluence (keine Schreibzugriffe)
- Content Security Policy mit `unsafe-inline` für Styles (Forge-Anforderung)

### Kritische technische Einschränkungen

- **Forge Cold Starts**: Serverless-Funktionen haben 1-3 Sekunden Cold Start Latency
- **Timeout-Limit**: Maximale Ausführungszeit pro Funktion: 900 Sekunden (15 Minuten)
- **Forge SQL**: MySQL-kompatibel, aber mit Einschränkungen (keine komplexen JOINs über mehrere Tabellen)
- **Kein Echtzeit-Sync**: Scans laufen periodisch (stündlich/täglich), nicht bei jedem Ticket-Update
- **KI-Token-Limits**: Bei grossen Confluence-Seiten (>10.000 Wörter) muss der Content gekürzt werden

---

## 5. Marktanalyse

### Atlassian Marketplace

| Metrik | Wert | Quelle |
|--------|------|--------|
| Marketplace-Umsatz gesamt | **>$2 Mrd.** (2024) | Atlassian FY2024 Earnings |
| Anzahl Marketplace-Apps | ~6.000 | Atlassian Marketplace |
| Cloud-Migrationsdeadline | Februar 2029 | Atlassian Ankündigung 2024 |
| Atlassian-Kunden gesamt | 300.000+ | Atlassian FY2024 Annual Report |

### Preismodell (Empfehlung)

| Tier | Preis | Zielgruppe |
|------|-------|------------|
| Free | $0 (1-10 User) | Kleine Teams, Trial |
| Standard | $2,50-5/User/Monat | Mittelstand, 11-100 User |
| Premium | $8-12/User/Monat | Enterprise, KI-Features, Custom Rules, Rovo Agent |

### Umsatz-Prognose (KONSERVATIV)

**Diese Zahlen sind Schätzungen basierend auf vergleichbaren Marketplace-Apps. Es gibt keine validierten Kundenannahmen.**

| Zeitraum | Szenario Pessimistisch | Szenario Realistisch | Szenario Optimistisch |
|----------|----------------------|--------------------|--------------------|
| Jahr 1 | $50K ARR | $150K ARR | $300K ARR |
| Jahr 2 | $200K ARR | $800K ARR | $1,5M ARR |
| Jahr 3 | $500K ARR | $1,5M ARR | $3M ARR |

**Annahmen für "Realistisch" (Jahr 1):**
- 500 Free-Installs, 50 Paid-Conversions
- Durchschnittspreis $250/Monat ($3.000/Jahr)
- Conversion Rate Free->Paid: 10% (Marketplace-Durchschnitt liegt bei 5-15%)

**Ehrliche Einschätzung:** Jahr-1-Umsatz von >$100K erfordert aktives Marketing und mindestens einen Enterprise-Pilotkunden. Ohne beides ist $50K realistischer.

---

## 6. Wettbewerbsanalyse

### Direkte Wettbewerber am Atlassian Marketplace

| App | Installs | KI | Confluence | Cross-Referenz | Preis |
|-----|----------|----|-----------:|:-------------:|-------|
| **Project Health Monitor** | 1.344 | Nein | Nein | Nein | Paid |
| **Optimizer for Jira** | 1.265 | Nein | Nein | Nein | Paid |
| **Keep it up to date** | 213 | Nein | Nur Confluence | Nein | Kostenlos |
| **Data Quality Guard** | 0 (neu) | **Ja** | **Ja** | **Ja** | Freemium |

### Analyse der Wettbewerbsposition

**Stärken gegenüber Wettbewerb:**
- Einzige App mit KI-Widerspruchserkennung
- Einzige App mit Jira + Confluence Cross-Referenz
- Multi-Provider KI (kein Vendor Lock-in)
- Rovo Agent (Conversational Interface)

**Schwächen gegenüber Wettbewerb:**
- 0 Installs, 0 Reviews, 0 Track Record
- Wettbewerber haben jahrelange Marketplace-Präsenz und Vertraünsvorsprung
- "Project Health Monitor" mit 1.344 Installs hat etabliertes Kunden-Feedback und Feature-Roadmap
- Kein Enterprise-Referenzkunde

**Kritische Frage:** Warum haben die bestehenden Apps KEINE KI integriert? Mögliche Antworten:
1. KI-Integration in Forge ist technisch komplex (externe API-Aufrufe, Token-Management)
2. Der Markt hat noch keinen starken Demand-Signal für KI-Quality-Checks gezeigt
3. Die bestehenden Apps sind profitabel ohne KI -- kein Anreiz zur Erweiterung

Punkt 2 ist ein echtes Risiko. Es könnte sein, dass der Markt für KI-gestützte Datenqualität in Atlassian kleiner ist als angenommen.

---

## 7. Go-to-Market Strategie

### Phase 1: Marketplace-Launch (Monat 1-3)

- Marketplace-Listing mit Free Tier (1-10 User)
- Marketplace-Review-Prozess durchlaufen (**Daür: 2-8 Wochen, nicht planbar**)
- Organisches Wachstum durch Marketplace-Suche
- Community-Posts in Atlassian Community, Reddit r/jira, LinkedIn

**Realistisch:** Phase 1 liefert 50-200 Free-Installs. Paid Conversion wird minimal sein.

### Phase 2: Partner-Vertrieb (Monat 3-6)

- **Seibert Group** als Vertriebspartner
  - Atlassian Platinum Solution Partner
  - 500+ Mitarbeiter
  - Zugang zu Enterprise-Kunden: Bosch, Siemens, T-Mobile, etc.
  - Bestehender Kontakt über Abde (Projekt-Auftraggeber)
- Co-Marketing mit Seibert Group (Webinare, Case Studies)

**Kritische Anmerkung:** Eine Partnerschaft mit Seibert Group ist besprochen, aber NICHT vertraglich fixiert. Die tatsächliche Vertriebsunterstützung hängt von der App-Qualität und dem Pilotergebnis ab.

### Phase 3: Enterprise Tier (Monat 6-12)

- Custom Rules Engine für unternehmensspezifische Qualitätsregeln
- Rovo Agent mit erweiterten Aktionen
- Compliance-Reporting (ISO, DSGVO Audit-Trails)
- Dedicated Support

**Abhängigkeit:** Phase 3 ist nur sinnvoll, wenn Phase 1 und 2 mindestens 10 zahlende Kunden generieren.

---

## 8. Team

### Aktuelles Team

| Rolle | Person | Anmerkung |
|-------|--------|-----------|
| Gründerin / Product Owner | Sammy-Jo Hoffmann | Hoffmann Digital Solutions |
| Technische Umsetzung | KI-gestütztes Development (Claude Code) | Kein dedizierter Entwickler |

### Ehrliche Einschätzung zur Team-Situation

Das Produkt wurde zu >90% mit KI-gestütztem Development (Claude Code / Anthropic) entwickelt. Das hat Vorteile (Geschwindigkeit, Kosten) und Nachteile:

**Vorteile:**
- Extrem schnelle Entwicklung (19 Versionen in wenigen Wochen)
- Niedrige Entwicklungskosten (kein Vollzeit-Entwickler-Gehalt)
- Reproduzierbare Code-Qualität

**Risiken:**
- Kein dedizierter Senior-Entwickler für Debugging komplexer Forge-Probleme
- Bus Factor = 1 (alles hängt an einer Person)
- Enterprise-Kunden erwarten ein Team, keinen Solo-Founder mit KI
- Code Reviews finden nicht durch einen zweiten Menschen statt

**Was fehlt:**
- Mindestens 1 Vollzeit-Entwickler mit Atlassian Forge-Erfahrung
- 1 Person für Sales/Customer Success (Marketplace ist kein Self-Service für Enterprise)

---

## 9. Finanzierung und Use of Funds

### Aktueller Stand

| Position | Kosten |
|----------|--------|
| Bisherige Investition | $0 extern (Bootstrapped) |
| KI-API-Kosten (Entwicklung) | ~$50 gesamt (Claude Code) |
| Forge-Hosting | $0 (Atlassian übernimmt) |
| Laufende KI-Kosten (Betrieb) | ~$7/Monat bei 10.000 Checks (Gemini Free/Flash) |

### Kostenstruktur im Betrieb

| Nutzer-Stufe | KI-Kosten/Monat | Marge bei $5/User |
|-------------|----------------|-------------------|
| 100 User, 1.000 Checks | ~$0,70 | >98% |
| 1.000 User, 10.000 Checks | ~$7 | >98% |
| 10.000 User, 100.000 Checks | ~$70 | >98% |
| 100.000 User, 1 Mio. Checks | ~$700 | ~98% |

**Anmerkung:** Kunden nutzen eigene API-Keys (BYOK). Die KI-Kosten trägt der Kunde, nicht HDS. Das ist ein Skalierungsvorteil, aber auch ein Adoptions-Hindernis: Kunden müssen sich selbst KI-API-Keys besorgen.

### Use of Funds (bei Seed-Investition)

| Position | Betrag | Zweck |
|----------|--------|-------|
| Vollzeit-Entwickler (12 Monate) | EUR 60-80K | Forge-Expertise, Bug-Fixes, Enterprise Features |
| Marketing / Marketplace | EUR 15-20K | Ads, Webinare, Content, Community |
| Enterprise Support / CSM | EUR 30-40K | Dedizierter Ansprechpartner für Pilotkunden |
| Infrastruktur / Tools | EUR 5K | Monitoring, Testing, CI/CD |
| **Gesamt** | **EUR 110-145K** | |

---

## 10. Risiken

### Hohe Risiken (wahrscheinlich, starker Impact)

| # | Risiko | Eintrittswahrscheinlichkeit | Impact | Mitigation |
|---|--------|---------------------------|--------|------------|
| R1 | **Atlassian baut native Qualitäts-Features** (Rovo AI analysiert Datenqualität nativ) | Mittel-Hoch | Existenzbedrohend | First-Mover-Vorteil nutzen, Community aufbaün, bevor Atlassian reagiert. Realistisch: Atlassian fokussiert sich auf horizontale KI-Features, nicht auf Nischen-Qualitätsprüfung. Aber Rovo wird stärker. |
| R2 | **Kein Enterprise-Pilotkunde** nach 6 Monaten | Mittel | Hoch | Seibert Group frühzeitig einbinden, Free Tier aggressiv vermarkten |
| R3 | **Marketplace-Review daürt 4-8 Wochen** und blockiert Launch | Hoch | Mittel | Früh einreichen, Dokumentation perfektionieren |
| R4 | **KI-Ergebnisse sind zu ungenau** für Enterprise | Mittel | Hoch | Confidence Scores anzeigen, Halluzinationen klar markieren, Fallback auf regelbasierte Checks |

### Mittlere Risiken (möglich, moderater Impact)

| # | Risiko | Detail |
|---|--------|--------|
| R5 | **Performance bei 50.000+ Tickets** | Nicht getestet. Forge hat 15-Minuten-Timeout. Batching nötig. |
| R6 | **BYOK-Modell schreckt Kunden ab** | Enterprise-Kunden wollen keine eigenen API-Keys verwalten. Alternative: HDS-managed KI-Keys gegen Aufpreis. |
| R7 | **Bus Factor = 1** | Alles hängt an einer Person. Kritischer Infrastruktur-Risiko. |
| R8 | **Forge-Plattform-Änderungen** | Atlassian kann Forge-APIs ändern/deprecaten. Dependency auf Atlassians Roadmap. |

### Niedrige Risiken (unwahrscheinlich, aber erwähnenswert)

| # | Risiko | Detail |
|---|--------|--------|
| R9 | Datenschutz-Bedenken (DSGVO) | Daten werden an externe KI-APIs gesendet. Muss in Privacy Policy klar kommuniziert werden. |
| R10 | Wettbewerber kopiert KI-Feature | Technisch möglich, aber Atlassian-Forge-KI-Integration ist komplex. Zeitvorsprung: 6-12 Monate. |

---

## 11. Warum JETZT?

### Zeitfenster-Argumente

**1. Forge 0% Revenue Share**
Atlassian erhebt für Forge-Apps 0% Revenue Share bis $1 Mio. Umsatz (danach 15%). Connect-Apps zahlen sofort 15-25%. Dieses Fenster existiert, um Entwickler zu Forge zu migrieren. Es kann jederzeit geschlossen werden.

> Quelle: Atlassian Developer Documentation, "Forge vs. Connect" (2025)

**2. Erzwungene Cloud-Migration (Deadline: Februar 2029)**
Alle Atlassian Server- und Data Center-Kunden MUESSEN zur Cloud migrieren. Das bedeutet:
- Tausende Enterprise-Kunden kommen neu in den Cloud-Marketplace
- Diese Kunden suchen Cloud-native Tools für ihre Workflows
- Server-Apps müssen neu entwickelt oder migriert werden -- Legacy-Wettbewerber verlieren Vorsprung

**3. Rovo/MCP-Ökosystem wächst**
Atlassian investiert massiv in Rovo (KI-Agent-Plattform). Data Quality Guard ist einer der ersten Rovo-Agents am Marketplace. Early Adopter-Vorteil.

**4. Seibert Group als Partner-Zugang**
Der Kontakt zur Seibert Group (Platinum Atlassian Partner, 500+ Mitarbeiter) existiert über das laufende Projekt. Dieses Zeitfenster ist persönlich und projektgebunden.

### Gegen-Argumente (ehrlich)

- Das "Zeitfenster" könnte auch bedeuten, dass der Markt noch nicht reif ist
- Rovo ist noch in der Frühphase -- Kunden nutzen es kaum aktiv
- Die Cloud-Migration zwingt Kunden zur Cloud, aber nicht zu neün Apps
- Ohne validierten Product-Market-Fit ist "jetzt investieren" ein Risiko, kein Argument

---

## 12. Zusammenfassung für Investoren

### Was existiert (verifiziert)

- Funktionsfähige Forge-App mit 3.500 Zeilen TypeScript
- 7 Analyse-Module, 71 Unit Tests, 19 Feature-Versionen
- Multi-Provider KI-Integration (Gemini, Claude, OpenAI)
- Custom UI (React), Rovo Agent, Scheduled Scans
- Marketplace-Listing vorbereitet (noch nicht eingereicht)
- Privacy Policy, DSGVO-Hinweise

### Was NICHT existiert (ehrlich)

- Kein einziger zahlender Kunde
- Kein Marketplace-Listing (Review steht aus)
- Kein validierter Product-Market-Fit
- Kein Enterprise-Pilotprojekt
- Kein dediziertes Entwicklerteam
- Keine Performance-Tests mit realen Enterprise-Datenmengen
- Kein Sales-Prozess oder Sales-Pipeline

### Investment-These

Data Quality Guard adressiert ein reales, messbares Problem ($12,9 Mio./Jahr Verlust durch schlechte Datenqualität) in einem wachsenden Markt (Atlassian Cloud, $2 Mrd.+ Marketplace) mit einem technisch differenzierten Produkt (einzige KI-Cross-Referenz). Die grössten Risiken sind der fehlende Product-Market-Fit-Nachweis und das Ein-Personen-Team. Eine Seed-Investition von EUR 110-145K würde diese beiden Lücken schliessen: ein Entwickler für technische Stabilität und Marketing/Sales für die ersten Enterprise-Kunden.

---

## Quellen

| Claim | Quelle |
|-------|--------|
| $12,9 Mio. jährlicher Verlust durch schlechte Datenqualität | Gartner, "How to Improve Your Data Quality" (2024) |
| 80%+ der Fortune 500 nutzen Atlassian | BusinessWire / Atlassian Pressemitteilungen |
| 300.000+ Atlassian-Kunden | Atlassian FY2024 Annual Report |
| Marketplace >$2 Mrd. Umsatz | Atlassian FY2024 Earnings Call |
| Forge 0% Revenue Share bis $1 Mio. | Atlassian Developer Documentation (2025) |
| Cloud-Migration Deadline Februar 2029 | Atlassian Official Announcement (2024) |
| Wettbewerber-Install-Zahlen | Atlassian Marketplace, abgerufen März 2026 |
| Codebase-Metriken (3.500 Zeilen, 71 Tests) | Git Repository, verifiziert 17.03.2026 |
| KI-Kosten (~$7/10.000 Checks) | Google Gemini Pricing Page (2026) |

---

## Kontakt

**Hoffmann Digital Solutions**
Sammy-Jo Hoffmann
E-Mail: sh@hoffmanndigitalsolutions.de
GitHub: https://github.com/SammyJoHofmann/data-quality-guard

---

*Erstellt am 17.03.2026. Dieses Dokument enthält Zukunftsprognosen und Schätzungen, die mit Unsicherheit behaftet sind. Alle Marktdaten wurden nach bestem Wissen recherchiert, können aber veraltet oder ungenau sein.*
