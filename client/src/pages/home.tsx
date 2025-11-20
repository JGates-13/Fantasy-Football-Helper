import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";
import { Trophy, Link2, Plus, LogOut, Users, Calendar } from "lucide-react";
import type { EspnLeague, User } from "@shared/schema";

export default function Home() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { user, isLoading: authLoading } = useAuth();
  const [leagueId, setLeagueId] = useState("");
  const [seasonId, setSeasonId] = useState(new Date().getFullYear().toString());

  // Removed automatic redirect - the router handles showing landing page for unauthenticated users

  const { data: leagues, isLoading: leaguesLoading, error: leaguesError } = useQuery<EspnLeague[]>({
    queryKey: ["/api/leagues"],
    retry: false,
    enabled: !!user, // Only fetch leagues when user is authenticated
  });

  // Handle auth errors in leagues query
  if (leaguesError && isUnauthorizedError(leaguesError as Error)) {
    toast({
      title: "Session Expired",
      description: "Please log in again to continue.",
      variant: "destructive",
    });
    setTimeout(() => {
      setLocation("/login");
    }, 1000);
  }

  const connectLeagueMutation = useMutation({
    mutationFn: async (data: { leagueId: string; seasonId: string }) => {
      return await apiRequest("POST", "/api/leagues/connect", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/leagues"] });
      setLeagueId("");
      toast({
        title: "Success",
        description: "League connected successfully!",
      });
    },
    onError: (error: Error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          setLocation("/login");
        }, 500);
        return;
      }
      toast({
        title: "Error",
        description: error.message || "Failed to connect league. Please check your league ID and try again.",
        variant: "destructive",
      });
    },
  });

  const selectLeagueMutation = useMutation({
    mutationFn: async (leagueDbId: string) => {
      return await apiRequest("POST", `/api/leagues/${leagueDbId}/select`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/leagues"] });
      toast({
        title: "Success",
        description: "League selected!",
      });
    },
    onError: (error: Error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          setLocation("/login");
        }, 500);
        return;
      }
      toast({
        title: "Error",
        description: "Failed to select league",
        variant: "destructive",
      });
    },
  });

  const handleConnectLeague = (e: React.FormEvent) => {
    e.preventDefault();
    if (!leagueId.trim()) {
      toast({
        title: "Error",
        description: "Please enter a league ID",
        variant: "destructive",
      });
      return;
    }
    connectLeagueMutation.mutate({ leagueId: leagueId.trim(), seasonId });
  };

  const handleSelectLeague = (leagueDbId: string) => {
    selectLeagueMutation.mutate(leagueDbId);
  };

  const logoutMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", "/api/logout", {});
    },
    onSuccess: () => {
      queryClient.clear();
      setLocation("/");
    },
    onError: () => {
      queryClient.clear();
      setLocation("/");
    },
  });

  const handleLogout = () => {
    logoutMutation.mutate();
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="space-y-4 text-center">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  const selectedLeague = leagues?.find((l) => l.isSelected === 1);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-primary rounded-md flex items-center justify-center">
                <Trophy className="w-6 h-6 text-primary-foreground" />
              </div>
              <h1 className="text-xl font-semibold text-foreground">Fantasy League Manager</h1>
            </div>
            
            <div className="flex items-center gap-4">
              {user && (
                <div className="flex items-center gap-3">
                  <Avatar className="w-8 h-8">
                    <AvatarImage src={user.profileImageUrl || undefined} className="object-cover" />
                    <AvatarFallback className="bg-accent text-accent-foreground text-sm">
                      {user.username?.[0]?.toUpperCase() || user.firstName?.[0] || user.email?.[0] || 'U'}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-sm text-foreground hidden sm:inline" data-testid="text-user-name">
                    {user.username || user.firstName || user.email}
                  </span>
                </div>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={handleLogout}
                disabled={logoutMutation.isPending}
                data-testid="button-logout"
              >
                <LogOut className="w-4 h-4 mr-2" />
                Log Out
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-12 max-w-6xl">
        <div className="space-y-8">
          {selectedLeague && (
            <Card className="border-primary">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Trophy className="w-5 h-5 text-primary" />
                  <CardTitle>Currently Selected League</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <p className="text-lg font-semibold text-foreground" data-testid="text-selected-league-name">
                    {selectedLeague.leagueName}
                  </p>
                  <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4" />
                      <span>Season {selectedLeague.seasonId}</span>
                    </div>
                    {selectedLeague.teamCount && (
                      <div className="flex items-center gap-2">
                        <Users className="w-4 h-4" />
                        <span>{selectedLeague.teamCount} Teams</span>
                      </div>
                    )}
                  </div>
                </div>
                <Button
                  onClick={() => setLocation(`/league/${selectedLeague.id}`)}
                  className="w-full"
                  data-testid="button-view-league"
                >
                  View Matchups & Rosters
                </Button>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Link2 className="w-5 h-5 text-primary" />
                <CardTitle>Connect ESPN League</CardTitle>
              </div>
              <CardDescription>
                Enter your ESPN Fantasy Football league ID and season year to connect your league.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleConnectLeague} className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="leagueId">League ID</Label>
                    <Input
                      id="leagueId"
                      placeholder="e.g., 123456"
                      value={leagueId}
                      onChange={(e) => setLeagueId(e.target.value)}
                      disabled={connectLeagueMutation.isPending}
                      data-testid="input-league-id"
                    />
                    <p className="text-xs text-muted-foreground">
                      Find this in your ESPN league URL
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="seasonId">Season Year</Label>
                    <Input
                      id="seasonId"
                      type="number"
                      placeholder="e.g., 2024"
                      value={seasonId}
                      onChange={(e) => setSeasonId(e.target.value)}
                      disabled={connectLeagueMutation.isPending}
                      data-testid="input-season-id"
                    />
                  </div>
                </div>
                <Button 
                  type="submit" 
                  disabled={connectLeagueMutation.isPending}
                  data-testid="button-connect-league"
                >
                  {connectLeagueMutation.isPending ? (
                    <>
                      <div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin mr-2"></div>
                      Connecting...
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4 mr-2" />
                      Connect League
                    </>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>

          <div>
            <h2 className="text-2xl font-semibold text-foreground mb-6">Your Leagues</h2>
            {leaguesLoading ? (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[1, 2, 3].map((i) => (
                  <Card key={i}>
                    <CardHeader>
                      <Skeleton className="h-6 w-3/4" />
                    </CardHeader>
                    <CardContent>
                      <Skeleton className="h-4 w-full mb-2" />
                      <Skeleton className="h-4 w-2/3" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : leagues && leagues.length > 0 ? (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {leagues.map((league) => (
                  <Card 
                    key={league.id} 
                    className={`hover-elevate transition-all ${league.isSelected === 1 ? 'border-primary' : ''}`}
                    data-testid={`card-league-${league.id}`}
                  >
                    <CardHeader>
                      <CardTitle className="text-lg" data-testid={`text-league-name-${league.id}`}>
                        {league.leagueName}
                      </CardTitle>
                      <CardDescription className="flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4" />
                          <span>Season {league.seasonId}</span>
                        </div>
                        {league.teamCount && (
                          <div className="flex items-center gap-2">
                            <Users className="w-4 h-4" />
                            <span>{league.teamCount} Teams</span>
                          </div>
                        )}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {league.isSelected === 1 ? (
                        <>
                          <Button 
                            onClick={() => setLocation(`/league/${league.id}`)}
                            className="w-full"
                            data-testid={`button-view-${league.id}`}
                          >
                            View League
                          </Button>
                          <Button 
                            variant="secondary" 
                            className="w-full"
                            disabled
                            data-testid={`button-selected-${league.id}`}
                          >
                            Selected
                          </Button>
                        </>
                      ) : (
                        <Button 
                          onClick={() => handleSelectLeague(league.id)}
                          disabled={selectLeagueMutation.isPending}
                          className="w-full"
                          data-testid={`button-select-${league.id}`}
                        >
                          Select League
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="py-12 text-center">
                  <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                    <Trophy className="w-8 h-8 text-muted-foreground" />
                  </div>
                  <h3 className="text-lg font-semibold text-foreground mb-2">No Leagues Connected</h3>
                  <p className="text-muted-foreground mb-6">
                    Connect your first ESPN Fantasy Football league to get started
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
