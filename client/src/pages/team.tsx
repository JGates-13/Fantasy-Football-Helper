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

  const { data: trendingAdds } = useQuery<any[]>({
    queryKey: ["/api/waiver-wire"],
    enabled: !!selectedLeague,
  });

  const { data: tradeSuggestions } = useQuery<any[]>({
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
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Trophy className="w-5 h-5" />
                    Starting Lineup (Week {currentWeek})
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {teamsLoading ? (
                    Array.from({ length: 9 }).map((_, i) => (
                      <Skeleton key={i} className="h-16 w-full" />
                    ))
                  ) : starters.length > 0 ? (
                    starters.map((player: any, index: number) => (
                      <div
                        key={index}
                        className="flex items-center justify-between p-3 rounded-md bg-muted/30 hover-elevate"
                        data-testid={`player-starter-${index}`}
                      >
                        <div className="flex items-center gap-3">
                          <Badge variant="secondary" className="w-12 text-center">
                            {player.position}
                          </Badge>
                          <div>
                            <p className="font-medium text-foreground">{player.playerName}</p>
                            <p className="text-sm text-muted-foreground">
                              {player.nflTeam} {player.opponent && `vs ${player.opponent}`}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold text-foreground">{player.totalPoints?.toFixed(1) || '0.0'} pts</p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-muted-foreground text-center py-8">No starters found</p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Bench</CardTitle>
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
                        className="flex items-center justify-between p-3 rounded-md bg-muted/30"
                        data-testid={`player-bench-${index}`}
                      >
                        <div className="flex items-center gap-3">
                          <Badge variant="outline" className="w-12 text-center">
                            {player.position}
                          </Badge>
                          <div>
                            <p className="font-medium text-foreground">{player.playerName}</p>
                            <p className="text-sm text-muted-foreground">
                              {player.nflTeam} {player.opponent && `vs ${player.opponent}`}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
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
                <Card>
                  <CardHeader>
                    <CardTitle>Week {currentWeek} Matchup</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-3 gap-4 items-center text-center">
                      <div className="space-y-2">
                        <p className="font-semibold text-foreground" data-testid="text-my-team">{myTeam?.name || 'My Team'}</p>
                        <p className="text-3xl font-bold text-primary" data-testid="text-my-score">
                          {isHomeTeam ? myMatchup.homeScore?.toFixed(1) : myMatchup.awayScore?.toFixed(1)}
                        </p>
                      </div>
                      <div className="text-2xl font-bold text-muted-foreground">VS</div>
                      <div className="space-y-2">
                        <p className="font-semibold text-foreground" data-testid="text-opponent">{opponentTeam?.name || 'Opponent'}</p>
                        <p className="text-3xl font-bold text-muted-foreground" data-testid="text-opponent-score">
                          {isHomeTeam ? myMatchup.awayScore?.toFixed(1) : myMatchup.homeScore?.toFixed(1)}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <CardContent className="py-16 text-center">
                    <p className="text-muted-foreground">No matchup data available</p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="trades" className="space-y-4 mt-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="w-5 h-5" />
                    Trade Suggestions
                  </CardTitle>
                  <CardDescription>
                    Based on your roster needs and rankings
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {tradeSuggestions && tradeSuggestions.length > 0 ? (
                    <div className="space-y-4">
                      {tradeSuggestions.map((suggestion: any, index: number) => (
                        <div key={index} className="p-4 rounded-md bg-muted/30">
                          <p className="text-sm text-muted-foreground mb-2">Trade with {suggestion.teamName}</p>
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <p className="text-xs font-semibold text-muted-foreground mb-1">You Give</p>
                              <p className="font-medium">{suggestion.yourPlayer}</p>
                            </div>
                            <div>
                              <p className="text-xs font-semibold text-muted-foreground mb-1">You Get</p>
                              <p className="font-medium text-primary">{suggestion.theirPlayer}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-muted-foreground text-center py-8">
                      Trade suggestions will appear here based on your roster
                    </p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="waiver" className="space-y-4 mt-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="w-5 h-5" />
                    Trending Adds
                  </CardTitle>
                  <CardDescription>
                    Most added players across all leagues (last 24 hours)
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  {trendingAdds && trendingAdds.length > 0 ? (
                    trendingAdds.map((player: any, index: number) => (
                      <div
                        key={index}
                        className="flex items-center justify-between p-3 rounded-md bg-muted/30"
                        data-testid={`waiver-player-${index}`}
                      >
                        <div>
                          <p className="font-medium text-foreground">{player.name}</p>
                          <p className="text-sm text-muted-foreground">{player.position} - {player.team}</p>
                        </div>
                        <Badge variant="secondary">{player.adds || 0} adds</Badge>
                      </div>
                    ))
                  ) : (
                    <p className="text-muted-foreground text-center py-8">
                      Loading trending waiver wire picks...
                    </p>
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
