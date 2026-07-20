import {
  pgTable,
  uuid,
  text,
  timestamp,
  jsonb,
  boolean,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    email: text("email").notNull(),
    passwordHash: text("password_hash").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("users_email_idx").on(table.email)],
);

export const profiles = pgTable(
  "profiles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    firstName: text("first_name").default(""),
    lastName: text("last_name").default(""),
    email: text("email").default(""),
    phone: text("phone").default(""),
    address: text("address").default(""),
    city: text("city").default(""),
    state: text("state").default(""),
    zip: text("zip").default(""),
    country: text("country").default(""),
    linkedin: text("linkedin").default(""),
    github: text("github").default(""),
    portfolio: text("portfolio").default(""),
    website: text("website").default(""),
    currentTitle: text("current_title").default(""),
    currentCompany: text("current_company").default(""),
    yearsExperience: text("years_experience").default(""),
    expectedSalary: text("expected_salary").default(""),
    noticePeriod: text("notice_period").default(""),
    workAuthorization: text("work_authorization").default(""),
    needsSponsorship: text("needs_sponsorship").default(""),
    willingToRelocate: text("willing_to_relocate").default(""),
    gender: text("gender").default(""),
    veteranStatus: text("veteran_status").default(""),
    disabilityStatus: text("disability_status").default(""),
    race: text("race").default(""),
    summary: text("summary").default(""),
    coverLetter: text("cover_letter").default(""),
    education: jsonb("education").$type<Record<string, unknown>[]>().default([]),
    experience: jsonb("experience").$type<Record<string, unknown>[]>().default([]),
    skills: jsonb("skills").$type<string[]>().default([]),
    extra: jsonb("extra").$type<Record<string, string>>().default({}),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("profiles_user_id_idx").on(table.userId)],
);

export const qaPairs = pgTable(
  "qa_pairs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    question: text("question").notNull(),
    questionNormalized: text("question_normalized").notNull(),
    answer: text("answer").notNull(),
    category: text("category").default("general"),
    timesUsed: text("times_used").default("0"),
    source: text("source").default("manual"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("qa_pairs_user_question_idx").on(table.userId, table.questionNormalized)],
);

export const apiTokens = pgTable("api_tokens", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  token: text("token").notNull(),
  name: text("name").notNull().default("Browser Extension"),
  isActive: boolean("is_active").notNull().default(true),
  lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [uniqueIndex("api_tokens_token_idx").on(table.token)]);

export const fillHistory = pgTable("fill_history", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  siteUrl: text("site_url").notNull(),
  siteTitle: text("site_title").default(""),
  fieldsFilled: text("fields_filled").default("0"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
