# Project Control — Airtable Schema & Operational Logic

> This document captures the Airtable structure known at handoff time. Field labels should be treated as case/spacing-sensitive when implementing API mappings. Before production implementation, compare this document against the live Airtable schema and update mappings if a label has changed.

## 1. PMO base
Known Base ID:

`apppc8tQLwGbF4rPp`

This identifier is not an authentication secret. **Never store the Personal Access Token in this document or in source control.**

Primary tables:
- `Eventos`
- `Tareas`
- `Templates`

## 2. `Eventos`
Purpose: one record per event/project. Holds high-level event data plus rollups/formulas summarizing task execution.

Known fields visible/used in the current implementation:

| Field | Role in Project Control V1 |
|---|---|
| `Nombre Evento` | Project/event display name and primary search key |
| `Categoría` | Event category, e.g. Reality / Canal |
| `Formato` | Format, e.g. Standalone / 24/7 / Standalone + 24/7 |
| `Fecha Inicio` | Launch/start date |
| `Fecha Fin` | End date |
| `Estado` | Event-level status if populated/used |
| `Descripción` | Context/description; can later be passed to AI |
| `Tareas` | Linked records to `Tareas` |
| `Total Tasks` | Total task count |
| `Completed Tasks` | Completed task count |
| `Launch Readiness` | Existing Airtable readiness calculation; source of truth |
| `Estado General` | Existing overall project health/status; source of truth |
| `Días para lanzamiento` | Existing launch countdown formula |
| blocker summary field(s) | Count of blockers/open blockers; exact live label should be verified |
| `Bloqueante Vencidos` | Existing overdue-blocker summary; exact grammar/spelling should be verified against live base |
| `Región` | Region/territory grouping |
| `Link metadata` | Reference link; not required in V1 status answers |
| `Link imagen` | Reference link; not required in V1 status answers |
| `Link BI` | Reference link; not required in V1 status answers |
| `Radar ID` | Existing identifier from earlier PMO design; not currently central to V1 |

### Important rule
Do not independently calculate `Launch Readiness`, `Estado General`, blocker summaries or `Días para lanzamiento` in the web app when Airtable already supplies them. Read and expose the Airtable values.

## 3. `Tareas`
Purpose: operational tasks generated/managed for each event.

Known fields:

| Field | Meaning / V1 usage |
|---|---|
| `Item` | Task name |
| `Evento` | Linked event/project |
| `Estado` | Task status |
| `Deadline` | Task deadline |
| `Bloqueante` | Whether task is considered blocking/critical |
| `Prioridad` | Priority |
| `Comentarios` | Operational comments/context |
| `Días Restantes` | Existing date/countdown formula |
| `Semáforo` | Existing visual deadline/status indicator |
| `Riesgo` | Existing risk formula/status |
| `Depende de` | Task dependency link |
| `Bloqueante Abierto` | Existing blocker-open flag/formula |
| `Bloqueante Vencido` | Existing overdue-blocker flag/formula |
| `Completada` | Existing completion helper/formula |
| `Responsible` / `Responsable` / `Área Responsable` | Responsible area; retained but not required for V1 responses |
| `Owner` | Individual owner; retained but not required for V1 responses |
| `Detalle` | Additional detail if populated; not required for V1 core |
| `Fecha Completada` | Completion date from earlier design |
| record/autonumber field | Internal row identifier from earlier design |

### Task statuses — DO NOT CHANGE
The current task statuses are:
- `Not Started`
- `In Progress`
- `Waiting`
- `Blocked`
- `Done`
- `Cancelled`
- `Wont do`

These labels are established and should not be renamed by Project Control.

### Pending semantics
For general project status, anything not terminal may be considered pending, but the application should preserve the exact Airtable status. Terminal statuses include at least `Done`, `Cancelled`, and `Wont do`. Any business-specific exceptions should be taken from the live Airtable formulas rather than invented in the app.

## 4. `Templates`
Purpose: reusable task/definition templates used to generate event tasks.

Known fields from the established PMO design:
- `Name`
- `Tipo` — e.g. Tarea / Definición / Información
- `Aplica a`
- `Área Responsable`
- `Offset Días`
- `Bloqueante`
- `Prioridad`
- `Descripción`
- `Depende de Template` — dependency link added later
- lookup of dependency/template `Name`

Known task families include operational items such as:
- Imágenes — solicitar / cargar
- Fake Airing
- Metadata — solicitar / traducir / cargar
- Dashboard BI
- Firma Contrato
- Informar VX
- QC eventos
- Rating
- DAI Set up
- Test DSS
- Creación eventos
- Logo Bug
- Confirmar Simulcast/DAI
- Territory

The template system is already part of Airtable operational logic. Project Control V1 only reads resulting tasks; it does not recreate the template engine.

## 5. Existing PMO automation behavior
The PMO was designed around:

```text
Event created / relevant event data changes
          ↓
Template matching
          ↓
Create/update tasks
          ↓
Deadline offsets / dependencies
          ↓
Task formulas / blocker logic
          ↓
Rollups back to Eventos
```

Known automation/script responsibilities from the existing implementation:
1. On event creation, create tasks from matching `Templates` records using template applicability and deadline offsets.
2. A later update script handles changes to event dates so task deadlines can be updated instead of requiring the event to be recreated.
3. Dependency links are created from template-level dependencies so generated tasks can point to the relevant generated task.
4. Existing records were also considered for backfill/re-run behavior rather than requiring re-creation.

### Important handoff note on scripts
The exact final source text of every historical Airtable automation script is not embedded in this context pack because it was developed iteratively in prior conversations and should not be reconstructed from memory as if byte-identical. Treat the behaviors above as authoritative requirements. When the exact live script is needed, copy it from the Airtable Automation currently running in the base and add it to the repository under `docs/airtable-scripts/`.

## 6. Existing deadline/status logic
Airtable already contains formulas/helpers for:
- days remaining;
- traffic-light / `Semáforo` state;
- risk;
- completion;
- open blockers;
- overdue blockers;
- event-level readiness/overall status.

A previously established deadline workflow also considered pending task states `Not Started`, `In Progress`, and `Waiting` when looking for near-term deadlines. The exact live automation should remain the authority for alerts.

## 7. Feeds Roll Out monthly capacity model
Implemented in the `Proyectos` base (same `apppc8tQLwGbF4rPp` base as `Eventos`/`Tareas`). Measures active 24/7 feed usage by month — see `src/lib/airtable/feeds.ts`.

### `Feeds Roll Out`
One row per project/channel with its active date range and feed count. Fields:
- `Project` (primary)
- `Country`, `Type`, `Status`, `Ad Hoc`, `DAI / Catch up` — single selects
- `Q Feeds (24/7)` — number
- `Start Date`, `End Date` — date
- `Feeds Roll Out - Monthly Usage` — link (generated junction, below)

### `Feeds Roll Out - Monthly Usage`
One row per project × active month (generated/kept in sync by an Airtable automation triggered on Start Date/End Date changes — see `docs/airtable-scripts/`). Fields:
- `Usage ID` (primary), `Month` (date), `Mes (orden)` (single select, chronologically ordered text label e.g. "October 2026")
- `Project Name`, `Country`, `Type`, `Status`, `Ad Hoc` — lookups from `Feeds Roll Out`
- `Feeds` — formula, the `Q Feeds (24/7)` value carried onto this row
- `Mes (link)` — link to `Meses` (below)

### `Meses`
One row per calendar month (Feb 2026 – May 2027). Fields: `Mes` (primary, text label), `Año` (number), `Feeds Roll Out - Monthly Usage` (link), `Total Feeds del Mes` (rollup, `SUM` of linked rows' `Feeds`).

**Important rule**: peak simultaneous capacity for a year is `MAX(Total Feeds del Mes)` across that year's `Meses` rows — never `SUM(Q Feeds (24/7))` across `Feeds Roll Out` directly, which double-counts projects that don't all overlap. This was a real bug found and fixed during Phase 3 implementation (a dashboard number reading 42 instead of the correct ~21).

## 8. Standalones monthly event-count model
Implemented in the `Proyectos` base. Measures standalone event counts by month — see `src/lib/airtable/standalones.ts`. Migrated from the "Latam planning (Standalones)" Excel tab.

### `Standalones Events`
One row per show/project. Fields: `Event Name` (primary), `Type` (single select), `Reference` (single select — content-category legend from the source spreadsheet: Live / Upcoming / Planning / ESPN content), `Year` (number), `Standalones - Monthly Events` (link).

### `Standalones - Monthly Events`
One row per show × active month, generated from the spreadsheet. Fields: `Name` (primary), `Event` (link to `Standalones Events`), `Month` (date), `Events` (number — the real per-month count copied directly from the spreadsheet, not calculated), `Mes (orden)` (single select), plus `Event Name`/`Type`/`Reference` lookups.

**Important rule**: a year's total event count is `SUM(Events)` across that year's rows — this reconciles with the spreadsheet's own yearly TOTAL row (verified: 2026 sums to 991, matching exactly; 2027's own TOTAL cell in the spreadsheet turned out to be a stale cached formula, off by 28 from summing its own monthly columns — the live monthly data, and therefore this sum, is the correct number).

## 9. Relationship rules for API reader
### Project lookup
Search `Eventos` by `Nombre Evento` and retain Airtable `record.id`.

### Task lookup
`Tareas.Evento` is a linked-record field. During the connectivity test, filtering by the event's displayed name worked for retrieving the linked tasks. For production code, prefer a robust strategy such as:
- use the `Tareas` record IDs already linked in `Eventos.Tareas`, then retrieve/resolve those records; or
- use a tested Airtable formula/filter based on the linked field display value.

Avoid assuming that `ARRAYJOIN({Evento})` exposes the linked record ID; the initial PowerShell test using the event record ID returned zero tasks.

## 10. Normalized mapping — Phase 1
Suggested application-side names:

```text
Airtable Eventos              App model
------------------------------------------------
Nombre Evento                 project.name
Categoría                     project.category
Formato                       project.format
Fecha Inicio                  project.startDate
Fecha Fin                     project.endDate
Estado General                project.status
Launch Readiness              project.readiness
Días para lanzamiento         project.daysToLaunch
Total Tasks                   summary.totalTasks
Completed Tasks               summary.completedTasks
blocker summary               summary.openBlockers
Bloqueante Vencidos           summary.overdueBlockers
Región                        project.region

Airtable Tareas               App model
------------------------------------------------
Item                          task.name
Estado                        task.status
Deadline                      task.deadline
Bloqueante                    task.isBlocker
Prioridad                     task.priority
Comentarios                   task.comments
Días Restantes                task.daysRemaining
Riesgo                        task.risk
Depende de                    task.dependsOn
Bloqueante Abierto            task.openBlocker
Bloqueante Vencido            task.overdueBlocker
Completada                    task.completed
```
