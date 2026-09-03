# Project Control — Project Context

## 1. Purpose
Project Control is a web application layered on top of existing Airtable operational bases. Airtable remains the source of truth. The application exists to make project status easier to consume through a concise interface and, later, an AI assistant.

The first use case is Content Operations / event launches. The same architecture should later support 24/7 feed capacity and standalone-event usage.

## 2. Core product principle
**Do not replace Airtable.** Airtable continues to own operational records, automations, formulas, deadlines, dependencies and task status. Project Control reads and normalizes those records.

Where Airtable already calculates a value (for example Launch Readiness, Estado General, Días para lanzamiento, blocker flags or risk), the application/AI should use that value rather than independently recomputing it unless explicitly required for validation.

## 3. V1 scope — read only
V1 is intentionally read-only.

The application should answer questions such as:
- How is project X doing?
- What is still pending?
- What is overdue?
- What is blocked?
- What are the next deadlines?
- What does a blocked task depend on?
- Which projects are at risk?
- What is due this week?

V1 should **not**:
- edit Airtable records;
- change task status;
- create tasks;
- assign owners;
- recommend who to contact;
- send messages;
- infer missing operational facts that are not present in Airtable.

Owners/contacts may be added in a later phase. Chat-based editing is a later phase after read-only behavior is trusted.

## 4. Initial modules
### 4.1 Projects
Primary V1 module. Reads the PMO base, initially the `Eventos` and `Tareas` tables.

Expected Project Brief:
- Project name
- Project status / Estado General
- Launch Readiness
- Start date / launch date
- End date
- Category
- Format
- Region
- Total tasks
- Completed tasks
- Pending tasks
- Open blockers
- Overdue blockers
- Next deadline
- Pending/blocked/overdue task list

### 4.2 Feeds
Later module using the existing monthly feed-usage model. Goal: answer capacity questions such as active feeds by month and annual usage without counting one long-running event multiple times incorrectly in annual views.

### 4.3 Standalones
Later module using `Events (Standalones)` and `Monthly Standalones Events` to expose monthly and annual standalone-event volume.

### 4.4 AI / Ask Operations
After the normalized project reader is reliable, add an AI layer. The AI receives normalized data/functions rather than unrestricted direct access to arbitrary Airtable structures.

Example internal tools/functions:
- `getProjectStatus(projectName)`
- `getProjectTasks(projectId)`
- `getPendingTasks(projectId)`
- `getDeadlines(projectId)`
- `getBlockedTasks(projectId)`
- later: `getMonthlyFeeds(month)`
- later: `getMonthlyStandalones(month)`

## 5. Expected AI behavior
Example question:

> How is La Granja VIP 2 doing?

Desired style of response:

> La Granja VIP 2 is in Risk with a 71% Launch Readiness. 22 of 31 tasks are complete. There are 9 pending tasks and 5 blockers. The most urgent pending items are listed below, ordered by deadline.

The exact figures must always come from current Airtable data. Examples in documentation are illustrative, not hard-coded project facts.

If a task is `Blocked` and Airtable contains a dependency, the assistant can explain that relationship. It must not invent a reason for the block if Airtable does not contain one.

## 6. Project-status data flow
```text
Airtable PMO
  ├─ Eventos
  └─ Tareas
       ↓
Airtable read adapter
       ↓
Normalized Project object
       ↓
Project Control UI
       ↓
AI Assistant (later)
```

Target normalized shape:

```json
{
  "project": {
    "id": "rec...",
    "name": "La Granja VIP 2",
    "category": "Reality",
    "format": "Standalone + 24/7",
    "region": "LAS",
    "startDate": "2026-09-06",
    "endDate": null,
    "status": "Risk",
    "readiness": 71,
    "daysToLaunch": 4
  },
  "summary": {
    "totalTasks": 31,
    "completedTasks": 22,
    "pendingTasks": 9,
    "openBlockers": 5,
    "overdueBlockers": 0
  },
  "tasks": [
    {
      "id": "rec...",
      "name": "IMÁGENES | ...",
      "status": "In Progress",
      "deadline": "2026-09-03",
      "priority": "Alta",
      "risk": "...",
      "isBlocker": true,
      "dependsOn": []
    }
  ]
}
```

## 7. Product phases
### Phase 0 — Connectivity validation — COMPLETE
A read-only Airtable Personal Access Token was created and a real API call from the corporate Windows environment successfully read records from the PMO base. A second test successfully retrieved an event and its related tasks. This confirms that `api.airtable.com` is reachable from the environment and that read access works.

### Phase 1 — Project Reader
Build the web application and implement Airtable server-side access. First milestone: search/select a project and render its Project Brief from `Eventos + Tareas`.

### Phase 2 — AI read assistant
Add natural-language questions over the normalized read-only functions.

### Phase 3 — Feeds + Standalones
Connect the existing monthly usage tables as independent data adapters and expose them in the same application/chat.

### Phase 4 — Owners / contacts / recommendations
Optionally include responsible teams/owners and suggested follow-up actions.

### Phase 5 — Controlled write actions
Only after read behavior is trusted, allow the AI to propose changes such as marking a task Done or updating fields. Every write should require explicit confirmation and use separate write scopes/credentials.

## 8. Web-app direction
The product should be a browser-based web app so end users do not need Node.js, Next.js or development tools installed.

Development can happen on any authorized machine. Deployment should expose a URL to authorized users.

Recommended logical architecture:
```text
User browser
    ↓
Project Control web UI
    ↓
Server-side application/API
    ↓
Airtable API
```

Airtable credentials must never be sent to the browser.

## 9. UI concept for V1
### Home / Projects
- Active projects
- At-risk projects
- Projects launching soon
- Search/select project

### Project Brief
- Name
- Estado General
- Launch Readiness
- launch date / days to launch
- total/completed/pending tasks
- blockers
- overdue items
- next deadlines
- detailed pending task list

### Ask Operations — after Phase 1
Natural-language interface backed by the same read functions.

## 10. Key decisions already made
- Airtable remains source of truth.
- V1 is read-only.
- Start with `Eventos + Tareas` only.
- Do not add an `AI / Project Rules` table yet; existing Airtable formulas/templates already encode significant business logic.
- Do not prioritize owner/contact functionality in V1.
- Do not let the AI recompute existing Airtable status/readiness fields by default.
- Feeds and Standalones are later modules, not blockers for the first Project Brief.
- Build as a web app so users only need a browser.
