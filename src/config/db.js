const mongoose = require('mongoose');

// Vercel functions can be invoked many times against the same warm process.
// Caching the connection on `global` avoids opening a new MongoDB connection
// on every request, which is the #1 cause of "too many connections" errors
// when running Express as a serverless function.
let cached = global._skvkMongooseCache;
if (!cached) {
  cached = global._skvkMongooseCache = { conn: null, promise: null };
}

async function connectDB() {
  const MONGODB_URI = process.env.MONGODB_URI;

  if (!MONGODB_URI) {
    throw new Error('MONGODB_URI is not set. Add it to your .env file (local) or Vercel project environment variables (production).');
  }

  if (cached.conn) {
    return cached.conn;
  }

  if (!cached.promise) {
    mongoose.set('strictQuery', true);
    cached.promise = mongoose
      .connect(MONGODB_URI, { bufferCommands: false })
      .then((mongooseInstance) => mongooseInstance);
  }

  try {
    cached.conn = await cached.promise;
  } catch (err) {
    cached.promise = null; // allow retry on next request instead of caching a rejected promise
    throw err;
  }

  return cached.conn;
}

module.exports = connectDB;
