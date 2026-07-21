const path = require('path');
const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');

const authRoutes = require('./routes/auth');
const profileRoutes = require('./routes/profile');
const qaRoutes = require('./routes/qa');
const autofillRoutes = require('./routes/autofill');

const app = express();

app.use(cors()); // open CORS - the extension calls this API from arbitrary job-site
                  // origins and from its own background worker; JWT auth is the real
                  // security boundary here, not CORS. Tighten this if you'd rather
                  // restrict it to your own domain(s).
app.use(express.json({ limit: '2mb' }));

// Serves the website when running locally with `npm run dev`.
// In production on Vercel this is unreachable - Vercel serves /public directly
// and only routes /api/* to this app (see vercel.json) - but it's harmless to
// leave in, and keeps local dev to a single `npm run dev`.
app.use(express.static(path.join(__dirname, '..', 'public')));

// Health check first, before the DB is required, so you can confirm the
// server itself is up even if MONGODB_URI is missing or unreachable.
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

app.use('/api', async (req, res, next) => {
  try {
    await connectDB();
    next();
  } catch (err) {
    console.error('DB connection error:', err.message);
    res.status(500).json({ error: 'Database connection failed. Check MONGODB_URI.' });
  }
});

app.use('/api/auth', authRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/qa', qaRoutes);
app.use('/api/autofill', autofillRoutes);

app.use('/api', (req, res) => res.status(404).json({ error: 'API route not found' }));

// Express swallows errors thrown in async handlers unless they're passed to
// next(); every route here uses try/catch and responds directly, but this
// stays as a safety net for anything that slips through.
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(err.status || 500).json({ error: err.message || 'Server error' });
});

module.exports = app;
