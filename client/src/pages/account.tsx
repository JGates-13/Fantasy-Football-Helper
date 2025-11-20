import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { LogOut, Trash2, Link2, Plus, UserCircle, Mail } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { EspnLeague, User } from "@shared/schema";

export default function Account() {
  const { user } = useAuth() as { user: User | null };
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showAddLeagueDialog, setShowAddLeagueDialog] = useState(false);
  const [leagueId, setLeagueId] = useState("");
  const [seasonId, setSeasonId] = useState(new Date().getFullYear().toString());

  const { data: leagues, isLoading: leaguesLoading } = useQuery<EspnLeague[]>({
    queryKey: ["/api/leagues"],
    enabled: !!user,
  });

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

  const deleteAccountMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("DELETE", "/api/account", {});
    },
    onSuccess: () => {
      queryClient.clear();
      toast({
        title: "Account Deleted",
        description: "Your account has been permanently deleted.",
      });
      setLocation("/");
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete account",
        variant: "destructive",
      });
    },
  });

  const connectLeagueMutation = useMutation({
    mutationFn: async ({ leagueId, seasonId }: { leagueId: string; seasonId: string }) => {
      return await apiRequest("POST", "/api/leagues/connect", { leagueId, seasonId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/leagues"] });
      toast({
        title: "League Connected",
        description: "Your league has been added successfully!",
      });
      setShowAddLeagueDialog(false);
      setLeagueId("");
      setSeasonId(new Date().getFullYear().toString());
    },
    onError: (error: Error) => {
      toast({
        title: "Connection Failed",
        description: error.message || "Failed to connect league",
        variant: "destructive",
      });
    },
  });

  const handleLogout = () => {
    logoutMutation.mutate();
  };

  const handleDeleteAccount = () => {
    deleteAccountMutation.mutate();
  };

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

  if (!user) {
    return (
      <div className="min-h-[calc(100vh-4rem)] bg-background flex items-center justify-center pb-20">
        <p className="text-muted-foreground">Please log in to view your account</p>
      </div>
    );
  }

  return (
    <>
      <div className="min-h-[calc(100vh-4rem)] bg-background pb-20">
        <div className="container mx-auto px-4 py-8 max-w-2xl space-y-6">
          <h1 className="text-3xl font-bold text-foreground">Account</h1>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-4">
                <Avatar className="w-20 h-20">
                  <AvatarImage src={user.profileImageUrl || undefined} className="object-cover" />
                  <AvatarFallback className="bg-primary text-primary-foreground text-2xl">
                    {user.username?.[0]?.toUpperCase() || user.firstName?.[0] || user.email?.[0] || 'U'}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <CardTitle className="text-2xl" data-testid="text-account-username">
                    {user.username || user.firstName || 'User'}
                  </CardTitle>
                  {user.email && (
                    <p className="text-sm text-muted-foreground mt-1 flex items-center gap-2">
                      <Mail className="w-4 h-4" />
                      {user.email}
                    </p>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label className="text-sm text-muted-foreground">Account Information</Label>
                <div className="space-y-2">
                  {user.firstName && (
                    <div className="flex items-center gap-2">
                      <UserCircle className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm">{user.firstName} {user.lastName}</span>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Link2 className="w-5 h-5" />
                Connected Leagues
              </CardTitle>
              <CardDescription>
                Manage your ESPN Fantasy Football leagues
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {leaguesLoading ? (
                <div className="space-y-2">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              ) : leagues && leagues.length > 0 ? (
                <div className="space-y-2">
                  {leagues.map((league) => (
                    <div
                      key={league.id}
                      className="flex items-center justify-between p-4 rounded-md bg-muted/30"
                      data-testid={`league-${league.id}`}
                    >
                      <div>
                        <p className="font-semibold text-foreground">{league.leagueName}</p>
                        <p className="text-sm text-muted-foreground">
                          {league.seasonId} Season • {league.teamCount || 0} Teams
                        </p>
                      </div>
                      {league.userTeamId && (
                        <Badge variant="secondary">Active</Badge>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground text-center py-4">No leagues connected</p>
              )}
              
              <Button
                onClick={() => setShowAddLeagueDialog(true)}
                className="w-full"
                variant="outline"
                data-testid="button-add-league"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add League
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Account Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button
                onClick={handleLogout}
                variant="outline"
                className="w-full justify-start"
                disabled={logoutMutation.isPending}
                data-testid="button-logout"
              >
                <LogOut className="w-4 h-4 mr-2" />
                Log Out
              </Button>
              <Button
                onClick={() => setShowDeleteDialog(true)}
                variant="destructive"
                className="w-full justify-start"
                data-testid="button-delete-account"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete Account
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      <AlertDialog open={showAddLeagueDialog} onOpenChange={setShowAddLeagueDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Add League</AlertDialogTitle>
            <AlertDialogDescription>
              Enter your ESPN Fantasy Football league details
            </AlertDialogDescription>
          </AlertDialogHeader>
          <form onSubmit={handleConnectLeague} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="leagueId">League ID</Label>
              <Input
                id="leagueId"
                value={leagueId}
                onChange={(e) => setLeagueId(e.target.value)}
                placeholder="Enter ESPN League ID"
                data-testid="input-league-id"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="seasonId">Season Year</Label>
              <Input
                id="seasonId"
                type="number"
                value={seasonId}
                onChange={(e) => setSeasonId(e.target.value)}
                placeholder="2024"
                data-testid="input-season-id"
              />
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel type="button">Cancel</AlertDialogCancel>
              <Button
                type="submit"
                disabled={connectLeagueMutation.isPending}
                data-testid="button-connect-league"
              >
                {connectLeagueMutation.isPending ? "Connecting..." : "Connect League"}
              </Button>
            </AlertDialogFooter>
          </form>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Account</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete your account and remove all your data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteAccount}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete"
            >
              Delete Account
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
