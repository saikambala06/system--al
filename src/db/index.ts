import mongoose from "mongoose";

const MONGODB_URI = process.env.MONGODB_URI!;

if (!MONGODB_URI) {
  throw new Error("MONGODB_URI environment variable is required");
}

// Prevent multiple connections during hot reload in development
const globalForMongoose = globalThis as typeof globalThis & {
  __mongooseConn?: typeof mongoose;
  __mongoosePromise?: Promise<typeof mongoose>;
};

const cached = globalForMongoose;

export async function connectDB(): Promise<typeof mongoose> {
  if (cached.__mongooseConn) {
    return cached.__mongooseConn;
  }

  if (!cached.__mongoosePromise) {
    cached.__mongoosePromise = mongoose.connect(MONGODB_URI, {
      bufferCommands: false,
      serverSelectionTimeoutMS: 5000, // 5 second timeout
      connectTimeoutMS: 5000,
    });
  }

  try {
    cached.__mongooseConn = await cached.__mongoosePromise;
  } catch (e) {
    cached.__mongoosePromise = undefined;
    throw e;
  }

  return cached.__mongooseConn;
}

// Helper to ensure connection before any query (with timeout)
export async function ensureDB(): Promise<void> {
  if (mongoose.connection.readyState === 1) return;

  try {
    await connectDB();
  } catch {
    // Silently fail - the API route will handle errors
  }
}
