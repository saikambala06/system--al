import { NextResponse } from "next/server";
import mongoose from "mongoose";

export async function GET() {
  const dbReady =
    mongoose.connection.readyState === 1;

  // Don't block on DB connection for health check
  return NextResponse.json({
    ok: true,
    db: dbReady,
    timestamp: Date.now(),
  });
}
