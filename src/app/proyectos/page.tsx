import AskBox from "@/components/AskBox";
import Panorama from "@/components/Panorama";

// Forzamos render dinámico (nada de prerender estático): el
// adaptador de Netlify para Next.js sirve las páginas estáticas desde
// un "route cache" propio que se puebla recién en el primer acceso
// después de un deploy — con rutas nuevas como esta, ese primer
// fetch estaba fallando y devolvía 404 aunque el build la compilaba
// bien. Renderizando siempre en el momento evitamos ese caché.
export const dynamic = "force-dynamic";

export default function ProyectosPage() {
  return (
    <>
      <Panorama />
      <AskBox />
    </>
  );
}
