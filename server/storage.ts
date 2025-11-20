import {
  users,
  espnLeagues,
  type User,
  type UpsertUser,
  type EspnLeague,
  type InsertEspnLeague,
} from "@shared/schema";
import { db } from "./db";
import { eq, and } from "drizzle-orm";

export interface IStorage {
  // User operations
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: UpsertUser): Promise<User>;
  upsertUser(user: UpsertUser): Promise<User>;
  
  // League operations
  getLeaguesByUserId(userId: string): Promise<EspnLeague[]>;
  getLeagueById(id: string): Promise<EspnLeague | undefined>;
  createLeague(league: InsertEspnLeague): Promise<EspnLeague>;
  selectLeague(userId: string, leagueId: string): Promise<void>;
  checkLeagueExists(userId: string, leagueId: string, seasonId: number): Promise<boolean>;
}

export class DatabaseStorage implements IStorage {
  // User operations
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async createUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .returning();
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  // League operations
  async getLeaguesByUserId(userId: string): Promise<EspnLeague[]> {
    return await db
      .select()
      .from(espnLeagues)
      .where(eq(espnLeagues.userId, userId))
      .orderBy(espnLeagues.createdAt);
  }

  async getLeagueById(id: string): Promise<EspnLeague | undefined> {
    const [league] = await db
      .select()
      .from(espnLeagues)
      .where(eq(espnLeagues.id, id));
    return league;
  }

  async createLeague(league: InsertEspnLeague): Promise<EspnLeague> {
    const [newLeague] = await db
      .insert(espnLeagues)
      .values(league)
      .returning();
    return newLeague;
  }

  async selectLeague(userId: string, leagueId: string): Promise<void> {
    // Deselect all leagues for this user
    await db
      .update(espnLeagues)
      .set({ isSelected: 0 })
      .where(eq(espnLeagues.userId, userId));

    // Select the specified league
    await db
      .update(espnLeagues)
      .set({ isSelected: 1 })
      .where(and(
        eq(espnLeagues.id, leagueId),
        eq(espnLeagues.userId, userId)
      ));
  }

  async checkLeagueExists(userId: string, leagueId: string, seasonId: number): Promise<boolean> {
    const [existing] = await db
      .select()
      .from(espnLeagues)
      .where(and(
        eq(espnLeagues.userId, userId),
        eq(espnLeagues.leagueId, leagueId),
        eq(espnLeagues.seasonId, seasonId)
      ));
    return !!existing;
  }
}

export const storage = new DatabaseStorage();
