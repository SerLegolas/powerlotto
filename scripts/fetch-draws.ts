import "dotenv/config";
import axios from "axios";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { draws, stats } from "@/lib/db/schema";

const SOURCE_URL = process.env.LOTTO_SOURCE_URL || "https://www.estrazionidellotto.it/";
const WHEELS = [
  "Bari",
  "Cagliari",
  "Firenze",
  "Genova",
  "Milano",
  "Napoli",
  "Palermo",
  "Roma",
  "Torino",
  "Venezia",
  "Nazionale",
];

const MONTHS: Record<string, string> = {
  gennaio: "01",
  febbraio: "02",
  marzo: "03",
  aprile: "04",
  maggio: "05",
  giugno: "06",
  luglio: "07",
  agosto: "08",
  settembre: "09",
  ottobre: "10",
  novembre: "11",
  dicembre: "12",
};

type ParsedDraw = {
  date: string;
  ruota: string;
  numbers: [number, number, number, number, number];
};

type FetchSummary = {
  insertedDraws: number;
  updatedStats: number;
  drawDate: string;
};

function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function parseItalianDate(raw: string): string {
  const normalized = normalizeText(raw).toLowerCase();
  const parts = normalized.split(" ").filter(Boolean);
  const dateParts = parts.length >= 4 ? parts.slice(parts.length - 3) : parts;

  if (dateParts.length !== 3) {
    return new Date().toISOString().slice(0, 10);
  }

  const [dayRaw, monthRaw, yearRaw] = dateParts;
  const day = dayRaw.padStart(2, "0");
  const month = MONTHS[monthRaw] || "01";
  const year = yearRaw;

  if (!/^\d{4}$/.test(year) || !/^\d{2}$/.test(day)) {
    return new Date().toISOString().slice(0, 10);
  }

  return `${year}-${month}-${day}`;
}

function extractDrawsFromPage(html: string): ParsedDraw[] {
  const text = normalizeText(html.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " "));

  const dateMatch = text.match(/Estrazione Lotto di\s+([^]+?)\s+Concorso\s+n/i);
  const drawDate = parseItalianDate(dateMatch?.[1] || "");

  const sectionStart = text.indexOf("Concorso n");
  const sectionEndMarker = "Resta sempre aggiornato";
  const sectionEnd = text.indexOf(sectionEndMarker);
  const section = sectionStart >= 0
    ? text.slice(sectionStart, sectionEnd > sectionStart ? sectionEnd : undefined)
    : text;

  const results: ParsedDraw[] = [];

  for (const wheel of WHEELS) {
    const escapedWheel = wheel.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(`${escapedWheel}\\s+(\\d{1,2})\\s+(\\d{1,2})\\s+(\\d{1,2})\\s+(\\d{1,2})\\s+(\\d{1,2})`, "i");
    const match = section.match(regex);

    if (!match) {
      continue;
    }

    const parsed = match.slice(1, 6).map((value) => Number(value));
    const valid = parsed.every((n) => Number.isInteger(n) && n >= 1 && n <= 90);

    if (!valid) {
      continue;
    }

    results.push({
      date: drawDate,
      ruota: wheel,
      numbers: [parsed[0], parsed[1], parsed[2], parsed[3], parsed[4]],
    });
  }

  return results;
}

async function upsertDraws(parsedDraws: ParsedDraw[]): Promise<number> {
  let inserted = 0;

  for (const draw of parsedDraws) {
    const existing = await db
      .select({ id: draws.id })
      .from(draws)
      .where(and(eq(draws.date, draw.date), eq(draws.ruota, draw.ruota)))
      .limit(1);

    if (existing.length) {
      continue;
    }

    await db.insert(draws).values({
      date: draw.date,
      ruota: draw.ruota,
      n1: draw.numbers[0],
      n2: draw.numbers[1],
      n3: draw.numbers[2],
      n4: draw.numbers[3],
      n5: draw.numbers[4],
    });

    inserted += 1;
  }

  return inserted;
}

async function recomputeStats(): Promise<number> {
  const allDraws = await db.select().from(draws);
  const byWheel = new Map<string, typeof allDraws>();

  for (const row of allDraws) {
    const list = byWheel.get(row.ruota) || [];
    list.push(row);
    byWheel.set(row.ruota, list);
  }

  let updated = 0;

  for (const [wheel, wheelDraws] of byWheel.entries()) {
    const sortedByDateDesc = [...wheelDraws].sort((a, b) => {
      const at = new Date(a.date).getTime() || 0;
      const bt = new Date(b.date).getTime() || 0;
      return bt - at;
    });

    const frequency = Array.from({ length: 91 }, () => 0);
    const delay = Array.from({ length: 91 }, () => sortedByDateDesc.length + 1);

    sortedByDateDesc.forEach((row, index) => {
      const nums = [row.n1, row.n2, row.n3, row.n4, row.n5];
      for (const n of nums) {
        if (!n || n < 1 || n > 90) continue;
        frequency[n] += 1;
        if (delay[n] === sortedByDateDesc.length + 1) {
          delay[n] = index;
        }
      }
    });

    // Upsert batch: un'unica operazione per ruota invece di 90 query singole
    const now = new Date().toISOString();
    const rows = Array.from({ length: 90 }, (_, i) => ({
      ruota: wheel,
      numero: i + 1,
      ritardo: delay[i + 1],
      frequenza: frequency[i + 1],
      updatedAt: now,
    }));

    await db
      .insert(stats)
      .values(rows)
      .onConflictDoUpdate({
        target: [stats.ruota, stats.numero],
        set: {
          ritardo: sql`excluded.ritardo`,
          frequenza: sql`excluded.frequenza`,
          updatedAt: sql`excluded.updated_at`,
        },
      });

    updated += rows.length;
  }

  return updated;
}

export async function fetchDraws(): Promise<FetchSummary> {
  if (!db) {
    throw new Error("Database not initialized. Check TURSO_CONNECTION_URL and TURSO_AUTH_TOKEN.");
  }

  const { data: html } = await axios.get<string>(SOURCE_URL, {
    timeout: 15000,
    headers: {
      "User-Agent": "PowerLottoBot/1.0 (+https://powerlotto.local)",
    },
  });

  const parsedDraws = extractDrawsFromPage(html);

  if (!parsedDraws.length) {
    throw new Error("No draws parsed from live source");
  }

  const insertedDraws = await upsertDraws(parsedDraws);
  const updatedStats = await recomputeStats();

  return {
    insertedDraws,
    updatedStats,
    drawDate: parsedDraws[0].date,
  };
}

if (require.main === module) {
  fetchDraws()
    .then((summary) => {
      console.log("Fetch completed:", summary);
      process.exit(0);
    })
    .catch((error) => {
      console.error("Fetch failed:", error);
      process.exit(1);
    });
}
