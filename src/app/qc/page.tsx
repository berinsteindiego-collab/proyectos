export default function QCPage() {
  return (
    <div className="py-10">
      <div className="text-center">
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
          Disney+ QC
        </h1>

        <p className="mx-auto mt-2 max-w-md text-sm text-slate-500 dark:text-slate-400">
          Consultá información de QC de películas, series y episodios.
        </p>
      </div>

      <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <textarea
          rows={2}
          placeholder='Ej: "Decime los subtítulos y doblajes del episodio 7 de la temporada 3 de El encargado"'
          className="w-full resize-none bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400 dark:text-slate-100"
        />

        <div className="mt-3 flex justify-end">
          <button
            disabled
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white opacity-50"
          >
            Consultar
          </button>
        </div>
      </div>

      <p className="mt-3 text-center text-xs text-slate-400">
        Entorno local de prueba · QC todavía no conectado
      </p>
    </div>
  );
}