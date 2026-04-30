'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';

interface Play {
  id: string;
  userId: string;
  numbers: string;
  superstar: number | null;
  colonne: number;
  costo: number;
  createdAt: string;
}

interface Draw {
  id: string;
  date: string;
  ruota: string;
  n1: number;
  n2: number;
  n3: number;
  n4: number;
  n5: number;
}

interface StatItem {
  id: string;
  ruota: string;
  numero: number;
  ritardo: number;
  frequenza: number;
}

const allWheels = ['Bari', 'Cagliari', 'Firenze', 'Genova', 'Milano', 'Napoli', 'Palermo', 'Roma', 'Torino', 'Venezia', 'Nazionale'];
const cities = ['Bari', 'Milano', 'Napoli', 'Roma', 'Venezia'];
const SINGLE_PLAY_MAX_WIN = 6000000;

// Numero Oro: quote ufficiali per giocata da 1€ su singola ruota.
// Fonte: lotto-italia.it/lotto/come-si-gioca/numero-oro (tabella "SORTE CON NUMERO ORO" e "SOLO NUMERO ORO").
const numeroOroQuote = {
  withSort: {
    // 2 numeri -> sorte Ambo
    2: 650,
    // 3 numeri -> sorte Terno
    3: 10000,
    // 4 numeri -> sorte Quaterna
    4: 250000,
  },
  onlyOro: {
    // Solo Numero Oro per rispettive quantita di numeri giocati
    2: 15,
    3: 10,
    4: 5,
  },
};

const normalizeWheelName = (value: string) =>
  (value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();

const getStatsFromDraws = (draws: Draw[]) => {
  const allNumbers = draws.flatMap((d) => [d.n1, d.n2, d.n3, d.n4, d.n5]);
  const validNumbers = allNumbers.filter((n): n is number => typeof n === 'number' && n >= 1 && n <= 90);

  if (!validNumbers.length) {
    return {
      ritardatari: [] as number[],
      frequenti: [] as number[],
      caldi: [] as number[],
    };
  }

  const frequencyMap = new Map<number, number>();
  for (const n of validNumbers) {
    frequencyMap.set(n, (frequencyMap.get(n) || 0) + 1);
  }

  const sortedRecent = [...draws].reverse();
  const delayMap = new Map<number, number>();
  for (let i = 0; i < sortedRecent.length; i++) {
    const row = sortedRecent[i];
    const rowNums = [row.n1, row.n2, row.n3, row.n4, row.n5];
    for (const n of rowNums) {
      if (typeof n === 'number' && n >= 1 && n <= 90 && !delayMap.has(n)) {
        delayMap.set(n, i);
      }
    }
  }

  const withScores = Array.from({ length: 90 }, (_, idx) => {
    const numero = idx + 1;
    const frequenza = frequencyMap.get(numero) || 0;
    const ritardo = delayMap.has(numero) ? (delayMap.get(numero) as number) : sortedRecent.length + 1;
    return { numero, frequenza, ritardo, score: frequenza - ritardo };
  });

  const ritardatari = [...withScores]
    .sort((a, b) => b.ritardo - a.ritardo)
    .slice(0, 3)
    .map((x) => x.numero);

  const frequenti = [...withScores]
    .sort((a, b) => b.frequenza - a.frequenza)
    .slice(0, 3)
    .map((x) => x.numero);

  const caldi = [...withScores]
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((x) => x.numero);

  return { ritardatari, frequenti, caldi };
};

export function DashboardComponent() {
  const router = useRouter();
  const saveInFlightRef = useRef(false);
  const drawsAutoRefreshDoneRef = useRef(false);
  const [isStandaloneApp, setIsStandaloneApp] = useState(false);
  const [plays, setPlays] = useState<Play[]>([]);
  const [user, setUser] = useState<{ id: string; email: string } | null>(null);
  const [authenticated, setAuthenticated] = useState(false);
  const [selectedCity, setSelectedCity] = useState('Bari');
  const [numbersMode, setNumbersMode] = useState<'magic' | 'manual'>('magic');
  const [columns, setColumns] = useState(5);
  const [stakeAmount, setStakeAmount] = useState(1);
  const [numeroOro, setNumeroOro] = useState(false);
  const [numeroOroValue, setNumeroOroValue] = useState<number | null>(null);
  const [generatedNumbers, setGeneratedNumbers] = useState<number[]>([]);
  const [lastDraw, setLastDraw] = useState<{ date: string; byRuota: Record<string, number[]> } | null>(null);
  const [delayedNumbers, setDelayedNumbers] = useState<number[]>([]);
  const [frequentNumbers, setFrequentNumbers] = useState<number[]>([]);
  const [hotNumbers, setHotNumbers] = useState<number[]>([]);
  const [showMaxWinModal, setShowMaxWinModal] = useState(false);
  const [isSavingPlay, setIsSavingPlay] = useState(false);
  const [savePlayMessage, setSavePlayMessage] = useState<string | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('authToken');
    if (!token) {
      router.replace('/login');
      return;
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAuthenticated(true);
    // eslint-disable-next-line react-hooks/immutability
    fetchUserData();
    // eslint-disable-next-line react-hooks/immutability
    fetchPlays();
    // eslint-disable-next-line react-hooks/immutability
    fetchDraws();
    // eslint-disable-next-line react-hooks/immutability
    fetchStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  useEffect(() => {
    // Numero Oro e consentito solo per Ambo, Terno e Quaterna.
    if (columns < 2 || columns > 4) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setNumeroOro(false);
      setNumeroOroValue(null);
    }
  }, [columns]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const mediaQuery = window.matchMedia('(display-mode: standalone)');
    const updateDisplayMode = () => {
      setIsStandaloneApp(
        mediaQuery.matches ||
        ((window.navigator as Navigator & { standalone?: boolean }).standalone ?? false)
      );
    };

    updateDisplayMode();
    mediaQuery.addEventListener?.('change', updateDisplayMode);

    return () => {
      mediaQuery.removeEventListener?.('change', updateDisplayMode);
    };
  }, []);


  async function fetchUserData() {
    try {
      const token = localStorage.getItem('authToken');
      if (token) {
        const payload = JSON.parse(
          Buffer.from(token.split('.')[1], 'base64').toString()
        );
        setUser({
          id: payload.userId,
          email: payload.email,
        });
      }
    } catch (err) {
      console.error('Error fetching user data:', err);
    }
  }

  async function fetchPlays() {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch('/api/plays', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch plays');
      }

      const data = await response.json();
      setPlays(data);
    } catch (err) {
      console.error('Error fetching plays:', err);
    }
  }

  async function fetchDraws() {
    try {
      const response = await fetch('/api/draws?limit=500', { cache: 'no-store' });
      if (!response.ok) throw new Error('Failed to fetch draws');
      const refreshTriggered = response.headers.get('x-draws-refresh-triggered') === '1';

      const data: Draw[] = await response.json();
      if (!data.length) return;

      // Trova la data più recente
      let maxDate = '';
      for (const draw of data) {
        if (draw.date > maxDate) maxDate = draw.date;
      }

      // Raggruppa per ruota solo i draw della data più recente
      const wheelByNormalized = Object.fromEntries(allWheels.map((w) => [normalizeWheelName(w), w]));
      const byRuota: Record<string, number[]> = {};
      for (const draw of data) {
        if (draw.date !== maxDate) continue;
        const wheel = wheelByNormalized[normalizeWheelName(draw.ruota)];
        if (!wheel) continue;
        const numbers = [draw.n1, draw.n2, draw.n3, draw.n4, draw.n5].filter(
          (n): n is number => typeof n === 'number'
        );
        if (numbers.length === 5) byRuota[wheel] = numbers;
      }

      setLastDraw({ date: maxDate, byRuota });

      // Se il server ha avviato il refresh in background, facciamo un solo refetch automatico.
      if (refreshTriggered && !drawsAutoRefreshDoneRef.current) {
        drawsAutoRefreshDoneRef.current = true;
        setTimeout(() => {
          void fetchDraws();
          void fetchStats();
        }, 5000);
      }
    } catch (err) {
      console.error('Error fetching draws:', err);
    }
  }

  async function fetchStats() {
    try {
      const response = await fetch('/api/stats', { cache: 'no-store' });
      if (!response.ok) {
        throw new Error('Failed to fetch stats');
      }

      const data: StatItem[] = await response.json();
      const valid = data.filter((s) => typeof s.numero === 'number' && s.numero >= 1 && s.numero <= 90);

      if (!valid.length) {
        const drawsResponse = await fetch('/api/draws?limit=1000', { cache: 'no-store' });
        if (!drawsResponse.ok) {
          throw new Error('Failed to fetch draws fallback for stats');
        }

        const drawsData: Draw[] = await drawsResponse.json();
        const fallbackStats = getStatsFromDraws(drawsData);
        setDelayedNumbers(fallbackStats.ritardatari);
        setFrequentNumbers(fallbackStats.frequenti);
        setHotNumbers(fallbackStats.caldi);
        return;
      }

      const ritardatari = [...valid]
        .sort((a, b) => (b.ritardo || 0) - (a.ritardo || 0))
        .slice(0, 3)
        .map((s) => s.numero);

      const frequenti = [...valid]
        .sort((a, b) => (b.frequenza || 0) - (a.frequenza || 0))
        .slice(0, 3)
        .map((s) => s.numero);

      const caldi = [...valid]
        .sort((a, b) => ((b.frequenza || 0) - (b.ritardo || 0)) - ((a.frequenza || 0) - (a.ritardo || 0)))
        .slice(0, 3)
        .map((s) => s.numero);

      setDelayedNumbers(ritardatari);
      setFrequentNumbers(frequenti);
      setHotNumbers(caldi);
    } catch (err) {
      console.error('Error fetching stats:', err);
    }
  }

  const handleLogout = () => {
    localStorage.removeItem('authToken');
    router.push('/login');
  };

  const handleSavePlay = async () => {
    if (!generatedNumbers.length || isSavingPlay || saveInFlightRef.current) return;

    const normalizeNumbers = (nums: number[]) => [...nums].sort((a, b) => a - b).join('-');
    const normalizeCost = (value: number) => Number(value).toFixed(2);

    const currentSuperstarValue = numeroOro ? numeroOroValue : null;
    const currentFingerprint = `${normalizeNumbers(generatedNumbers)}|${columns}|${normalizeCost(generatedCost)}|${currentSuperstarValue ?? 'null'}`;
    const duplicateExists = plays.some((p) => {
      let parsedNumbers: number[] = [];
      try {
        const parsed = JSON.parse(p.numbers);
        if (Array.isArray(parsed)) {
          parsedNumbers = parsed.map((n) => Number(n)).filter((n) => Number.isFinite(n));
        }
      } catch {
        parsedNumbers = [];
      }
      const rowFingerprint = `${normalizeNumbers(parsedNumbers)}|${p.colonne}|${normalizeCost(p.costo)}|${p.superstar ?? 'null'}`;
      return rowFingerprint === currentFingerprint;
    });

    if (duplicateExists) {
      setSavePlayMessage('Questa giocata e gia stata salvata');
      return;
    }

    saveInFlightRef.current = true;
    setIsSavingPlay(true);
    setSavePlayMessage(null);
    try {
      const token = localStorage.getItem('authToken');
      if (!token) {
        setSavePlayMessage('Sessione non valida. Effettua di nuovo il login.');
        return;
      }

      const response = await fetch('/api/plays', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          numbers: generatedNumbers,
          superstar: currentSuperstarValue,
          colonne: columns,
          costo: generatedCost,
          ruota: selectedCity,
        }),
      });

      if (response.status === 409) {
        setSavePlayMessage('Questa giocata e gia stata salvata');
        return;
      }

      if (!response.ok) {
        throw new Error('save play failed');
      }

      const savedPlay: Play = await response.json();
      setPlays((prev) => [...prev, savedPlay]);

      setSavePlayMessage('Giocata salvata con successo');
    } catch {
      setSavePlayMessage('Errore nel salvataggio della giocata');
    } finally {
      saveInFlightRef.current = false;
      setIsSavingPlay(false);
    }
  };

  // Formula Sisal/Lotto: vincita = quota della sorte x (importo giocato / combinazioni).
  // In questa UI la sorte e implicita (1->Estratto, 2->Ambo, 3->Terno, 4->Quaterna, 5->Cinquina)
  // e le combinazioni sono sempre 1, quindi: vincita = quota x importo giocato.
  const calcRawWinBySelection = (n: number, cost: number): number => {
    const quotaByType: Record<number, number> = {
      1: 11.23,
      2: 250,
      3: 4500,
      4: 120000,
      5: 6000000,
    };
    const quota = quotaByType[n] ?? 0;
    return quota * cost;
  };

  const calculateEstimatedTotalWin = useCallback(() => {
    const baseCost = stakeAmount;
    const baseWin = calcRawWinBySelection(columns, baseCost);
    const oroWithSortQuota = columns >= 2 && columns <= 4 ? numeroOroQuote.withSort[columns as 2 | 3 | 4] : null;
    const oroOnlyQuota = columns >= 2 && columns <= 4 ? numeroOroQuote.onlyOro[columns as 2 | 3 | 4] : null;
    const oroWithSortWin = numeroOro && oroWithSortQuota ? oroWithSortQuota * baseCost : 0;
    const oroOnlyWin = numeroOro && oroOnlyQuota ? oroOnlyQuota * baseCost : 0;
    return baseWin + oroWithSortWin + oroOnlyWin;
  }, [columns, numeroOro, stakeAmount]);

  const generateManualNumbers = useCallback(() => {
    const randomCity = cities[Math.floor(Math.random() * cities.length)];
    setSelectedCity(randomCity);
    const numbers: number[] = [];
    for (let i = 0; i < columns; i++) {
      const num = Math.floor(Math.random() * 90) + 1;
      numbers.push(num);
    }
    setGeneratedNumbers(numbers);
    setNumeroOroValue(null);
    setNumeroOro(false);

    const totalWin = calculateEstimatedTotalWin();
    setShowMaxWinModal(totalWin > SINGLE_PLAY_MAX_WIN);
  }, [columns, calculateEstimatedTotalWin]);

  const generateMagicNumbers = useCallback(() => {
    const magicColumns = Math.floor(Math.random() * 5) + 1;
    setColumns(magicColumns);
    setStakeAmount(1);
    setNumeroOro(false);
    setNumeroOroValue(null);

    const randomCity = cities[Math.floor(Math.random() * cities.length)];
    setSelectedCity(randomCity);
    const numbers: number[] = [];
    for (let i = 0; i < magicColumns; i++) {
      const num = Math.floor(Math.random() * 90) + 1;
      numbers.push(num);
    }
    setGeneratedNumbers(numbers);

    const magicTotalWin = calculateEstimatedTotalWin();
    setShowMaxWinModal(magicTotalWin > SINGLE_PLAY_MAX_WIN);
  }, [calculateEstimatedTotalWin]);

  const handleRegenerate = useCallback(() => {
    if (numbersMode === 'magic') {
      generateMagicNumbers();
      return;
    }
    generateManualNumbers();
  }, [numbersMode, generateMagicNumbers, generateManualNumbers]);

  const estimatedTotalWin = (authenticated && generatedNumbers.length > 0)
    ? calculateEstimatedTotalWin()
    : 0;
  void estimatedTotalWin;

  if (!authenticated) return null;

  const userName = user?.email.split('@')[0] || 'Utente';
  const baseCost = stakeAmount;
  const numeroOroEligible = columns >= 2 && columns <= 4;
  const numeroOroCost = numeroOro ? baseCost : 0;
  const generatedCost = baseCost + numeroOroCost;
  const generatedCostText = generatedCost.toFixed(2).replace('.', ',');
  const baseCostText = baseCost.toFixed(2).replace('.', ',');
  const numeroOroCostText = numeroOroCost.toFixed(2).replace('.', ',');

  const playTypeLabel: Record<number, string> = {
    1: 'Estratto', 2: 'Ambo', 3: 'Terno', 4: 'Quaterna', 5: 'Cinquina',
  };

  const maxWin = calcRawWinBySelection(columns, baseCost);
  const displayedMaxWin = Math.min(maxWin, SINGLE_PLAY_MAX_WIN);
  const maxWinText = displayedMaxWin >= 1000
    ? `€${displayedMaxWin.toLocaleString('it-IT', { maximumFractionDigits: 2 })}`
    : `€${displayedMaxWin.toFixed(2).replace('.', ',')}`;

  const numeroOroWithSortQuota = numeroOroEligible ? numeroOroQuote.withSort[columns as 2 | 3 | 4] : null;
  const numeroOroOnlyQuota = numeroOroEligible ? numeroOroQuote.onlyOro[columns as 2 | 3 | 4] : null;
  const numeroOroWithSortWin = numeroOro && numeroOroWithSortQuota ? numeroOroWithSortQuota * baseCost : 0;
  const numeroOroOnlyWin = numeroOro && numeroOroOnlyQuota ? numeroOroOnlyQuota * baseCost : 0;
  const totalPotentialWin = maxWin + numeroOroWithSortWin + numeroOroOnlyWin;
  const displayedTotalPotentialWin = Math.min(totalPotentialWin, SINGLE_PLAY_MAX_WIN);
  const totalPotentialWinText = displayedTotalPotentialWin >= 1000
    ? `€${displayedTotalPotentialWin.toLocaleString('it-IT', { maximumFractionDigits: 2 })}`
    : `€${displayedTotalPotentialWin.toFixed(2).replace('.', ',')}`;
  const playType = playTypeLabel[columns] ?? '';
  const latestDrawTableFontSize = isStandaloneApp ? '10px' : '12px';
  const latestDrawRowLabelWidth = isStandaloneApp ? 58 : 85;
  const latestDrawRowLabelFontSize = isStandaloneApp ? '9px' : '11px';
  const latestDrawCellPadding = isStandaloneApp ? '6px 2px' : '8px 4px';
  const latestDrawBallSize = isStandaloneApp ? 24 : 30;
  const latestDrawBallFontSize = isStandaloneApp ? '10px' : '12px';

  return (
    <div style={{ minHeight: '100vh', background: '#f5f5f5', fontFamily: 'Arial, sans-serif' }}>
      {/* Header */}
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
          <Image
            src="/images/powerlotto-logo.png"
            alt="PowerLotto"
            width={140}
            height={50}
          />
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <button
            onClick={() => router.push('/dashboard/storico')}
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
            Giocate
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

      {/* Main Content */}
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '24px' }}>
        {/* Welcome */}
        <div style={{ background: 'white', padding: '20px', borderRadius: 8, marginBottom: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <p style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#001f7f' }}>
            Benvenuto, {userName}!
          </p>
        </div>

        {/* Ultime Estrazioni */}
        <div style={{ background: 'white', padding: '20px', borderRadius: 8, marginBottom: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <h2 style={{ margin: '0 0 4px 0', fontSize: 16, fontWeight: 700, color: '#001f7f' }}>
            Ultima Estrazione
          </h2>
          {lastDraw && (
            <p style={{ margin: '0 0 12px 0', fontSize: 12, color: '#666' }}>
              {new Date(lastDraw.date).toLocaleDateString('it-IT', { day: '2-digit', month: 'long', year: 'numeric' })}
            </p>
          )}
          <div style={{ overflowX: isStandaloneApp ? 'hidden' : 'auto', WebkitOverflowScrolling: 'touch', minWidth: 0 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: latestDrawTableFontSize, minWidth: isStandaloneApp ? 0 : 520, tableLayout: isStandaloneApp ? 'fixed' : 'auto' }}>
              <tbody>
                {allWheels.map((wheel) => {
                  const nums = lastDraw?.byRuota[wheel] || [];
                  const visibleNums: Array<number | string> = nums.length === 5 ? nums : ['-', '-', '-', '-', '-'];
                  const colors = ['#0066cc', '#ffa500', '#ff6600', '#d32f2f', '#ffcc00'];
                  return (
                    <tr key={wheel} style={{ borderBottom: '1px solid #eee' }}>
                      <td style={{ padding: isStandaloneApp ? '6px 4px' : '8px 6px', fontWeight: 600, color: '#001f7f', minWidth: latestDrawRowLabelWidth, width: latestDrawRowLabelWidth, fontSize: latestDrawRowLabelFontSize, lineHeight: 1.1 }}>
                        {isStandaloneApp ? wheel : `🎯 ${wheel}`}
                      </td>
                      {visibleNums.map((num, idx) => (
                        <td key={idx} style={{ padding: latestDrawCellPadding, textAlign: 'center' }}>
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              width: latestDrawBallSize,
                              height: latestDrawBallSize,
                              borderRadius: '50%',
                              background: colors[idx],
                              color: 'white',
                              fontWeight: 700,
                              fontSize: latestDrawBallFontSize,
                            }}
                          >
                            {num}
                          </span>
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 16, marginBottom: 24 }}>
          <div style={{ background: 'linear-gradient(135deg, #0066cc 0%, #004c99 100%)', color: 'white', padding: '20px', borderRadius: 12, textAlign: 'center', boxShadow: '0 4px 12px rgba(0,102,204,0.3)' }}>
            <p style={{ margin: '0 0 8px 0', fontSize: 12, fontWeight: 600, opacity: 0.9 }}>Numeri Ritardatari</p>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 8 }}>
              {(delayedNumbers.length ? delayedNumbers : ['--', '--', '--']).map((num, idx) => (
                <span key={idx} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 40, height: 40, borderRadius: '50%', background: 'rgba(255,255,255,0.3)', fontWeight: 700, fontSize: 16 }}>
                  {num}
                </span>
              ))}
            </div>
          </div>

          <div style={{ background: 'linear-gradient(135deg, #ffa500 0%, #ff8c00 100%)', color: 'white', padding: '20px', borderRadius: 12, textAlign: 'center', boxShadow: '0 4px 12px rgba(255,165,0,0.3)' }}>
            <p style={{ margin: '0 0 8px 0', fontSize: 12, fontWeight: 600, opacity: 0.9 }}>Numeri Frequenti</p>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 8 }}>
              {(frequentNumbers.length ? frequentNumbers : ['--', '--', '--']).map((num, idx) => (
                <span key={idx} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 40, height: 40, borderRadius: '50%', background: 'rgba(255,255,255,0.3)', fontWeight: 700, fontSize: 16 }}>
                  {num}
                </span>
              ))}
            </div>
          </div>

          <div style={{ background: 'linear-gradient(135deg, #d32f2f 0%, #b71c1c 100%)', color: 'white', padding: '20px', borderRadius: 12, textAlign: 'center', boxShadow: '0 4px 12px rgba(211,47,47,0.3)' }}>
            <p style={{ margin: '0 0 8px 0', fontSize: 12, fontWeight: 600, opacity: 0.9 }}>Numeri Caldi</p>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 8 }}>
              {(hotNumbers.length ? hotNumbers : ['--', '--', '--']).map((num, idx) => (
                <span key={idx} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 40, height: 40, borderRadius: '50%', background: 'rgba(255,255,255,0.3)', fontWeight: 700, fontSize: 16 }}>
                  {num}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* MagicLotto */}
        <div style={{ background: 'white', padding: '20px', borderRadius: 8, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <div style={{ background: 'linear-gradient(90deg, #0066cc 0%, #004c99 100%)', color: 'white', padding: '12px 16px', marginBottom: 16, borderRadius: 6 }}>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>✨ MagicLotto</p>
          </div>

          <div style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontWeight: 600 }}>Numeri giocata: </span>
                <select
                  value={numbersMode === 'magic' ? 'magic' : String(columns)}
                  onChange={(e) => {
                    const value = e.target.value;
                    if (value === 'magic') {
                      setNumbersMode('magic');
                      setStakeAmount(1);
                      setNumeroOro(false);
                      setNumeroOroValue(null);
                    } else {
                      setNumbersMode('manual');
                      setColumns(Number(value));
                    }
                  }}
                  style={{ padding: '8px', border: '1px solid #ccc', borderRadius: 4, fontSize: 14 }}
                >
                  {[
                    { value: 'magic', label: 'Magic' },
                    { value: '1', label: '1' },
                    { value: '2', label: '2' },
                    { value: '3', label: '3' },
                    { value: '4', label: '4' },
                    { value: '5', label: '5' },
                  ].map((n) => (
                    <option key={n.value} value={n.value}>
                      {n.label}
                    </option>
                  ))}
                </select>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontWeight: 600 }}>Importo: </span>
                <select
                  value={stakeAmount}
                  onChange={(e) => setStakeAmount(Number(e.target.value))}
                  disabled={numbersMode === 'magic'}
                  style={{ padding: '8px', border: '1px solid #ccc', borderRadius: 4, fontSize: 14 }}
                >
                  {[
                    { value: 1, label: '€1' },
                    { value: 2, label: '€2' },
                    { value: 5, label: '€5' },
                    { value: 10, label: '€10' },
                    { value: 20, label: '€20' },
                    { value: 50, label: '€50' },
                    { value: 100, label: '€100' },
                    { value: 200, label: '€200' },
                  ].map((v) => (
                    <option key={v.value} value={v.value}>
                      {v.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            {numbersMode === 'magic' && (
              <p style={{ margin: '0 0 8px 0', fontSize: 12, color: '#666' }}>
                Modalita Magic attiva: numeri giocata casuali (1-5) e importo fisso €1.
              </p>
            )}
            <label style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <input
                type="checkbox"
                checked={numeroOro}
                disabled={!numeroOroEligible || numbersMode === 'magic'}
                onChange={(e) => {
                  const checked = e.target.checked;
                  setNumeroOro(checked);
                  if (checked && columns >= 2 && columns <= 4) {
                    setNumeroOroValue(Math.floor(Math.random() * 90) + 1);
                  } else {
                    setNumeroOroValue(null);
                  }
                }}
              />
              <span style={{ fontWeight: 600, color: (numeroOroEligible && numbersMode !== 'magic') ? '#001f7f' : '#999' }}>
                Numero Oro
              </span>
            </label>
            <p style={{ margin: '6px 0 0 0', fontSize: 12, color: '#666' }}>
              Opzione disponibile solo con 2, 3 o 4 numeri giocata.
            </p>
          </div>

          {generatedNumbers.length > 0 && (
            <div style={{ background: '#f0f4ff', padding: '16px', borderRadius: 8, marginBottom: 16 }}>
              <p style={{ margin: '0 0 12px 0', fontWeight: 600, color: '#001f7f' }}>Magic Giocata:</p>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'nowrap', justifyContent: 'center' }}>
                {generatedNumbers.map((num, idx) => (
                  <span
                    key={idx}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      minWidth: 32,
                      width: 32,
                      height: 32,
                      borderRadius: '50%',
                      background: '#0066cc',
                      color: 'white',
                      fontWeight: 700,
                      fontSize: 12,
                      flexShrink: 0,
                    }}
                  >
                    {num}
                  </span>
                ))}
                {numeroOro && numeroOroValue !== null && (
                  <span
                    title="Numero Oro"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      minWidth: 32,
                      width: 32,
                      height: 32,
                      borderRadius: '50%',
                      background: 'radial-gradient(circle at 30% 30%, #ffe58a 0%, #ffd54f 45%, #f9a825 100%)',
                      color: '#4e342e',
                      fontWeight: 800,
                      fontSize: 12,
                      flexShrink: 0,
                      border: '1px solid rgba(185,120,10,0.7)',
                      boxShadow: '0 0 8px rgba(255,193,7,0.55)',
                    }}
                  >
                    {numeroOroValue}
                  </span>
                )}
              </div>
              {numeroOro && numeroOroValue !== null && (
                <p style={{ margin: '8px 0 0 0', fontSize: 12, color: '#996515', fontWeight: 700, textAlign: 'center' }}>
                  Numero Oro
                </p>
              )}
              <p style={{ margin: '10px 0 0 0', fontSize: 13, fontWeight: 700, color: '#004c99', textAlign: 'center' }}>
                {selectedCity}
              </p>
              <p style={{ margin: '12px 0 0 0', fontSize: 14, fontWeight: 600, color: '#2e7d32' }}>
                Costo base: €{baseCostText}
              </p>
              {numeroOro && (
                <p style={{ margin: '6px 0 0 0', fontSize: 13, fontWeight: 600, color: '#8e24aa' }}>
                  Opzione Numero Oro: €{numeroOroCostText}
                </p>
              )}
              <p style={{ margin: '6px 0 0 0', fontSize: 14, fontWeight: 700, color: '#1b5e20' }}>
                Totale giocata: €{generatedCostText}
              </p>
              <p style={{ margin: '6px 0 0 0', fontSize: 13, fontWeight: 600, color: '#6a1b9a' }}>
                Tipo: {playType}{numeroOro ? ' + Numero Oro' : ''}
              </p>
              <p style={{ margin: '6px 0 0 0', fontSize: 15, fontWeight: 700, color: '#c62828' }}>
                💰 Vincita max base: {maxWinText}
              </p>
              {numeroOro && (
                <>
                  <p style={{ margin: '6px 0 0 0', fontSize: 12, color: '#7b1fa2' }}>
                    Sorte con Numero Oro: €{numeroOroWithSortWin.toLocaleString('it-IT', { maximumFractionDigits: 2 })}
                  </p>
                  <p style={{ margin: '4px 0 0 0', fontSize: 12, color: '#7b1fa2' }}>
                    Solo Numero Oro: €{numeroOroOnlyWin.toLocaleString('it-IT', { maximumFractionDigits: 2 })}
                  </p>
                  <p style={{ margin: '6px 0 0 0', fontSize: 13, fontWeight: 700, color: '#8e24aa' }}>
                    💎 Vincita potenziale totale con Numero Oro: {totalPotentialWinText}
                  </p>
                </>
              )}
              {totalPotentialWin > SINGLE_PLAY_MAX_WIN && (
                <p style={{ margin: '6px 0 0 0', fontSize: 12, color: '#666' }}>
                  Limite per singola giocata applicato: €6.000.000
                </p>
              )}
              <button
                onClick={handleSavePlay}
                disabled={isSavingPlay}
                style={{
                  margin: '12px auto 0 auto',
                  width: '50%',
                  display: 'block',
                  padding: '10px 12px',
                  background: isSavingPlay ? '#9bb7f5' : '#0d47a1',
                  color: 'white',
                  border: 'none',
                  borderRadius: 6,
                  fontWeight: 700,
                  cursor: isSavingPlay ? 'not-allowed' : 'pointer',
                  fontSize: 14,
                }}
              >
                {isSavingPlay ? 'Salvataggio...' : '💾 Salva giocata'}
              </button>
              {savePlayMessage && (
                <p style={{ margin: '8px 0 0 0', fontSize: 12, color: savePlayMessage.includes('Errore') ? '#c62828' : '#2e7d32', textAlign: 'center' }}>
                  {savePlayMessage}
                </p>
              )}
            </div>
          )}

          <div style={{ display: 'flex', gap: 12 }}>
            <button
              onClick={handleRegenerate}
              style={{
                flex: 1,
                padding: '12px',
                background: '#0066cc',
                color: 'white',
                border: 'none',
                borderRadius: 6,
                fontWeight: 600,
                cursor: 'pointer',
                fontSize: 14,
              }}
            >
              ↻ Rigenera
            </button>
            <button
              style={{
                flex: 1,
                padding: '12px',
                background: '#25d366',
                color: 'white',
                border: 'none',
                borderRadius: 6,
                fontWeight: 600,
                cursor: 'pointer',
                fontSize: 14,
              }}
            >
              📱 Condividi su WhatsApp
            </button>
          </div>
        </div>

        {showMaxWinModal && (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0, 0, 0, 0.55)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 9999,
              padding: 16,
            }}
          >
            <div
              style={{
                width: '100%',
                maxWidth: 420,
                background: 'white',
                borderRadius: 10,
                padding: 20,
                boxShadow: '0 10px 30px rgba(0,0,0,0.25)',
              }}
            >
              <p style={{ margin: '0 0 8px 0', fontSize: 18, fontWeight: 700, color: '#001f7f' }}>
                Limite vincita
              </p>
              <p style={{ margin: '0 0 16px 0', fontSize: 14, color: '#333', lineHeight: 1.4 }}>
                La vincita calcolata supera il limite massimo per singola giocata. Verranno considerati al massimo €6.000.000.
              </p>
              <button
                onClick={() => setShowMaxWinModal(false)}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  border: 'none',
                  borderRadius: 8,
                  background: '#001f7f',
                  color: 'white',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Ho capito
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
