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

## 7. Feeds monthly usage model
A separate monthly model already exists to measure active 24/7 feed usage by month.

Known structure:

### Main events source
Fields include:
- `Start date`
- `End Date`
- `Premiere Month`
- `End`
- `Q Feeds (24/7)`
- `Status`
- `Type of Event`
- `Region`
- `Usage ID`

### `Months`
Known fields:
- `Month` — date
- `Year`
- `Month Number`

### Automation behavior
When an event record is created/updated, a script creates/updates monthly usage rows for every month between Start and End, carrying the number of 24/7 feeds. This allows monthly capacity reporting without manually maintaining month columns each year.

The model was specifically designed so an event spanning multiple months can be represented correctly for monthly usage and can later support an annual view without naïvely treating six active months as six separate events.

Known prior automation input convention:
- input variable named `Record ID`
- script receives the triggering event record ID

## 8. Standalone events monthly model
Tables:
- `Events (Standalones)`
- `Monthly Standalones Events`

Purpose: reusable year-over-year monthly standalone event tracking without creating a new column for each month/year.

Conceptual source fields include start/end date and standalone event quantity; the monthly table contains generated records for the months covered by each source event.

Existing automation behavior:
- Trigger on source event creation/update.
- Generate/update one monthly usage record per applicable month between event start and end.
- Monthly interface can sum `Q Events` by month.
- Annual view can then aggregate the monthly model appropriately.

Exact live field labels for this module should be copied from Airtable before implementing its adapter; this module is not required for Project Control Phase 1.

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
