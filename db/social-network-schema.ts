import { pgTable, text, timestamp, integer, boolean, serial } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// Tabla de usuarios de la red social - SIMPLIFIED to match actual DB columns
export const socialUsers = pgTable("social_users", {
  id: integer("id").primaryKey().notNull(),
  displayName: text("display_name").notNull(),
  avatar: text("avatar"),
  bio: text("bio"),
  interests: text("interests").array(),
  language: text("language").default("en"),
  isBot: boolean("is_bot").default(false),
  personality: text("personality"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Tabla de publicaciones - SIMPLIFIED to match actual DB columns
export const posts = pgTable("social_posts", {
  id: integer("id").primaryKey().notNull(),
  userId: integer("user_id").notNull().references(() => socialUsers.id, { onDelete: "cascade" }),
  content: text("content").notNull(),
  likes: integer("likes").default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Tabla de desafíos/retos
export const challenges = pgTable("social_challenges", {
  id: serial("id").primaryKey(),
  creatorId: integer("creator_id").notNull().references(() => socialUsers.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  hashtag: text("hashtag").notNull(),
  content: text("content"), // Puede ser audio, video o texto
  mediaType: text("media_type"),
  mediaData: text("media_data"),
  participantCount: integer("participant_count").default(0),
  endDate: timestamp("end_date"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Tabla de participantes en desafíos
export const challengeParticipants = pgTable("social_challenge_participants", {
  id: serial("id").primaryKey(),
  challengeId: integer("challenge_id").notNull().references(() => challenges.id, { onDelete: "cascade" }),
  postId: integer("post_id").notNull().references(() => posts.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Tabla de badges/logros
export const userBadges = pgTable("social_user_badges", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => socialUsers.id, { onDelete: "cascade" }),
  badgeType: text("badge_type").notNull(), // 'verified', 'trending', 'collaborator', 'trending_creator'
  reason: text("reason"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Tabla de colaboraciones sugeridas
export const collaborationSuggestions = pgTable("social_collaboration_suggestions", {
  id: serial("id").primaryKey(),
  userId1: integer("user_id_1").notNull().references(() => socialUsers.id, { onDelete: "cascade" }),
  userId2: integer("user_id_2").notNull().references(() => socialUsers.id, { onDelete: "cascade" }),
  compatibilityScore: integer("compatibility_score"),
  reason: text("reason"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Tabla de comentarios - SIMPLIFIED to match actual DB columns
export const comments = pgTable("social_comments", {
  id: integer("id").primaryKey().notNull(),
  userId: integer("user_id").notNull().references(() => socialUsers.id, { onDelete: "cascade" }),
  postId: integer("post_id").notNull().references(() => posts.id, { onDelete: "cascade" }),
  content: text("content").notNull(),
  likes: integer("likes").default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Relaciones para usuarios
export const socialUsersRelations = relations(socialUsers, ({ many }) => ({
  posts: many(posts),
  comments: many(comments),
}));

// Relaciones para publicaciones
export const postsRelations = relations(posts, ({ one, many }) => ({
  user: one(socialUsers, {
    fields: [posts.userId],
    references: [socialUsers.id],
  }),
  comments: many(comments),
}));

// Relaciones para comentarios - SIMPLIFIED
export const commentsRelations = relations(comments, ({ one }) => ({
  post: one(posts, {
    fields: [comments.postId],
    references: [posts.id],
  }),
  user: one(socialUsers, {
    fields: [comments.userId],
    references: [socialUsers.id],
  }),
}));

// Tipos para TypeScript
export type SocialUser = typeof socialUsers.$inferSelect;
export type NewSocialUser = typeof socialUsers.$inferInsert;

export type Post = typeof posts.$inferSelect;
export type NewPost = typeof posts.$inferInsert;

export type Comment = typeof comments.$inferSelect;
export type NewComment = typeof comments.$inferInsert;

export type Challenge = typeof challenges.$inferSelect;
export type NewChallenge = typeof challenges.$inferInsert;

export type UserBadge = typeof userBadges.$inferSelect;
export type NewUserBadge = typeof userBadges.$inferInsert;

export type CollaborationSuggestion = typeof collaborationSuggestions.$inferSelect;