import mongoose, { Schema, Document, Model } from "mongoose";

// Mongoose documents only serialize `_id` (an ObjectId) by default, not the
// `id` string virtual, unless a schema explicitly opts in with
// `toJSON: { virtuals: true }`. The frontend reads `.id` everywhere (list
// keys, edit/delete calls), so without this every one of those was
// `undefined` — e.g. delete requests silently hit `?id=undefined`.
const jsonOptions = {
  virtuals: true,
  versionKey: false,
  transform: (_doc: unknown, ret: Record<string, unknown>) => {
    delete ret._id;
    return ret;
  },
};

// ── User ──
export interface IUser extends Document {
  name: string;
  email: string;
  passwordHash: string;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
  },
  { timestamps: true, toJSON: jsonOptions }
);

export const User: Model<IUser> =
  mongoose.models.User || mongoose.model<IUser>("User", UserSchema);

// ── Profile ──
export interface IProfile extends Document {
  userId: mongoose.Types.ObjectId;
  name: string;
  email: string;
  phone?: string;
  location?: string;
  linkedin?: string;
  website?: string;
  resumeText?: string;
  fields: Record<string, string>;
  createdAt: Date;
  updatedAt: Date;
}

const ProfileSchema = new Schema<IProfile>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    name: { type: String, required: true },
    email: { type: String, required: true },
    phone: { type: String, default: "" },
    location: { type: String, default: "" },
    linkedin: { type: String, default: "" },
    website: { type: String, default: "" },
    resumeText: { type: String, default: "" },
    fields: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true, toJSON: jsonOptions }
);

export const Profile: Model<IProfile> =
  mongoose.models.Profile || mongoose.model<IProfile>("Profile", ProfileSchema);

// ── QuestionTemplate ──
export interface IQuestionTemplate extends Document {
  userId: mongoose.Types.ObjectId;
  question: string;
  answer: string;
  category?: string;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
}

const QuestionTemplateSchema = new Schema<IQuestionTemplate>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    question: { type: String, required: true },
    answer: { type: String, required: true },
    category: { type: String, default: "" },
    tags: { type: [String], default: [] },
  },
  { timestamps: true, toJSON: jsonOptions }
);

export const QuestionTemplate: Model<IQuestionTemplate> =
  mongoose.models.QuestionTemplate ||
  mongoose.model<IQuestionTemplate>("QuestionTemplate", QuestionTemplateSchema);

// ── JobApplication ──
export interface IJobApplication extends Document {
  userId: mongoose.Types.ObjectId;
  profileId?: mongoose.Types.ObjectId;
  jobTitle: string;
  company?: string;
  jobUrl?: string;
  status: string;
  answers: Record<string, string>;
  createdAt: Date;
  updatedAt: Date;
}

const JobApplicationSchema = new Schema<IJobApplication>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    profileId: { type: Schema.Types.ObjectId, ref: "Profile", default: null },
    jobTitle: { type: String, required: true },
    company: { type: String, default: "" },
    jobUrl: { type: String, default: "" },
    status: { type: String, default: "pending" },
    answers: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true, toJSON: jsonOptions }
);

export const JobApplication: Model<IJobApplication> =
  mongoose.models.JobApplication ||
  mongoose.model<IJobApplication>("JobApplication", JobApplicationSchema);

// ── Session ──
export interface ISession extends Document {
  userId: mongoose.Types.ObjectId;
  token: string;
  expiresAt: Date;
  createdAt: Date;
}

const SessionSchema = new Schema<ISession>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    token: { type: String, required: true, unique: true },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

// TTL index to auto-delete expired sessions
SessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const Session: Model<ISession> =
  mongoose.models.Session || mongoose.model<ISession>("Session", SessionSchema);
