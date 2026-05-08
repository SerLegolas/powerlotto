import { NextRequest } from "next/server";
import { verifyAdminToken } from "./jwt";

export function getAuthToken(request: NextRequest): string | null {
  const authHeader = request.headers.get("authorization");
  if (!authHeader) return null;
  const parts = authHeader.split(" ");
  return parts[0] === "Bearer" && parts[1] ? parts[1] : null;
}

export function verifyAdminRequest(request: NextRequest) {
  const token = getAuthToken(request);
  if (!token) return null;
  return verifyAdminToken(token);
}
