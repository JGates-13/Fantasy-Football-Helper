import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Trophy, Users, ArrowLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { EspnLeague } from "@shared/schema";

export default function LeagueView() {
  const { id } = useParams();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [selectedWeek, setSelectedWeek] = useState<number | null>(null);

  const { data: leagues } = useQuery<EspnLeague[]>({
    queryKey: ["/api/leagues"],
  });

  const league = leagues?.find((l) => l.id === id);

  const { data: matchupsData, isLoading: matchupsLoading, error: matchupsError } = useQuery({
    queryKey: [`/api/leagues/${id}/matchups`, selectedWeek],
    queryFn: async () => {
      const url = selectedWeek 
        ? `/api/leagues/${id}/matchups?week=${selectedWeek}`
        : `/api/leagues/${id}/matchups`;
      const response = await fetch(url, {
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error(await response.text());
      }
      return response.json();
    },
    enabled: !!id && !!league,
  });

  const { data: teamsData, isLoading: teamsLoading, error: teamsError } = useQuery({
    queryKey: [`/api/leagues/${id}/teams`, selectedWeek],
    queryFn: async () => {
      const url = selectedWeek 
        ? `/api/leagues/${id}/teams?week=${selectedWeek}`
        : `/api/leagues/${id}/teams`;
      const response = await fetch(url, {
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error(await response.text());
      }
      return response.json();
    },
    enabled: !!id && !!league,
  });

  // Update selectedWeek when data is first loaded
  useEffect(() => {
    if (matchupsData?.week && selectedWeek === null) {
      setSelectedWeek(matchupsData.week);
    } else if (teamsData?.week && selectedWeek === null) {
      setSelectedWeek(teamsData.week);
    }
  }, [matchupsData, teamsData, selectedWeek]);

  // Show error toasts
  useEffect(() => {
    if (matchupsError) {
      toast({
        title: "Error Loading Matchups",
        description: "Failed to load matchup data from ESPN",
        variant: "destructive",
      });
    }
    if (teamsError) {
      toast({
        title: "Error Loading Teams",
        description: "Failed to load team roster data from ESPN",
        variant: "destructive",
      });
    }
  }, [matchupsError, teamsError, toast]);

  if (!league) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card>
          <CardContent className="py-12 text-center">
            <Trophy className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
            <p className="text-foreground font-semibold mb-2">League not found</p>
            <p className="text-sm text-muted-foreground mb-4">
              This league may not exist or you don't have access to it
            </p>
            <Button onClick={() => setLocation("/")} className="mt-4">
              Go Back
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const currentWeek = matchupsData?.week || teamsData?.week || 1;
  const matchups = matchupsData?.matchups || [];
  const teams = teamsData?.teams || [];

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="border-b border-border sticky top-0 bg-background z-50">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setLocation("/")}
              data-testid="button-back"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-primary rounded-md flex items-center justify-center">
                <Trophy className="w-5 h-5 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-lg font-semibold text-foreground" data-testid="text-league-name">
                  {league.leagueName}
                </h1>
                <p className="text-xs text-muted-foreground">
                  Week {currentWeek}
                </p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-4 max-w-7xl">
        <Tabs defaultValue="matchups" className="space-y-6">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="matchups" data-testid="tab-matchups">Matchups</TabsTrigger>
            <TabsTrigger value="rosters" data-testid="tab-rosters">Team Rosters</TabsTrigger>
          </TabsList>

          <TabsContent value="matchups" className="space-y-4">
            <h2 className="text-xl font-semibold text-foreground">Week {currentWeek} Matchups</h2>

            {matchupsLoading ? (
              <div className="grid gap-4">
                {[1, 2, 3].map((i) => (
                  <Card key={i}>
                    <CardContent className="p-4">
                      <Skeleton className="h-24 w-full" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : matchups.length > 0 ? (
              <div className="space-y-6">
                {matchups.map((matchup: any, idx: number) => (
                  <Card key={idx} data-testid={`card-matchup-${idx}`}>
                    <CardContent className="p-0">
                      {/* Matchup Header */}
                      <div className="grid md:grid-cols-2 gap-4 p-4 border-b border-border">
                        <div className="flex flex-col items-center text-center space-y-1">
                          <p className="font-semibold text-base text-foreground" data-testid={`text-home-team-${idx}`}>
                            {matchup.homeTeam?.name || `Team ${matchup.homeTeamId}`}
                          </p>
                          <p className="text-2xl font-bold text-primary" data-testid={`text-home-score-${idx}`}>
                            {matchup.homeScore?.toFixed(2) || '0.00'}
                          </p>
                          {matchup.homeTeam?.record && (
                            <p className="text-xs text-muted-foreground">
                              {matchup.homeTeam.wins}-{matchup.homeTeam.losses}
                            </p>
                          )}
                        </div>

                        <div className="flex flex-col items-center text-center space-y-1">
                          <p className="font-semibold text-base text-foreground" data-testid={`text-away-team-${idx}`}>
                            {matchup.awayTeam?.name || `Team ${matchup.awayTeamId}`}
                          </p>
                          <p className="text-2xl font-bold text-primary" data-testid={`text-away-score-${idx}`}>
                            {matchup.awayScore?.toFixed(2) || '0.00'}
                          </p>
                          {matchup.awayTeam?.record && (
                            <p className="text-xs text-muted-foreground">
                              {matchup.awayTeam.wins}-{matchup.awayTeam.losses}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Player Rosters */}
                      <div className="grid md:grid-cols-2 divide-x divide-border">
                        {/* Home Team Roster */}
                        <div className="p-4 space-y-3">
                          <h3 className="text-sm font-semibold text-foreground mb-2">Roster</h3>
                          <div className="space-y-1">
                            {matchup.homeRoster?.map((player: any, pIdx: number) => (
                              <div
                                key={pIdx}
                                className={`flex items-center justify-between text-xs p-2 rounded ${
                                  player.isStarter
                                    ? 'bg-primary/10 border border-primary/20'
                                    : 'bg-muted/30'
                                }`}
                                data-testid={`player-home-${idx}-${pIdx}`}
                              >
                                <div className="flex items-center gap-2 flex-1 min-w-0">
                                  <span className={`font-semibold text-[10px] px-1.5 py-0.5 rounded whitespace-nowrap ${
                                    player.isStarter
                                      ? 'bg-primary text-primary-foreground'
                                      : 'bg-muted-foreground/20 text-muted-foreground'
                                  }`}>
                                    {player.position}
                                  </span>
                                  <div className="flex flex-col flex-1 min-w-0">
                                    <span className="font-medium text-foreground truncate">
                                      {player.playerName}
                                    </span>
                                    {(player.nflTeam || player.opponent) && (
                                      <span className="text-[10px] text-muted-foreground">
                                        {player.nflTeam}
                                        {player.opponent && ` vs ${player.opponent}`}
                                      </span>
                                    )}
                                  </div>
                                </div>
                                <span className="font-semibold text-foreground ml-2">
                                  {player.totalPoints?.toFixed(1) || '0.0'}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Away Team Roster */}
                        <div className="p-4 space-y-3">
                          <h3 className="text-sm font-semibold text-foreground mb-2">Roster</h3>
                          <div className="space-y-1">
                            {matchup.awayRoster?.map((player: any, pIdx: number) => (
                              <div
                                key={pIdx}
                                className={`flex items-center justify-between text-xs p-2 rounded ${
                                  player.isStarter
                                    ? 'bg-primary/10 border border-primary/20'
                                    : 'bg-muted/30'
                                }`}
                                data-testid={`player-away-${idx}-${pIdx}`}
                              >
                                <div className="flex items-center gap-2 flex-1 min-w-0">
                                  <span className={`font-semibold text-[10px] px-1.5 py-0.5 rounded whitespace-nowrap ${
                                    player.isStarter
                                      ? 'bg-primary text-primary-foreground'
                                      : 'bg-muted-foreground/20 text-muted-foreground'
                                  }`}>
                                    {player.position}
                                  </span>
                                  <div className="flex flex-col flex-1 min-w-0">
                                    <span className="font-medium text-foreground truncate">
                                      {player.playerName}
                                    </span>
                                    {(player.nflTeam || player.opponent) && (
                                      <span className="text-[10px] text-muted-foreground">
                                        {player.nflTeam}
                                        {player.opponent && ` vs ${player.opponent}`}
                                      </span>
                                    )}
                                  </div>
                                </div>
                                <span className="font-semibold text-foreground ml-2">
                                  {player.totalPoints?.toFixed(1) || '0.0'}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="py-12 text-center">
                  <Trophy className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                  <p className="text-foreground font-semibold mb-2">No matchups available</p>
                  <p className="text-sm text-muted-foreground">
                    Matchups will appear here once the week starts
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="rosters" className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-semibold text-foreground">Team Rosters</h2>
            </div>

            {teamsLoading ? (
              <div className="grid md:grid-cols-2 gap-6">
                {[1, 2, 3, 4].map((i) => (
                  <Card key={i}>
                    <CardHeader>
                      <Skeleton className="h-6 w-2/3" />
                    </CardHeader>
                    <CardContent>
                      <Skeleton className="h-32 w-full" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : teams.length > 0 ? (
              <div className="grid md:grid-cols-2 gap-6">
                {teams.map((team: any, idx: number) => (
                  <Card key={idx} className="hover-elevate" data-testid={`card-team-${idx}`}>
                    <CardHeader>
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-3">
                          <Avatar>
                            <AvatarFallback className="bg-primary text-primary-foreground">
                              {team.name?.[0] || 'T'}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <CardTitle className="text-lg" data-testid={`text-team-name-${idx}`}>
                              {team.name || `Team ${idx + 1}`}
                            </CardTitle>
                            <CardDescription>
                              {team.wins}-{team.losses}{team.ties > 0 ? `-${team.ties}` : ''}
                            </CardDescription>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-semibold text-foreground">
                            {team.totalPoints?.toFixed(1) || '0.0'} pts
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Rank #{team.playoffSeed || idx + 1}
                          </p>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        <p className="text-sm font-semibold text-foreground mb-3">
                          Roster ({team.roster?.length || 0} players)
                        </p>
                        <div className="max-h-64 overflow-y-auto space-y-2">
                          {team.roster?.slice(0, 10).map((player: any, pIdx: number) => (
                            <div
                              key={pIdx}
                              className="flex items-center justify-between text-sm p-2 rounded-md bg-muted/50"
                              data-testid={`player-${idx}-${pIdx}`}
                            >
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-foreground">
                                  {player.player?.fullName || 'Unknown Player'}
                                </span>
                                <span className="text-xs text-muted-foreground">
                                  {player.position}
                                </span>
                              </div>
                              <span className="text-muted-foreground">
                                {player.totalPoints?.toFixed(1) || '0.0'}
                              </span>
                            </div>
                          ))}
                          {team.roster?.length > 10 && (
                            <p className="text-xs text-muted-foreground text-center pt-2">
                              +{team.roster.length - 10} more players
                            </p>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="py-12 text-center">
                  <Users className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                  <p className="text-foreground font-semibold mb-2">No rosters available</p>
                  <p className="text-sm text-muted-foreground">
                    Team rosters will appear here
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
