import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { plays } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { verifyToken } from "@/lib/utils/jwt";
import { randomUUID } from "crypto";

function getAuthToken(request: NextRequest): string | null {
  const authHeader = request.headers.get("authorization");
  if (!authHeader) return null;
  const [, token] = authHeader.split(" ");
  return token;
}

function normalizeNumbers(numbers: number[]): string {
  return [...numbers]
    .map((n) => Number(n))
    .filter((n) => Number.isFinite(n))
    .sort((a, b) => a - b)
    .join("-");
}

function normalizeCost(cost: number): string {
  return Number(cost).toFixed(2);
}

export async function GET(request: NextRequest) {
  try {
    const token = getAuthToken(request);
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const payload = verifyToken(token);
    if (!payload) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    const userPlays = await db
      .select()
      .from(plays)
      .where(eq(plays.userId, payload.userId))
      .orderBy(plays.createdAt);

    return NextResponse.json(userPlays);
  } catch (error) {
    console.error("Plays error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const token = getAuthToken(request);
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const payload = verifyToken(token);
    if (!payload) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    const body = await request.json();
    const { numbers, superstar, colonne, costo, ruota } = body;

    if (!numbers || !Array.isArray(numbers) || !colonne || costo === undefined) {
      return NextResponse.json(
        { error: "Invalid play data" },
        { status: 400 }
      );
    }

    const currentFingerprint = `${normalizeNumbers(numbers)}|${Number(colonne)}|${normalizeCost(costo)}|${superstar ?? "null"}`;
    const userPlays = await db
      .select()
      .from(plays)
      .where(eq(plays.userId, payload.userId));

    const duplicate = userPlays.find((p: (typeof userPlays)[number]) => {
      let parsedNumbers: number[] = [];
      try {
        const parsed = JSON.parse(p.numbers);
        if (Array.isArray(parsed)) {
          parsedNumbers = parsed.map((n) => Number(n)).filter((n) => Number.isFinite(n));
        }
      } catch {
        parsedNumbers = [];
      }

      const playFingerprint = `${normalizeNumbers(parsedNumbers)}|${Number(p.colonne)}|${normalizeCost(p.costo)}|${p.superstar ?? "null"}`;
      return playFingerprint === currentFingerprint;
    });

    if (duplicate) {
      return NextResponse.json(
        { error: "Duplicate play", play: duplicate },
        { status: 409 }
      );
    }

    const newPlay = await db
      .insert(plays)
      .values({
        id: randomUUID(),
        userId: payload.userId,
        numbers: JSON.stringify(numbers),
        superstar: superstar ?? null,
        colonne,
        costo,
        ruota: ruota ?? '',
      })
      .returning();

    return NextResponse.json(newPlay[0], { status: 201 });
  } catch (error) {
    console.error("Play creation error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
