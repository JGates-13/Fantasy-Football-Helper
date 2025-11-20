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
    <div className="min-h-screen bg-background pb-20">
      <header className="border-b border-border">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-primary rounded-md flex items-center justify-center">
                <Trophy className="w-5 h-5 text-primary-foreground" />
              </div>
              <h1 className="text-lg font-semibold text-foreground">Fantasy Manager</h1>
            </div>
            
            {user && (
              <Avatar className="w-8 h-8">
                <AvatarImage src={user.profileImageUrl || undefined} className="object-cover" />
                <AvatarFallback className="bg-primary text-primary-foreground text-sm">
                  {user.username?.[0]?.toUpperCase() || user.firstName?.[0] || user.email?.[0] || 'U'}
                </AvatarFallback>
              </Avatar>
            )}
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 max-w-6xl">
        <div className="space-y-6">
          {selectedLeague && (
            <Card className="border-primary">
              <CardContent className="p-4">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 bg-primary/10 rounded-md flex items-center justify-center">
                    <Trophy className="w-6 h-6 text-primary" />
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-foreground" data-testid="text-selected-league-name">
                      {selectedLeague.leagueName}
                    </p>
                    <div className="flex flex-wrap gap-3 text-xs text-muted-foreground mt-1">
                      <div className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        <span>{selectedLeague.seasonId}</span>
                      </div>
                      {selectedLeague.teamCount && (
                        <div className="flex items-center gap-1">
                          <Users className="w-3 h-3" />
                          <span>{selectedLeague.teamCount} Teams</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                <Button
                  onClick={() => setLocation(`/league/${selectedLeague.id}`)}
                  className="w-full"
                  data-testid="button-view-league"
                >
                  View League
                </Button>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Plus className="w-5 h-5 text-primary" />
                <CardTitle className="text-base">Connect ESPN League</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleConnectLeague} className="space-y-3">
                <div className="grid md:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="leagueId" className="text-sm">League ID</Label>
                    <Input
                      id="leagueId"
                      placeholder="123456"
                      value={leagueId}
                      onChange={(e) => setLeagueId(e.target.value)}
                      disabled={connectLeagueMutation.isPending}
                      data-testid="input-league-id"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="seasonId" className="text-sm">Season Year</Label>
                    <Input
                      id="seasonId"
                      type="number"
                      placeholder="2024"
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
                  className="w-full"
                  data-testid="button-connect-league"
                >
                  {connectLeagueMutation.isPending ? (
                    <>
                      <div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin mr-2"></div>
                      Connecting...
                    </>
                  ) : (
                    <>
                      <Link2 className="w-4 h-4 mr-2" />
                      Connect League
                    </>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>

          <div>
            <h2 className="text-xl font-semibold text-foreground mb-4">My Leagues</h2>
            {leaguesLoading ? (
              <div className="grid md:grid-cols-2 gap-4">
                {[1, 2, 3].map((i) => (
                  <Card key={i}>
                    <CardContent className="p-4">
                      <Skeleton className="h-6 w-3/4 mb-2" />
                      <Skeleton className="h-4 w-full mb-2" />
                      <Skeleton className="h-4 w-2/3" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : leagues && leagues.length > 0 ? (
              <div className="grid md:grid-cols-2 gap-4">
                {leagues.map((league) => (
                  <Card 
                    key={league.id} 
                    className={`hover-elevate ${league.isSelected === 1 ? 'border-primary' : ''}`}
                    data-testid={`card-league-${league.id}`}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-2 mb-3">
                        <div className="flex-1">
                          <p className="font-semibold text-foreground mb-1" data-testid={`text-league-name-${league.id}`}>
                            {league.leagueName}
                          </p>
                          <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                            <div className="flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              <span>{league.seasonId}</span>
                            </div>
                            {league.teamCount && (
                              <div className="flex items-center gap-1">
                                <Users className="w-3 h-3" />
                                <span>{league.teamCount} Teams</span>
                              </div>
                            )}
                          </div>
                        </div>
                        {league.isSelected === 1 && (
                          <div className="w-2 h-2 bg-primary rounded-full"></div>
                        )}
                      </div>
                      {league.isSelected === 1 ? (
                        <Button 
                          onClick={() => setLocation(`/league/${league.id}`)}
                          className="w-full"
                          size="sm"
                          data-testid={`button-view-${league.id}`}
                        >
                          View League
                        </Button>
                      ) : (
                        <Button 
                          onClick={() => handleSelectLeague(league.id)}
                          disabled={selectLeagueMutation.isPending}
                          variant="outline"
                          size="sm"
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
                  <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Trophy className="w-8 h-8 text-primary" />
                  </div>
                  <h3 className="text-base font-semibold text-foreground mb-2">No Leagues Connected</h3>
                  <p className="text-sm text-muted-foreground">
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
