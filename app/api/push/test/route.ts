import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/utils/jwt";
import { sendPushToUser } from "@/lib/push/send";

function getAuthToken(request: NextRequest): string | null {
  const authHeader = request.headers.get("authorization");
  if (!authHeader) return null;
  const [, token] = authHeader.split(" ");
  return token;
}

export async function POST(request: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not available in production" }, { status: 403 });
  }

  const token = getAuthToken(request);
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = verifyToken(token);
  if (!payload) {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }

  const result = await sendPushToUser(payload.userId, {
    title: "🎰 Test Vincita PowerLotto",
    body: "Hai 2 giocate vincenti su Roma (2026-05-02): 1 terno, 1 ambo.",
    icon: "/icons/icon-192.png",
    data: {
      kind: "winning",
      ruota: "Roma",
      date: "2026-05-02",
      drawId: 0,
      winningPlays: 2,
    },
  });

  return NextResponse.json({ success: true, result });
}
