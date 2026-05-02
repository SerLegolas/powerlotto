import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { randomUUID } from "crypto";
import { db } from "@/lib/db";
import { pushPreferences } from "@/lib/db/schema";
import { verifyToken } from "@/lib/utils/jwt";

function getAuthToken(request: NextRequest): string | null {
  const authHeader = request.headers.get("authorization");
  if (!authHeader) return null;
  const [, token] = authHeader.split(" ");
  return token;
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

    const rows = await db
      .select()
      .from(pushPreferences)
      .where(eq(pushPreferences.userId, payload.userId))
      .limit(1);

    if (rows.length === 0) {
      return NextResponse.json({ notifyWins: true });
    }

    return NextResponse.json({ notifyWins: rows[0].notifyWins === 1 });
  } catch (error) {
    console.error("Push preferences GET error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
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
    const notifyWins = Boolean(body?.notifyWins);

    const existing = await db
      .select({ id: pushPreferences.id })
      .from(pushPreferences)
      .where(eq(pushPreferences.userId, payload.userId))
      .limit(1);

    if (existing.length > 0) {
      await db
        .update(pushPreferences)
        .set({
          notifyWins: notifyWins ? 1 : 0,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(pushPreferences.userId, payload.userId));
    } else {
      await db.insert(pushPreferences).values({
        id: randomUUID(),
        userId: payload.userId,
        notifyWins: notifyWins ? 1 : 0,
        updatedAt: new Date().toISOString(),
      });
    }

    return NextResponse.json({ success: true, notifyWins });
  } catch (error) {
    console.error("Push preferences PATCH error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
