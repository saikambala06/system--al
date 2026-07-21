const mongoose = require('mongoose');

const qaPairSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  question: {
    type: String,
    required: true,
    trim: true
  },
  answer: {
    type: String,
    required: true
  },
  fieldType: {
    type: String,
    enum: ['text', 'textarea', 'select', 'radio', 'checkbox'],
    default: 'text'
  },
  source: {
    type: String,
    enum: ['manual', 'ai'],
    default: 'manual'
  },
  useCount: {
    type: Number,
    default: 0
  },
  lastUsedAt: Date,
  createdAt: {
    type: Date,
    default: Date.now
  }
});

qaPairSchema.index({ user: 1 });

module.exports = mongoose.models.QAPair || mongoose.model('QAPair', qaPairSchema);
