import { NextRequest, NextResponse } from "next/server";
import { fetchDraws } from "@/scripts/fetch-draws";

/**
 * Cron job endpoint for Vercel
 * Called daily to fetch latest lottery draws
 */
export async function GET(request: NextRequest) {
  // Verify the request is from Vercel
  const auth = request.headers.get("authorization");
  const isDev = process.env.NODE_ENV !== "production";
  if (!isDev && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
