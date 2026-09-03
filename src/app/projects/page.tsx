import { Suspense } from "react";
import ProjectPageContent from "./ProjectPageContent";

export default function ProjectPage() {
  return (
    <Suspense fallback={<p className="text-sm text-slate-500">Cargando...</p>}>
      <ProjectPageContent />
    </Suspense>
  );
}
