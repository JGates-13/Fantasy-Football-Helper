import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./auth";
import { createRequire } from "module";
import type { User } from "@shared/schema";

// ESPN API doesn't support ES modules, use createRequire
const require = createRequire(import.meta.url);
const { Client } = require("espn-fantasy-football-api/node");

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

  const httpServer = createServer(app);
  return httpServer;
}