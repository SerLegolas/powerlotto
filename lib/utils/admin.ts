import { NextRequest } from "next/server";
import { verifyAdminToken, verifyToken } from "@/lib/utils/jwt";
import { getDb } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export function getAuthToken(request: NextRequest): string | null {
  const authHeader = request.headers.get("authorization");
  if (!authHeader) return null;
  const parts = authHeader.split(" ");
  return parts[0] === "Bearer" && parts[1] ? parts[1] : null;
}

export async function verifyAdminRequest(request: NextRequest) {
  const token = getAuthToken(request);
  if (!token) return null;

  const adminPayload = verifyAdminToken(token);
  if (adminPayload) {
    return adminPayload;
  }

  const payload = verifyToken(token);
  if (!payload?.userId) {
    return null;
  }

  try {
    const db = getDb();
    const result = await db
      .select({ id: users.id, email: users.email, role: users.role })
      .from(users)
      .where(eq(users.id, payload.userId))
      .limit(1);

    const user = result[0];
    if (!user || user.role !== "admin") {
      return null;
    }

    return {
      userId: user.id,
      email: user.email,
      role: user.role,
      isAdmin: 1,
    };
  } catch {
    return null;
  }
}
