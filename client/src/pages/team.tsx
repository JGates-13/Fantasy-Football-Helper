import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Trophy, TrendingUp, Users, AlertCircle } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { EspnLeague } from "@shared/schema";

export default function Team() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [teamSelectionDialog, setTeamSelectionDialog] = useState<{
    open: boolean;
    leagueDbId: string;
    leagueEspnId: string;
    seasonId: number;
  }>({ open: false, leagueDbId: "", leagueEspnId: "", seasonId: 0 });

  const { data: leagues, isLoading: leaguesLoading } = useQuery<EspnLeague[]>({
    queryKey: ["/api/leagues"],
    enabled: !!user,
  });

  // Find the league with a selected team
  const selectedLeague = leagues?.find(l => l.userTeamId);

  // Fetch team roster and matchup data
  const { data: teamsData, isLoading: teamsLoading } = useQuery<{
    teams: any[];
    week: number;
  }>({
    queryKey: ["/api/leagues", selectedLeague?.id, "teams"],
    enabled: !!selectedLeague,
  });

  const { data: matchupsData, isLoading: matchupsLoading } = useQuery<{
    matchups: any[];
    week: number;
  }>({
    queryKey: ["/api/leagues", selectedLeague?.id, "matchups"],
    enabled: !!selectedLeague,
  });

  const { data: teamsDialogData } = useQuery<{
    teams: any[];
    week: number;
  }>({
    queryKey: ["/api/leagues", teamSelectionDialog.leagueDbId, "teams"],
    enabled: teamSelectionDialog.open && !!teamSelectionDialog.leagueDbId,
  });

  const { data: trendingAdds, isLoading: waiverLoading } = useQuery<any[]>({
    queryKey: ["/api/waiver-wire", selectedLeague?.id],
    enabled: !!selectedLeague,
  });

  const { data: tradeSuggestions, isLoading: tradesLoading } = useQuery<any[]>({
    queryKey: ["/api/trade-suggestions", selectedLeague?.id],
    enabled: !!selectedLeague,
  });

  const setTeamMutation = useMutation({
    mutationFn: async ({ leagueId, teamId }: { leagueId: string; teamId: number }) => {
      return await apiRequest("POST", `/api/leagues/${leagueId}/set-team`, { teamId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/leagues"] });
      setTeamSelectionDialog({ open: false, leagueDbId: "", leagueEspnId: "", seasonId: 0 });
      toast({
        title: "Team Selected",
        description: "Your team has been set successfully!",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to set team",
        variant: "destructive",
      });
    },
  });

  // If no team is selected, prompt user to select one
  useEffect(() => {
    if (leagues && leagues.length > 0 && !selectedLeague && !teamSelectionDialog.open) {
      const firstLeague = leagues[0];
      setTeamSelectionDialog({
        open: true,
        leagueDbId: firstLeague.id,
        leagueEspnId: firstLeague.leagueId,
        seasonId: firstLeague.seasonId,
      });
    }
  }, [leagues, selectedLeague, teamSelectionDialog.open]);

  if (!user) {
    return (
      <div className="min-h-[calc(100vh-4rem)] bg-background flex items-center justify-center pb-20">
        <p className="text-muted-foreground">Please log in to view your team</p>
      </div>
    );
  }

  if (leaguesLoading) {
    return (
      <div className="min-h-[calc(100vh-4rem)] bg-background pb-20">
        <div className="container mx-auto px-4 py-8 max-w-4xl space-y-4">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  if (!leagues || leagues.length === 0) {
    return (
      <div className="min-h-[calc(100vh-4rem)] bg-background pb-20">
        <div className="container mx-auto px-4 py-8 max-w-4xl">
          <Card>
            <CardContent className="py-16 text-center">
              <AlertCircle className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-2">No Leagues Connected</h3>
              <p className="text-muted-foreground mb-4">
                Connect a league from the Home page to view your team.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const myTeam = teamsData?.teams?.find(t => t.id === selectedLeague?.userTeamId);
  const currentWeek = teamsData?.week || matchupsData?.week || 1;
  
  // Find current matchup
  const myMatchup = matchupsData?.matchups?.find(m => 
    m.homeTeamId === selectedLeague?.userTeamId || m.awayTeamId === selectedLeague?.userTeamId
  );

  const isHomeTeam = myMatchup?.homeTeamId === selectedLeague?.userTeamId;
  const opponentId = isHomeTeam ? myMatchup?.awayTeamId : myMatchup?.homeTeamId;
  const opponentTeam = teamsData?.teams?.find(t => t.id === opponentId);

  // Separate starters and bench
  const starters = myTeam?.roster?.filter((p: any) => p.lineupSlotId < 20) || [];
  const bench = myTeam?.roster?.filter((p: any) => p.lineupSlotId >= 20) || [];

  return (
    <>
      <div className="min-h-[calc(100vh-4rem)] bg-background pb-20">
        <div className="container mx-auto px-4 py-8 max-w-4xl space-y-6">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h1 className="text-3xl font-bold text-foreground">My Team</h1>
            {selectedLeague && (
              <Badge variant="outline" className="text-sm" data-testid="badge-league-name">
                {selectedLeague.leagueName}
              </Badge>
            )}
          </div>

          <Tabs defaultValue="roster" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="roster" data-testid="tab-roster">Roster</TabsTrigger>
              <TabsTrigger value="matchup" data-testid="tab-matchup">Matchup</TabsTrigger>
              <TabsTrigger value="trades" data-testid="tab-trades">Trade Ideas</TabsTrigger>
              <TabsTrigger value="waiver" data-testid="tab-waiver">Waiver Wire</TabsTrigger>
            </TabsList>

            <TabsContent value="roster" className="space-y-4 mt-6">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2">
                    <Trophy className="w-5 h-5 text-primary" />
                    Starting Lineup - Week {currentWeek}
                  </CardTitle>
                  <CardDescription>
                    Your active players for this week
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  {teamsLoading ? (
                    Array.from({ length: 9 }).map((_, i) => (
                      <Skeleton key={i} className="h-24 w-full" />
                    ))
                  ) : starters.length > 0 ? (
                    starters.map((player: any, index: number) => (
                      <div
                        key={index}
                        className="flex items-center justify-between p-4 rounded-md border bg-card hover-elevate"
                        data-testid={`player-starter-${index}`}
                      >
                        <div className="flex items-center gap-4 flex-1 min-w-0">
                          <Badge variant="default" className="w-14 text-center shrink-0">
                            {player.position}
                          </Badge>
                          <div className="min-w-0 flex-1">
                            <p className="font-semibold text-foreground truncate">{player.playerName}</p>
                            <p className="text-sm text-muted-foreground">
                              {player.nflTeam} {player.opponent && `vs ${player.opponent}`}
                            </p>
                          </div>
                        </div>
                        <div className="text-right shrink-0 ml-2">
                          <div className="flex flex-col items-end gap-1">
                            <div>
                              <p className="text-lg font-bold text-primary">{player.totalPoints?.toFixed(1) || '0.0'}</p>
                              <p className="text-xs text-muted-foreground">actual</p>
                            </div>
                            <div className="border-t pt-1">
                              <p className="text-sm font-semibold text-blue-600 dark:text-blue-400">
                                {player.projectedPoints?.toFixed(1) || '0.0'}
                              </p>
                              <p className="text-xs text-muted-foreground">projected</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-12">
                      <Trophy className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                      <p className="text-muted-foreground">No starting lineup found</p>
                      <p className="text-sm text-muted-foreground mt-2">
                        Set your lineup in the ESPN app
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle>Bench Players</CardTitle>
                  <CardDescription>
                    Reserve players not in your starting lineup
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  {teamsLoading ? (
                    Array.from({ length: 4 }).map((_, i) => (
                      <Skeleton key={i} className="h-16 w-full" />
                    ))
                  ) : bench.length > 0 ? (
                    bench.map((player: any, index: number) => (
                      <div
                        key={index}
                        className="flex items-center justify-between p-3 rounded-md bg-muted/40"
                        data-testid={`player-bench-${index}`}
                      >
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <Badge variant="outline" className="w-14 text-center shrink-0">
                            {player.position}
                          </Badge>
                          <div className="min-w-0 flex-1">
                            <p className="font-medium text-foreground truncate">{player.playerName}</p>
                            <p className="text-sm text-muted-foreground">
                              {player.nflTeam} {player.opponent && `vs ${player.opponent}`}
                            </p>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="font-semibold text-muted-foreground">{player.totalPoints?.toFixed(1) || '0.0'} pts</p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-muted-foreground text-center py-8">No bench players</p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="matchup" className="space-y-4 mt-6">
              {matchupsLoading ? (
                <Skeleton className="h-64 w-full" />
              ) : myMatchup ? (
                <>
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="flex items-center gap-2">
                        <Trophy className="w-5 h-5" />
                        Week {currentWeek} Matchup
                      </CardTitle>
                      <CardDescription>
                        {myTeam?.wins || 0}-{myTeam?.losses || 0}-{myTeam?.ties || 0} overall record
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-3 gap-6 items-center text-center mb-6">
                        <div className="space-y-3">
                          <p className="font-semibold text-foreground text-lg" data-testid="text-my-team">{myTeam?.name || 'My Team'}</p>
                          <p className="text-4xl font-bold text-primary" data-testid="text-my-score">
                            {isHomeTeam ? myMatchup.homeScore?.toFixed(1) : myMatchup.awayScore?.toFixed(1)}
                          </p>
                          <p className="text-sm text-muted-foreground">Current Score</p>
                          <p className="text-lg font-semibold text-blue-600 dark:text-blue-400">
                            {(() => {
                              const myRoster = isHomeTeam ? myMatchup.homeRoster : myMatchup.awayRoster;
                              const myProjected = myRoster?.filter((p: any) => p.isStarter)
                                .reduce((sum: number, p: any) => sum + (p.projectedPoints || 0), 0) || 0;
                              return myProjected.toFixed(1);
                            })()}
                          </p>
                          <p className="text-xs text-muted-foreground">Projected</p>
                        </div>
                        <div className="space-y-2">
                          <div className="text-2xl font-bold text-muted-foreground bg-muted/30 rounded-full w-16 h-16 flex items-center justify-center mx-auto">
                            VS
                          </div>
                          {(() => {
                            const myRoster = isHomeTeam ? myMatchup.homeRoster : myMatchup.awayRoster;
                            const oppRoster = isHomeTeam ? myMatchup.awayRoster : myMatchup.homeRoster;
                            const myProjected = myRoster?.filter((p: any) => p.isStarter)
                              .reduce((sum: number, p: any) => sum + (p.projectedPoints || 0), 0) || 0;
                            const oppProjected = oppRoster?.filter((p: any) => p.isStarter)
                              .reduce((sum: number, p: any) => sum + (p.projectedPoints || 0), 0) || 0;
                            const totalProjected = myProjected + oppProjected;
                            const winProbability = totalProjected > 0 ? (myProjected / totalProjected * 100) : 50;
                            
                            return (
                              <div className="mt-4">
                                <div className="text-3xl font-bold text-primary">
                                  {winProbability.toFixed(0)}%
                                </div>
                                <p className="text-xs text-muted-foreground mt-1">Win Probability</p>
                              </div>
                            );
                          })()}
                        </div>
                        <div className="space-y-3">
                          <p className="font-semibold text-foreground text-lg" data-testid="text-opponent">{opponentTeam?.name || 'Opponent'}</p>
                          <p className="text-4xl font-bold text-muted-foreground" data-testid="text-opponent-score">
                            {isHomeTeam ? myMatchup.awayScore?.toFixed(1) : myMatchup.homeScore?.toFixed(1)}
                          </p>
                          <p className="text-sm text-muted-foreground">Current Score</p>
                          <p className="text-lg font-semibold text-blue-600 dark:text-blue-400">
                            {(() => {
                              const oppRoster = isHomeTeam ? myMatchup.awayRoster : myMatchup.homeRoster;
                              const oppProjected = oppRoster?.filter((p: any) => p.isStarter)
                                .reduce((sum: number, p: any) => sum + (p.projectedPoints || 0), 0) || 0;
                              return oppProjected.toFixed(1);
                            })()}
                          </p>
                          <p className="text-xs text-muted-foreground">Projected</p>
                        </div>
                      </div>
                      {myMatchup.homeScore !== undefined && myMatchup.awayScore !== undefined && (
                        <div className="text-center">
                          <Badge 
                            variant={
                              (isHomeTeam ? myMatchup.homeScore > myMatchup.awayScore : myMatchup.awayScore > myMatchup.homeScore)
                                ? "default"
                                : myMatchup.homeScore === myMatchup.awayScore
                                ? "outline"
                                : "secondary"
                            }
                            className="text-base px-4 py-1"
                          >
                            {isHomeTeam && myMatchup.homeScore > myMatchup.awayScore && "You're Winning!"}
                            {isHomeTeam && myMatchup.homeScore < myMatchup.awayScore && "You're Losing"}
                            {!isHomeTeam && myMatchup.awayScore > myMatchup.homeScore && "You're Winning!"}
                            {!isHomeTeam && myMatchup.awayScore < myMatchup.homeScore && "You're Losing"}
                            {myMatchup.homeScore === myMatchup.awayScore && "It's Tied!"}
                          </Badge>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-lg">Starting Lineup Comparison</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <h3 className="font-semibold text-sm text-muted-foreground mb-3">Your Starters</h3>
                          {(() => {
                            const myRoster = isHomeTeam ? myMatchup.homeRoster : myMatchup.awayRoster;
                            return myRoster?.filter((p: any) => p.isStarter).map((player: any, idx: number) => (
                              <div key={idx} className="flex items-center justify-between p-2 rounded-md bg-primary/10 border border-primary/20 text-sm">
                                <div className="flex items-center gap-2 flex-1 min-w-0">
                                  <Badge variant="default" className="text-xs shrink-0">{player.position}</Badge>
                                  <div className="flex flex-col min-w-0">
                                    <span className="font-medium truncate">{player.playerName}</span>
                                    <span className="text-xs text-muted-foreground">{player.nflTeam}</span>
                                  </div>
                                </div>
                                <div className="text-right shrink-0 ml-2">
                                  <p className="font-bold text-primary">{player.totalPoints?.toFixed(1)}</p>
                                  <p className="text-xs text-muted-foreground">({player.projectedPoints?.toFixed(1)})</p>
                                </div>
                              </div>
                            ));
                          })()}
                        </div>
                        <div className="space-y-2">
                          <h3 className="font-semibold text-sm text-muted-foreground mb-3">Opponent Starters</h3>
                          {(() => {
                            const oppRoster = isHomeTeam ? myMatchup.awayRoster : myMatchup.homeRoster;
                            return oppRoster?.filter((p: any) => p.isStarter).map((player: any, idx: number) => (
                              <div key={idx} className="flex items-center justify-between p-2 rounded-md bg-muted/50 border text-sm">
                                <div className="flex items-center gap-2 flex-1 min-w-0">
                                  <Badge variant="outline" className="text-xs shrink-0">{player.position}</Badge>
                                  <div className="flex flex-col min-w-0">
                                    <span className="font-medium truncate">{player.playerName}</span>
                                    <span className="text-xs text-muted-foreground">{player.nflTeam}</span>
                                  </div>
                                </div>
                                <div className="text-right shrink-0 ml-2">
                                  <p className="font-bold">{player.totalPoints?.toFixed(1)}</p>
                                  <p className="text-xs text-muted-foreground">({player.projectedPoints?.toFixed(1)})</p>
                                </div>
                              </div>
                            ));
                          })()}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </>
              ) : (
                <Card>
                  <CardContent className="py-16 text-center">
                    <Users className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                    <p className="text-muted-foreground">No matchup data available for Week {currentWeek}</p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="trades" className="space-y-4 mt-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="w-5 h-5" />
                    Trade Finder
                  </CardTitle>
                  <CardDescription>
                    Smart trade suggestions based on roster analysis and position needs
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {tradesLoading ? (
                    Array.from({ length: 3 }).map((_, i) => (
                      <Skeleton key={i} className="h-32 w-full" />
                    ))
                  ) : tradeSuggestions && tradeSuggestions.length > 0 ? (
                    tradeSuggestions.map((suggestion: any, index: number) => (
                      <div 
                        key={index} 
                        className="p-4 rounded-md border bg-card hover-elevate"
                        data-testid={`trade-suggestion-${index}`}
                      >
                        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                          <h4 className="font-semibold text-foreground">Trade with {suggestion.teamName}</h4>
                          <Badge variant="outline">{suggestion.analysis.fairness} Fair</Badge>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-3">
                          <div className="space-y-2">
                            <p className="text-xs font-semibold text-muted-foreground uppercase">You Give</p>
                            <div className="p-3 rounded-md bg-destructive/10 border border-destructive/20">
                              <p className="font-medium text-foreground">{suggestion.myPlayer.name}</p>
                              <div className="flex items-center justify-between mt-1">
                                <span className="text-sm text-muted-foreground">
                                  {suggestion.myPlayer.position} - {suggestion.myPlayer.team}
                                </span>
                                <span className="text-sm font-semibold text-foreground">
                                  {suggestion.myPlayer.weeklyAvg} PPG
                                </span>
                              </div>
                            </div>
                          </div>
                          
                          <div className="space-y-2">
                            <p className="text-xs font-semibold text-muted-foreground uppercase">You Get</p>
                            <div className="p-3 rounded-md bg-primary/10 border border-primary/20">
                              <p className="font-medium text-foreground">{suggestion.theirPlayer.name}</p>
                              <div className="flex items-center justify-between mt-1">
                                <span className="text-sm text-muted-foreground">
                                  {suggestion.theirPlayer.position} - {suggestion.theirPlayer.team}
                                </span>
                                <span className="text-sm font-semibold text-primary">
                                  {suggestion.theirPlayer.weeklyAvg} PPG
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                        
                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">Your Impact:</span>
                            <span className={`font-semibold ${parseFloat(suggestion.analysis.myImpact) > 0 ? 'text-green-600 dark:text-green-400' : 'text-destructive'}`}>
                              {parseFloat(suggestion.analysis.myImpact) > 0 ? '+' : ''}{suggestion.analysis.myImpact} PPG
                            </span>
                          </div>
                          <p className="text-sm text-muted-foreground italic">
                            {suggestion.analysis.reasoning}
                          </p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-12">
                      <Users className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                      <p className="text-muted-foreground mb-2">
                        Analyzing all possible trades...
                      </p>
                      <p className="text-sm text-muted-foreground">
                        No mutually beneficial trades found at this time
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="waiver" className="space-y-4 mt-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="w-5 h-5" />
                    Waiver Wire Recommendations
                  </CardTitle>
                  <CardDescription>
                    Personalized suggestions based on your team needs and player rankings
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  {waiverLoading ? (
                    Array.from({ length: 10 }).map((_, i) => (
                      <Skeleton key={i} className="h-20 w-full" />
                    ))
                  ) : trendingAdds && trendingAdds.length > 0 ? (
                    trendingAdds.map((player: any, index: number) => (
                      <div
                        key={index}
                        className="flex items-center justify-between p-4 rounded-md border bg-card hover-elevate"
                        data-testid={`waiver-player-${index}`}
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <Badge variant="secondary" className="shrink-0">
                              {player.position}
                            </Badge>
                            <div>
                              <p className="font-medium text-foreground">{player.name}</p>
                              <p className="text-sm text-muted-foreground">{player.team}</p>
                            </div>
                          </div>
                          {player.recommendation && (
                            <p className="text-sm text-primary italic ml-16">
                              {player.recommendation}
                            </p>
                          )}
                        </div>
                        <div className="text-right space-y-1 shrink-0">
                          <div className="text-sm font-semibold text-foreground">
                            {player.weeklyAvg !== 'N/A' ? `${player.weeklyAvg} PPG` : ''}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {player.adds} adds
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-12">
                      <TrendingUp className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                      <p className="text-muted-foreground">
                        Analyzing waiver wire opportunities...
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      <Dialog open={teamSelectionDialog.open} onOpenChange={(open) => 
        setTeamSelectionDialog({ ...teamSelectionDialog, open })
      }>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Select Your Team</DialogTitle>
            <DialogDescription>
              Choose which team is yours in this league
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 mt-4">
            {teamsDialogData?.teams?.map((team: any) => (
              <button
                key={team.id}
                onClick={() => setTeamMutation.mutate({
                  leagueId: teamSelectionDialog.leagueDbId,
                  teamId: team.id,
                })}
                className="w-full p-4 text-left rounded-md bg-muted/30 hover-elevate flex items-center justify-between"
                data-testid={`select-team-${team.id}`}
                disabled={setTeamMutation.isPending}
              >
                <div>
                  <p className="font-semibold text-foreground">{team.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {team.wins || 0}-{team.losses || 0}-{team.ties || 0}
                  </p>
                </div>
                <Trophy className="w-5 h-5 text-muted-foreground" />
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
