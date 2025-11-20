import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, Trophy } from "lucide-react";

interface PlayerRanking {
  playerId: string;
  name: string;
  position: string;
  team: string;
  rank: number;
  points: number;
}

export default function Rankings() {
  const [selectedPosition, setSelectedPosition] = useState<string>("QB");

  const { data: rankings, isLoading } = useQuery<{ [key: string]: PlayerRanking[] }>({
    queryKey: ["/api/rankings"],
    staleTime: 60000, // Cache for 1 minute
  });

  const positions = ["QB", "RB", "WR", "TE", "K", "DEF"];

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-background pb-20">
      <div className="container mx-auto px-4 py-8 max-w-4xl space-y-6">
        <div className="flex items-center gap-3">
          <TrendingUp className="w-8 h-8 text-primary" />
          <h1 className="text-3xl font-bold text-foreground" data-testid="text-rankings-title">Player Rankings</h1>
        </div>

        <Tabs value={selectedPosition} onValueChange={setSelectedPosition} className="w-full" data-testid="tabs-rankings">
          <TabsList className="grid w-full grid-cols-6">
            {positions.map((pos) => (
              <TabsTrigger key={pos} value={pos} data-testid={`tab-${pos}`}>
                {pos}
              </TabsTrigger>
            ))}
          </TabsList>

          {positions.map((pos) => {
            const positionRankings = rankings?.[pos] || [];
            return (
              <TabsContent key={pos} value={pos} className="mt-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2" data-testid={`title-${pos}-rankings`}>
                      <Trophy className="w-5 h-5" />
                      {pos} Rankings (2024 Season)
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {isLoading ? (
                      <div className="space-y-2">
                        {Array.from({ length: 20 }).map((_, i) => (
                          <Skeleton key={i} className="h-16 w-full" />
                        ))}
                      </div>
                    ) : positionRankings.length > 0 ? (
                      <div className="space-y-2">
                        {positionRankings.map((player, index) => (
                          <div
                            key={player.playerId}
                            className={`flex items-center gap-4 p-4 rounded-md ${
                              index < 3
                                ? "bg-primary/10 border border-primary/20"
                                : "bg-muted/30"
                            }`}
                            data-testid={`player-${index}`}
                          >
                            <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/20">
                              <span className="font-bold text-primary text-sm">{player.rank}</span>
                            </div>
                            <div className="flex-1">
                              <p className="font-semibold text-foreground">{player.name}</p>
                              <p className="text-sm text-muted-foreground">
                                {player.team} • {player.position}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="font-semibold text-foreground">
                                {player.points.toFixed(1)} pts
                              </p>
                              {index < 3 && (
                                <Badge variant="secondary" className="text-xs mt-1">
                                  Top {index + 1}
                                </Badge>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-muted-foreground text-center py-16" data-testid={`text-no-rankings-${pos}`}>
                        No rankings available for {pos}
                      </p>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            );
          })}
        </Tabs>
      </div>
    </div>
  );
}
