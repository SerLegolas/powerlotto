import { NextRequest, NextResponse } from "next/server";
import { verifyAdminRequest } from "@/lib/utils/admin";
import { sendPushMessage } from "@/lib/push/dispatch";

export async function POST(request: NextRequest) {
  const admin = await verifyAdminRequest(request);
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = await request.json();
  const title = payload.title || "PowerLotto Notification";
  const body = payload.body || "Hai un nuovo aggiornamento PowerLotto.";
  const targetType = payload.targetType || "all";
  const targetUserIds = payload.targetUsernames ?? payload.targetUserIds ?? "[]";

  const summary = await sendPushMessage(title, body, targetType, targetUserIds);
  return NextResponse.json({ success: true, summary });
}
