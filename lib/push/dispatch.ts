import { eq, sql } from "drizzle-orm";
import { randomUUID } from "crypto";
import { db } from "@/lib/db";
import {
  users,
  pushNotificationSchedules,
  pushNotificationSettings,
  pushPreferences,
  pushSubscriptions,
} from "@/lib/db/schema";
import { sendPushToUser } from "@/lib/push/send";

export type TargetType = "all" | "notifyWins" | "manual";

export async function getPushSettings() {
  const rows = await db.select().from(pushNotificationSettings).limit(1);
  if (rows.length > 0) {
    return rows[0];
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
  return created;
}

export async function updatePushSettings(payload: {
  enabled?: number;
  mode?: string;
  titleTemplate?: string;
  bodyTemplate?: string;
}) {
  const settings = await getPushSettings();
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

  return getPushSettings();
}

export async function listSchedules() {
  return db
    .select()
    .from(pushNotificationSchedules)
    .orderBy(sql`created_at DESC`)
    .all();
}

export async function createSchedule(payload: {
  label: string;
  cronExpression?: string;
  time?: string;
  active?: number;
  targetType?: TargetType;
  targetUserIds?: string;
  titleTemplate?: string;
  bodyTemplate?: string;
}) {
  const values = {
    id: randomUUID(),
    label: payload.label,
    cronExpression: payload.cronExpression ?? "0 * * * *",
    time: payload.time ?? null,
    active: payload.active ?? 1,
    targetType: payload.targetType ?? "all",
    targetUserIds: payload.targetUserIds ?? "[]",
    titleTemplate: payload.titleTemplate ?? "PowerLotto Notification",
    bodyTemplate: payload.bodyTemplate ?? "Hai un nuovo aggiornamento PowerLotto.",
  };
  const [created] = await db.insert(pushNotificationSchedules).values(values).returning();
  return created;
}

export async function updateSchedule(id: string, payload: Partial<{
  label: string;
  cronExpression: string;
  time: string | null;
  active: number;
  targetType: TargetType;
  targetUserIds: string;
  titleTemplate: string;
  bodyTemplate: string;
}>) {
  await db
    .update(pushNotificationSchedules)
    .set({
      ...payload,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(pushNotificationSchedules.id, id));
  const rows = await db.select().from(pushNotificationSchedules).where(eq(pushNotificationSchedules.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function deleteSchedule(id: string) {
  await db.delete(pushNotificationSchedules).where(eq(pushNotificationSchedules.id, id));
}

async function findUserIdForUsernameOrIdentifier(identifier: string) {
  const normalized = identifier.trim().toLowerCase();
  if (!normalized) {
    return null;
  }

  const rows = await db.select({ id: users.id, email: users.email }).from(users);
  const match = rows.find((row) => {
    const emailLower = row.email.toLowerCase();
    if (emailLower === normalized) {
      return true;
    }

    const localPart = emailLower.split("@")[0];
    if (localPart === normalized) {
      return true;
    }

    if (row.id.toLowerCase() === normalized) {
      return true;
    }

    return false;
  });

  return match?.id ?? null;
}

async function resolveManualTargetUserIds(targetUserIds: string) {
  let ids: unknown[] = [];
  try {
    ids = JSON.parse(targetUserIds);
  } catch {
    ids = [];
  }

  if (!Array.isArray(ids)) {
    return [];
  }

  const resolvedIds: string[] = [];
  for (const item of ids) {
    if (typeof item !== "string") {
      continue;
    }
    const identifier = item.trim();
    if (!identifier) {
      continue;
    }
    const userId = await findUserIdForUsernameOrIdentifier(identifier);
    if (userId) {
      resolvedIds.push(userId);
    }
  }

  return Array.from(new Set(resolvedIds));
}

export async function resolveTargetUserIds(
  targetType: string,
  targetUserIds: string
) {
  const effectiveTargetType = ["all", "notifyWins", "manual"].includes(targetType)
    ? (targetType as TargetType)
    : "all";
  if (targetType === "manual") {
    return resolveManualTargetUserIds(targetUserIds);
  }

  if (targetType === "notifyWins") {
    const rows = await db
      .select({ userId: pushSubscriptions.userId })
      .from(pushSubscriptions)
      .innerJoin(pushPreferences, eq(pushSubscriptions.userId, pushPreferences.userId))
      .where(eq(pushPreferences.notifyWins, 1));

    return Array.from(new Set(rows.map((row) => row.userId)));
  }

  const rows = await db.select({ userId: pushSubscriptions.userId }).from(pushSubscriptions);
  return Array.from(new Set(rows.map((row) => row.userId)));
}

export async function sendPushMessage(
  title: string,
  body: string,
  targetType: string,
  targetUserIds: string
) {
  const userIds = await resolveTargetUserIds(targetType, targetUserIds);
  const summary = {
    totalUsers: userIds.length,
    notificationsSent: 0,
    notificationsFailed: 0,
    subscriptionsCleaned: 0,
    results: [] as Array<{ userId: string; sent: number; failed: number; cleaned: number }>,
  };

  for (const userId of userIds) {
    const result = await sendPushToUser(userId, {
      title,
      body,
      icon: "/icons/icon-192.png",
      data: { kind: "admin" },
    });

    summary.notificationsSent += result.sent;
    summary.notificationsFailed += result.failed;
    summary.subscriptionsCleaned += result.cleaned;
    summary.results.push({ userId, sent: result.sent, failed: result.failed, cleaned: result.cleaned });
  }

  return summary;
}
