import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { LogOut, Mail, User as UserIcon } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useLocation } from "wouter";

export default function Profile() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();

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

  if (!user) {
    return (
      <div className="min-h-[calc(100vh-4rem)] bg-background flex items-center justify-center pb-16">
        <p className="text-muted-foreground">Please log in to view your profile</p>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-background pb-20">
      <div className="container mx-auto px-4 py-8 max-w-2xl">
        <h1 className="text-3xl font-bold text-foreground mb-8">Profile</h1>
        
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
                <CardTitle className="text-2xl" data-testid="text-profile-username">
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
          <CardContent className="space-y-6">
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-4 rounded-md bg-muted/50">
                <UserIcon className="w-5 h-5 text-muted-foreground" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-foreground">Username</p>
                  <p className="text-sm text-muted-foreground">{user.username || 'Not set'}</p>
                </div>
              </div>

              {user.firstName && (
                <div className="flex items-center gap-3 p-4 rounded-md bg-muted/50">
                  <UserIcon className="w-5 h-5 text-muted-foreground" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-foreground">First Name</p>
                    <p className="text-sm text-muted-foreground">{user.firstName}</p>
                  </div>
                </div>
              )}

              {user.lastName && (
                <div className="flex items-center gap-3 p-4 rounded-md bg-muted/50">
                  <UserIcon className="w-5 h-5 text-muted-foreground" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-foreground">Last Name</p>
                    <p className="text-sm text-muted-foreground">{user.lastName}</p>
                  </div>
                </div>
              )}
            </div>

            <Button
              onClick={handleLogout}
              disabled={logoutMutation.isPending}
              variant="destructive"
              className="w-full"
              data-testid="button-logout-profile"
            >
              <LogOut className="w-4 h-4 mr-2" />
              {logoutMutation.isPending ? "Logging out..." : "Log Out"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
