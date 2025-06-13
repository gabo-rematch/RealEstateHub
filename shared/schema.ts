import { pgTable, text, serial, integer, boolean, timestamp, decimal } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const properties = pgTable("properties", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  unit_kind: text("unit_kind").notNull(), // apartment, villa, townhouse, penthouse
  transaction_type: text("transaction_type").notNull(), // sale, rent
  property_type: text("property_type"), // residential, commercial
  beds: text("beds"), // studio, 1, 2, 3, 4, 5+
  baths: integer("baths"),
  area_sqft: integer("area_sqft"),
  price: decimal("price", { precision: 12, scale: 2 }).notNull(),
  community: text("community"),
  location: text("location"),
  description: text("description"),
  off_plan: boolean("off_plan").default(false),
  distressed: boolean("distressed").default(false),
  property_id: text("property_id").unique(),
  updated_at: timestamp("updated_at").defaultNow(),
  created_at: timestamp("created_at").defaultNow(),
});

export const inquiries = pgTable("inquiries", {
  id: serial("id").primaryKey(),
  selected_unit_ids: text("selected_unit_ids").array().notNull(),
  agent_whatsapp: text("agent_whatsapp").notNull(),
  notes: text("notes"),
  portal_link: text("portal_link"),
  search_criteria: text("search_criteria"), // JSON string
  created_at: timestamp("created_at").defaultNow(),
});

export const insertPropertySchema = createInsertSchema(properties).omit({
  id: true,
  created_at: true,
  updated_at: true,
});

export const insertInquirySchema = createInsertSchema(inquiries).omit({
  id: true,
  created_at: true,
});

export type InsertProperty = z.infer<typeof insertPropertySchema>;
export type Property = typeof properties.$inferSelect;
export type InsertInquiry = z.infer<typeof insertInquirySchema>;
export type Inquiry = typeof inquiries.$inferSelect;

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
