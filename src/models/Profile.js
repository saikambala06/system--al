const mongoose = require('mongoose');

const educationSchema = new mongoose.Schema(
  {
    school: String,
    degree: String,
    fieldOfStudy: String,
    startDate: String,
    endDate: String,
    gpa: String
  },
  { _id: false }
);

const experienceSchema = new mongoose.Schema(
  {
    company: String,
    title: String,
    location: String,
    startDate: String,
    endDate: String,
    current: Boolean,
    description: String
  },
  { _id: false }
);

const profileSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  personal: {
    firstName: String,
    lastName: String,
    email: String,
    phone: String,
    address: String,
    city: String,
    state: String,
    zip: String,
    country: String
  },
  links: {
    linkedin: String,
    github: String,
    portfolio: String,
    website: String
  },
  workAuth: {
    authorizedToWork: String, // "Yes" | "No"
    requireSponsorship: String, // "Yes" | "No"
    visaStatus: String
  },
  // Voluntary self-identification fields some applications ask for.
  // Left blank unless the person chooses to fill them in.
  eeo: {
    gender: String,
    race: String,
    veteranStatus: String,
    disabilityStatus: String
  },
  education: [educationSchema],
  experience: [experienceSchema],
  skills: [String],
  preferences: {
    desiredSalary: String,
    willingToRelocate: String, // "Yes" | "No"
    remotePreference: String, // "Onsite" | "Hybrid" | "Remote"
    noticePeriod: String,
    earliestStartDate: String
  },
  summary: String,
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.models.Profile || mongoose.model('Profile', profileSchema);
