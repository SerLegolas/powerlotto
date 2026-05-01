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
  confermata: number | null;
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
  return date.toLocaleDateString('it-IT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
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

const DRAW_WEEK_DAYS = [2, 4, 6]; // mar, gio, sab
const DRAW_CUTOFF_HOUR = 19;

function ymdFromDateUTC(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function addDaysToYmd(ymd: string, days: number): string {
  const [y, m, d] = ymd.split('-').map(Number);
  if (!y || !m || !d) return ymd;
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return ymdFromDateUTC(dt);
}

function weekdayFromYmd(ymd: string): number {
  const [y, m, d] = ymd.split('-').map(Number);
  if (!y || !m || !d) return 0;
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

function parsePlayDateTimeToUtc(value: string): Date | null {
  // SQLite salva spesso "YYYY-MM-DD HH:mm:ss" in UTC.
  const normalized = value.includes('T') ? value : value.replace(' ', 'T');
  const withZone = /Z$|[+-]\d{2}:\d{2}$/.test(normalized) ? normalized : `${normalized}Z`;
  const dt = new Date(withZone);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

function getRomeDateParts(input: string): { ymd: string; hour: number; minute: number; second: number } | null {
  const dt = parsePlayDateTimeToUtc(input);
  if (!dt) return null;
  const parts = new Intl.DateTimeFormat('it-IT', {
    timeZone: 'Europe/Rome',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(dt);

  const byType = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  const year = Number(byType.year);
  const month = Number(byType.month);
  const day = Number(byType.day);
  const hour = Number(byType.hour);
  const minute = Number(byType.minute);
  const second = Number(byType.second);
  if ([year, month, day, hour, minute, second].some((n) => !Number.isFinite(n))) return null;

  return {
    ymd: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
    hour,
    minute,
    second,
  };
}

function getFirstEligibleDrawDate(createdAt: string): string {
  const rome = getRomeDateParts(createdAt);
  if (!rome) return createdAt.slice(0, 10);

  const day = weekdayFromYmd(rome.ymd);
  const isDrawDay = DRAW_WEEK_DAYS.includes(day);
  const isAfterCutoff =
    rome.hour > DRAW_CUTOFF_HOUR ||
    (rome.hour === DRAW_CUTOFF_HOUR && (rome.minute > 0 || rome.second > 0));

  if (isDrawDay && !isAfterCutoff) {
    return rome.ymd;
  }

  for (let offset = 1; offset <= 7; offset++) {
    const candidate = addDaysToYmd(rome.ymd, offset);
    if (DRAW_WEEK_DAYS.includes(weekdayFromYmd(candidate))) {
      return candidate;
    }
  }

  return rome.ymd;
}

export default function StoricoGiocatePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [drawsLoading, setDrawsLoading] = useState(true);
  const [playsFilter, setPlaysFilter] = useState<'active' | 'all' | 'won'>('active');
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

  const calcPlayWin = (play: Play, drawList: Draw[]): number => {
    const playNumbers = Array.from(new Set(parseNumbers(play.numbers)));
    if (!playNumbers.length || !play.colonne) return 0;
    const quota = quotaByType[play.colonne] ?? 0;
    if (!quota) return 0;
    const firstEligibleDrawDate = getFirstEligibleDrawDate(play.createdAt);
    const baseStake = Number(play.costo);
    if (!Number.isFinite(baseStake) || baseStake <= 0) return 0;
    return drawList.reduce((acc, draw) => {
      if (draw.date < firstEligibleDrawDate) return acc;
      const extracted = [draw.n1, draw.n2, draw.n3, draw.n4, draw.n5];
      const hits = playNumbers.filter((n) => extracted.includes(n)).length;
      if (hits >= play.colonne) return acc + quota * baseStake;
      return acc;
    }, 0);
  };

  const hasRelevantDraws = (play: Play, drawList: Draw[]): boolean => {
    const firstEligibleDrawDate = getFirstEligibleDrawDate(play.createdAt);
    return drawList.some((d) => d.date >= firstEligibleDrawDate);
  };

  const totalWins = useMemo(() => {
    if (!plays.length || !draws.length) return 0;
    return plays.reduce((acc, play) => acc + calcPlayWin(play, draws), 0);
  }, [plays, draws]);

  const totalWinsReali = useMemo(() => {
    if (!plays.length || !draws.length) return 0;
    return plays
      .filter((play) => (play.confermata ?? 0) === 1)
      .reduce((acc, play) => acc + calcPlayWin(play, draws), 0);
  }, [plays, draws]);

  const visiblePlays = useMemo(() => {
    if (playsFilter === 'all') return plays;
    if (drawsLoading) return plays;
    if (playsFilter === 'won') {
      return plays.filter((play) => calcPlayWin(play, draws) > 0);
    }
    return plays.filter((play) => !hasRelevantDraws(play, draws));
  }, [plays, playsFilter, drawsLoading, draws]);

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
            <p style={{ margin: '0 0 8px 0', fontSize: 12, fontWeight: 600, opacity: 0.9 }}>Vincite Totali su Estrazioni</p>
            <p style={{ margin: 0, fontSize: 32, fontWeight: 700 }}>
              {drawsLoading
                ? '--'
                : `€${totalWins.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            </p>
          </div>
          <div style={{ background: 'linear-gradient(135deg, #2e7d32 0%, #1b5e20 100%)', color: 'white', padding: '20px', borderRadius: 12, textAlign: 'center', boxShadow: '0 4px 12px rgba(46,125,50,0.3)' }}>
            <p style={{ margin: '0 0 8px 0', fontSize: 12, fontWeight: 600, opacity: 0.9 }}>Vincite su Giocate Reali</p>
            <p style={{ margin: 0, fontSize: 32, fontWeight: 700 }}>
              {drawsLoading
                ? '--'
                : `€${totalWinsReali.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            </p>
          </div>
        </div>

        <div style={{ background: 'white', padding: '20px', borderRadius: 8, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 4 }}>
            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#001f7f' }}>
              Le Tue Giocate Salvate
            </h2>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <button
                onClick={() => setPlaysFilter('active')}
                style={{
                  border: playsFilter === 'active' ? '1px solid #0b3d91' : '1px solid #cfd8dc',
                  background: playsFilter === 'active' ? '#0b3d91' : '#f6f8fa',
                  color: playsFilter === 'active' ? 'white' : '#263238',
                  borderRadius: 20,
                  padding: '6px 12px',
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Attive
              </button>
              <button
                onClick={() => setPlaysFilter('all')}
                style={{
                  border: playsFilter === 'all' ? '1px solid #0b3d91' : '1px solid #cfd8dc',
                  background: playsFilter === 'all' ? '#0b3d91' : '#f6f8fa',
                  color: playsFilter === 'all' ? 'white' : '#263238',
                  borderRadius: 20,
                  padding: '6px 12px',
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Tutte
              </button>
              <button
                onClick={() => setPlaysFilter('won')}
                style={{
                  border: playsFilter === 'won' ? '1px solid #0b3d91' : '1px solid #cfd8dc',
                  background: playsFilter === 'won' ? '#0b3d91' : '#f6f8fa',
                  color: playsFilter === 'won' ? 'white' : '#263238',
                  borderRadius: 20,
                  padding: '6px 12px',
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Vinte
              </button>
            </div>
          </div>
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

          {!loading && !error && visiblePlays.length === 0 && (
            <div style={{ background: 'white', padding: 20, borderRadius: 8, textAlign: 'center', color: '#666' }}>
              {playsFilter === 'active'
                ? 'Nessuna giocata attiva al momento.'
                : playsFilter === 'won'
                  ? 'Nessuna giocata vincente al momento.'
                : 'Nessuna giocata salvata al momento.'}
            </div>
          )}

          {!loading && !error && visiblePlays.length > 0 && (
            <div style={{ display: 'grid', gap: 12 }}>
              {visiblePlays.map((play) => {
                const numbers = parseNumbers(play.numbers);
                const playType = playTypeLabel[play.colonne] ?? `${play.colonne} numeri`;
                const costText = Number(play.costo).toLocaleString('it-IT', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                });
                const colors = ['#0066cc', '#ffa500', '#ff6600', '#d32f2f', '#ffcc00'];
                const playWin = drawsLoading ? null : calcPlayWin(play, draws);
                const isWinner = playWin !== null && playWin > 0;
                const hasDrawsToCheck = !drawsLoading && hasRelevantDraws(play, draws);
                const firstEligibleDrawDate = getFirstEligibleDrawDate(play.createdAt);
                const winText = playWin !== null
                  ? `€${playWin.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                  : null;
                const isReale = (play.confermata ?? 0) === 1;

                const toggleConfermata = async () => {
                  const token = localStorage.getItem('authToken');
                  const newVal = isReale ? 0 : 1;
                  setPlays((prev) => prev.map((p) => p.id === play.id ? { ...p, confermata: newVal } : p));
                  try {
                    await fetch('/api/plays', {
                      method: 'PATCH',
                      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                      body: JSON.stringify({ id: play.id, confermata: newVal }),
                    });
                  } catch {
                    setPlays((prev) => prev.map((p) => p.id === play.id ? { ...p, confermata: isReale ? 1 : 0 } : p));
                  }
                };

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
                    <div
                      style={{
                        marginBottom: 10,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        padding: '4px 10px',
                        borderRadius: 16,
                        background: '#eef5ff',
                        border: '1px solid #c8defa',
                        color: '#0b3d91',
                        fontSize: 11,
                        fontWeight: 700,
                      }}
                    >
                      <span>🗓️</span>
                      <span>Estrazione del : {formatDate(firstEligibleDrawDate)}</span>
                    </div>
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
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                        <p style={{ margin: 0, fontSize: 12, color: '#666' }}>{formatDate(play.createdAt)}</p>
                        <button
                          onClick={toggleConfermata}
                          style={{
                            border: 'none',
                            borderRadius: 20,
                            padding: '3px 12px',
                            fontSize: 12,
                            fontWeight: 700,
                            cursor: 'pointer',
                            background: isReale ? '#2e7d32' : '#e0e0e0',
                            color: isReale ? 'white' : '#555',
                          }}
                        >
                          {isReale ? '✅ Giocata reale' : '📝 Simulata'}
                        </button>
                      </div>
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
                      <p style={{ margin: '8px 0 0 0', fontSize: 11, color: hasDrawsToCheck ? '#666' : '#aaa' }}>
                        {hasDrawsToCheck
                          ? '❌ Nessuna vincita nelle estrazioni controllate'
                          : `⏳ In attesa estrazione dal ${formatDate(firstEligibleDrawDate)}`}
                      </p>
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
