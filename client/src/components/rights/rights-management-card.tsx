import { Card } from "../ui/card";
import { logger } from "../../lib/logger";
import { Button } from "../ui/button";
import { Music2, ExternalLink, Shield, DollarSign, Globe } from "lucide-react";
import { motion } from "framer-motion";

const societies = [
  {
    name: "ASCAP",
    description: "American Society of Composers, Authors and Publishers",
    url: "https://www.ascap.com/join",
    icon: Music2,
    benefits: "Protects public performance rights",
  },
  {
    name: "BMI",
    description: "Broadcast Music Inc.",
    url: "https://www.bmi.com/join",
    icon: Shield,
    benefits: "Licenses and royalties for composers",
  },
  {
    name: "SESAC",
    description: "Society of European Stage Authors and Composers",
    url: "https://www.sesac.com/join",
    icon: DollarSign,
    benefits: "Invitation-only rights society",
  },
  {
    name: "SoundExchange",
    description: "Digital Performance Rights Organization",
    url: "https://www.soundexchange.com",
    icon: Music2,
    benefits: "Digital performance royalties collection",
  },
  {
    name: "The MLC",
    description: "Mechanical Licensing Collective",
    url: "https://themlc.com",
    icon: Shield,
    benefits: "Mechanical royalties administration",
  },
  {
    name: "PRS",
    description: "Performing Right Society (UK)",
    url: "https://www.prsformusic.com",
    icon: Globe,
    benefits: "UK performance and mechanical rights",
  },
  {
    name: "SACEM",
    description: "Society of Authors, Composers and Publishers of Music (France)",
    url: "https://www.sacem.fr",
    icon: Globe,
    benefits: "French copyright management",
  },
  {
    name: "GEMA",
    description: "Society for Musical Performing and Mechanical Reproduction Rights (Germany)",
    url: "https://www.gema.de",
    icon: Globe,
    benefits: "German rights management",
  },
  {
    name: "SIAE",
    description: "Italian Society of Authors and Publishers",
    url: "https://www.siae.it",
    icon: Globe,
    benefits: "Italian rights management",
  }
];

export function RightsManagementCard() {
  return (
    <Card className="p-6">
      <div className="flex items-center gap-4 mb-6">
        <div className="h-12 w-12 rounded-lg bg-orange-500/10 flex items-center justify-center">
          <Shield className="h-6 w-6 text-orange-500" />
        </div>
        <div>
          <h2 className="text-xl font-semibold">Rights Management</h2>
          <p className="text-sm text-muted-foreground">
            Register and protect your music rights
          </p>
        </div>
      </div>

      <div className="grid gap-4">
        {societies.map((society) => (
          <motion.div
            key={society.name}
            whileHover={{ scale: 1.02 }}
            className="p-4 rounded-lg border bg-card hover:bg-orange-500/5 transition-colors"
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-orange-500/10 rounded-md">
                  <society.icon className="h-5 w-5 text-orange-500" />
                </div>
                <div>
                  <h3 className="font-semibold">{society.name}</h3>
                  <p className="text-sm text-muted-foreground">
                    {society.description}
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="text-orange-500 hover:text-orange-600"
                onClick={() => window.open(society.url, '_blank')}
              >
                <ExternalLink className="h-4 w-4 mr-1" />
                Register
              </Button>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              {society.benefits}
            </p>
          </motion.div>
        ))}
      </div>

      <div className="mt-4 p-4 bg-orange-500/5 rounded-lg">
        <h4 className="font-semibold mb-2">Why Register?</h4>
        <ul className="space-y-2 text-sm text-muted-foreground">
          <li>• Protect your copyrights</li>
          <li>• Collect royalties from performances</li>
          <li>• Access professional resources and tools</li>
          <li>• Connect with the music community</li>
        </ul>
      </div>
    </Card>
  );
}