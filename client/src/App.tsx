import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import BottomNav from "@/components/BottomNav";
import Landing from "@/pages/landing";
import Login from "@/pages/login";
import Signup from "@/pages/signup";
import Home from "@/pages/home";
import Profile from "@/pages/profile";
import Rankings from "@/pages/rankings";
import LeagueView from "@/pages/league-view";
import Team from "@/pages/team";
import League from "@/pages/league";
import Account from "@/pages/account";
import NotFound from "@/pages/not-found";

function Router() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="space-y-4 text-center">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  const showBottomNav = isAuthenticated;

  return (
    <>
      <Switch>
        <Route path="/login" component={Login} />
        <Route path="/signup" component={Signup} />
        <Route path="/league/:id" component={LeagueView} />
        <Route path="/team" component={Team} />
        <Route path="/league" component={League} />
        <Route path="/account" component={Account} />
        <Route path="/profile" component={Profile} />
        <Route path="/rankings" component={Rankings} />
        {!isAuthenticated ? (
          <Route path="/" component={Landing} />
        ) : (
          <Route path="/" component={Home} />
        )}
        <Route component={NotFound} />
      </Switch>
      {showBottomNav && <BottomNav />}
    </>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
