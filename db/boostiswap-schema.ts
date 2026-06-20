import { pgTable, text, timestamp, integer, serial, decimal, boolean } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// Pares de trading (SONG_A / USDC, etc)
export const tradingPairs = pgTable("boostiswap_pairs", {
  id: serial("id").primaryKey(),
  token1Id: integer("token1_id").notNull(), // ID de canción tokenizada
  token2Id: integer("token2_id").notNull(), // ID de canción o USDC
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

// Fondos de liquidez
export const liquidityPools = pgTable("boostiswap_pools", {
  id: serial("id").primaryKey(),
  pairId: integer("pairId").notNull().references(() => tradingPairs.id, { onDelete: "cascade" }),
  token1Reserve: decimal("token1_reserve", { precision: 20, scale: 8 }).default("0"),
  token2Reserve: decimal("token2_reserve", { precision: 20, scale: 8 }).default("0"),
  totalLiquidity: decimal("total_liquidity", { precision: 20, scale: 8 }).default("0"),
  feePercent: decimal("fee_percent", { precision: 5, scale: 3 }).default("0.300"), // 0.3%
  priceToken1: decimal("price_token1", { precision: 20, scale: 8 }).default("0"),
  priceToken2: decimal("price_token2", { precision: 20, scale: 8 }).default("0"),
  volume24h: decimal("volume_24h", { precision: 20, scale: 8 }).default("0"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

// Posiciones de liquidez del usuario
export const liquidityPositions = pgTable("boostiswap_positions", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  poolId: integer("poolId").notNull().references(() => liquidityPools.id, { onDelete: "cascade" }),
  liquidityShares: decimal("liquidity_shares", { precision: 20, scale: 8 }).notNull(),
  token1Amount: decimal("token1_amount", { precision: 20, scale: 8 }).notNull(),
  token2Amount: decimal("token2_amount", { precision: 20, scale: 8 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

// Historial de swaps
export const swapTransactions = pgTable("boostiswap_swaps", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  pairId: integer("pairId").notNull().references(() => tradingPairs.id, { onDelete: "cascade" }),
  inputToken: integer("input_token").notNull(),
  outputToken: integer("output_token").notNull(),
  inputAmount: decimal("input_amount", { precision: 20, scale: 8 }).notNull(),
  outputAmount: decimal("output_amount", { precision: 20, scale: 8 }).notNull(),
  fee: decimal("fee", { precision: 20, scale: 8 }).notNull(),
  priceImpact: decimal("price_impact", { precision: 10, scale: 2 }).default("0"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

// Historial de precios para gráficos
export const priceHistory = pgTable("boostiswap_price_history", {
  id: serial("id").primaryKey(),
  pairId: integer("pairId").notNull().references(() => tradingPairs.id, { onDelete: "cascade" }),
  priceToken1: decimal("price_token1", { precision: 20, scale: 8 }).notNull(),
  priceToken2: decimal("price_token2", { precision: 20, scale: 8 }).notNull(),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
});

// Tipos
export type TradingPair = typeof tradingPairs.$inferSelect;
export type LiquidityPool = typeof liquidityPools.$inferSelect;
export type LiquidityPosition = typeof liquidityPositions.$inferSelect;
export type SwapTransaction = typeof swapTransactions.$inferSelect;
export type PriceHistory = typeof priceHistory.$inferSelect;
