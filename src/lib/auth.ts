import { User, Session, IUser } from "@/db/schema";
import { ensureDB } from "@/db";
import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "super-secret-key-change-in-production-1234567890"
);

const COOKIE_NAME = "auth_token";
const SESSION_DAYS = 7;

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function createSession(userId: string): Promise<string> {
  await ensureDB();

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + SESSION_DAYS);

  const token = await new SignJWT({ userId })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime(`${SESSION_DAYS}d`)
    .setIssuedAt()
    .sign(JWT_SECRET);

  await Session.create({
    userId,
    token,
    expiresAt,
  });

  return token;
}

export async function setSessionCookie(token: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    // Must be "none" + secure so the browser will attach this cookie to
    // requests made from the chrome-extension:// origin (a cross-site
    // context). "lax" would silently drop the cookie on those requests.
    secure: true,
    sameSite: "none",
    path: "/",
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  });
}

export async function clearSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, "", {
    httpOnly: true,
    secure: true,
    sameSite: "none",
    path: "/",
    maxAge: 0,
  });
}

export async function getSession(): Promise<{
  userId: string;
  user: IUser;
  token: string;
} | null> {
  await ensureDB();

  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    const userId = payload.userId as string;

    const session = await Session.findOne({
      token,
      userId,
      expiresAt: { $gt: new Date() },
    });

    if (!session) return null;

    const user = await User.findById(userId);
    if (!user) return null;

    return { userId, user, token };
  } catch {
    return null;
  }
}

export async function getUser(): Promise<IUser | null> {
  const session = await getSession();
  return session?.user ?? null;
}
