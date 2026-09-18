// Forzamos render dinámico (nada de prerender estático). Ver el mismo
// comentario en src/app/qc/layout.tsx: es la mitigación que dejamos puesta
// para el bug de rutas nuevas 404 en producción de Netlify — parece
// resuelto (probado con curl), pero no cuesta nada dejarla.
export const dynamic = "force-dynamic";

export default function ConvivaLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
