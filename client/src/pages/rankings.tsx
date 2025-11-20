import { Card, CardContent } from "@/components/ui/card";
import { TrendingUp } from "lucide-react";

export default function Rankings() {
  return (
    <div className="min-h-[calc(100vh-4rem)] bg-background pb-20">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <h1 className="text-3xl font-bold text-foreground mb-8">Rankings</h1>
        
        <Card>
          <CardContent className="py-16 text-center">
            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <TrendingUp className="w-8 h-8 text-primary" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-2">Rankings Coming Soon</h3>
            <p className="text-muted-foreground max-w-md mx-auto">
              Player rankings and league standings will be available here in a future update.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
