import { Header } from "../components/layout/header";
import { Card } from "../components/ui/card";
import { ScrollArea } from "../components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Box, CircleDollarSign, Music2, Users, VideoIcon, Brain, Boxes, Gamepad2 } from "lucide-react";

export default function EcosystemPage() {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <main className="flex-1 pt-16 px-4 md:pt-20 md:px-8">
        <div className="flex-1 space-y-6 md:space-y-8">
          <div className="flex flex-col space-y-2">
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
              Digital Ecosystem & Partnerships
            </h2>
            <p className="text-muted-foreground text-sm md:text-base">
              Explore our innovative partnerships and digital ecosystem
            </p>
          </div>

          <Tabs defaultValue="metafeed" className="space-y-6">
            <TabsList className="grid w-full grid-cols-2 gap-2">
              <TabsTrigger value="metafeed" className="gap-2">
                <Box className="h-4 w-4" />
                Metafeed & Boostify
              </TabsTrigger>
              <TabsTrigger value="avatpro" className="gap-2">
                <Brain className="h-4 w-4" />
                Avat Pro & Boostify
              </TabsTrigger>
            </TabsList>

            <TabsContent value="metafeed">
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                <Card className="p-6 space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-orange-500/10 rounded-lg">
                      <Music2 className="h-6 w-6 text-orange-500" />
                    </div>
                    <h3 className="text-xl font-semibold">International Artists</h3>
                  </div>
                  <p className="text-muted-foreground text-sm">
                    Global collaboration platform for international artists
                  </p>
                </Card>

                <Card className="p-6 space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-orange-500/10 rounded-lg">
                      <Brain className="h-6 w-6 text-orange-500" />
                    </div>
                    <h3 className="text-xl font-semibold">Redwine Creations</h3>
                  </div>
                  <p className="text-muted-foreground text-sm">
                    Innovative artist creation and development platform
                  </p>
                </Card>

                <Card className="p-6 space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-orange-500/10 rounded-lg">
                      <Box className="h-6 w-6 text-orange-500" />
                    </div>
                    <h3 className="text-xl font-semibold">Metafeed Metaverse</h3>
                  </div>
                  <p className="text-muted-foreground text-sm">
                    Next-generation virtual reality experiences for artists
                  </p>
                </Card>

                <Card className="p-6 space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-orange-500/10 rounded-lg">
                      <CircleDollarSign className="h-6 w-6 text-orange-500" />
                    </div>
                    <h3 className="text-xl font-semibold">Metafeed Token</h3>
                  </div>
                  <p className="text-muted-foreground text-sm">
                    Decentralized token system for the music ecosystem
                  </p>
                </Card>

                <Card className="p-6 space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-orange-500/10 rounded-lg">
                      <Boxes className="h-6 w-6 text-orange-500" />
                    </div>
                    <h3 className="text-xl font-semibold">Blockchain Metaverse</h3>
                  </div>
                  <p className="text-muted-foreground text-sm">
                    Blockchain-powered virtual world for music experiences
                  </p>
                </Card>

                <Card className="p-6 space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-orange-500/10 rounded-lg">
                      <CircleDollarSign className="h-6 w-6 text-orange-500" />
                    </div>
                    <h3 className="text-xl font-semibold">One Artist One Token</h3>
                  </div>
                  <p className="text-muted-foreground text-sm">
                    Unique tokenization platform for individual artists
                  </p>
                </Card>

                <Card className="p-6 space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-orange-500/10 rounded-lg">
                      <Users className="h-6 w-6 text-orange-500" />
                    </div>
                    <h3 className="text-xl font-semibold">Communities</h3>
                  </div>
                  <p className="text-muted-foreground text-sm">
                    Vibrant artist and fan communities
                  </p>
                </Card>

                <Card className="p-6 space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-orange-500/10 rounded-lg">
                      <VideoIcon className="h-6 w-6 text-orange-500" />
                    </div>
                    <h3 className="text-xl font-semibold">Virtual Concert AI</h3>
                  </div>
                  <p className="text-muted-foreground text-sm">
                    AI-powered virtual concert experiences
                  </p>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="avatpro">
              <div className="grid gap-6 md:grid-cols-2">
                <Card className="p-6 space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-orange-500/10 rounded-lg">
                      <Brain className="h-6 w-6 text-orange-500" />
                    </div>
                    <h3 className="text-xl font-semibold">Hyper Realistic Avatars</h3>
                  </div>
                  <p className="text-muted-foreground text-sm">
                    State-of-the-art avatar creation technology
                  </p>
                </Card>

                <Card className="p-6 space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-orange-500/10 rounded-lg">
                      <Gamepad2 className="h-6 w-6 text-orange-500" />
                    </div>
                    <h3 className="text-xl font-semibold">Unreal Engine Concepts</h3>
                  </div>
                  <p className="text-muted-foreground text-sm">
                    Advanced visual concepts using Unreal Engine
                  </p>
                </Card>

                <Card className="p-6 space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-orange-500/10 rounded-lg">
                      <VideoIcon className="h-6 w-6 text-orange-500" />
                    </div>
                    <h3 className="text-xl font-semibold">Motion Capture</h3>
                  </div>
                  <p className="text-muted-foreground text-sm">
                    Professional motion capture solutions
                  </p>
                </Card>

                <Card className="p-6 space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-orange-500/10 rounded-lg">
                      <Gamepad2 className="h-6 w-6 text-orange-500" />
                    </div>
                    <h3 className="text-xl font-semibold">Animation Gaming</h3>
                  </div>
                  <p className="text-muted-foreground text-sm">
                    Gaming and animation solutions for artists
                  </p>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
}