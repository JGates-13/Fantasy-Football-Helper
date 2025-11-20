import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Trophy, Link2, TrendingUp, Users } from "lucide-react";

export default function Landing() {
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b border-border">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary rounded-md flex items-center justify-center">
              <Trophy className="w-6 h-6 text-primary-foreground" />
            </div>
            <h1 className="text-xl font-semibold text-foreground">Fantasy League Manager</h1>
          </div>
          <div className="flex gap-2">
            <Button 
              variant="outline"
              onClick={() => setLocation('/login')}
              data-testid="button-login"
            >
              Log In
            </Button>
            <Button 
              onClick={() => setLocation('/signup')}
              data-testid="button-signup"
            >
              Sign Up
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="max-w-4xl w-full space-y-12">
          <div className="text-center space-y-6">
            <h2 className="text-4xl md:text-5xl font-bold text-foreground">
              Manage Your Fantasy Football Leagues
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Connect your ESPN Fantasy Football leagues and access all your teams in one central hub.
            </p>
            <div className="flex justify-center pt-4">
              <Button 
                size="lg"
                onClick={() => setLocation('/signup')}
                className="h-12 px-8 text-base"
                data-testid="button-get-started"
              >
                Get Started
              </Button>
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-6 pt-8">
            <Card className="p-6 space-y-4 hover-elevate">
              <div className="w-12 h-12 bg-accent rounded-md flex items-center justify-center">
                <Link2 className="w-6 h-6 text-accent-foreground" />
              </div>
              <h3 className="text-lg font-semibold text-card-foreground">Quick Connection</h3>
              <p className="text-sm text-muted-foreground">
                Link your ESPN leagues instantly with just your league ID. No complicated setup required.
              </p>
            </Card>

            <Card className="p-6 space-y-4 hover-elevate">
              <div className="w-12 h-12 bg-accent rounded-md flex items-center justify-center">
                <Users className="w-6 h-6 text-accent-foreground" />
              </div>
              <h3 className="text-lg font-semibold text-card-foreground">Multiple Leagues</h3>
              <p className="text-sm text-muted-foreground">
                Manage all your fantasy leagues in one place. Switch between leagues seamlessly.
              </p>
            </Card>

            <Card className="p-6 space-y-4 hover-elevate">
              <div className="w-12 h-12 bg-accent rounded-md flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-accent-foreground" />
              </div>
              <h3 className="text-lg font-semibold text-card-foreground">Stay Updated</h3>
              <p className="text-sm text-muted-foreground">
                Access your league information quickly and stay on top of your fantasy game.
              </p>
            </Card>
          </div>
        </div>
      </main>

      <footer className="border-t border-border py-6">
        <div className="container mx-auto px-6 text-center text-sm text-muted-foreground">
          © 2024 Fantasy League Manager. Connect your ESPN leagues today.
        </div>
      </footer>
    </div>
  );
}
