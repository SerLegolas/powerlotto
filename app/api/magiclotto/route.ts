import { NextRequest, NextResponse } from "next/server";
import { magicLotto, calculateTotalCost } from "@/lib/lotto";
import { verifyToken } from "@/lib/utils/jwt";
import { db } from "@/lib/db";
import { plays } from "@/lib/db/schema";
import { randomUUID } from "crypto";

function getAuthToken(request: NextRequest): string | null {
  const authHeader = request.headers.get("authorization");
  if (!authHeader) return null;
  const [, token] = authHeader.split(" ");
  return token;
}

export async function POST(request: NextRequest) {
  try {
    const token = getAuthToken(request);
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const payload = verifyToken(token);
    if (!payload) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    const body = await request.json();
    const { ruota, colonne = 1, superstar = false, metodo = "equilibrio" } = body;

    if (!ruota || !colonne || colonne < 1 || colonne > 10) {
      return NextResponse.json(
        { error: "Invalid parameters" },
        { status: 400 }
      );
    }

    // Generate magic lotto columns
    const columns = await magicLotto({
      ruota,
      colonne,
      superstar,
      metodo,
    });

    // Calculate total cost
    const totalCosto = calculateTotalCost(columns, 1);

    // Save to database
    const playId = randomUUID();
    const allNumbers = columns.flatMap((col, idx) => ({
      colonna: idx + 1,
      numeri: col.numbers,
      superstar: col.superstar,
    }));

    const savedPlay = await db
      .insert(plays)
      .values({
        id: playId,
        userId: payload.userId,
        numbers: JSON.stringify(allNumbers),
        superstar: superstar ? 1 : 0,
        colonne,
        costo: totalCosto,
      })
      .returning();

    return NextResponse.json({
      columns,
      totalCosto,
      play: savedPlay[0],
      shareUrl: `${process.env.NEXT_PUBLIC_API_URL}/play/${playId}`,
      whatsappText: generateWhatsappText(columns, ruota, totalCosto),
    });
  } catch (error) {
    console.error("MagicLotto error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

function generateWhatsappText(
  columns: Array<{ numbers: number[]; superstar?: number }>,
  ruota: string,
  costo: number
): string {
  let text = `🎯 *POWERLOTTO - Estratti MagicLotto*\n\n`;
  text += `📍 *${ruota}*\n\n`;

  columns.forEach((col, idx) => {
    text += `*Colonna ${idx + 1}:*\n`;
    text += `🔢 ${col.numbers.join(" - ")}\n`;
    if (col.superstar) {
      text += `⭐ Superstar: ${col.superstar}\n`;
    }
    text += "\n";
  });

  text += `💰 *Costo totale: €${costo.toFixed(2)}*\n\n`;
  text += `Generato con 🚀 PowerLotto\n`;
  text += `https://powerlotto.vercel.app`;

  return text;
}
