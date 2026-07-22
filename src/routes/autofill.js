const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const QAPair = require('../models/QAPair');
const Profile = require('../models/Profile');
const { findBestMatch } = require('../utils/similarity');
const { generateAnswer } = require('../utils/gemini');
const { matchProfileField } = require('../utils/profileFields');

// How close a question has to be (0-1) to an existing bank entry before we
// reuse its answer instead of asking Gemini for a fresh one. Biased toward
// precision: a near-miss falls through to AI generation (still accurate,
// since it uses the full profile) rather than risking a wrong reuse -
// e.g. "What is your name?" vs "What is your phone number?" should NOT match.
// Tune this in one place if you want more/less aggressive reuse.
const MATCH_THRESHOLD = 0.65;

router.post('/batch', auth, async (req, res) => {
  try {
    const { questions } = req.body;

    if (!Array.isArray(questions) || questions.length === 0) {
      return res.status(400).json({ error: 'questions array is required' });
    }

    const [bank, profile] = await Promise.all([
      QAPair.find({ user: req.userId }).lean(),
      Profile.findOne({ user: req.userId }).lean()
    ]);

    const results = [];
    const bankUpdates = [];

    for (const q of questions) {
      const question = (q.question || '').trim();
      if (!question) {
        results.push({ question: q.question, answer: null, source: 'none', error: 'empty question' });
        continue;
      }

      // Well-known profile fields (name, email, phone, address, work auth,
      // etc.) are pulled straight from the Profile tab - no bank lookup, no
      // Gemini call, so they can't fail or go stale the way an AI-generated
      // or previously-cached answer can.
      const profileMatch = matchProfileField(question, profile, q.fieldType, q.options);
      if (profileMatch) {
        results.push({ question, answer: profileMatch.value, source: 'profile' });
        continue;
      }

      const { match, score } = findBestMatch(question, bank, 'question');

      if (match && score >= MATCH_THRESHOLD) {
        bankUpdates.push(match._id);
        results.push({ question, answer: match.answer, source: 'bank', score: Number(score.toFixed(2)) });
        continue;
      }

      try {
        const answer = await generateAnswer(question, profile, q.fieldType, q.options);
        const created = await QAPair.create({
          user: req.userId,
          question,
          answer,
          fieldType: q.fieldType || 'text',
          source: 'ai'
        });
        bank.push(created.toObject()); // so later duplicate questions in the same batch can reuse it
        results.push({ question, answer, source: 'ai', score: 0, qaPairId: created._id });
      } catch (err) {
        console.error('Autofill generation error:', err.message);
        results.push({ question, answer: null, source: 'none', error: err.message });
      }
    }

    if (bankUpdates.length) {
      QAPair.updateMany(
        { _id: { $in: bankUpdates } },
        { $inc: { useCount: 1 }, $set: { lastUsedAt: new Date() } }
      ).catch((err) => console.error('useCount update failed:', err.message));
    }

    res.json({ results });
  } catch (err) {
    console.error('Autofill batch error:', err);
    res.status(500).json({ error: 'Autofill matching failed' });
  }
});

module.exports = router;
