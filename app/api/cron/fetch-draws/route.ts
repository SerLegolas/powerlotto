import { NextRequest, NextResponse } from "next/server";
import { fetchDraws } from "@/scripts/fetch-draws";

/**
 * Cron job endpoint for Vercel
 * Called daily to fetch latest lottery draws
 */
export async function GET(request: NextRequest) {
  const isDev = process.env.NODE_ENV !== "production";

  // In production, verifica il token solo se CRON_SECRET è configurato.
  if (!isDev) {
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret) {
      const auth = request.headers.get("authorization");
      const bearerToken = auth?.startsWith("Bearer ") ? auth.slice(7) : null;
      const queryToken = request.nextUrl.searchParams.get("token");
      const providedToken = bearerToken ?? queryToken;

      if (providedToken !== cronSecret) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    }
  }

  try {
    console.log("🎰 Starting cron job: fetch lottery draws");

    const summary = await fetchDraws();

    return NextResponse.json(
      {
        success: true,
        message: "Lottery draws fetched and processed successfully",
        summary,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("❌ Cron job failed:", error);

    return NextResponse.json(
      {
        error: "Failed to fetch draws",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
