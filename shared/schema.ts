import { pgTable, text, serial, integer, boolean, timestamp, decimal } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const properties = pgTable("properties", {
  pk: serial("pk").primaryKey(),
  id: text("id"),
  kind: text("kind").notNull(), // listing, client_request
  transaction_type: text("transaction_type").notNull(), // sale, rent
  bedrooms: text("bedrooms").array(), // array of bedroom counts
  property_type: text("property_type").array(), // array of property types
  communities: text("communities").array(), // array of communities
  price_aed: decimal("price_aed", { precision: 12, scale: 2 }),
  budget_max_aed: decimal("budget_max_aed", { precision: 12, scale: 2 }),
  budget_min_aed: decimal("budget_min_aed", { precision: 12, scale: 2 }),
  area_sqft: decimal("area_sqft", { precision: 10, scale: 2 }),
  message_body_raw: text("message_body_raw"),
  furnishing: text("furnishing"),
  is_urgent: boolean("is_urgent"),
  is_agent_covered: boolean("is_agent_covered"),
  bathrooms: text("bathrooms").array(),
  location_raw: text("location_raw"),
  other_details: text("other_details"),
  has_maid_bedroom: boolean("has_maid_bedroom"),
  is_direct: boolean("is_direct"),
  mortgage_or_cash: text("mortgage_or_cash"),
  is_distressed_deal: boolean("is_distressed_deal"),
  is_off_plan: boolean("is_off_plan"),
  is_mortgage_approved: boolean("is_mortgage_approved"),
  is_community_agnostic: boolean("is_community_agnostic"),
  developers: text("developers").array(),
  whatsapp_participant: text("whatsapp_participant"),
  agent_phone: text("agent_phone"),
  groupJID: text("groupJID"),
  evolution_instance_id: text("evolution_instance_id"),
  updated_at: timestamp("updated_at").defaultNow(),
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
  pk: true,
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
