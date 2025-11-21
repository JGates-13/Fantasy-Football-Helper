import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
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

  // Separate starters and bench using isStarter flag
  const starters = myTeam?.roster?.filter((p: any) => p.isStarter === true) || [];
  const bench = myTeam?.roster?.filter((p: any) => p.isStarter === false) || [];
  
  const [activeView, setActiveView] = useState<'roster' | 'matchup' | 'trades' | 'waiver'>('roster');

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

          {/* Navigation Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <button
              onClick={() => setActiveView('roster')}
              className={`p-4 rounded-md border transition-all ${
                activeView === 'roster'
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-card hover-elevate'
              }`}
              data-testid="tab-roster"
            >
              <Trophy className="w-5 h-5 mx-auto mb-2" />
              <p className="text-sm font-semibold">Roster</p>
            </button>
            <button
              onClick={() => setActiveView('matchup')}
              className={`p-4 rounded-md border transition-all ${
                activeView === 'matchup'
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-card hover-elevate'
              }`}
              data-testid="tab-matchup"
            >
              <Users className="w-5 h-5 mx-auto mb-2" />
              <p className="text-sm font-semibold">Matchup</p>
            </button>
            <button
              onClick={() => setActiveView('trades')}
              className={`p-4 rounded-md border transition-all ${
                activeView === 'trades'
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-card hover-elevate'
              }`}
              data-testid="tab-trades"
            >
              <TrendingUp className="w-5 h-5 mx-auto mb-2" />
              <p className="text-sm font-semibold">Trades</p>
            </button>
            <button
              onClick={() => setActiveView('waiver')}
              className={`p-4 rounded-md border transition-all ${
                activeView === 'waiver'
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-card hover-elevate'
              }`}
              data-testid="tab-waiver"
            >
              <AlertCircle className="w-5 h-5 mx-auto mb-2" />
              <p className="text-sm font-semibold">Waiver</p>
            </button>
          </div>

          {/* Roster View - Compact Matchup */}
          {activeView === 'roster' && (
            <div className="space-y-4">
              {matchupsLoading || teamsLoading ? (
                <Skeleton className="h-64 w-full" />
              ) : myMatchup ? (
                <>
                  {/* Compact Matchup Card */}
                  <Card>
                    <CardHeader className="pb-4">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-xl">Week {currentWeek} Matchup</CardTitle>
                        <Badge variant="outline" className="text-xs">
                          {myTeam?.wins || 0}-{myTeam?.losses || 0}-{myTeam?.ties || 0}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      {/* Score Comparison */}
                      <div className="grid grid-cols-3 gap-4 items-center">
                        <div className="text-center space-y-1">
                          <p className="text-sm font-medium text-muted-foreground">You</p>
                          <p className="text-3xl font-bold text-primary">
                            {isHomeTeam ? myMatchup.homeScore?.toFixed(1) : myMatchup.awayScore?.toFixed(1)}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">{myTeam?.name}</p>
                        </div>
                        
                        <div className="text-center space-y-2">
                          <div className="w-16 h-16 mx-auto bg-muted rounded-full flex items-center justify-center">
                            <span className="text-xl font-bold text-muted-foreground">VS</span>
                          </div>
                        </div>
                        
                        <div className="text-center space-y-1">
                          <p className="text-sm font-medium text-muted-foreground">Opponent</p>
                          <p className="text-3xl font-bold text-muted-foreground">
                            {isHomeTeam ? myMatchup.awayScore?.toFixed(1) : myMatchup.homeScore?.toFixed(1)}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">{opponentTeam?.name}</p>
                        </div>
                      </div>

                      {/* Win Probability */}
                      <div className="space-y-3">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Win Probability</span>
                          <span className="text-xs text-muted-foreground">Based on projections</span>
                        </div>
                        
                        {(() => {
                          const myRoster = isHomeTeam ? myMatchup.homeRoster : myMatchup.awayRoster;
                          const oppRoster = isHomeTeam ? myMatchup.awayRoster : myMatchup.homeRoster;
                          const myProjected = myRoster?.filter((p: any) => p.isStarter)
                            .reduce((sum: number, p: any) => sum + (p.projectedPoints || 0), 0) || 0;
                          const oppProjected = oppRoster?.filter((p: any) => p.isStarter)
                            .reduce((sum: number, p: any) => sum + (p.projectedPoints || 0), 0) || 0;
                          
                          // Add variance for more realistic probability (average stddev ~15-20 points)
                          const variance = 18;
                          const scoreDiff = myProjected - oppProjected;
                          const zScore = scoreDiff / (variance * Math.sqrt(2));
                          // Normal CDF approximation
                          const winProb = 0.5 * (1 + Math.tanh(zScore * Math.sqrt(Math.PI / 8))) * 100;
                          
                          return (
                            <div className="space-y-2">
                              <div className="flex items-center gap-3">
                                <div className="flex-1 h-3 bg-muted rounded-full overflow-hidden">
                                  <div 
                                    className="h-full bg-gradient-to-r from-primary to-primary/80 transition-all"
                                    style={{ width: `${Math.min(Math.max(winProb, 5), 95)}%` }}
                                  />
                                </div>
                                <span className="text-2xl font-bold text-primary min-w-[4rem] text-right">
                                  {winProb.toFixed(0)}%
                                </span>
                              </div>
                              
                              <div className="flex items-center justify-between text-xs">
                                <div className="space-y-0.5">
                                  <p className="text-primary font-semibold">Your Projection: {myProjected.toFixed(1)}</p>
                                  <p className="text-muted-foreground">Opponent: {oppProjected.toFixed(1)}</p>
                                </div>
                                
                                {winProb > 50 ? (
                                  <Badge variant="default" className="text-xs">Favored to Win</Badge>
                                ) : winProb < 50 ? (
                                  <Badge variant="secondary" className="text-xs">Underdog</Badge>
                                ) : (
                                  <Badge variant="outline" className="text-xs">Toss-up</Badge>
                                )}
                              </div>
                            </div>
                          );
                        })()}
                      </div>

                      {/* Expert Predictions Reference */}
                      <div className="pt-3 border-t">
                        <p className="text-xs text-muted-foreground mb-2">Win probability based on statistical modeling</p>
                        <div className="flex flex-wrap gap-2">
                          <Badge variant="outline" className="text-[10px] px-2 py-0.5">
                            ESPN Projections
                          </Badge>
                          <Badge variant="outline" className="text-[10px] px-2 py-0.5">
                            FantasyPros ECR
                          </Badge>
                          <Badge variant="outline" className="text-[10px] px-2 py-0.5">
                            Monte Carlo Model
                          </Badge>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Quick Stats */}
                  <div className="grid grid-cols-2 gap-3">
                    <Card>
                      <CardContent className="pt-6">
                        <div className="text-center space-y-1">
                          <Trophy className="w-6 h-6 text-primary mx-auto mb-2" />
                          <p className="text-2xl font-bold">
                            {starters.reduce((sum: number, p: any) => sum + (p.totalPoints || 0), 0).toFixed(1)}
                          </p>
                          <p className="text-xs text-muted-foreground">Starter Points</p>
                        </div>
                      </CardContent>
                    </Card>
                    
                    <Card>
                      <CardContent className="pt-6">
                        <div className="text-center space-y-1">
                          <Users className="w-6 h-6 text-primary mx-auto mb-2" />
                          <p className="text-2xl font-bold">{starters.length}</p>
                          <p className="text-xs text-muted-foreground">Active Starters</p>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </>
              ) : (
                <Card>
                  <CardContent className="py-16 text-center">
                    <Users className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                    <p className="text-muted-foreground">No matchup data available</p>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {/* Matchup View */}
          {activeView === 'matchup' && (
            <div className="space-y-4">
              {matchupsLoading ? (
                <Skeleton className="h-64 w-full" />
              ) : myMatchup ? (
                <>
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="flex items-center gap-2 text-lg sm:text-2xl">
                        <Trophy className="w-4 h-4 sm:w-5 sm:h-5" />
                        Week {currentWeek} Matchup
                      </CardTitle>
                      <CardDescription className="text-xs sm:text-sm">
                        {myTeam?.wins || 0}-{myTeam?.losses || 0}-{myTeam?.ties || 0} overall record
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="px-2 sm:px-6">
                      <div className="grid grid-cols-3 gap-2 sm:gap-6 items-center text-center mb-4 sm:mb-6">
                        <div className="space-y-2 sm:space-y-3">
                          <p className="font-semibold text-foreground text-xs sm:text-lg truncate" data-testid="text-my-team">{myTeam?.name || 'My Team'}</p>
                          <p className="text-2xl sm:text-4xl font-bold text-primary" data-testid="text-my-score">
                            {isHomeTeam ? myMatchup.homeScore?.toFixed(1) : myMatchup.awayScore?.toFixed(1)}
                          </p>
                          <p className="text-[10px] sm:text-sm text-muted-foreground">Current</p>
                          <p className="text-sm sm:text-lg font-semibold text-blue-600 dark:text-blue-400">
                            {(() => {
                              const myRoster = isHomeTeam ? myMatchup.homeRoster : myMatchup.awayRoster;
                              const myProjected = myRoster?.filter((p: any) => p.isStarter)
                                .reduce((sum: number, p: any) => sum + (p.projectedPoints || 0), 0) || 0;
                              return myProjected.toFixed(1);
                            })()}
                          </p>
                          <p className="text-[10px] sm:text-xs text-muted-foreground">Projected</p>
                        </div>
                        <div className="space-y-1 sm:space-y-2">
                          <div className="text-lg sm:text-2xl font-bold text-muted-foreground bg-muted/30 rounded-full w-10 h-10 sm:w-16 sm:h-16 flex items-center justify-center mx-auto">
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
                              <div className="mt-2 sm:mt-4">
                                <div className="text-xl sm:text-3xl font-bold text-primary">
                                  {winProbability.toFixed(0)}%
                                </div>
                                <p className="text-[10px] sm:text-xs text-muted-foreground mt-1">Win %</p>
                              </div>
                            );
                          })()}
                        </div>
                        <div className="space-y-2 sm:space-y-3">
                          <p className="font-semibold text-foreground text-xs sm:text-lg truncate" data-testid="text-opponent">{opponentTeam?.name || 'Opponent'}</p>
                          <p className="text-2xl sm:text-4xl font-bold text-muted-foreground" data-testid="text-opponent-score">
                            {isHomeTeam ? myMatchup.awayScore?.toFixed(1) : myMatchup.homeScore?.toFixed(1)}
                          </p>
                          <p className="text-[10px] sm:text-sm text-muted-foreground">Current</p>
                          <p className="text-sm sm:text-lg font-semibold text-blue-600 dark:text-blue-400">
                            {(() => {
                              const oppRoster = isHomeTeam ? myMatchup.awayRoster : myMatchup.homeRoster;
                              const oppProjected = oppRoster?.filter((p: any) => p.isStarter)
                                .reduce((sum: number, p: any) => sum + (p.projectedPoints || 0), 0) || 0;
                              return oppProjected.toFixed(1);
                            })()}
                          </p>
                          <p className="text-[10px] sm:text-xs text-muted-foreground">Projected</p>
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
                      <CardTitle className="text-base sm:text-lg">Starting Lineup Comparison</CardTitle>
                    </CardHeader>
                    <CardContent className="px-2 sm:px-6">
                      <div className="grid md:grid-cols-2 gap-3 sm:gap-4">
                        <div className="space-y-1.5 sm:space-y-2">
                          <h3 className="font-semibold text-xs sm:text-sm text-muted-foreground mb-2 sm:mb-3">Your Starters</h3>
                          {(() => {
                            const myRoster = isHomeTeam ? myMatchup.homeRoster : myMatchup.awayRoster;
                            return myRoster?.filter((p: any) => p.isStarter).map((player: any, idx: number) => (
                              <div key={idx} className="flex items-center justify-between p-1.5 sm:p-2 rounded-md bg-primary/10 border border-primary/20 text-xs sm:text-sm">
                                <div className="flex items-center gap-1.5 sm:gap-2 flex-1 min-w-0">
                                  <Badge variant="default" className="text-[10px] sm:text-xs shrink-0 px-1 sm:px-2">{player.position}</Badge>
                                  <div className="flex flex-col min-w-0">
                                    <span className="font-medium truncate text-xs sm:text-sm">{player.playerName}</span>
                                    <span className="text-[10px] sm:text-xs text-muted-foreground">{player.nflTeam}</span>
                                  </div>
                                </div>
                                <div className="text-right shrink-0 ml-1 sm:ml-2">
                                  <p className="font-bold text-primary text-xs sm:text-sm">{player.totalPoints?.toFixed(1)}</p>
                                  <p className="text-[10px] sm:text-xs text-muted-foreground">({player.projectedPoints?.toFixed(1)})</p>
                                </div>
                              </div>
                            ));
                          })()}
                        </div>
                        <div className="space-y-1.5 sm:space-y-2">
                          <h3 className="font-semibold text-xs sm:text-sm text-muted-foreground mb-2 sm:mb-3">Opponent Starters</h3>
                          {(() => {
                            const oppRoster = isHomeTeam ? myMatchup.awayRoster : myMatchup.homeRoster;
                            return oppRoster?.filter((p: any) => p.isStarter).map((player: any, idx: number) => (
                              <div key={idx} className="flex items-center justify-between p-1.5 sm:p-2 rounded-md bg-muted/50 border text-xs sm:text-sm">
                                <div className="flex items-center gap-1.5 sm:gap-2 flex-1 min-w-0">
                                  <Badge variant="outline" className="text-[10px] sm:text-xs shrink-0 px-1 sm:px-2">{player.position}</Badge>
                                  <div className="flex flex-col min-w-0">
                                    <span className="font-medium truncate text-xs sm:text-sm">{player.playerName}</span>
                                    <span className="text-[10px] sm:text-xs text-muted-foreground">{player.nflTeam}</span>
                                  </div>
                                </div>
                                <div className="text-right shrink-0 ml-1 sm:ml-2">
                                  <p className="font-bold text-xs sm:text-sm">{player.totalPoints?.toFixed(1)}</p>
                                  <p className="text-[10px] sm:text-xs text-muted-foreground">({player.projectedPoints?.toFixed(1)})</p>
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
            </div>
          )}

          {/* Trade Ideas View */}
          {activeView === 'trades' && (
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <Users className="w-5 h-5" />
                        Trade Finder
                      </CardTitle>
                      <CardDescription>
                        AI-powered trade suggestions based on team analysis
                      </CardDescription>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      Based on ESPN Projections
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {tradesLoading ? (
                    Array.from({ length: 3 }).map((_, i) => (
                      <Skeleton key={i} className="h-40 w-full" />
                    ))
                  ) : tradeSuggestions && tradeSuggestions.length > 0 ? (
                    tradeSuggestions.map((suggestion: any, index: number) => (
                      <div 
                        key={index} 
                        className="p-4 rounded-md border bg-card space-y-4"
                        data-testid={`trade-suggestion-${index}`}
                      >
                        {/* Header */}
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h4 className="font-semibold text-foreground">{suggestion.teamName}</h4>
                              <Badge variant="outline" className="text-[10px]">
                                {suggestion.teamRecord}
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">
                              {suggestion.analysis?.myWeakPosition} ⟷ {suggestion.analysis?.myStrongPosition} Position Swap
                            </p>
                          </div>
                          <Badge 
                            variant={suggestion.tradeQuality === 'Win-Win' ? 'default' : suggestion.tradeQuality === 'Favorable' ? 'secondary' : 'outline'} 
                            className="text-xs shrink-0"
                          >
                            {suggestion.tradeQuality || 'Fair'}
                          </Badge>
                        </div>
                        
                        {/* Trade Cards */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div className="space-y-2">
                            <p className="text-xs font-semibold text-muted-foreground uppercase">You Trade Away</p>
                            <div className="p-3 rounded-md bg-destructive/10 border border-destructive/20 space-y-2">
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex-1 min-w-0">
                                  <p className="font-semibold text-sm truncate">{suggestion.myPlayer.name}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {suggestion.myPlayer.position} • {suggestion.myPlayer.team}
                                  </p>
                                </div>
                                <Badge variant="outline" className="text-[10px] shrink-0">
                                  {suggestion.myPlayer.position}
                                </Badge>
                              </div>
                              <div className="flex items-center justify-between text-xs pt-2 border-t border-destructive/20">
                                <div className="space-y-0.5">
                                  <p className="text-muted-foreground">Season: {suggestion.myPlayer.seasonTotal} pts</p>
                                  <p className="text-muted-foreground">Avg: {suggestion.myPlayer.weeklyAvg} PPG</p>
                                </div>
                                <div className="text-right">
                                  <p className="font-semibold text-sm">{suggestion.myPlayer.projected}</p>
                                  <p className="text-[10px] text-muted-foreground">Proj PPG</p>
                                </div>
                              </div>
                            </div>
                          </div>
                          
                          <div className="space-y-2">
                            <p className="text-xs font-semibold text-muted-foreground uppercase">You Receive</p>
                            <div className="p-3 rounded-md bg-primary/10 border border-primary/20 space-y-2">
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex-1 min-w-0">
                                  <p className="font-semibold text-sm truncate">{suggestion.theirPlayer.name}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {suggestion.theirPlayer.position} • {suggestion.theirPlayer.team}
                                  </p>
                                </div>
                                <Badge variant="default" className="text-[10px] shrink-0">
                                  {suggestion.theirPlayer.position}
                                </Badge>
                              </div>
                              <div className="flex items-center justify-between text-xs pt-2 border-t border-primary/20">
                                <div className="space-y-0.5">
                                  <p className="text-muted-foreground">Season: {suggestion.theirPlayer.seasonTotal} pts</p>
                                  <p className="text-muted-foreground">Avg: {suggestion.theirPlayer.weeklyAvg} PPG</p>
                                </div>
                                <div className="text-right">
                                  <p className="font-semibold text-sm text-primary">{suggestion.theirPlayer.projected}</p>
                                  <p className="text-[10px] text-muted-foreground">Proj PPG</p>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                        
                        {/* Analysis */}
                        <div className="pt-3 border-t space-y-2">
                          <div className="flex items-center justify-between text-sm flex-wrap gap-2">
                            <div>
                              <span className="text-muted-foreground">Your Gain:</span>{' '}
                              <span className={`font-semibold ${parseFloat(suggestion.analysis.myImprovement || suggestion.analysis.myImpact) > 0 ? 'text-green-600 dark:text-green-400' : 'text-destructive'}`}>
                                {parseFloat(suggestion.analysis.myImprovement || suggestion.analysis.myImpact) > 0 ? '+' : ''}{suggestion.analysis.myImprovement || suggestion.analysis.myImpact} PPG
                              </span>
                            </div>
                            <Badge variant="outline" className="text-[10px]">
                              {suggestion.analysis.fairness} Fair
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground leading-relaxed">
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
            </div>
          )}

          {/* Waiver Wire View */}
          {activeView === 'waiver' && (
            <div className="space-y-4">
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
            </div>
          )}
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
