import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./auth";
import { createRequire } from "module";
import type { User } from "@shared/schema";
import { z } from "zod";

// ESPN API doesn't support ES modules, use createRequire
const require = createRequire(import.meta.url);
const { Client } = require("espn-fantasy-football-api/node");

// Lineup slot mapping for ESPN Fantasy Football
const LINEUP_SLOT_LABELS: Record<number, string> = {
  0: 'QB',
  2: 'RB',
  4: 'WR',
  6: 'TE',
  16: 'D/ST',
  17: 'K',
  20: 'BE',  // Bench
  21: 'IR',  // Injured Reserve
  23: 'FLEX',
};

// NFL team abbreviation mapping
const NFL_TEAM_NAMES: Record<number, string> = {
  1: 'ATL', 2: 'BUF', 3: 'CHI', 4: 'CIN', 5: 'CLE', 6: 'DAL', 7: 'DEN', 8: 'DET',
  9: 'GB', 10: 'TEN', 11: 'IND', 12: 'KC', 13: 'LV', 14: 'LAR', 15: 'MIA', 16: 'MIN',
  17: 'NE', 18: 'NO', 19: 'NYG', 20: 'NYJ', 21: 'PHI', 22: 'ARI', 23: 'PIT', 24: 'LAC',
  25: 'SF', 26: 'SEA', 27: 'TB', 28: 'WSH', 29: 'CAR', 30: 'JAX', 33: 'BAL', 34: 'HOU'
};

// Helper function to process roster data
function processRoster(roster: any[]): any[] {
  if (!roster || !Array.isArray(roster)) {
    return [];
  }

  return roster.map((entry: any) => {
    // ESPN API has nested structure - need to dig deep
    let player: any = null;
    let playerSlot = entry;
    
    // Try different paths to find player data
    if (entry.playerPoolEntry?.player) {
      player = entry.playerPoolEntry.player;
    } else if (entry.player) {
      player = entry.player;
    } else if (entry.entry?.playerPoolEntry?.player) {
      player = entry.entry.playerPoolEntry.player;
    }
    
    // If still no player, check if entry itself has player properties
    if (!player && entry.fullName) {
      player = entry;
    }
    
    // Extract lineup slot ID from various locations
    const lineupSlotId = entry.lineupSlotId ?? 
                         entry.slot ?? 
                         entry.lineupSlot ?? 
                         entry.slotCategoryId ?? 
                         20; // Default to bench
    
    // Get NFL team and opponent info
    const nflTeamId = player?.proTeamId ?? player?.proTeam ?? null;
    const opponentTeamId = player?.opponentProTeamId ?? null;
    
    // Determine player name with extensive fallbacks
    let playerName = 'Empty Slot';
    
    if (player) {
      // Try fullName first
      if (player.fullName) {
        playerName = player.fullName;
      }
      // Try firstName + lastName
      else if (player.firstName && player.lastName) {
        playerName = `${player.firstName} ${player.lastName}`;
      }
      // For defense/special teams (position 16 or proTeamId without a name)
      else if (lineupSlotId === 16 && nflTeamId && NFL_TEAM_NAMES[nflTeamId]) {
        playerName = `${NFL_TEAM_NAMES[nflTeamId]} D/ST`;
      }
      // Try just lastName
      else if (player.lastName) {
        playerName = player.lastName;
      }
      // If we have a proTeam but no name, might be D/ST
      else if (nflTeamId && NFL_TEAM_NAMES[nflTeamId]) {
        playerName = `${NFL_TEAM_NAMES[nflTeamId]} D/ST`;
      }
    }
    
    // Get position label
    let position = LINEUP_SLOT_LABELS[lineupSlotId] || 'SLOT';
    
    // Also try to get the actual player position if available
    if (player?.defaultPositionId && LINEUP_SLOT_LABELS[player.defaultPositionId]) {
      position = LINEUP_SLOT_LABELS[player.defaultPositionId];
    } else if (player?.eligibleSlots && player.eligibleSlots.length > 0) {
      const firstEligible = player.eligibleSlots[0];
      if (LINEUP_SLOT_LABELS[firstEligible]) {
        position = LINEUP_SLOT_LABELS[firstEligible];
      }
    }
    
    // Extract points
    const totalPoints = entry.totalPoints ?? 
                       entry.points ?? 
                       entry.appliedStatTotal ?? 
                       player?.points ?? 
                       0;
    
    const projectedPoints = entry.projectedPoints ?? 
                           entry.currentPeriodProjectedStats ?? 
                           player?.projectedPoints ?? 
                           0;
    
    return {
      playerName,
      position,
      lineupSlotId,
      isStarter: lineupSlotId !== 20 && lineupSlotId !== 21, // 20=bench, 21=IR
      totalPoints: parseFloat(totalPoints) || 0,
      projectedPoints: parseFloat(projectedPoints) || 0,
      nflTeam: nflTeamId && NFL_TEAM_NAMES[nflTeamId] ? NFL_TEAM_NAMES[nflTeamId] : '',
      opponent: opponentTeamId && NFL_TEAM_NAMES[opponentTeamId] ? NFL_TEAM_NAMES[opponentTeamId] : null,
      playerId: player?.playerId ?? player?.id ?? null,
      playerPosition: player?.defaultPositionId && LINEUP_SLOT_LABELS[player.defaultPositionId] 
        ? LINEUP_SLOT_LABELS[player.defaultPositionId] 
        : null,
    };
  }).sort((a, b) => {
    // Sort starters first, then by lineup slot ID
    if (a.isStarter !== b.isStarter) {
      return a.isStarter ? -1 : 1;
    }
    return a.lineupSlotId - b.lineupSlotId;
  });
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Auth middleware
  await setupAuth(app);

  // Auth routes
  app.get('/api/auth/user', isAuthenticated, async (req, res) => {
    try {
      const user = req.user as User;
      // Return user without password
      const { password: _, ...userWithoutPassword } = user;
      res.json(userWithoutPassword);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // League routes
  app.get('/api/leagues', isAuthenticated, async (req, res) => {
    try {
      const user = req.user as User;
      const leagues = await storage.getLeaguesByUserId(user.id);
      res.json(leagues);
    } catch (error) {
      console.error("Error fetching leagues:", error);
      res.status(500).json({ message: "Failed to fetch leagues" });
    }
  });

  app.post('/api/leagues/connect', isAuthenticated, async (req, res) => {
    try {
      const user = req.user as User;
      const userId = user.id;
      const { leagueId, seasonId } = req.body;

      if (!leagueId || !seasonId) {
        return res.status(400).json({ message: "League ID and season year are required" });
      }

      // Clean and validate league ID - remove any non-numeric characters
      const cleanedLeagueId = leagueId.trim().replace(/\D/g, '');
      if (!cleanedLeagueId || cleanedLeagueId.length === 0) {
        return res.status(400).json({ message: "League ID must contain numbers" });
      }

      const seasonYear = parseInt(seasonId);
      if (isNaN(seasonYear) || seasonYear < 2000 || seasonYear > new Date().getFullYear() + 1) {
        return res.status(400).json({ message: "Please enter a valid season year" });
      }

      // Check if league already exists
      const exists = await storage.checkLeagueExists(userId, cleanedLeagueId, seasonYear);
      if (exists) {
        return res.status(400).json({ message: "This league is already connected" });
      }

      // Fetch league info from ESPN API with timeout and error handling
      const espnClient = new Client({ leagueId: parseInt(cleanedLeagueId) });

      let leagueInfo;
      try {
        // Set a timeout for the ESPN API call (10 seconds) with cleanup
        let timeoutId: NodeJS.Timeout;
        const timeoutPromise = new Promise((_, reject) => {
          timeoutId = setTimeout(() => reject(new Error('ESPN API request timed out')), 10000);
        });

        try {
          leagueInfo = await Promise.race([
            espnClient.getLeagueInfo({ seasonId: seasonYear }),
            timeoutPromise
          ]);
        } finally {
          clearTimeout(timeoutId!);
        }
      } catch (espnError: any) {
        console.error("ESPN API error for league", cleanedLeagueId, "season", seasonYear, ":", espnError);
        
        let errorMessage = "Failed to fetch league from ESPN. ";
        const statusCode = espnError.response?.status;
        
        if (espnError.message?.includes('timeout')) {
          errorMessage = "ESPN API request timed out. Please try again.";
        } else if (statusCode === 401) {
          errorMessage = `League ${cleanedLeagueId} is private and requires authentication. Currently, only public ESPN leagues are supported. To make your league accessible: Go to ESPN → League Settings → Make League Publicly Viewable.`;
        } else if (statusCode === 404 || espnError.message?.includes('404') || espnError.message?.includes('not found')) {
          errorMessage = `League ${cleanedLeagueId} not found for ${seasonYear} season. Please verify: 1) League ID is correct, 2) Season year is correct.`;
        } else {
          errorMessage += `Please verify your league ID and season year are correct. (Error: ${statusCode || 'Unknown'})`;
        }
        
        return res.status(400).json({ message: errorMessage });
      }

      // Create league record
      const newLeague = await storage.createLeague({
        userId,
        leagueId: cleanedLeagueId,
        seasonId: seasonYear,
        leagueName: leagueInfo.name || `League ${cleanedLeagueId}`,
        teamCount: leagueInfo.size || null,
        isSelected: 0,
      });

      res.json(newLeague);
    } catch (error: any) {
      console.error("Error connecting league:", error);
      res.status(500).json({ 
        message: error.message || "Failed to connect league" 
      });
    }
  });

  app.post('/api/leagues/:id/select', isAuthenticated, async (req, res) => {
    try {
      const user = req.user as User;
      const userId = user.id;
      const { id } = req.params;

      // Verify the league belongs to the user
      const league = await storage.getLeagueById(id);
      if (!league) {
        return res.status(404).json({ message: "League not found" });
      }
      if (league.userId !== userId) {
        return res.status(403).json({ message: "Forbidden" });
      }

      await storage.selectLeague(userId, id);
      res.json({ message: "League selected successfully" });
    } catch (error) {
      console.error("Error selecting league:", error);
      res.status(500).json({ message: "Failed to select league" });
    }
  });

  app.post('/api/leagues/:id/set-team', isAuthenticated, async (req, res) => {
    try {
      const user = req.user as User;
      const userId = user.id;
      const { id } = req.params;

      // Validate request body with Zod
      const setTeamSchema = z.object({
        teamId: z.number().int().positive(),
      });

      const validation = setTeamSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ 
          message: "Valid team ID is required",
          errors: validation.error.errors 
        });
      }

      const { teamId } = validation.data;

      // Verify the league belongs to the user
      const league = await storage.getLeagueById(id);
      if (!league) {
        return res.status(404).json({ message: "League not found" });
      }
      if (league.userId !== userId) {
        return res.status(403).json({ message: "Forbidden" });
      }

      // Validate that the team exists in the league by fetching from ESPN
      const espnClient = new Client({ leagueId: parseInt(league.leagueId) });
      let teams;
      try {
        let timeoutId: NodeJS.Timeout;
        const timeoutPromise = new Promise((_, reject) => {
          timeoutId = setTimeout(() => reject(new Error('ESPN API request timed out')), 10000);
        });

        try {
          teams = await Promise.race([
            espnClient.getTeamsAtWeek({
              seasonId: league.seasonId,
              scoringPeriodId: getCurrentNFLWeek(),
            }),
            timeoutPromise
          ]);
        } finally {
          clearTimeout(timeoutId!);
        }
      } catch (espnError: any) {
        console.error("ESPN API error validating team:", espnError);
        return res.status(500).json({ message: "Failed to validate team with ESPN" });
      }

      // Check if the team exists in the league
      const teamExists = teams.some((team: any) => team.id === teamId);
      if (!teamExists) {
        return res.status(400).json({ message: "Team does not exist in this league" });
      }

      await storage.updateUserTeam(userId, id, teamId);
      res.json({ message: "Team selected successfully" });
    } catch (error) {
      console.error("Error setting user team:", error);
      res.status(500).json({ message: "Failed to set team" });
    }
  });

  // ESPN Data routes
  app.get('/api/leagues/:id/matchups', isAuthenticated, async (req, res) => {
    try {
      const user = req.user as User;
      const { id } = req.params;
      const { week } = req.query;

      // Verify the league belongs to the user
      const league = await storage.getLeagueById(id);
      if (!league) {
        return res.status(404).json({ message: "League not found" });
      }
      if (league.userId !== user.id) {
        return res.status(403).json({ message: "Forbidden" });
      }

      const currentWeek = week ? parseInt(week as string) : getCurrentNFLWeek();
      const espnClient = new Client({ leagueId: parseInt(league.leagueId) });

      let boxscores;
      try {
        let timeoutId: NodeJS.Timeout;
        const timeoutPromise = new Promise((_, reject) => {
          timeoutId = setTimeout(() => reject(new Error('ESPN API request timed out')), 15000);
        });

        try {
          boxscores = await Promise.race([
            espnClient.getBoxscoreForWeek({
              seasonId: league.seasonId,
              scoringPeriodId: currentWeek,
              matchupPeriodId: currentWeek,
            }),
            timeoutPromise
          ]);
        } finally {
          clearTimeout(timeoutId!);
        }
      } catch (espnError: any) {
        console.error("ESPN API error fetching matchups:", espnError);
        return res.status(500).json({ message: "Failed to fetch matchups from ESPN" });
      }

      // Debug: Log raw roster data from first matchup
      if (boxscores && boxscores.length > 0 && boxscores[0].homeRoster && boxscores[0].homeRoster.length > 0) {
        console.log("Sample raw roster entry from ESPN:", JSON.stringify(boxscores[0].homeRoster[0], null, 2));
      }

      // Enhance boxscores with processed player roster data
      const enhancedMatchups = boxscores.map((boxscore: any) => ({
        ...boxscore,
        homeRoster: processRoster(boxscore.homeRoster || []),
        awayRoster: processRoster(boxscore.awayRoster || []),
      }));

      res.json({ week: currentWeek, matchups: enhancedMatchups });
    } catch (error) {
      console.error("Error fetching matchups:", error);
      res.status(500).json({ message: "Failed to fetch matchups" });
    }
  });

  app.get('/api/leagues/:id/teams', isAuthenticated, async (req, res) => {
    try {
      const user = req.user as User;
      const { id } = req.params;
      const { week } = req.query;

      // Verify the league belongs to the user
      const league = await storage.getLeagueById(id);
      if (!league) {
        return res.status(404).json({ message: "League not found" });
      }
      if (league.userId !== user.id) {
        return res.status(403).json({ message: "Forbidden" });
      }

      const currentWeek = week ? parseInt(week as string) : getCurrentNFLWeek();
      const espnClient = new Client({ leagueId: parseInt(league.leagueId) });

      let teams;
      try {
        let timeoutId: NodeJS.Timeout;
        const timeoutPromise = new Promise((_, reject) => {
          timeoutId = setTimeout(() => reject(new Error('ESPN API request timed out')), 15000);
        });

        try {
          teams = await Promise.race([
            espnClient.getTeamsAtWeek({
              seasonId: league.seasonId,
              scoringPeriodId: currentWeek,
            }),
            timeoutPromise
          ]);
        } finally {
          clearTimeout(timeoutId!);
        }
      } catch (espnError: any) {
        console.error("ESPN API error fetching teams:", espnError);
        return res.status(500).json({ message: "Failed to fetch teams from ESPN" });
      }

      // Debug: Log raw roster data from first team
      if (teams && teams.length > 0 && teams[0].roster && teams[0].roster.length > 0) {
        console.log("Sample raw team roster entry from ESPN:", JSON.stringify(teams[0].roster[0], null, 2));
      }

      // Process roster data for each team
      const processedTeams = teams.map((team: any) => ({
        ...team,
        roster: processRoster(team.roster || []),
      }));

      res.json({ week: currentWeek, teams: processedTeams });
    } catch (error) {
      console.error("Error fetching teams:", error);
      res.status(500).json({ message: "Failed to fetch teams" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}

// Helper function to get current NFL week (approximate)
function getCurrentNFLWeek(): number {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth(); // 0-indexed
  
  // NFL season typically starts in early September
  if (month < 8) return 1; // Before September
  if (month > 11) return 18; // After December (playoffs/offseason)
  
  // Approximate week based on date
  const seasonStart = new Date(year, 8, 5); // ~September 5
  const daysDiff = Math.floor((now.getTime() - seasonStart.getTime()) / (1000 * 60 * 60 * 24));
  const week = Math.min(Math.max(Math.floor(daysDiff / 7) + 1, 1), 18);
  
  return week;
}