# Project Control (V1 — Project Reader)

Web app read-only sobre la base de PMO en Airtable (`Eventos` + `Tareas`).
Airtable sigue siendo la fuente de verdad; esta app normaliza y muestra esos
datos. Contexto completo del handoff en `docs/`.

## Requisitos
- Node.js LTS
- Un Airtable Personal Access Token con scope `data.records:read`, acceso
  restringido a la base PMO (`apppc8tQLwGbF4rPp`)
- (Opcional) Una API key gratis de Groq (console.groq.com) para el chat en
  lenguaje natural de `/ask`. Sin ella, `/ask` sigue funcionando con el
  parser de reglas.

## Setup

```bash
npm install
cp .env.example .env.local
# completar AIRTABLE_TOKEN, SITE_PASSWORD y (opcional) GROQ_API_KEY en .env.local
# (nunca commitear ese archivo)
npm run dev
```

Abrir http://localhost:3000. Pide la contraseña configurada en
`SITE_PASSWORD` (ver Seguridad). Buscar un proyecto por nombre completo o
parcial (`/projects`), o preguntarle al asistente en lenguaje natural
(`/ask`).

### Modo mock (sin token)
Si `AIRTABLE_TOKEN` no está configurado, la app sirve datos de ejemplo
(`src/lib/airtable/mock-data.ts`) para poder probar la UI sin conexión real.
Buscar: `La Granja` (trae dos coincidencias, para probar la desambiguación).

## Estructura

```
src/
  middleware.ts              → gate de contraseña compartida (SITE_PASSWORD) para toda la app
  app/
    login/page.tsx            → formulario de login
    page.tsx                  → home / buscador
    projects/page.tsx          → Project Brief + tabla de tareas (con desambiguación)
    ask/page.tsx                → chat con el asistente (preguntas en lenguaje natural)
    api/login/                  → valida SITE_PASSWORD y setea la cookie de sesión
    api/projects/[name]/        → endpoint server-side que llama a Airtable
    api/ask/                    → chat con Groq (si hay GROQ_API_KEY) con fallback a parser de reglas
  components/                   → ProjectSearch, ProjectBrief, TaskTable
  lib/airtable/                  → client.ts (REST), fields.ts (mapeo), projects.ts (incl. búsqueda difusa y "en riesgo"), tasks.ts, mock-data.ts
  lib/project-status/            → types.ts (incl. AmbiguousProjectError), normalize.ts
  lib/ai/tools.ts                 → funciones read-only que usa /api/ask (nunca escriben a Airtable)
  lib/ai/groq.ts                   → loop de function-calling contra la API de Groq, usando esas mismas tools
```

## Estado del roadmap
- **Fase 0 — Conectividad**: validada (ver `docs/TECHNICAL_CONTEXT.md`).
- **Fase 1 — Project Reader**: implementada (buscador difuso, Project Brief,
  tabla de tareas, desambiguación cuando el nombre coincide con más de un
  proyecto).
- **Fase 2 — Chatbot / Ask Operations**: implementada en dos capas. Si hay
  `GROQ_API_KEY` configurada, `/ask` usa un modelo gratuito de Groq
  (`openai/gpt-oss-120b` por defecto, ver `GROQ_MODEL`) con
  function-calling contra las mismas tools read-only de `src/lib/ai/tools.ts`
  — el modelo nunca responde con conocimiento propio, solo con lo que esas
  tools devuelven de Airtable. Si la key no está configurada, o la llamada a
  Groq falla, cae automáticamente al parser de reglas anterior (sin
  proveedor de IA, sin costo): reconoce un set fijo de preguntas frecuentes
  de PMO — "¿cómo está X?", "¿qué falta?", "¿qué está bloqueado?", "¿qué
  está vencido?", "¿próximos deadlines?", "¿qué proyectos están en riesgo?",
  "¿qué eventos vienen?" — y admite nombre de proyecto parcial (ej. "Telefe"
  en vez del nombre completo). Ambos caminos viven en
  `src/app/api/ask/route.ts` (Groq en `src/lib/ai/groq.ts`); las reglas de
  comportamiento (Airtable como fuente de verdad, no inventar datos,
  preguntar cuando hay ambigüedad, preservar los nombres exactos de estado,
  solo lectura) están documentadas en el system prompt de `groq.ts` y en
  `docs/PROJECT_CONTEXT.md` sección 11.
- **Fase 3 — Feeds / Standalones**: no implementada.

## Seguridad
- El PAT de Airtable y la API key de Groq solo viven en variables de entorno
  server-side; nunca se exponen al browser.
- `src/middleware.ts` pide una contraseña compartida (`SITE_PASSWORD`) antes
  de mostrar cualquier página, guardada en una cookie httpOnly. Es un gate
  simple para no dejar la URL abierta a cualquiera — no es autenticación por
  usuario ni protege datos sensibles por sí sola.
- `.env.local` está en `.gitignore`. `.env.example` solo documenta nombres
  de variables.
- La app es de solo lectura: ni el buscador ni el chat (rule-based o Groq)
  pueden escribir en Airtable.

## Próximos pasos sugeridos
1. Cargar `AIRTABLE_TOKEN`, `SITE_PASSWORD` y `GROQ_API_KEY` reales en las
   variables de entorno de hosting (nunca en el repo) y validar contra un
   proyecto conocido.
2. Verificar en la base viva los labels exactos de los campos de "blocker
   summary" y el valor real de "Estado General" para proyectos en riesgo
   (ver nota en `docs/AIRTABLE_SCHEMA.md` sección 2) y ajustar
   `src/lib/airtable/fields.ts` / `isRiskStatus()` si difieren.
3. Si el uso crece más allá de un equipo interno chico, reemplazar el gate
   de contraseña compartida por autenticación real por usuario.
