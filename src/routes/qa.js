const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const QAPair = require('../models/QAPair');

router.get('/', auth, async (req, res) => {
  try {
    const items = await QAPair.find({ user: req.userId }).sort({ createdAt: -1 });
    res.json(items);
  } catch (err) {
    res.status(500).json({ error: 'Failed to load Q&A bank' });
  }
});

router.post('/', auth, async (req, res) => {
  try {
    const { question, answer, fieldType } = req.body;
    if (!question || !answer) {
      return res.status(400).json({ error: 'question and answer are required' });
    }
    const item = await QAPair.create({
      user: req.userId,
      question,
      answer,
      fieldType: fieldType || 'text',
      source: 'manual'
    });
    res.status(201).json(item);
  } catch (err) {
    console.error('Create QA pair error:', err);
    res.status(500).json({ error: 'Failed to save Q&A pair' });
  }
});

router.put('/:id', auth, async (req, res) => {
  try {
    const updates = { ...req.body };
    delete updates.user;
    delete updates._id;
    delete updates.__v;

    const item = await QAPair.findOneAndUpdate(
      { _id: req.params.id, user: req.userId },
      { $set: updates },
      { new: true, runValidators: true }
    );

    if (!item) return res.status(404).json({ error: 'Q&A pair not found' });
    res.json(item);
  } catch (err) {
    console.error('Update QA pair error:', err);
    res.status(500).json({ error: 'Failed to update Q&A pair' });
  }
});

router.delete('/:id', auth, async (req, res) => {
  try {
    const result = await QAPair.deleteOne({ _id: req.params.id, user: req.userId });
    if (result.deletedCount === 0) return res.status(404).json({ error: 'Q&A pair not found' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete Q&A pair' });
  }
});

module.exports = router;
