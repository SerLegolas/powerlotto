import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { pushNotificationSchedules } from "@/lib/db/schema";
import { verifyAdminRequest } from "@/lib/utils/admin";
import { eq } from "drizzle-orm";

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const admin = await verifyAdminRequest(request);
  const params = await context.params;
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = await request.json();
  const db = getDb();
  const scheduleId = params.id;
  const updateData: Record<string, unknown> = {
    updatedAt: new Date().toISOString(),
  };

  if (payload.label !== undefined) updateData.label = payload.label;
  if (payload.cronExpression !== undefined) updateData.cronExpression = payload.cronExpression;
  if (payload.time !== undefined) updateData.time = payload.time;
  if (payload.active !== undefined) updateData.active = payload.active;
  if (payload.targetType !== undefined) updateData.targetType = payload.targetType;
  if (payload.targetUserIds !== undefined) updateData.targetUserIds = payload.targetUserIds;
  if (payload.titleTemplate !== undefined) updateData.titleTemplate = payload.titleTemplate;
  if (payload.bodyTemplate !== undefined) updateData.bodyTemplate = payload.bodyTemplate;

  await db
    .update(pushNotificationSchedules)
    .set(updateData)
    .where(eq(pushNotificationSchedules.id, scheduleId));

  const rows = await db
    .select()
    .from(pushNotificationSchedules)
    .where(eq(pushNotificationSchedules.id, scheduleId))
    .limit(1);

  if (!rows.length) {
    return NextResponse.json({ error: "Schedule not found" }, { status: 404 });
  }

  return NextResponse.json(rows[0]);
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const admin = await verifyAdminRequest(request);
  const params = await context.params;
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const scheduleId = params.id;
  const db = getDb();
  await db.delete(pushNotificationSchedules).where(eq(pushNotificationSchedules.id, scheduleId));

  return NextResponse.json({ success: true });
}
