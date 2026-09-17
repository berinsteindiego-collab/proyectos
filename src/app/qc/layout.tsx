// Forzamos render dinámico para /qc (nada de prerender estático): el
// adaptador de Netlify para Next.js sirve las páginas estáticas desde
// un "route cache" propio que se puebla recién en el primer acceso
// después de un deploy — con rutas nuevas, ese primer fetch estaba
// fallando y devolvía 404 aunque el build la compilaba bien.
// Renderizando siempre en el momento evitamos ese caché. No podemos
// poner este export directo en page.tsx porque ese archivo es "use
// client".
export const dynamic = "force-dynamic";

export default function QcLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
