import mongoose from "mongoose";

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  throw new Error("Please define the MONGODB_URI environment variable inside your Vercel settings.");
}

/**
 * Global is used here to maintain a cached connection across hot-reloads
 * in development and serverless container lifecycles in Vercel.
 */
let cached = (global as any).mongoose;

if (!cached) {
  cached = (global as any).mongoose = { conn: null, promise: null };
}

export async function ensureDB() {
  // 1. If we already have a fully established connection, return it immediately
  if (cached.conn) {
    return cached.conn;
  }

  // 2. If we aren't already trying to connect, start the connection promise
  if (!cached.promise) {
    const opts = {
      bufferCommands: true, // Allows Mongoose to safely queue commands if minor delays occur
    };

    cached.promise = mongoose.connect(MONGODB_URI!, opts).then((mongooseInstance) => {
      return mongooseInstance;
    });
  }

  try {
    // 3. FORCE the code to wait until the promise is fully resolved
    cached.conn = await cached.promise;
  } catch (e) {
    cached.promise = null; // Reset the broken promise if it fails so the next request can retry
    throw e;
  }

  return cached.conn;
}
