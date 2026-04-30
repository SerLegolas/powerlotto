import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { draws } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const ruota = searchParams.get("ruota");
    const limit =parseInt(searchParams.get("limit") || "90");

    let allDraws;

    if (ruota) {
      allDraws = await db
        .select()
        .from(draws)
        .where(eq(draws.ruota, ruota))
        .orderBy(draws.date)
        .limit(limit)
        .offset(0);
    } else {
      allDraws = await db
        .select()
        .from(draws)
        .orderBy(draws.date)
        .limit(limit)
        .offset(0);
    }

    return NextResponse.json(allDraws);
  } catch (error) {
    console.error("Draws error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { date, ruota, numbers } = body;

    if (!date || !ruota || !numbers || numbers.length !== 5) {
      return NextResponse.json(
        { error: "Invalid draw data" },
        { status: 400 }
      );
    }

    const newDraw = await db
      .insert(draws)
      .values({
        date,
        ruota,
        n1: numbers[0],
        n2: numbers[1],
        n3: numbers[2],
        n4: numbers[3],
        n5: numbers[4],
      })
      .returning();

    return NextResponse.json(newDraw[0], { status: 201 });
  } catch (error) {
    console.error("Draw creation error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
