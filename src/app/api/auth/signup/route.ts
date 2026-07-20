import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { users, profiles, apiTokens } from "@/db/schema";
import { eq } from "drizzle-orm";
import { createSessionToken, hashPassword, setSessionCookie } from "@/lib/auth";
import { generateApiToken } from "@/lib/tokens";
import { z } from "zod";

const schema = z.object({
  name: z.string().min(1, "Name is required").max(120),
  email: z.string().email("Enter a valid email"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Invalid input" },
        { status: 400 },
      );
    }
    const { name, email, password } = parsed.data;
    const normalizedEmail = email.toLowerCase().trim();

    const existing = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, normalizedEmail))
      .limit(1);

    if (existing.length > 0) {
      return NextResponse.json({ error: "An account with this email already exists" }, { status: 409 });
    }

    const passwordHash = await hashPassword(password);
    const [user] = await db
      .insert(users)
      .values({ name: name.trim(), email: normalizedEmail, passwordHash })
      .returning({ id: users.id, name: users.name, email: users.email });

    await db.insert(profiles).values({
      userId: user.id,
      firstName: name.trim().split(" ")[0] || "",
      lastName: name.trim().split(" ").slice(1).join(" ") || "",
      email: normalizedEmail,
    });

    await db.insert(apiTokens).values({
      userId: user.id,
      token: generateApiToken(),
      name: "Browser Extension",
    });

    const token = await createSessionToken({ userId: user.id, email: user.email, name: user.name });
    await setSessionCookie(token);

    return NextResponse.json({ user: { id: user.id, name: user.name, email: user.email } });
  } catch (err) {
    console.error("signup error", err);
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
