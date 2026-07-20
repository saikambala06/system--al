import { NextResponse } from "next/server";
import { Session } from "@/db/schema";
import { ensureDB } from "@/db";
import { cookies } from "next/headers";
import { clearSessionCookie } from "@/lib/auth";

export async function POST() {
  await ensureDB();
  const cookieStore = await cookies();
  const token = cookieStore.get("auth_token")?.value;

  if (token) {
    await Session.deleteOne({ token });
  }

  await clearSessionCookie();
  return NextResponse.json({ success: true });
}
