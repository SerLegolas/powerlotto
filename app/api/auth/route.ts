import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { hashPassword, verifyPassword } from "@/lib/utils/password";
import { generateToken } from "@/lib/utils/jwt";
import { randomUUID } from "crypto";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password, action } = body;

    if (!email || !password) {
      return NextResponse.json(
        { error: "Missing email or password" },
        { status: 400 }
      );
    }

    if (action === "login") {
      // Login
      const db = getDb();
      const user = await db
        .select()
        .from(users)
        .where(eq(users.email, email))
        .limit(1);

      if (!user.length) {
        return NextResponse.json(
          { error: "User not found" },
          { status: 401 }
        );
      }

      const passwordMatch = await verifyPassword(password, user[0].passwordHash);
      if (!passwordMatch) {
        return NextResponse.json(
          { error: "Invalid password" },
          { status: 401 }
        );
      }

      const token = generateToken({
        userId: user[0].id,
        email: user[0].email,
      });

      return NextResponse.json({
        token,
        user: {
          id: user[0].id,
          email: user[0].email,
        },
      });
    } else if (action === "register") {
      // Register
      const db = getDb();
      const existingUser = await db
        .select()
        .from(users)
        .where(eq(users.email, email))
        .limit(1);

      if (existingUser.length > 0) {
        return NextResponse.json(
          { error: "User already exists" },
          { status: 409 }
        );
      }

      const passwordHash = await hashPassword(password);
      const userId = randomUUID();

      const newUser = await db
        .insert(users)
        .values({
          id: userId,
          email,
          passwordHash,
        })
        .returning();

      const token = generateToken({
        userId: newUser[0].id,
        email: newUser[0].email,
      });

      return NextResponse.json(
        {
          token,
          user: {
            id: newUser[0].id,
            email: newUser[0].email,
          },
        },
        { status: 201 }
      );
    } else {
      return NextResponse.json(
        { error: "Invalid action" },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error("Auth error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
