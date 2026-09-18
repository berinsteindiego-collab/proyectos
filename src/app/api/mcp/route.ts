import { createMcpHandler } from "mcp-handler";
import { z } from "zod";
import { getConvivaLiveSnapshot } from "@/lib/conviva/client";

// Servidor MCP para que el Artifact de "Pulse Conviva" (hosteado en
// claude.ai) pueda buscar audiencia en vivo sin pasar por fetch() directo:
// el sandbox de los Artifacts bloquea cualquier conexión de red saliente
// que no sea a este mismo origen o a Google Fonts (ver Content-Security-
// Policy del visor), así que un fetch normal a esta app nunca iba a
// funcionar desde adentro del Artifact, tuviera o no CORS bien puesto.
//
// La llamada MCP no pasa por esa restricción: el visor de Claude conecta
// a este endpoint del lado de la extensión/cliente, no desde el iframe
// sandboxeado. CONVIVA_CLIENT_ID/SECRET nunca salen de este handler,
// igual que en /api/live.
const handler = createMcpHandler((server) => {
  server.registerTool(
    "get_conviva_snapshot",
    {
      title: "Audiencia en vivo (Conviva)",
      description:
        "Devuelve la audiencia en vivo de Disney+ para un título, según Conviva: " +
        "concurrentes totales, split en vivo/on-demand, assets que matchearon " +
        "y desglose por título, país y dispositivo.",
      inputSchema: z.object({
        title: z
          .string()
          .min(1)
          .describe("Nombre del contenido a buscar, ej. 'Modern Family'."),
      }),
    },
    async ({ title }) => {
      try {
        const live = await getConvivaLiveSnapshot(title);
        return { content: [{ type: "text", text: JSON.stringify(live) }] };
      } catch (err) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                error: err instanceof Error ? err.message : "No se pudo consultar Conviva.",
              }),
            },
          ],
          isError: true,
        };
      }
    }
  );
});

export { handler as GET, handler as POST, handler as DELETE };
