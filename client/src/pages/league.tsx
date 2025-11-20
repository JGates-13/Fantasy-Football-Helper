import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Trophy, Users, TrendingUp, AlertCircle } from "lucide-react";
import type { EspnLeague } from "@shared/schema";

export default function League() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  const { data: leagues, isLoading: leaguesLoading } = useQuery<EspnLeague[]>({
    queryKey: ["/api/leagues"],
    enabled: !!user,
  });

  // Find the league with a selected team
  const selectedLeague = leagues?.find(l => l.userTeamId);

  const { data: teamsData, isLoading: teamsLoading } = useQuery<{
    teams: any[];
    week: number;
  }>({
    queryKey: ["/api/leagues", selectedLeague?.id, "teams"],
    enabled: !!selectedLeague,
  });

  if (!user) {
    return (
      <div className="min-h-[calc(100vh-4rem)] bg-background flex items-center justify-center pb-20">
        <p className="text-muted-foreground">Please log in to view league info</p>
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

  if (!leagues || leagues.length === 0 || !selectedLeague) {
    return (
      <div className="min-h-[calc(100vh-4rem)] bg-background pb-20">
        <div className="container mx-auto px-4 py-8 max-w-4xl">
          <Card>
            <CardContent className="py-16 text-center">
              <AlertCircle className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-2">No League Selected</h3>
              <p className="text-muted-foreground mb-4">
                Select a team from the Team page to view league standings.
              </p>
              <Button onClick={() => setLocation("/team")} data-testid="button-go-to-team">
                Go to Team
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Sort teams by wins
  const sortedTeams = teamsData?.teams?.slice().sort((a: any, b: any) => {
    const aWins = a.wins || 0;
    const bWins = b.wins || 0;
    if (bWins !== aWins) return bWins - aWins;
    
    // If wins are equal, sort by points
    const aPoints = a.pointsFor || 0;
    const bPoints = b.pointsFor || 0;
    return bPoints - aPoints;
  }) || [];

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-background pb-20">
      <div className="container mx-auto px-4 py-8 max-w-4xl space-y-6">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold text-foreground" data-testid="text-league-name">
            {selectedLeague.leagueName}
          </h1>
          <div className="flex items-center gap-4 flex-wrap">
            <Badge variant="outline" className="text-sm">
              <Users className="w-3 h-3 mr-1" />
              {selectedLeague.teamCount || teamsData?.teams?.length || 0} Teams
            </Badge>
            <Badge variant="outline" className="text-sm">
              {selectedLeague.seasonId} Season
            </Badge>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2" data-testid="title-league-standings">
              <Trophy className="w-5 h-5" />
              League Standings
            </CardTitle>
          </CardHeader>
          <CardContent>
            {teamsLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 8 }).map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : sortedTeams.length > 0 ? (
              <div className="space-y-2">
                {sortedTeams.map((team: any, index: number) => {
                  const isMyTeam = team.id === selectedLeague.userTeamId;
                  return (
                    <div
                      key={team.id}
                      className={`flex items-center gap-4 p-4 rounded-md ${
                        isMyTeam 
                          ? "bg-primary/10 border-2 border-primary" 
                          : "bg-muted/30"
                      }`}
                      data-testid={`team-${index}`}
                    >
                      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/20">
                        <span className="font-bold text-primary text-sm">{index + 1}</span>
                      </div>
                      <Avatar className="w-10 h-10">
                        <AvatarFallback className="bg-accent text-accent-foreground">
                          {team.name?.[0]?.toUpperCase() || 'T'}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className={`font-semibold ${isMyTeam ? "text-primary" : "text-foreground"}`} data-testid={`text-team-name-${index}`}>
                            {team.name}
                          </p>
                          {isMyTeam && <Badge variant="secondary" className="text-xs" data-testid="badge-my-team">You</Badge>}
                        </div>
                        <p className="text-sm text-muted-foreground" data-testid={`text-team-record-${index}`}>
                          {team.wins || 0}-{team.losses || 0}-{team.ties || 0}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-foreground">
                          {(team.pointsFor || 0).toFixed(1)} PF
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {(team.pointsAgainst || 0).toFixed(1)} PA
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-muted-foreground text-center py-8">No standings data available</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2" data-testid="title-league-stats">
              <TrendingUp className="w-5 h-5" />
              League Stats
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 rounded-md bg-muted/30">
                <p className="text-sm text-muted-foreground mb-1">Current Week</p>
                <p className="text-2xl font-bold text-foreground" data-testid="text-current-week">
                  {teamsData?.week || 1}
                </p>
              </div>
              <div className="p-4 rounded-md bg-muted/30">
                <p className="text-sm text-muted-foreground mb-1">Total Teams</p>
                <p className="text-2xl font-bold text-foreground">
                  {selectedLeague.teamCount || teamsData?.teams?.length || 0}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
