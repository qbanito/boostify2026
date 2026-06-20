import { pgTable, serial, text, integer, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";

// ── Investor contacts to outreach ──────────────────────────────────────────────
export const holosuitInvestorContacts = pgTable("holosuit_investor_contacts", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  company: text("company"),
  title: text("title"),
  source: text("source").default("manual"), // manual | apify_linkedin | apify_crunchbase | csv
  tierInterest: text("tier_interest").default("seed"), // seed | pioneer | partner | lead
  // Outreach state
  status: text("status").default("pending"),
  // pending | queued | sent_1 | sent_2 | sent_3 | sent_4 | sent_5 | replied | invested | opted_out | bounced
  sequenceStep: integer("sequence_step").default(0), // 0=not started, 1-5=step completed
  lastSentAt: timestamp("last_sent_at"),
  nextSendAt: timestamp("next_send_at"),
  // Lead tracking
  formFilledAt: timestamp("form_filled_at"),
  investedAt: timestamp("invested_at"),
  stripeSessionId: text("stripe_session_id"),
  notes: text("notes"),
  apifyData: jsonb("apify_data"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// ── Email send log ─────────────────────────────────────────────────────────────
export const holosuitEmailLog = pgTable("holosuit_email_log", {
  id: serial("id").primaryKey(),
  contactId: integer("contact_id").references(() => holosuitInvestorContacts.id),
  step: integer("step").notNull(), // 1-5 outreach, 6=lead confirmation, 7=investor confirmation
  emailType: text("email_type").notNull(), // outreach | lead_confirm | invest_confirm | hot_followup
  resendId: text("resend_id"),
  subject: text("subject"),
  sentAt: timestamp("sent_at").defaultNow(),
  openedAt: timestamp("opened_at"),
  clickedAt: timestamp("clicked_at"),
  repliedAt: timestamp("replied_at"),
  bouncedAt: timestamp("bounced_at"),
  error: text("error"),
});

// ── Hot leads (form fills + investors) ────────────────────────────────────────
export const holosuitLeads = pgTable("holosuit_leads", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  company: text("company"),
  tier: text("tier").notNull(),
  message: text("message"),
  phone: text("phone"),
  source: text("source").default("form"), // form | stripe
  formFilledAt: timestamp("form_filled_at").defaultNow(),
  investedAt: timestamp("invested_at"),
  stripeSessionId: text("stripe_session_id"),
  amountCents: integer("amount_cents"),
  forwardedToOwner: boolean("forwarded_to_owner").default(false),
  hotSequenceStep: integer("hot_sequence_step").default(0),
  lastHotEmailAt: timestamp("last_hot_email_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export type HolosuitInvestorContact = typeof holosuitInvestorContacts.$inferSelect;
export type HolosuitEmailLog = typeof holosuitEmailLog.$inferSelect;
export type HolosuitLead = typeof holosuitLeads.$inferSelect;
