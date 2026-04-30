import { MagicLottoComponent } from '@/components/MagicLottoComponent';

export default function GeneratePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-cyan-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-800 mb-2">
            ⚡ MagicLotto Generator
          </h1>
          <p className="text-gray-600">
            Genera giocate intelligenti basate su algoritmi avanzati di analisi
          </p>
        </div>
        <MagicLottoComponent />
      </div>
    </div>
  );
}
