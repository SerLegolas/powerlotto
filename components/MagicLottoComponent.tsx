'use client';

import { useState } from 'react';

interface MagicLottoResult {
  columns: Array<{
    numbers: number[];
    superstar?: number;
    costo: number;
  }>;
  totalCosto: number;
  shareUrl: string;
  whatsappText: string;
}

const RUOTE = [
  'Nazionale',
  'Bari',
  'Cagliari',
  'Firenze',
  'Genova',
  'Milano',
  'Napoli',
  'Palermo',
  'Roma',
  'Torino',
  'Venezia',
];

const METODI = [
  { value: 'ritardo', label: '⏱️ Numeri in Ritardo', description: 'Numeri che non escono da più tempo' },
  { value: 'frequenza', label: '📊 Numeri Frequenti', description: 'Numeri estratti più spesso' },
  { value: 'equilibrio', label: '⚖️ Equilibrio', description: 'Mix tra ritardo e frequenza (consigliato)' },
];

export function MagicLottoComponent() {
  const [ruota, setRuota] = useState('Nazionale');
  const [colonne, setColonne] = useState(1);
  const [superstar, setSuperstar] = useState(false);
  const [metodo, setMetodo] = useState('equilibrio');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<MagicLottoResult | null>(null);
  const [error, setError] = useState('');

  const handleGenerate = async () => {
    setError('');
    setLoading(true);

    try {
      const token = localStorage.getItem('authToken');
      if (!token) {
        throw new Error('Non autenticato');
      }

      const response = await fetch('/api/magiclotto', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          ruota,
          colonne: parseInt(String(colonne)),
          superstar,
          metodo,
        }),
      });

      if (!response.ok) {
        throw new Error('Errore nella generazione');
      }

      const data = await response.json();
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore sconosciuto');
    } finally {
      setLoading(false);
    }
  };

  const shareOnWhatsApp = () => {
    if (result) {
      const text = encodeURIComponent(result.whatsappText);
      window.open(
        `https://wa.me/?text=${text}`,
        '_blank'
      );
    }
  };

  return (
    <div className="space-y-6">
      {/* Configuration Panel */}
      <div className="bg-white rounded-3xl shadow-lg p-6 sm:p-8">
        <h2 className="text-2xl font-bold text-gray-800 mb-6">
          ⚡ MagicLotto Generator
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Ruota Selection */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-3">
              📍 Seleziona la Ruota
            </label>
            <select
              value={ruota}
              onChange={(e) => setRuota(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-yellow-400 transition"
            >
              {RUOTE.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>

          {/* Number of Columns */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-3">
              📋 Numero di Colonne
            </label>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min="1"
                max="10"
                value={colonne}
                onChange={(e) => setColonne(parseInt(e.target.value))}
                className="flex-1"
              />
              <span className="bg-gradient-to-r from-yellow-400 to-orange-500 text-white px-4 py-2 rounded-lg font-bold text-lg">
                {colonne}
              </span>
            </div>
          </div>
        </div>

        {/* Metodo Selection */}
        <div className="mt-6">
          <label className="block text-sm font-semibold text-gray-700 mb-3">
            🎯 Metodo di Generazione
          </label>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {METODI.map((m) => (
              <button
                key={m.value}
                onClick={() => setMetodo(m.value)}
                className={`p-4 rounded-xl border-2 transition text-left ${
                  metodo === m.value
                    ? 'border-yellow-400 bg-yellow-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="font-semibold text-gray-800">{m.label}</div>
                <div className="text-xs text-gray-600 mt-1">{m.description}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Superstar Option */}
        <div className="mt-6">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={superstar}
              onChange={(e) => setSuperstar(e.target.checked)}
              className="w-5 h-5 rounded accent-yellow-400"
            />
            <span className="font-semibold text-gray-700">
              ⭐ Aggiungi SuperStar (+0.50€ per colonna)
            </span>
          </label>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mt-6 bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 text-sm">
            {error}
          </div>
        )}

        {/* Generate Button */}
        <button
          onClick={handleGenerate}
          disabled={loading}
          className="w-full mt-6 bg-gradient-to-r from-yellow-400 to-orange-500 text-white font-bold py-4 rounded-xl hover:shadow-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? '🔄 Generazione in corso...' : '🚀 Genera Giocata'}
        </button>
      </div>

      {/* Results */}
      {result && (
        <div className="bg-white rounded-3xl shadow-lg p-6 sm:p-8 space-y-6">
          <h3 className="text-2xl font-bold text-gray-800">
            🎲 Numeri Generati per {ruota}
          </h3>

          {result.columns.map((column, idx) => (
            <div
              key={idx}
              className="bg-gradient-to-r from-blue-50 to-cyan-50 rounded-2xl p-6 border-l-4 border-yellow-400"
            >
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-bold text-gray-800">
                  Colonna {idx + 1}
                </h4>
                <span className="bg-yellow-400 text-white px-3 py-1 rounded-full text-sm font-semibold">
                  €{column.costo.toFixed(2)}
                </span>
              </div>

              <div className="flex gap-2 mb-3 flex-wrap">
                {column.numbers.map((num) => (
                  <span
                    key={num}
                    className="bg-blue-500 text-white w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg"
                  >
                    {num}
                  </span>
                ))}
              </div>

              {column.superstar && (
                <div className="text-center">
                  <span className="inline-block bg-orange-400 text-white px-4 py-2 rounded-full font-bold">
                    ⭐ SuperStar: {column.superstar}
                  </span>
                </div>
              )}
            </div>
          ))}

          {/* Total Cost */}
          <div className="bg-gradient-to-r from-yellow-100 to-orange-100 rounded-2xl p-6 border-2 border-yellow-400">
            <div className="flex items-center justify-between">
              <span className="text-xl font-bold text-gray-800">
                💰 Costo Totale
              </span>
              <span className="text-4xl font-bold bg-gradient-to-r from-yellow-400 to-orange-500 bg-clip-text text-transparent">
                €{result.totalCosto.toFixed(2)}
              </span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={shareOnWhatsApp}
              className="bg-green-500 hover:bg-green-600 text-white font-bold py-3 rounded-xl transition"
            >
              💬 Condividi su WhatsApp
            </button>
            <button
              onClick={() => setResult(null)}
              className="bg-gray-500 hover:bg-gray-600 text-white font-bold py-3 rounded-xl transition"
            >
              🔄 Genera Nuova
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
