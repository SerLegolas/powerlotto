import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { pushNotificationSchedules } from "@/lib/db/schema";
import { verifyAdminRequest } from "@/lib/utils/admin";
import { randomUUID } from "crypto";
import { sql } from "drizzle-orm";

export async function GET(request: NextRequest) {
  const admin = await verifyAdminRequest(request);
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getDb();
  const rows = await db.select().from(pushNotificationSchedules).orderBy(sql`created_at DESC`);
  return NextResponse.json(rows);
}

export async function POST(request: NextRequest) {
  const admin = await verifyAdminRequest(request);
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = await request.json();
  const db = getDb();
  const [created] = await db
    .insert(pushNotificationSchedules)
    .values({
      id: randomUUID(),
      label: payload.label || "Nuova schedule",
      cronExpression: payload.cronExpression || "0 * * * *",
      time: payload.time || null,
      active: payload.active === 0 ? 0 : 1,
      targetType: payload.targetType || "all",
      targetUserIds: payload.targetUserIds || "[]",
      titleTemplate: payload.titleTemplate || "PowerLotto Notification",
      bodyTemplate: payload.bodyTemplate || "Hai un nuovo aggiornamento PowerLotto.",
    })
    .returning();

  return NextResponse.json(created, { status: 201 });
}
