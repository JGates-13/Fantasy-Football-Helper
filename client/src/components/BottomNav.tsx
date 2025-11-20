import { Home, User, TrendingUp } from "lucide-react";
import { useLocation } from "wouter";

export default function BottomNav() {
  const [location, setLocation] = useLocation();

  const navItems = [
    { icon: Home, label: "Home", path: "/", testId: "nav-home" },
    { icon: User, label: "Profile", path: "/profile", testId: "nav-profile" },
    { icon: TrendingUp, label: "Rankings", path: "/rankings", testId: "nav-rankings" },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-card border-t-2 border-primary">
      <div className="max-w-7xl mx-auto">
        <nav className="flex items-center justify-around h-16">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location === item.path || 
                           (item.path === "/" && location.startsWith("/league"));
            
            return (
              <button
                key={item.path}
                onClick={() => setLocation(item.path)}
                className={`flex flex-col items-center justify-center gap-1 flex-1 h-full transition-colors ${
                  isActive
                    ? "text-primary"
                    : "text-muted-foreground hover-elevate"
                }`}
                data-testid={item.testId}
              >
                <Icon className="w-6 h-6" />
                <span className="text-xs font-medium">{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
