const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Profile = require('../models/Profile');

router.get('/', auth, async (req, res) => {
  try {
    let profile = await Profile.findOne({ user: req.userId });
    if (!profile) {
      profile = await Profile.create({ user: req.userId });
    }
    res.json(profile);
  } catch (err) {
    console.error('Load profile error:', err);
    res.status(500).json({ error: 'Failed to load profile' });
  }
});

router.put('/', auth, async (req, res) => {
  try {
    const updates = { ...req.body };
    // Never let the request body override ownership or internal fields.
    delete updates.user;
    delete updates._id;
    delete updates.__v;
    updates.updatedAt = new Date();

    const profile = await Profile.findOneAndUpdate(
      { user: req.userId },
      { $set: updates },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
    );

    res.json(profile);
  } catch (err) {
    console.error('Update profile error:', err);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

module.exports = router;
