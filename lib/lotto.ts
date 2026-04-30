import { db } from "@/lib/db";
import { stats } from "@/lib/db/schema";
import { sql } from "drizzle-orm";

// Costi unitari per tipo di giocata
const COSTI_UNITARI = {
  ambetto: 1.0,
  ambo: 1.0,
  terno: 1.5,
  quaterna: 3.0,
  cinquina: 5.0,
};

interface MagicLottoOptions {
  ruota: string;
  colonne: number;
  superstar?: boolean;
  metodo: "ritardo" | "frequenza" | "equilibrio";
}

interface GeneratedColumn {
  numbers: number[];
  superstar?: number;
  costo: number;
}

/**
 * MagicLotto: Genera giocate inteligenti basate su statistiche
 * @param options Opzioni di configurazione
 * @returns Array di colonne generate
 */
export async function magicLotto(
  options: MagicLottoOptions
): Promise<GeneratedColumn[]> {
  const { ruota, colonne, superstar = false, metodo } = options;

  // Fetch statistics for the wheel
  const wheelsStats = await db
    .select()
    .from(stats)
    .where(sql`ruota = ${ruota}`)
    .limit(90);

  if (wheelsStats.length === 0) {
    // Fallback: random generation
    return generateRandomColumns(colonne, superstar);
  }

  // Sort by method
  let sortedNumbers: typeof wheelsStats = [];

  if (metodo === "ritardo") {
    // Sort by delay (highest first)
    sortedNumbers = wheelsStats.sort(
      (a: typeof wheelsStats[0], b: typeof wheelsStats[0]) => (b.ritardo || 0) - (a.ritardo || 0)
    );
  } else if (metodo === "frequenza") {
    // Sort by frequency (highest first)
    sortedNumbers = wheelsStats.sort(
      (a: typeof wheelsStats[0], b: typeof wheelsStats[0]) => (b.frequenza || 0) - (a.frequenza || 0)
    );
  } else {
    // "equilibrio": mix between delay and frequency
    sortedNumbers = wheelsStats.sort((a: typeof wheelsStats[0], b: typeof wheelsStats[0]) => {
      const scoreA = (a.ritardo || 0) * 0.6 + (a.frequenza || 0) * 0.4;
      const scoreB = (b.ritardo || 0) * 0.6 + (b.frequenza || 0) * 0.4;
      return scoreB - scoreA;
    });
  }

  // Generate columns
  const columns: GeneratedColumn[] = [];

  for (let i = 0; i < colonne; i++) {
    // Get 5 best numbers, with some randomness
    const topNumbers = sortedNumbers.slice(0, 15);
    const selected = topNumbers
      .sort(() => Math.random() - 0.5)
      .slice(0, 5)
      .map((n: typeof wheelsStats[0]) => n.numero)
      .sort((a: number, b: number) => a - b);

    const generatedSuperstar = superstar
      ? Math.floor(Math.random() * 90) + 1
      : undefined;

    columns.push({
      numbers: selected,
      superstar: generatedSuperstar,
      costo: calculateCost(selected, generatedSuperstar),
    });
  }

  return columns;
}

/**
 * Calcola il costo di una giocata
 */
export function calculateCost(numbers: number[], superstar?: number): number {
  let costo = COSTI_UNITARI["cinquina"]; // base cost for 5 numbers

  // Add cost if superstar is selected
  if (superstar) {
    costo += 0.5; // additional cost for superstar
  }

  return costo;
}

/**
 * Genera colonne casuali (fallback)
 */
function generateRandomColumns(
  colonne: number,
  superstar: boolean
): GeneratedColumn[] {
  const columns: GeneratedColumn[] = [];

  for (let i = 0; i < colonne; i++) {
    const numbers = Array.from({ length: 5 }, () =>
      Math.floor(Math.random() * 90) + 1
    )
      .filter((v, i, a) => a.indexOf(v) === i)
      .sort((a, b) => a - b);

    // Ensure we have 5 numbers
    while (numbers.length < 5) {
      const newNum = Math.floor(Math.random() * 90) + 1;
      if (!numbers.includes(newNum)) {
        numbers.push(newNum);
      }
    }

    const generatedSuperstar = superstar
      ? Math.floor(Math.random() * 90) + 1
      : undefined;

    columns.push({
      numbers: numbers.slice(0, 5).sort((a, b) => a - b),
      superstar: generatedSuperstar,
      costo: calculateCost(numbers, generatedSuperstar),
    });
  }

  return columns;
}

/**
 * Calcola costo totale di una giocata
 */
export function calculateTotalCost(
  columns: GeneratedColumn[],
  ruote: number = 1
): number {
  const columnCost = columns.reduce((sum, col) => sum + col.costo, 0);
  return columnCost * ruote;
}
