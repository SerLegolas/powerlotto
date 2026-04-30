import Link from "next/link";

export default function NotFoundPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 text-white flex items-center justify-center px-6 py-16">
      <div className="max-w-xl rounded-[32px] border border-white/10 bg-slate-900/95 p-10 shadow-[0_30px_80px_rgba(0,0,0,0.45)]">
        <div className="mb-6 rounded-3xl bg-yellow-500/10 px-4 py-3 text-sm font-semibold text-yellow-200">
          Pagina non trovata
        </div>
        <h1 className="text-4xl font-black tracking-tight text-white mb-4">
          404 - Siamo persi
        </h1>
        <p className="text-sm text-slate-300 leading-7 mb-6">
          La pagina che stai cercando non esiste o è stata rimossa. Torna al cruscotto e riprova.
        </p>
        <Link
          href="/"
          className="inline-flex items-center justify-center rounded-3xl bg-yellow-400 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-yellow-300"
        >
          Torna alla Home
        </Link>
      </div>
    </div>
  );
}
