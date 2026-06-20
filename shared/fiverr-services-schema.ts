/**
 * Fiverr Services Schema
 * Defines the structure for resold Fiverr services on Boostify
 */

import { serial, varchar, decimal, boolean, integer, timestamp, pgTable } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const fiverr_services = pgTable("fiverr_services", {
  id: serial("id").primaryKey(),
  gigId: varchar("gig_id").notNull().unique(),
  title: varchar("title").notNull(),
  category: varchar("category").notNull(), // 'youtube_boost' | 'spotify_boost' | 'instagram_boost'
  description: varchar("description"),
  originalPrice: decimal("original_price", { precision: 10, scale: 2 }).notNull(),
  boostifyPrice: decimal("boostify_price", { precision: 10, scale: 2 }).notNull(),
  sellerName: varchar("seller_name").notNull(),
  sellerDisplayName: varchar("seller_display_name").notNull(),
  sellerRating: decimal("seller_rating", { precision: 3, scale: 2 }).notNull(),
  sellerReviews: integer("seller_reviews").notNull(),
  sellerCountry: varchar("seller_country"),
  deliveryDays: integer("delivery_days").notNull(),
  extraFast: boolean("extra_fast").default(false),
  features: varchar("features").array(), // JSON array of features
  imageUrl: varchar("image_url"),
  fiverr_url: varchar("fiverr_url"),
  isActive: boolean("is_active").default(true),
  syncDate: timestamp("sync_date").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const pending_orders = pgTable("pending_orders", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull(),
  serviceId: integer("service_id").notNull(),
  quantity: integer("quantity").default(1),
  boostifyPrice: decimal("boostify_price", { precision: 10, scale: 2 }).notNull(),
  status: varchar("status").default("pending"), // pending | processing | completed | failed
  fiverr_order_id: varchar("fiverr_order_id"),
  webhook_token: varchar("webhook_token").unique(),
  metadata: varchar("metadata"), // JSON
  createdAt: timestamp("created_at").defaultNow(),
  completedAt: timestamp("completed_at"),
});

// Schemas for validation
export const insertFiverServiceSchema = createInsertSchema(fiverr_services).omit({
  id: true,
  syncDate: true,
  createdAt: true,
  updatedAt: true,
});

export const insertPendingOrderSchema = createInsertSchema(pending_orders).omit({
  id: true,
  createdAt: true,
  completedAt: true,
});

export type FiverService = typeof fiverr_services.$inferSelect;
export type InsertFiverService = z.infer<typeof insertFiverServiceSchema>;
export type PendingOrder = typeof pending_orders.$inferSelect;
export type InsertPendingOrder = z.infer<typeof insertPendingOrderSchema>;
