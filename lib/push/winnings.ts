import { and, eq } from "drizzle-orm";
import { randomUUID } from "crypto";
import { db } from "@/lib/db";
import { draws, plays, pushNotificationLogs, pushPreferences } from "@/lib/db/schema";
import { sendPushToUser } from "@/lib/push/send";

type InsertedDraw = {
  date: string;
  ruota: string;
  numbers: [number, number, number, number, number];
};

type WinningPlay = {
  playId: string;
  matches: number;
  prize: "ambo" | "terno" | "quaterna" | "cinquina";
};

type NotifySummary = {
  drawsProcessed: number;
  usersEvaluated: number;
  usersNotified: number;
  notificationsSent: number;
  notificationsFailed: number;
  subscriptionsCleaned: number;
};

function parsePlayNumbers(raw: string): number[] {
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .map((n) => Number(n))
      .filter((n) => Number.isInteger(n) && n >= 1 && n <= 90);
  } catch {
    return [];
  }
}

function getMatchCount(playNumbers: number[], drawNumbers: number[]): number {
  const drawSet = new Set(drawNumbers);
  let count = 0;

  for (const n of playNumbers) {
    if (drawSet.has(n)) count += 1;
  }

  return count;
}

function prizeFromMatches(matches: number): WinningPlay["prize"] | null {
  if (matches >= 5) return "cinquina";
  if (matches === 4) return "quaterna";
  if (matches === 3) return "terno";
  if (matches === 2) return "ambo";
  return null;
}

function buildNotificationBody(ruota: string, date: string, winningPlays: WinningPlay[]): string {
  const byPrize = winningPlays.reduce<Record<string, number>>((acc, play) => {
    acc[play.prize] = (acc[play.prize] || 0) + 1;
    return acc;
  }, {});

  const parts = ["cinquina", "quaterna", "terno", "ambo"]
    .filter((key) => byPrize[key])
    .map((key) => `${byPrize[key]} ${key}`);

  return `Hai ${winningPlays.length} giocata/e vincente/i su ${ruota} (${date}): ${parts.join(", ")}.`;
}

export async function notifyWinningUsersForDraws(insertedDraws: InsertedDraw[]): Promise<NotifySummary> {
  if (insertedDraws.length === 0) {
    return {
      drawsProcessed: 0,
      usersEvaluated: 0,
      usersNotified: 0,
      notificationsSent: 0,
      notificationsFailed: 0,
      subscriptionsCleaned: 0,
    };
  }

  const summary: NotifySummary = {
    drawsProcessed: 0,
    usersEvaluated: 0,
    usersNotified: 0,
    notificationsSent: 0,
    notificationsFailed: 0,
    subscriptionsCleaned: 0,
  };

  for (const inserted of insertedDraws) {
    const drawRows = await db
      .select()
      .from(draws)
      .where(and(eq(draws.date, inserted.date), eq(draws.ruota, inserted.ruota)))
      .limit(1);

    if (drawRows.length === 0) {
      continue;
    }

    const draw = drawRows[0];
    const drawNumbers = [draw.n1, draw.n2, draw.n3, draw.n4, draw.n5].filter(
      (n): n is number => Number.isInteger(n)
    );

    if (drawNumbers.length !== 5) {
      continue;
    }

    const confirmedPlays = await db
      .select()
      .from(plays)
      .where(and(eq(plays.ruota, draw.ruota), eq(plays.confermata, 1)));

    if (confirmedPlays.length === 0) {
      summary.drawsProcessed += 1;
      continue;
    }

    const winsByUser = new Map<string, WinningPlay[]>();

    for (const play of confirmedPlays) {
      const playNumbers = parsePlayNumbers(play.numbers);
      if (playNumbers.length === 0) continue;

      const matches = getMatchCount(playNumbers, drawNumbers);
      const prize = prizeFromMatches(matches);
      if (!prize) continue;

      const userWins = winsByUser.get(play.userId) || [];
      userWins.push({ playId: play.id, matches, prize });
      winsByUser.set(play.userId, userWins);
    }

    summary.usersEvaluated += winsByUser.size;

    for (const [userId, winningPlays] of winsByUser.entries()) {
      const alreadySent = await db
        .select({ id: pushNotificationLogs.id })
        .from(pushNotificationLogs)
        .where(and(eq(pushNotificationLogs.userId, userId), eq(pushNotificationLogs.drawId, draw.id)))
        .limit(1);

      if (alreadySent.length > 0) {
        continue;
      }

      const preferences = await db
        .select({ notifyWins: pushPreferences.notifyWins })
        .from(pushPreferences)
        .where(eq(pushPreferences.userId, userId))
        .limit(1);

      if (preferences.length > 0 && preferences[0].notifyWins !== 1) {
        continue;
      }

      const result = await sendPushToUser(userId, {
        title: "Vincita PowerLotto",
        body: buildNotificationBody(draw.ruota, draw.date, winningPlays),
        icon: "/icons/icon-192.png",
        data: {
          kind: "winning",
          ruota: draw.ruota,
          date: draw.date,
          drawId: draw.id,
          winningPlays: winningPlays.length,
        },
      });

      summary.notificationsSent += result.sent;
      summary.notificationsFailed += result.failed;
      summary.subscriptionsCleaned += result.cleaned;

      if (result.sent > 0) {
        summary.usersNotified += 1;

        await db.insert(pushNotificationLogs).values({
          id: randomUUID(),
          userId,
          drawId: draw.id,
          ruota: draw.ruota,
        });
      }
    }

    summary.drawsProcessed += 1;
  }

  return summary;
}
