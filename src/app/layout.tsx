import type { Metadata } from "next";
import "./globals.css";
import ThemeToggle from "@/components/ThemeToggle";

export const metadata: Metadata = {
  title: "Project Control",
  description: "Read-only view of PMO project status, backed by Airtable.",
};

const THEME_INIT_SCRIPT = `
(function () {
  try {
    var saved = localStorage.getItem("pc-theme");
    var dark = saved ? saved === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches;
    if (dark) document.documentElement.classList.add("dark");
  } catch (e) {}
})();
`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>

      <body>
        <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/80 backdrop-blur dark:border-slate-800 dark:bg-slate-950/80">
          <div className="mx-auto flex max-w-3xl items-center gap-2 px-6 py-4">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-sm font-bold text-white">
              PC
            </span>

            <a
              href="/"
              className="text-lg font-semibold text-slate-900 dark:text-slate-100"
            >
              Project Control
            </a>

            <span className="ml-1 text-xs text-slate-400 dark:text-slate-500">
              PMO
            </span>

            <nav className="ml-6 flex items-center gap-1 rounded-lg bg-slate-100 p-1 text-sm dark:bg-slate-800">
              <a
                href="/"
                className="rounded-md px-3 py-1.5 font-medium text-slate-700 transition hover:bg-white hover:text-indigo-600 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-indigo-400"
              >
                Proyectos
              </a>

              <a
                href="/qc"
                className="rounded-md px-3 py-1.5 font-medium text-slate-700 transition hover:bg-white hover:text-indigo-600 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-indigo-400"
              >
                QC
              </a>
            </nav>

            <ThemeToggle />
          </div>
        </header>

        <main className="mx-auto flex min-h-[calc(100vh-4.5rem)] max-w-3xl flex-col px-6 py-8">
          {children}
        </main>
      </body>
    </html>
  );
}