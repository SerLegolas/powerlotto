import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { stats } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const ruota = searchParams.get("ruota");

    let allStats;

    if (ruota) {
      allStats = await db
        .select()
        .from(stats)
        .where(eq(stats.ruota, ruota))
        .orderBy(stats.ritardo);
    } else {
      allStats = await db.select().from(stats).orderBy(stats.ritardo);
    }

    return NextResponse.json(allStats);
  } catch (error) {
    console.error("Stats error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { ruota, numero, ritardo, frequenza } = body;

    if (ruota === undefined || numero === undefined) {
      return NextResponse.json(
        { error: "Missing ruota or numero" },
        { status: 400 }
      );
    }

    const newStat = await db
      .insert(stats)
      .values({
        ruota,
        numero,
        ritardo: ritardo || 0,
        frequenza: frequenza || 0,
      })
      .returning();

    return NextResponse.json(newStat[0], { status: 201 });
  } catch (error) {
    console.error("Stats creation error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
