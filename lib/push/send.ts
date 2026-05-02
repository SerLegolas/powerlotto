import webpush from "web-push";
import { db } from "@/lib/db";
import { pushSubscriptions } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

type PushPayload = {
  title: string;
  body: string;
  icon?: string;
  data?: Record<string, unknown>;
};

type SendResult = {
  total: number;
  sent: number;
  failed: number;
  cleaned: number;
};

type WebPushError = Error & {
  statusCode?: number;
};

let vapidConfigured = false;

function ensureVapidConfigured() {
  if (vapidConfigured) return;

  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || "mailto:support@powerlotto.local";

  if (!publicKey || !privateKey) {
    throw new Error("Missing VAPID keys: NEXT_PUBLIC_VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY are required");
  }

  webpush.setVapidDetails(subject, publicKey, privateKey);
  vapidConfigured = true;
}

export async function sendPushToUser(userId: string, payload: PushPayload): Promise<SendResult> {
  ensureVapidConfigured();

  const subscriptions = await db
    .select()
    .from(pushSubscriptions)
    .where(eq(pushSubscriptions.userId, userId));

  if (subscriptions.length === 0) {
    return { total: 0, sent: 0, failed: 0, cleaned: 0 };
  }

  let sent = 0;
  let failed = 0;
  let cleaned = 0;

  const message = JSON.stringify(payload);

  for (const sub of subscriptions) {
    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: {
            p256dh: sub.p256dh,
            auth: sub.auth,
          },
        },
        message
      );
      sent += 1;
    } catch (error) {
      failed += 1;

      const pushError = error as WebPushError;
      if (pushError.statusCode === 404 || pushError.statusCode === 410) {
        await db.delete(pushSubscriptions).where(eq(pushSubscriptions.endpoint, sub.endpoint));
        cleaned += 1;
      }

      console.error("Push send failed", {
        userId,
        endpoint: sub.endpoint,
        statusCode: pushError.statusCode,
      });
    }
  }

  return {
    total: subscriptions.length,
    sent,
    failed,
    cleaned,
  };
}
