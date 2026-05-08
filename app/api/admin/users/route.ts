import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { verifyAdminRequest } from "@/lib/utils/admin";

export async function GET(request: NextRequest) {
  const admin = await verifyAdminRequest(request);
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getDb();
  const rows = await db
    .select({ id: users.id, email: users.email })
    .from(users)
    .orderBy(users.email);

  return NextResponse.json(rows);
}
