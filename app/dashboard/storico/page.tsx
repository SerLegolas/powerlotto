'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';

interface Play {
  id: string;
  userId: string;
  numbers: string;
  superstar: number | null;
  colonne: number;
  costo: number;
  ruota: string;
  createdAt: string;
}

interface Draw {
  id: number;
  date: string;
  ruota: string;
  n1: number;
  n2: number;
  n3: number;
  n4: number;
  n5: number;
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('it-IT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function nextDrawDate(): string {
  const drawDays = [2, 4, 6]; // martedì, giovedì, sabato
  const now = new Date();
  const today = now.getDay(); // 0=dom, 1=lun, ...
  let daysAhead = drawDays
    .map((d) => (d - today + 7) % 7)
    .filter((d) => d > 0);
  if (daysAhead.length === 0) daysAhead = drawDays.map((d) => (d - today + 7) % 7 || 7);
  const minDays = Math.min(...daysAhead);
  const next = new Date(now);
  next.setDate(now.getDate() + minDays);
  return next.toLocaleDateString('it-IT', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' });
}

function parseNumbers(numbersJson: string): number[] {
  try {
    const parsed = JSON.parse(numbersJson);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((n) => Number(n)).filter((n) => Number.isFinite(n));
  } catch {
    return [];
  }
}

const playTypeLabel: Record<number, string> = {
  1: 'Estratto',
  2: 'Ambo',
  3: 'Terno',
  4: 'Quaterna',
  5: 'Cinquina',
};

const quotaByType: Record<number, number> = {
  1: 11.23,
  2: 250,
  3: 4500,
  4: 120000,
  5: 6000000,
};

export default function StoricoGiocatePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [drawsLoading, setDrawsLoading] = useState(true);
  const [plays, setPlays] = useState<Play[]>([]);
  const [draws, setDraws] = useState<Draw[]>([]);
  const [error, setError] = useState<string | null>(null);

  const handleLogout = () => {
    localStorage.removeItem('authToken');
    router.push('/login');
  };

  useEffect(() => {
    const fetchPlays = async () => {
      const token = localStorage.getItem('authToken');
      if (!token) {
        router.replace('/login');
        return;
      }

      try {
        const response = await fetch('/api/plays', {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          cache: 'no-store',
        });

        if (response.status === 401) {
          localStorage.removeItem('authToken');
          router.replace('/login');
          return;
        }

        if (!response.ok) {
          throw new Error('Errore nel caricamento dello storico');
        }

        const data: Play[] = await response.json();
        const ordered = [...data].sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
        setPlays(ordered);
      } catch {
        setError('Impossibile caricare lo storico giocate');
      } finally {
        setLoading(false);
      }
    };

    void fetchPlays();
  }, [router]);

  useEffect(() => {
    const fetchDraws = async () => {
      try {
        const response = await fetch('/api/draws?limit=5000', { cache: 'no-store' });
        if (!response.ok) {
          throw new Error('Errore nel caricamento estrazioni');
        }
        const data: Draw[] = await response.json();
        setDraws(data);
      } catch {
        setDraws([]);
      } finally {
        setDrawsLoading(false);
      }
    };

    void fetchDraws();
  }, []);

  const totalSpent = useMemo(
    () => plays.reduce((sum, play) => sum + Number(play.costo || 0), 0),
    [plays]
  );
  const numeroOroCount = useMemo(
    () => plays.filter((play) => play.superstar !== null).length,
    [plays]
  );

  const calcPlayWin = (play: Play, drawList: Draw[]): number => {
    const playNumbers = Array.from(new Set(parseNumbers(play.numbers)));
    if (!playNumbers.length || !play.colonne) return 0;
    const quota = quotaByType[play.colonne] ?? 0;
    if (!quota) return 0;
    const playDateTs = new Date(play.createdAt).getTime();
    const baseStake = Number(play.costo);
    if (!Number.isFinite(baseStake) || baseStake <= 0) return 0;
    return drawList.reduce((acc, draw) => {
      const drawTs = new Date(draw.date).getTime();
      if (Number.isFinite(playDateTs) && Number.isFinite(drawTs) && drawTs < playDateTs) return acc;
      const extracted = [draw.n1, draw.n2, draw.n3, draw.n4, draw.n5];
      const hits = playNumbers.filter((n) => extracted.includes(n)).length;
      if (hits >= play.colonne) return acc + quota * baseStake;
      return acc;
    }, 0);
  };

  const totalWins = useMemo(() => {
    if (!plays.length || !draws.length) return 0;
    return plays.reduce((acc, play) => acc + calcPlayWin(play, draws), 0);
  }, [plays, draws]);

  return (
    <div style={{ minHeight: '100vh', background: '#f5f5f5', fontFamily: 'Arial, sans-serif' }}>
      <div
        style={{
          background: 'linear-gradient(90deg, #001f7f 0%, #061f7f 50%, #123ebf 100%)',
          color: 'white',
          padding: '16px 24px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Image src="/images/powerlotto-logo.png" alt="PowerLotto" width={140} height={50} />
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <button
            onClick={() => router.push('/dashboard')}
            style={{
              padding: '8px 16px',
              borderRadius: 6,
              background: 'rgba(255,255,255,0.2)',
              color: 'white',
              border: '1px solid rgba(255,255,255,0.3)',
              cursor: 'pointer',
              fontSize: 14,
              fontWeight: 600,
            }}
          >
            Dashboard
          </button>
          <button
            onClick={handleLogout}
            style={{
              padding: '8px 16px',
              borderRadius: 6,
              background: '#d32f2f',
              color: 'white',
              border: 'none',
              cursor: 'pointer',
              fontSize: 14,
              fontWeight: 600,
            }}
          >
            Esci
          </button>
        </div>
      </div>

      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '24px' }}>
        <div style={{ background: 'white', padding: '20px', borderRadius: 8, marginBottom: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <p style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#001f7f' }}>
            Benvenuto nello Storico Giocate
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 16, marginBottom: 24 }}>
          <div style={{ background: 'linear-gradient(135deg, #0066cc 0%, #004c99 100%)', color: 'white', padding: '20px', borderRadius: 12, textAlign: 'center', boxShadow: '0 4px 12px rgba(0,102,204,0.3)' }}>
            <p style={{ margin: '0 0 8px 0', fontSize: 12, fontWeight: 600, opacity: 0.9 }}>Giocate Totali</p>
            <p style={{ margin: 0, fontSize: 32, fontWeight: 700 }}>{plays.length}</p>
          </div>
          <div style={{ background: 'linear-gradient(135deg, #ffa500 0%, #ff8c00 100%)', color: 'white', padding: '20px', borderRadius: 12, textAlign: 'center', boxShadow: '0 4px 12px rgba(255,165,0,0.3)' }}>
            <p style={{ margin: '0 0 8px 0', fontSize: 12, fontWeight: 600, opacity: 0.9 }}>Spesa Totale</p>
            <p style={{ margin: 0, fontSize: 32, fontWeight: 700 }}>
              {`€${totalSpent.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            </p>
          </div>
          <div style={{ background: 'linear-gradient(135deg, #d32f2f 0%, #b71c1c 100%)', color: 'white', padding: '20px', borderRadius: 12, textAlign: 'center', boxShadow: '0 4px 12px rgba(211,47,47,0.3)' }}>
            <p style={{ margin: '0 0 8px 0', fontSize: 12, fontWeight: 600, opacity: 0.9 }}>Giocate Con Numero Oro</p>
            <p style={{ margin: 0, fontSize: 32, fontWeight: 700 }}>{numeroOroCount}</p>
          </div>
          <div style={{ background: 'linear-gradient(135deg, #2e7d32 0%, #1b5e20 100%)', color: 'white', padding: '20px', borderRadius: 12, textAlign: 'center', boxShadow: '0 4px 12px rgba(46,125,50,0.3)' }}>
            <p style={{ margin: '0 0 8px 0', fontSize: 12, fontWeight: 600, opacity: 0.9 }}>Vincite Totali (da uscite)</p>
            <p style={{ margin: 0, fontSize: 32, fontWeight: 700 }}>
              {drawsLoading
                ? '--'
                : `€${totalWins.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            </p>
          </div>
        </div>

        <div style={{ background: 'white', padding: '20px', borderRadius: 8, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <h2 style={{ margin: '0 0 4px 0', fontSize: 16, fontWeight: 700, color: '#001f7f' }}>
            Le Tue Giocate Salvate
          </h2>
          <p style={{ margin: '0 0 12px 0', fontSize: 12, color: '#666' }}>
            Ordinate dalla piu recente alla piu vecchia
          </p>

          {loading && (
            <div style={{ background: 'white', padding: 20, borderRadius: 8, textAlign: 'center', color: '#666' }}>
              Caricamento storico...
            </div>
          )}

          {!loading && error && (
            <div style={{ background: '#fff5f5', border: '1px solid #fecaca', padding: 20, borderRadius: 8, textAlign: 'center', color: '#b91c1c' }}>
              {error}
            </div>
          )}

          {!loading && !error && plays.length === 0 && (
            <div style={{ background: 'white', padding: 20, borderRadius: 8, textAlign: 'center', color: '#666' }}>
              Nessuna giocata salvata al momento.
            </div>
          )}

          {!loading && !error && plays.length > 0 && (
            <div style={{ display: 'grid', gap: 12 }}>
              {plays.map((play) => {
                const numbers = parseNumbers(play.numbers);
                const playType = playTypeLabel[play.colonne] ?? `${play.colonne} numeri`;
                const costText = Number(play.costo).toLocaleString('it-IT', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                });
                const colors = ['#0066cc', '#ffa500', '#ff6600', '#d32f2f', '#ffcc00'];
                const playWin = drawsLoading ? null : calcPlayWin(play, draws);
                const isWinner = playWin !== null && playWin > 0;
                const winText = playWin !== null
                  ? `€${playWin.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                  : null;

                return (
                  <article
                    key={play.id}
                    style={{
                      background: isWinner ? 'linear-gradient(135deg, #f0fff4 0%, #e6f9ed 100%)' : 'white',
                      padding: 16,
                      borderRadius: 8,
                      boxShadow: isWinner ? '0 2px 12px rgba(46,125,50,0.25)' : '0 1px 3px rgba(0,0,0,0.1)',
                      border: isWinner ? '2px solid #2e7d32' : '1px solid #eee',
                    }}
                  >
                    <div style={{ marginBottom: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: isWinner ? '#1b5e20' : '#001f7f' }}>{playType}</p>
                        {isWinner && (
                          <span style={{
                            background: '#2e7d32',
                            color: 'white',
                            fontSize: 11,
                            fontWeight: 700,
                            padding: '2px 8px',
                            borderRadius: 20,
                            letterSpacing: '0.04em',
                          }}>🏆 HAI VINTO</span>
                        )}
                      </div>
                      <p style={{ margin: 0, fontSize: 12, color: '#666' }}>{formatDate(play.createdAt)}</p>
                    </div>

                    <div style={{ marginBottom: 10, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {numbers.length > 0 ? (
                        numbers.map((num, idx) => (
                          <span
                            key={`${play.id}-${idx}`}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              width: 34,
                              height: 34,
                              borderRadius: '50%',
                              background: colors[idx % colors.length],
                              color: 'white',
                              fontWeight: 700,
                              fontSize: 13,
                            }}
                          >
                            {num}
                          </span>
                        ))
                      ) : (
                        <span style={{ fontSize: 13, color: '#666' }}>Numeri non disponibili</span>
                      )}
                      {play.superstar !== null && (
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            minWidth: 34,
                            height: 34,
                            borderRadius: '50%',
                            background: '#ffcc00',
                            color: '#333',
                            fontWeight: 800,
                            fontSize: 13,
                            padding: '0 8px',
                          }}
                        >
                          {play.superstar}
                        </span>
                      )}
                    </div>

                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, fontSize: 13, color: '#333' }}>
                      <p style={{ margin: 0 }}><strong>Ruota:</strong> {play.ruota}</p>
                      <p style={{ margin: 0 }}><strong>Numeri giocati:</strong> {play.colonne}</p>
                      <p style={{ margin: 0 }}><strong>Costo:</strong> €{costText}</p>
                      {play.superstar !== null && <p style={{ margin: 0 }}><strong>Numero Oro:</strong> attivo</p>}
                    </div>
                    {isWinner && winText && (
                      <div style={{
                        marginTop: 10,
                        padding: '8px 12px',
                        background: '#2e7d32',
                        borderRadius: 6,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                      }}>
                        <span style={{ fontSize: 16 }}>💰</span>
                        <span style={{ color: 'white', fontWeight: 700, fontSize: 14 }}>Vincita: {winText}</span>
                      </div>
                    )}
                    {!drawsLoading && !isWinner && (
                      <p style={{ margin: '8px 0 0 0', fontSize: 11, color: '#aaa' }}>Prossima estrazione: {nextDrawDate()}</p>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
