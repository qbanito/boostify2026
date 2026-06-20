import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { Badge } from "../ui/badge";
import { Progress } from "../ui/progress";
import { Award, Lock, TrendingUp, CheckCircle2 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";

export function AffiliateBadges() {
  // Obtener badges
  const { data: badgesData, isLoading } = useQuery({
    queryKey: ['/api/affiliate/badges'],
  });

  const earnedBadges = badgesData?.data?.earnedBadges || [];
  const lockedBadges = badgesData?.data?.lockedBadges || [];
  const totalBadges = badgesData?.data?.totalBadges || 0;
  const earnedCount = badgesData?.data?.earnedCount || 0;

  const overallProgress = totalBadges > 0 ? (earnedCount / totalBadges) * 100 : 0;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <Award className="h-6 w-6 text-primary" />
          Logros y Badges
        </h2>
        <p className="text-muted-foreground mt-1">
          Desbloquea logros alcanzando hitos como afiliado
        </p>
      </div>

      {/* Progreso General */}
      <Card className="border-2 border-primary/20 bg-gradient-to-br from-primary/5 via-background to-background">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              Tu Progreso
            </span>
            <Badge variant="secondary" className="text-lg px-4">
              {earnedCount} / {totalBadges}
            </Badge>
          </CardTitle>
          <CardDescription>
            Has desbloqueado {earnedCount} de {totalBadges} logros disponibles
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Progress value={overallProgress} className="h-3" />
          <p className="text-sm text-muted-foreground mt-2 text-center">
            {overallProgress.toFixed(0)}% completado
          </p>
        </CardContent>
      </Card>

      {/* Tabs para Desbloqueados/Bloqueados */}
      <Tabs defaultValue="earned" className="space-y-4">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="earned" className="gap-2">
            <CheckCircle2 className="h-4 w-4" />
            Desbloqueados ({earnedCount})
          </TabsTrigger>
          <TabsTrigger value="locked" className="gap-2">
            <Lock className="h-4 w-4" />
            Por Desbloquear ({totalBadges - earnedCount})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="earned" className="space-y-4">
          {earnedBadges.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Award className="h-16 w-16 text-muted-foreground mb-4 opacity-50" />
                <p className="text-muted-foreground text-center">
                  Aún no has desbloqueado ningún logro.<br />
                  ¡Comienza a vender para ganar tus primeros badges!
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {earnedBadges.map((badge: any) => (
                <Card 
                  key={badge.id} 
                  className="relative overflow-hidden border-2 border-primary/30 bg-gradient-to-br from-primary/10 via-background to-background hover:shadow-xl transition-all"
                  data-testid={`badge-earned-${badge.id}`}
                >
                  {/* Efecto de brillo */}
                  <div className="absolute top-0 right-0 w-24 h-24 bg-primary/5 rounded-full blur-3xl"></div>
                  
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="text-5xl mb-2">{badge.icon}</div>
                      <Badge variant="default" className="bg-green-500 hover:bg-green-600">
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                        Desbloqueado
                      </Badge>
                    </div>
                    <CardTitle className="text-lg">{badge.name}</CardTitle>
                    <CardDescription>{badge.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="bg-primary/5 rounded-lg p-3">
                      <p className="text-xs text-muted-foreground mb-1">Requisito</p>
                      <p className="text-sm font-semibold">{badge.requirement}</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="locked" className="space-y-4">
          {lockedBadges.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Award className="h-16 w-16 text-primary mb-4" />
                <p className="text-center">
                  <span className="text-xl font-bold block mb-2">¡Felicitaciones! 🎉</span>
                  <span className="text-muted-foreground">
                    Has desbloqueado todos los logros disponibles.
                  </span>
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {lockedBadges.map((badge: any) => {
                const progressPercentage = typeof badge.progress === 'number' && badge.requirement 
                  ? Math.min((badge.progress / parseFloat(badge.requirement)) * 100, 100)
                  : 0;

                return (
                  <Card 
                    key={badge.id} 
                    className="relative overflow-hidden border-2 border-muted/30 bg-muted/5 hover:shadow-lg transition-all opacity-80"
                    data-testid={`badge-locked-${badge.id}`}
                  >
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="text-5xl mb-2 opacity-40 grayscale">
                          {badge.icon}
                        </div>
                        <Badge variant="outline" className="gap-1">
                          <Lock className="h-3 w-3" />
                          Bloqueado
                        </Badge>
                      </div>
                      <CardTitle className="text-lg">{badge.name}</CardTitle>
                      <CardDescription>{badge.description}</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="bg-muted/30 rounded-lg p-3">
                        <p className="text-xs text-muted-foreground mb-1">Requisito</p>
                        <p className="text-sm font-semibold">{badge.requirement}</p>
                      </div>

                      {progressPercentage > 0 && (
                        <div className="space-y-1">
                          <div className="flex justify-between text-xs text-muted-foreground">
                            <span>Progreso</span>
                            <span className="font-medium">{progressPercentage.toFixed(0)}%</span>
                          </div>
                          <Progress value={progressPercentage} className="h-2" />
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Mensaje Motivacional */}
      {earnedCount > 0 && earnedCount < totalBadges && (
        <Card className="border-primary/20 bg-gradient-to-r from-primary/5 to-transparent">
          <CardContent className="flex items-center gap-4 py-4">
            <Award className="h-12 w-12 text-primary flex-shrink-0" />
            <div>
              <p className="font-semibold">¡Sigue así!</p>
              <p className="text-sm text-muted-foreground">
                Te faltan {totalBadges - earnedCount} logros por desbloquear. 
                Cada venta te acerca más a tu próximo badge.
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
