import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { pushNotificationSettings } from "@/lib/db/schema";
import { verifyAdminRequest } from "@/lib/utils/admin";
import { eq } from "drizzle-orm";
import { randomUUID } from "crypto";

export async function GET(request: NextRequest) {
  const admin = await verifyAdminRequest(request);
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getDb();
  const rows = await db.select().from(pushNotificationSettings).limit(1);
  if (rows.length > 0) {
    return NextResponse.json(rows[0]);
  }

  const [created] = await db
    .insert(pushNotificationSettings)
    .values({
      id: randomUUID(),
      enabled: 1,
      mode: "scheduled",
      titleTemplate: "PowerLotto Notification",
      bodyTemplate: "Hai un nuovo aggiornamento PowerLotto.",
    })
    .returning();

  return NextResponse.json(created);
}

export async function PATCH(request: NextRequest) {
  const admin = await verifyAdminRequest(request);
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = await request.json();
  const db = getDb();
  const rows = await db.select().from(pushNotificationSettings).limit(1);
  let settings = rows[0];

  if (!settings) {
    const [created] = await db
      .insert(pushNotificationSettings)
      .values({
        id: randomUUID(),
        enabled: payload.enabled ? 1 : 0,
        mode: payload.mode || "scheduled",
        titleTemplate: payload.titleTemplate || "PowerLotto Notification",
        bodyTemplate: payload.bodyTemplate || "Hai un nuovo aggiornamento PowerLotto.",
      })
      .returning();
    settings = created;
  } else {
    await db
      .update(pushNotificationSettings)
      .set({
        enabled: payload.enabled ?? settings.enabled,
        mode: payload.mode ?? settings.mode,
        titleTemplate: payload.titleTemplate ?? settings.titleTemplate,
        bodyTemplate: payload.bodyTemplate ?? settings.bodyTemplate,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(pushNotificationSettings.id, settings.id));
  }

  const updated = await db.select().from(pushNotificationSettings).limit(1);
  return NextResponse.json(updated[0]);
}
