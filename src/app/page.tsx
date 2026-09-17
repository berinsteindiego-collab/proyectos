import { redirect } from "next/navigation";

// El QC Center pasa a ser lo primero que se ve al entrar al sitio.
// "Proyectos" sigue existiendo, ahora en /proyectos (ver nav en
// layout.tsx).
export default function HomePage() {
  redirect("/qc");
}
