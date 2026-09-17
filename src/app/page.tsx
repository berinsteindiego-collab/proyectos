import { redirect } from "next/navigation";

// El QC Center pasa a ser lo primero que se ve al entrar al sitio.
// "Proyectos" sigue existiendo, ahora en /proyectos (ver nav en
// layout.tsx).
//
// force-dynamic: esta página cambió de contenido (antes mostraba el
// Panorama, ahora redirige) y el adaptador de Netlify para Next.js
// siguió sirviendo la versión vieja cacheada como página estática.
// Renderizando siempre en el momento evitamos ese caché.
export const dynamic = "force-dynamic";

export default function HomePage() {
  redirect("/qc");
}
