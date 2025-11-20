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
        <div>
          <div className="flex items-center gap-3 mb-2">
            <TrendingUp className="w-8 h-8 text-primary" />
            <h1 className="text-3xl font-bold text-foreground" data-testid="text-rankings-title">Player Rankings</h1>
          </div>
          <p className="text-muted-foreground">
            2024 season PPR rankings - Updated with latest stats
          </p>
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
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2" data-testid={`title-${pos}-rankings`}>
                      <Trophy className="w-5 h-5 text-primary" />
                      Top {pos} Players
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {isLoading ? (
                      <div className="space-y-2">
                        {Array.from({ length: 20 }).map((_, i) => (
                          <Skeleton key={i} className="h-20 w-full" />
                        ))}
                      </div>
                    ) : positionRankings.length > 0 ? (
                      <div className="space-y-2">
                        {positionRankings.map((player, index) => (
                          <div
                            key={player.playerId}
                            className={`flex items-center gap-4 p-4 rounded-md border ${
                              index < 3
                                ? "bg-primary/10 border-primary/30 hover-elevate"
                                : "bg-card hover-elevate"
                            }`}
                            data-testid={`player-${index}`}
                          >
                            <div className={`flex items-center justify-center w-12 h-12 rounded-full shrink-0 ${
                              index < 3 ? 'bg-primary text-primary-foreground' : 'bg-muted'
                            }`}>
                              <span className="font-bold text-lg">{player.rank}</span>
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold text-foreground text-lg truncate">{player.name}</p>
                              <div className="flex items-center gap-2 mt-1">
                                <Badge variant="outline" className="text-xs">
                                  {player.team}
                                </Badge>
                                <span className="text-sm text-muted-foreground">{player.position}</span>
                              </div>
                            </div>
                            <div className="text-right shrink-0">
                              <p className="text-xl font-bold text-primary">
                                {player.points.toFixed(1)}
                              </p>
                              <p className="text-xs text-muted-foreground">Total Points</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-16">
                        <Trophy className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                        <p className="text-muted-foreground" data-testid={`text-no-rankings-${pos}`}>
                          No rankings available for {pos}
                        </p>
                      </div>
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
