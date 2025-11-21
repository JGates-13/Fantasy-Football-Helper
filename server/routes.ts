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
    // ESPN API has different structures for different endpoints
    let player: any = null;
    let lineupSlotId = 20; // Default to bench
    
    // Check if this is from the teams endpoint (has direct player properties)
    if (entry.fullName || entry.firstName || entry.lastName) {
      player = entry;
      // For teams endpoint, rosteredPosition tells us the lineup slot
      if (entry.rosteredPosition) {
        // Map rosteredPosition string to slot ID
        const posMap: Record<string, number> = {
          'QB': 0, 'RB': 2, 'WR': 4, 'TE': 6, 'FLEX': 23, 'D/ST': 16, 'K': 17,
          'Bench': 20, 'BE': 20, 'IR': 21
        };
        lineupSlotId = posMap[entry.rosteredPosition] ?? 20;
      }
    } 
    // Check for matchup endpoint structure (nested in playerPoolEntry)
    else if (entry.playerPoolEntry?.player) {
      player = entry.playerPoolEntry.player;
      lineupSlotId = entry.lineupSlotId ?? 20;
    } 
    // Other possible structures
    else if (entry.player) {
      player = entry.player;
      lineupSlotId = entry.lineupSlotId ?? entry.slot ?? 20;
    }

    // Get NFL team and opponent info
    const nflTeamId = player?.proTeamId ?? player?.proTeam ?? null;
    const opponentTeamId = player?.opponentProTeamId ?? null;

    // Determine player name with extensive fallbacks
    let playerName = 'Empty Slot';
    if (player) {
      if (player.fullName) {
        playerName = player.fullName;
      } else if (player.firstName && player.lastName) {
        playerName = `${player.firstName} ${player.lastName}`;
      } else if (lineupSlotId === 16 && nflTeamId && NFL_TEAM_NAMES[nflTeamId]) {
        playerName = `${NFL_TEAM_NAMES[nflTeamId]} D/ST`;
      } else if (player.lastName) {
        playerName = player.lastName;
      } else if (nflTeamId && NFL_TEAM_NAMES[nflTeamId]) {
        playerName = `${NFL_TEAM_NAMES[nflTeamId]} D/ST`;
      }
    }

    // Get the actual player position (their real position, not lineup slot)
    let actualPosition = 'N/A';
    
    // Try defaultPosition first (like "RB/WR" for flex-eligible players)
    if (player?.defaultPosition) {
      // Parse positions like "RB/WR" to get primary position
      const positions = player.defaultPosition.split('/');
      // Use the first position that's a standard position
      for (const pos of positions) {
        if (['QB', 'RB', 'WR', 'TE', 'K'].includes(pos)) {
          actualPosition = pos;
          break;
        }
      }
      // If still N/A and position includes D/ST
      if (actualPosition === 'N/A' && player.defaultPosition.includes('D/ST')) {
        actualPosition = 'D/ST';
      }
    }
    
    // Fallback: check eligiblePositions array
    if (actualPosition === 'N/A' && player?.eligiblePositions && Array.isArray(player.eligiblePositions)) {
      for (const pos of player.eligiblePositions) {
        if (['QB', 'RB', 'WR', 'TE', 'K', 'D/ST', 'DEF'].includes(pos)) {
          actualPosition = pos === 'DEF' ? 'D/ST' : pos;
          break;
        }
      }
    }
    
    // Last resort: infer from lineup slot if it's a specific position slot
    if (actualPosition === 'N/A' && lineupSlotId < 20) {
      if (lineupSlotId === 0) actualPosition = 'QB';
      else if (lineupSlotId === 2) actualPosition = 'RB';
      else if (lineupSlotId === 4) actualPosition = 'WR';
      else if (lineupSlotId === 6) actualPosition = 'TE';
      else if (lineupSlotId === 16) actualPosition = 'D/ST';
      else if (lineupSlotId === 17) actualPosition = 'K';
    }

    // Extract points - ESPN provides these at multiple levels
    const totalPoints = entry.totalPoints ?? 
                       entry.points ?? 
                       entry.appliedStatTotal ?? 
                       player?.totalPoints ?? 
                       0;

    // Projected points calculation from projectedPointBreakdown
    let projectedPoints = 0;
    
    // Check player object first (from teams endpoint)
    if (player?.projectedPointBreakdown?.usesPoints) {
      const breakdown = player.projectedPointBreakdown;
      projectedPoints = Object.entries(breakdown)
        .filter(([key]) => key !== 'usesPoints')
        .reduce((sum, [_, value]) => sum + (typeof value === 'number' ? value : 0), 0);
    }
    // Check entry object (from matchups endpoint)
    else if (entry.projectedPointBreakdown?.usesPoints) {
      const breakdown = entry.projectedPointBreakdown;
      projectedPoints = Object.entries(breakdown)
        .filter(([key]) => key !== 'usesPoints')
        .reduce((sum, [_, value]) => sum + (typeof value === 'number' ? value : 0), 0);
    }
    // Check nested playerPoolEntry structure
    else if (entry.playerPoolEntry?.player?.projectedPointBreakdown?.usesPoints) {
      const breakdown = entry.playerPoolEntry.player.projectedPointBreakdown;
      projectedPoints = Object.entries(breakdown)
        .filter(([key]) => key !== 'usesPoints')
        .reduce((sum, [_, value]) => sum + (typeof value === 'number' ? value : 0), 0);
    }
    // Fallback to direct projectedPoints field
    else {
      projectedPoints = entry.projectedPoints ?? 
                       player?.projectedPoints ??
                       entry.playerPoolEntry?.player?.projectedPoints ??
                       0;
    }

    // Determine if this is a starter (lineup slot < 20 means active lineup, not bench/IR)
    const isStarter = lineupSlotId < 20 && lineupSlotId !== 21;

    return {
      playerId: player?.id ?? null,
      playerName,
      position: actualPosition,
      lineupSlotId,
      isStarter,
      nflTeam: nflTeamId ? NFL_TEAM_NAMES[nflTeamId] || 'FA' : 'FA',
      opponent: opponentTeamId ? NFL_TEAM_NAMES[opponentTeamId] : null,
      totalPoints: parseFloat(totalPoints) || 0,
      projectedPoints: parseFloat(projectedPoints) || 0,
      slotCategoryId: lineupSlotId,
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

  // Rankings from Sleeper API with current season year
  app.get('/api/rankings', async (req, res) => {
    try {
      // Get current season year dynamically
      const now = new Date();
      const currentSeasonYear = now.getMonth() >= 8 ? now.getFullYear() : now.getFullYear() - 1;

      const response = await fetch(`https://api.sleeper.com/stats/nfl/${currentSeasonYear}?season_type=regular&position[]=QB&position[]=RB&position[]=WR&position[]=TE&position[]=K&position[]=DEF&order_by=pts_ppr`);
      if (!response.ok) {
        throw new Error('Failed to fetch rankings from Sleeper');
      }

      const allStats = await response.json();

      // Also fetch player info to get names
      const playersResponse = await fetch('https://api.sleeper.app/v1/players/nfl');
      if (!playersResponse.ok) {
        throw new Error('Failed to fetch player data');
      }
      const players = await playersResponse.json();

      // Organize rankings by position
      const rankings: any = {
        QB: [],
        RB: [],
        WR: [],
        TE: [],
        K: [],
        DEF: []
      };

      // Get current week to calculate per-game averages
      const currentWeek = getCurrentNFLWeek();

      // Process and rank players
      allStats.forEach((stat: any, index: number) => {
        const player = players[stat.player_id];
        if (player && stat.stats?.pts_ppr) {
          const position = stat.position || player.position;
          if (rankings[position]) {
            rankings[position].push({
              playerId: stat.player_id,
              name: `${player.first_name || ''} ${player.last_name || ''}`.trim() || player.full_name || 'Unknown',
              position: position,
              team: player.team || 'FA',
              rank: rankings[position].length + 1,
              points: stat.stats.pts_ppr || 0,
              weeklyAvg: currentWeek > 0 ? (stat.stats.pts_ppr / currentWeek).toFixed(1) : '0.0'
            });
          }
        }
      });

      // Sort each position by points and limit to top 50
      Object.keys(rankings).forEach(pos => {
        rankings[pos] = rankings[pos]
          .sort((a: any, b: any) => b.points - a.points)
          .slice(0, 50)
          .map((p: any, idx: number) => ({ ...p, rank: idx + 1 }));
      });

      res.json(rankings);
    } catch (error) {
      console.error("Error fetching rankings:", error);
      res.status(500).json({ message: "Failed to fetch rankings" });
    }
  });

  // Intelligent waiver wire suggestions based on user's roster and rankings
  app.get('/api/waiver-wire/:id', isAuthenticated, async (req, res) => {
    try {
      const user = req.user as User;
      const { id } = req.params;

      // Verify the league belongs to the user
      const league = await storage.getLeagueById(id);
      if (!league) {
        return res.status(404).json({ message: "League not found" });
      }
      if (league.userId !== user.id) {
        return res.status(403).json({ message: "Forbidden" });
      }

      // Fetch trending players
      const trendingResponse = await fetch('https://api.sleeper.app/v1/players/nfl/trending/add?lookback_hours=48&limit=100');
      if (!trendingResponse.ok) {
        throw new Error('Failed to fetch trending players');
      }
      const trending = await trendingResponse.json();

      // Fetch player data
      const playersResponse = await fetch('https://api.sleeper.app/v1/players/nfl');
      if (!playersResponse.ok) {
        throw new Error('Failed to fetch player data');
      }
      const players = await playersResponse.json();

      // Fetch current season stats for ranking
      const now = new Date();
      const currentSeasonYear = now.getMonth() >= 8 ? now.getFullYear() : now.getFullYear() - 1;

      const statsResponse = await fetch(`https://api.sleeper.com/stats/nfl/${currentSeasonYear}?season_type=regular&position[]=QB&position[]=RB&position[]=WR&position[]=TE&position[]=K&position[]=DEF&order_by=pts_ppr`);
      if (!statsResponse.ok) {
        throw new Error('Failed to fetch player stats');
      }
      const allStats = await statsResponse.json();

      // Create a map of player stats
      const statsMap = new Map();
      allStats.forEach((stat: any) => {
        if (stat.stats?.pts_ppr) {
          statsMap.set(stat.player_id, {
            points: stat.stats.pts_ppr,
            weeklyAvg: stat.stats.pts_ppr / getCurrentNFLWeek()
          });
        }
      });

      // Get user's team roster
      const currentWeek = getCurrentNFLWeek();
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
        console.error("ESPN API error:", espnError);
        // Fallback to just trending if can't get roster
        const trendingPlayers = trending.slice(0, 25).map((t: any) => {
          const player = players[t.player_id];
          const stats = statsMap.get(t.player_id);
          return {
            playerId: t.player_id,
            name: player ? `${player.first_name || ''} ${player.last_name || ''}`.trim() || player.full_name : 'Unknown',
            position: player?.position || 'N/A',
            team: player?.team || 'FA',
            adds: t.count,
            weeklyAvg: stats?.weeklyAvg?.toFixed(1) || 'N/A',
            totalPoints: stats?.points?.toFixed(1) || 'N/A',
            recommendation: 'Trending pickup'
          };
        });
        return res.json(trendingPlayers);
      }

      const myTeam = teams.find((t: any) => t.id === league.userTeamId);
      if (!myTeam) {
        // Fallback if team not found
        const trendingPlayers = trending.slice(0, 25).map((t: any) => {
          const player = players[t.player_id];
          const stats = statsMap.get(t.player_id);
          return {
            playerId: t.player_id,
            name: player ? `${player.first_name || ''} ${player.last_name || ''}`.trim() || player.full_name : 'Unknown',
            position: player?.position || 'N/A',
            team: player?.team || 'FA',
            adds: t.count,
            weeklyAvg: stats?.weeklyAvg?.toFixed(1) || 'N/A',
            totalPoints: stats?.points?.toFixed(1) || 'N/A',
            recommendation: 'Trending pickup'
          };
        });
        return res.json(trendingPlayers);
      }

      // Analyze roster to find weak positions
      const rosterByPosition = processRoster(myTeam.roster || []).reduce((acc: any, player: any) => {
        const pos = player.position;
        if (!acc[pos]) acc[pos] = [];
        acc[pos].push(player);
        return acc;
      }, {});

      // Calculate average points by position
      const positionAverages: any = {};
      Object.keys(rosterByPosition).forEach(pos => {
        const players = rosterByPosition[pos];
        const avgPoints = players.reduce((sum: number, p: any) => sum + (p.totalPoints || 0), 0) / players.length;
        positionAverages[pos] = avgPoints;
      });

      // Identify weak positions (below average)
      const weakPositions = new Set<string>();
      ['QB', 'RB', 'WR', 'TE'].forEach(pos => {
        if (!rosterByPosition[pos] || rosterByPosition[pos].length === 0 || positionAverages[pos] < 8) {
          weakPositions.add(pos);
        }
      });

      // Score and rank waiver wire candidates
      const candidates = trending.map((t: any) => {
        const player = players[t.player_id];
        const stats = statsMap.get(t.player_id);
        const position = player?.position;

        if (!player || !position || !['QB', 'RB', 'WR', 'TE', 'K', 'DEF'].includes(position)) {
          return null;
        }

        // Calculate recommendation score
        let score = t.count; // Base score from trending adds
        if (weakPositions.has(position)) score += 100; // Boost for weak positions
        if (stats) {
          score += stats.weeklyAvg * 10; // Boost for performance
        }

        let recommendation = '';
        if (weakPositions.has(position)) {
          recommendation = `Upgrade weak ${position} position`;
        } else {
          recommendation = 'Trending high-value pickup';
        }

        return {
          playerId: t.player_id,
          name: player ? `${player.first_name || ''} ${player.last_name || ''}`.trim() || player.full_name : 'Unknown',
          position: position,
          team: player?.team || 'FA',
          adds: t.count,
          weeklyAvg: stats?.weeklyAvg?.toFixed(1) || 'N/A',
          totalPoints: stats?.points?.toFixed(1) || 'N/A',
          recommendation,
          score
        };
      }).filter((p: any) => p !== null);

      // Sort by score and return top 25
      candidates.sort((a: any, b: any) => b.score - a.score);

      res.json(candidates.slice(0, 25));
    } catch (error) {
      console.error("Error fetching waiver wire:", error);
      res.status(500).json({ message: "Failed to fetch waiver wire suggestions" });
    }
  });

  // Comprehensive trade finder using ESPN projection data
  app.get('/api/trade-suggestions/:id', isAuthenticated, async (req, res) => {
    try {
      const user = req.user as User;
      const { id } = req.params;

      // Verify the league belongs to the user
      const league = await storage.getLeagueById(id);
      if (!league) {
        return res.status(404).json({ message: "League not found" });
      }
      if (league.userId !== user.id) {
        return res.status(403).json({ message: "Forbidden" });
      }

      // Get all teams in the league with ESPN data
      const currentWeek = getCurrentNFLWeek();
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
        console.error("ESPN API error:", espnError);
        return res.status(500).json({ message: "Failed to fetch teams from ESPN" });
      }

      const myTeam = teams.find((t: any) => t.id === league.userTeamId);
      if (!myTeam) {
        return res.json([]);
      }

      // Process rosters using ESPN's actual and projected points
      const myRoster = processRoster(myTeam.roster || []).map((player: any) => {
        // Use projectedPoints for rest-of-season value, totalPoints for current performance
        const projectedAvg = player.projectedPoints || 0;
        const actualAvg = currentWeek > 0 ? (player.totalPoints || 0) / currentWeek : 0;
        // Weight: 60% projected, 40% actual performance
        const value = (projectedAvg * 0.6) + (actualAvg * 0.4);
        
        return {
          ...player,
          weeklyAvg: actualAvg,
          projectedAvg: projectedAvg,
          value: value,
          seasonTotal: player.totalPoints || 0
        };
      });

      // Analyze my team's strengths and weaknesses by position
      const myPositionStrength: any = {};
      const myAllPlayers = myRoster.filter(p => ['QB', 'RB', 'WR', 'TE'].includes(p.position));
      
      ['QB', 'RB', 'WR', 'TE'].forEach(pos => {
        const posPlayers = myAllPlayers.filter(p => p.position === pos);
        if (posPlayers.length > 0) {
          const sortedPlayers = posPlayers.sort((a, b) => b.value - a.value);
          const avgValue = sortedPlayers.reduce((sum, p) => sum + p.value, 0) / sortedPlayers.length;
          const topValue = sortedPlayers[0]?.value || 0;
          const depth = sortedPlayers.filter(p => p.value > 5).length;
          
          myPositionStrength[pos] = {
            avgValue,
            topValue,
            depth,
            count: posPlayers.length,
            players: sortedPlayers,
            starters: sortedPlayers.filter(p => p.isStarter)
          };
        } else {
          myPositionStrength[pos] = { avgValue: 0, topValue: 0, depth: 0, count: 0, players: [], starters: [] };
        }
      });

      // Calculate position rankings to identify weaknesses
      const positionRanking = Object.entries(myPositionStrength)
        .map(([pos, data]: [string, any]) => ({ 
          pos, 
          avgValue: data.avgValue,
          topValue: data.topValue,
          depth: data.depth,
          score: (data.topValue * 0.5) + (data.avgValue * 0.3) + (data.depth * 2)
        }))
        .sort((a, b) => a.score - b.score);

      const weakPositions = positionRanking.slice(0, 2).map(p => p.pos);
      const strongPositions = positionRanking.slice(-2).map(p => p.pos);

      // Analyze all other teams
      const tradeSuggestions: any[] = [];

      teams.forEach((otherTeam: any) => {
        if (otherTeam.id === league.userTeamId) return;

        const theirRoster = processRoster(otherTeam.roster || []).map((player: any) => {
          const projectedAvg = player.projectedPoints || 0;
          const actualAvg = currentWeek > 0 ? (player.totalPoints || 0) / currentWeek : 0;
          const value = (projectedAvg * 0.6) + (actualAvg * 0.4);
          
          return {
            ...player,
            weeklyAvg: actualAvg,
            projectedAvg: projectedAvg,
            value: value,
            seasonTotal: player.totalPoints || 0
          };
        });

        // Analyze their team
        const theirPositionStrength: any = {};
        const theirAllPlayers = theirRoster.filter(p => ['QB', 'RB', 'WR', 'TE'].includes(p.position));
        
        ['QB', 'RB', 'WR', 'TE'].forEach(pos => {
          const posPlayers = theirAllPlayers.filter(p => p.position === pos);
          if (posPlayers.length > 0) {
            const sortedPlayers = posPlayers.sort((a, b) => b.value - a.value);
            const avgValue = sortedPlayers.reduce((sum, p) => sum + p.value, 0) / sortedPlayers.length;
            const topValue = sortedPlayers[0]?.value || 0;
            const depth = sortedPlayers.filter(p => p.value > 5).length;
            
            theirPositionStrength[pos] = {
              avgValue,
              topValue,
              depth,
              players: sortedPlayers,
              starters: sortedPlayers.filter(p => p.isStarter)
            };
          } else {
            theirPositionStrength[pos] = { avgValue: 0, topValue: 0, depth: 0, players: [], starters: [] };
          }
        });

        // Find mutually beneficial trades
        weakPositions.forEach(weakPos => {
          strongPositions.forEach(strongPos => {
            const myStrongPlayers = myPositionStrength[strongPos]?.players || [];
            const theirStrongPlayers = theirPositionStrength[weakPos]?.players || [];

            // Consider tradeable players: bench players or flex-worthy starters from deep positions
            const myTradeable = myStrongPlayers.filter((p: any) => 
              p.value > 5 && (!p.isStarter || myPositionStrength[strongPos].depth > 2)
            ).slice(0, 4);
            
            const theirTradeable = theirStrongPlayers.filter((p: any) =>
              p.value > 5 && (!p.isStarter || theirPositionStrength[weakPos].depth > 2)
            ).slice(0, 4);

            myTradeable.forEach((myPlayer: any) => {
              theirTradeable.forEach((theirPlayer: any) => {
                // Calculate trade fairness
                const valueDiff = Math.abs(myPlayer.value - theirPlayer.value);
                const avgValue = (myPlayer.value + theirPlayer.value) / 2;
                const fairness = avgValue > 0 ? (1 - (valueDiff / avgValue)) : 0;

                // Calculate positional need scores
                const myNeedScore = (15 - myPositionStrength[weakPos].topValue) / 15;
                const theirNeedScore = (15 - theirPositionStrength[strongPos].topValue) / 15;
                
                // Calculate improvement for both teams
                const myImprovement = theirPlayer.value - (myPositionStrength[weakPos].avgValue || 0);
                const theirImprovement = myPlayer.value - (theirPositionStrength[strongPos].avgValue || 0);

                // Trade is good if it's fair AND helps at least one team significantly
                if (fairness > 0.65 && myPlayer.value > 4 && theirPlayer.value > 4) {
                  const helpsMe = myImprovement > 1;
                  const helpsThem = theirImprovement > 1;
                  const mutualBenefit = helpsMe && helpsThem;

                  if (helpsMe || mutualBenefit) {
                    const tradeQuality = mutualBenefit ? 'Win-Win' : helpsMe ? 'Favorable' : 'Fair';
                    
                    tradeSuggestions.push({
                      teamId: otherTeam.id,
                      teamName: otherTeam.name || `Team ${otherTeam.id}`,
                      teamRecord: `${otherTeam.wins || 0}-${otherTeam.losses || 0}`,
                      tradeQuality,
                      myPlayer: {
                        name: myPlayer.playerName,
                        position: myPlayer.position,
                        team: myPlayer.nflTeam,
                        weeklyAvg: myPlayer.weeklyAvg.toFixed(1),
                        projected: myPlayer.projectedAvg.toFixed(1),
                        seasonTotal: myPlayer.seasonTotal.toFixed(1),
                        value: myPlayer.value.toFixed(1)
                      },
                      theirPlayer: {
                        name: theirPlayer.playerName,
                        position: theirPlayer.position,
                        team: theirPlayer.nflTeam,
                        weeklyAvg: theirPlayer.weeklyAvg.toFixed(1),
                        projected: theirPlayer.projectedAvg.toFixed(1),
                        seasonTotal: theirPlayer.seasonTotal.toFixed(1),
                        value: theirPlayer.value.toFixed(1)
                      },
                      analysis: {
                        fairness: (fairness * 100).toFixed(0) + '%',
                        myImprovement: myImprovement.toFixed(1),
                        theirImprovement: theirImprovement.toFixed(1),
                        myWeakPosition: weakPos,
                        myStrongPosition: strongPos,
                        reasoning: `Strengthen your ${weakPos} position by acquiring ${theirPlayer.playerName} (${theirPlayer.projectedAvg.toFixed(1)} proj PPG). You can afford to trade ${myPlayer.playerName} from your deep ${strongPos} position.`
                      },
                      score: (fairness * 100) + (myImprovement * 5) + (mutualBenefit ? 30 : helpsMe ? 20 : 0) + (myNeedScore * 10)
                    });
                  }
                }
              });
            });
          });
        });
      });

      // Sort by score and return top suggestions
      tradeSuggestions.sort((a, b) => b.score - a.score);

      res.json(tradeSuggestions.slice(0, 15));
    } catch (error) {
      console.error("Error fetching trade suggestions:", error);
      res.status(500).json({ message: "Failed to fetch trade suggestions" });
    }
  });

  // Delete account
  app.delete('/api/account', isAuthenticated, async (req, res) => {
    try {
      const user = req.user as User;
      await storage.deleteUser(user.id);

      // Destroy session
      req.session.destroy((err) => {
        if (err) {
          console.error("Error destroying session:", err);
        }
      });

      res.json({ message: "Account deleted successfully" });
    } catch (error) {
      console.error("Error deleting account:", error);
      res.status(500).json({ message: "Failed to delete account" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}

// Helper function to get current NFL week (dynamically calculates for any season)
function getCurrentNFLWeek(): number {
  const now = new Date();
  const currentYear = now.getFullYear();

  // NFL season typically starts first Thursday after Labor Day (first Monday in September)
  // For simplicity, we'll use early September as the season start
  const seasonStartYear = now.getMonth() >= 8 ? currentYear : currentYear - 1; // September or later = current year, else previous year

  // Week start dates for current season (adjust year dynamically)
  const weekStarts = [
    new Date(`${seasonStartYear}-09-05`), // Week 1 (approximate)
    new Date(`${seasonStartYear}-09-09`), // Week 2
    new Date(`${seasonStartYear}-09-16`), // Week 3
    new Date(`${seasonStartYear}-09-23`), // Week 4
    new Date(`${seasonStartYear}-09-30`), // Week 5
    new Date(`${seasonStartYear}-10-07`), // Week 6
    new Date(`${seasonStartYear}-10-14`), // Week 7
    new Date(`${seasonStartYear}-10-21`), // Week 8
    new Date(`${seasonStartYear}-10-28`), // Week 9
    new Date(`${seasonStartYear}-11-04`), // Week 10
    new Date(`${seasonStartYear}-11-11`), // Week 11
    new Date(`${seasonStartYear}-11-18`), // Week 12
    new Date(`${seasonStartYear}-11-25`), // Week 13
    new Date(`${seasonStartYear}-12-02`), // Week 14
    new Date(`${seasonStartYear}-12-09`), // Week 15
    new Date(`${seasonStartYear}-12-16`), // Week 16
    new Date(`${seasonStartYear}-12-23`), // Week 17
    new Date(`${seasonStartYear}-12-30`), // Week 18
  ];

  // Find the current week
  for (let i = weekStarts.length - 1; i >= 0; i--) {
    if (now >= weekStarts[i]) {
      return i + 1; // Week number is index + 1
    }
  }

  // Before season starts or after season ends
  return 1;
}