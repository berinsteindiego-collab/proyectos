# Project Control — Technical Context

## 1. Current technical status
Airtable connectivity has been validated from the corporate Windows 11 environment using PowerShell and a Personal Access Token with read-only access.

Successful path:
```text
Corporate Windows PC
      ↓
api.airtable.com
      ↓
Authentication
      ↓
PMO Base
      ↓
Eventos
      ↓
Tareas
```

This means the primary feared blocker — corporate network preventing Airtable API reads — was not present during testing.

## 2. Airtable credentials
Known PMO Base ID:

`apppc8tQLwGbF4rPp`

Authentication method for prototype:
- Airtable Personal Access Token (PAT)
- scope: `data.records:read`
- resource access restricted to the required PMO base

**Security rule:** never commit or paste the PAT into source files, Markdown docs, screenshots, chat messages, GitHub or client-side JavaScript.

Recommended environment variable names:

```env
AIRTABLE_TOKEN=...
AIRTABLE_BASE_ID=apppc8tQLwGbF4rPp
```

The token should be stored only in local/server environment variables or the hosting provider's secret manager.

## 3. Connectivity test that succeeded
PowerShell pattern used:

```powershell
$token = Read-Host "Pega tu Airtable Token"

$headers = @{
    Authorization = "Bearer $token"
}

Invoke-RestMethod `
  -Uri "https://api.airtable.com/v0/apppc8tQLwGbF4rPp/Eventos?maxRecords=1" `
  -Headers $headers `
  -Method Get
```

A successful response returned an Airtable record object with a `rec...` ID.

A subsequent test successfully searched an event and retrieved its related tasks.

### Lesson from testing linked records
An initial attempt to filter `Tareas` using the linked event record ID through `ARRAYJOIN({Evento})` returned zero records. Filtering using the linked field's displayed event name worked in the test. Production implementation should avoid relying on undocumented assumptions and should preferably use the linked task IDs available from `Eventos.Tareas` or a tested filter strategy.

## 4. Application architecture
Target architecture:

```text
Browser
   ↓ HTTPS
Project Control Web App
   ├─ UI
   └─ Server/API layer
          ↓
      Airtable API
          ↓
      PMO bases

Later:
Server/API layer
   └─ AI provider
       using constrained read tools
```

The browser must never communicate with Airtable using the PAT directly.

## 5. Suggested stack
Initial implementation direction:
- Next.js
- TypeScript
- React
- Tailwind CSS
- server-side Airtable REST calls
- Git repository, preferably private
- web hosting capable of server-side execution and secret environment variables

The exact hosting provider is not a permanent architectural decision. A prototype may use an approved cloud host; a corporate rollout may move to company-approved infrastructure.

## 6. Development environment
If developing locally on Windows:
- Node.js LTS
- Visual Studio Code

End users do **not** need either tool. Once deployed, they access Project Control through a browser URL.

If corporate installation permissions are unavailable, development can occur on another authorized machine or browser-based development environment; the deployed app remains browser-accessible.

## 7. Suggested repository layout
```text
project-control/
├─ docs/
│  ├─ PROJECT_CONTEXT.md
│  ├─ AIRTABLE_SCHEMA.md
│  ├─ TECHNICAL_CONTEXT.md
│  └─ airtable-scripts/
├─ src/
│  ├─ app/
│  │  ├─ page.tsx
│  │  ├─ projects/
│  │  └─ api/
│  └─ lib/
│     ├─ airtable/
│     │  ├─ client.ts
│     │  ├─ projects.ts
│     │  └─ tasks.ts
│     └─ project-status/
│        ├─ normalize.ts
│        └─ types.ts
├─ .env.local
├─ .env.example
├─ .gitignore
└─ package.json
```

## 8. Phase 1 implementation target
First real function:

```ts
getProjectStatus(projectName: string)
```

Responsibilities:
1. Find project in `Eventos` by `Nombre Evento`.
2. Read project-level status fields.
3. Resolve linked `Tareas`.
4. Normalize task fields.
5. Sort pending tasks/deadlines.
6. Return a stable application object.

It should not call an AI model.

Suggested output:

```ts
interface ProjectStatus {
  project: {
    id: string;
    name: string;
    category?: string;
    format?: string;
    region?: string;
    startDate?: string;
    endDate?: string;
    status?: string;
    readiness?: number;
    daysToLaunch?: number;
  };
  summary: {
    totalTasks: number;
    completedTasks: number;
    pendingTasks: number;
    openBlockers?: number;
    overdueBlockers?: number;
  };
  tasks: ProjectTask[];
}
```

## 9. Airtable client requirements
The Airtable reader should:
- execute server-side only;
- use environment variables;
- URL-encode table names/formulas/parameters;
- handle Airtable pagination (`offset`) rather than assuming one page;
- distinguish 401/403/404/network failures;
- avoid logging secrets;
- keep Airtable field names in a centralized mapping rather than scattering string literals through UI components.

Suggested mapping pattern:

```ts
export const EVENT_FIELDS = {
  name: "Nombre Evento",
  category: "Categoría",
  format: "Formato",
  startDate: "Fecha Inicio",
  endDate: "Fecha Fin",
  status: "Estado General",
  readiness: "Launch Readiness",
  daysToLaunch: "Días para lanzamiento",
  totalTasks: "Total Tasks",
  completedTasks: "Completed Tasks",
  region: "Región",
  tasks: "Tareas",
} as const;
```

Do the same for `Tareas`.

## 10. First UI milestone
Do not begin with AI chat.

Build:
1. Project search/select.
2. Project Brief card.
3. Pending task table.
4. Blocked/overdue indicators.
5. Upcoming deadlines.

Acceptance test:
> Selecting `La granja vip 2: México` returns the same status/readiness/task information visible in Airtable at that moment.

No values should be hard-coded from this handoff document.

## 11. AI integration — later
Once Phase 1 is stable, expose constrained server-side functions to the model, e.g.:

```text
get_project_status
get_pending_tasks
get_blocked_tasks
get_project_deadlines
```

The model should receive only the data required to answer the user's question. It should not receive the Airtable PAT and should not construct arbitrary authenticated Airtable requests.

System behavior should explicitly say:
- Airtable is source of truth.
- Do not invent missing project facts.
- Distinguish factual Airtable state from interpretation.
- Preserve exact task status names.
- V1 is read-only.

## 12. Hosting / sharing
Project Control is intended to be a web app so colleagues can use it without installing development software.

Hosting requirements:
- server-side runtime for API calls;
- HTTPS;
- environment/secrets support;
- ability to keep source repository private;
- ideally authentication/access control before broader internal sharing;
- provider must be acceptable under company security/data policies.

A hosting provider is an implementation choice, not a permanent dependency. Do not expose the Airtable token in a static-only deployment.

## 13. Security / corporate considerations
Before sharing broadly:
- confirm the hosting provider is permitted for company data;
- use least-privilege Airtable scopes;
- keep V1 read-only;
- add application authentication before exposing internal project data beyond the intended group;
- rotate any credential that has appeared in a screenshot/chat;
- keep `.env.local` in `.gitignore`;
- provide `.env.example` with variable names only, never values.

## 14. Immediate next steps
1. Create private repository/project.
2. Add these context documents under `/docs`.
3. Create Next.js/TypeScript app.
4. Add server-side Airtable client.
5. Add centralized Airtable field mappings.
6. Implement `getProjectStatus()`.
7. Validate against one known project.
8. Build Project Brief UI.
9. Only then add AI read assistant.
10. Later connect Feeds and Standalones through separate adapters.
