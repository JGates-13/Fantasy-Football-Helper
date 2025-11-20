import { sql } from 'drizzle-orm';
import {
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Session storage table for Replit Auth
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// User storage table for Replit Auth
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;

// ESPN League connections table
export const espnLeagues = pgTable("espn_leagues", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  leagueId: varchar("league_id").notNull(),
  seasonId: integer("season_id").notNull(),
  leagueName: text("league_name").notNull(),
  teamCount: integer("team_count"),
  isSelected: integer("is_selected").default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

export const espnLeaguesRelations = relations(espnLeagues, ({ one }) => ({
  user: one(users, {
    fields: [espnLeagues.userId],
    references: [users.id],
  }),
}));

export const insertEspnLeagueSchema = createInsertSchema(espnLeagues).omit({
  id: true,
  createdAt: true,
});

export type InsertEspnLeague = z.infer<typeof insertEspnLeagueSchema>;
export type EspnLeague = typeof espnLeagues.$inferSelect;
