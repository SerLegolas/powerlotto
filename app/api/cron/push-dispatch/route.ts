import { NextRequest, NextResponse } from "next/server";
import { getPushSettings, listSchedules, sendPushMessage } from "@/lib/push/dispatch";

function getAuthToken(request: NextRequest): string | null {
  const authHeader = request.headers.get("authorization");
  if (!authHeader) return null;
  const parts = authHeader.split(" ");
  return parts[0] === "Bearer" && parts[1] ? parts[1] : null;
}

function isScheduleDue(schedule: { time: string | null; cronExpression: string }) {
  const now = new Date();
  const utcHours = String(now.getUTCHours()).padStart(2, "0");
  const utcMinutes = String(now.getUTCMinutes()).padStart(2, "0");
  const currentTime = `${utcHours}:${utcMinutes}`;

  if (schedule.time) {
    return schedule.time === currentTime;
  }

  if (schedule.cronExpression === "0 * * * *") {
    return utcMinutes === "00";
  }

  if (schedule.cronExpression === "*/15 * * * *") {
    return ["00", "15", "30", "45"].includes(utcMinutes);
  }

  return false;
}

export async function GET(request: NextRequest) {
  const isDev = process.env.NODE_ENV !== "production";
  if (!isDev) {
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret) {
      const providedToken = getAuthToken(request) ?? request.nextUrl.searchParams.get("token");
      if (providedToken !== cronSecret) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    }
  }

  try {
    const settings = await getPushSettings();
    if (!settings.enabled) {
      return NextResponse.json({ success: true, message: "Push dispatch disabled" });
    }

    const schedules = await listSchedules();
    const dueSchedules = schedules.filter((schedule) => schedule.active === 1 && isScheduleDue(schedule));

    if (!dueSchedules.length) {
      return NextResponse.json({ success: true, message: "No schedules due" });
    }

    const results = [];
    for (const schedule of dueSchedules) {
      const summary = await sendPushMessage(
        schedule.titleTemplate || settings.titleTemplate,
        schedule.bodyTemplate || settings.bodyTemplate,
        schedule.targetType,
        schedule.targetUserIds
      );
      results.push({ scheduleId: schedule.id, label: schedule.label, summary });
    }

    return NextResponse.json({ success: true, results });
  } catch (error) {
    console.error("Push dispatch error:", error);
    return NextResponse.json(
      { error: "Dispatch failed", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
