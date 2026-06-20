import { Card } from "../ui/card";
import { logger } from "../../lib/logger";
import { Button } from "../ui/button";
import { Music2, ExternalLink, Globe, DollarSign, Smartphone, Cloud } from "lucide-react";
import { motion } from "framer-motion";

const distributors = [
  {
    name: "DistroKid",
    description: "Unlimited distribution for a flat annual fee",
    url: "https://distrokid.com/vip/seven/641439",
    icon: Music2,
    benefits: "100% royalties, unlimited releases",
  },
  {
    name: "CD Baby",
    description: "One-time payment per release",
    url: "https://cdbaby.com",
    icon: Globe,
    benefits: "Permanent distribution, publishing services",
  },
  {
    name: "TuneCore",
    description: "Professional distribution with detailed analytics",
    url: "https://www.tunecore.com/r/17346764",
    icon: DollarSign,
    benefits: "100% royalties, marketing tools",
  },
  {
    name: "AWAL",
    description: "Selective music distribution and artist services",
    url: "https://www.awal.com",
    icon: Music2,
    benefits: "Marketing and funding opportunities",
  },
  {
    name: "United Masters",
    description: "Artist-focused distribution platform",
    url: "https://unitedmasters.com",
    icon: Cloud,
    benefits: "Brand partnership opportunities",
  },
  {
    name: "Ditto Music",
    description: "Global music distribution service",
    url: "https://dittomusic.com",
    icon: Globe,
    benefits: "Worldwide distribution, label services",
  },
  {
    name: "Amuse",
    description: "Free music distribution with pro options",
    url: "https://www.amuse.io",
    icon: Smartphone,
    benefits: "Free tier available, data-driven insights",
  },
  {
    name: "ONErpm",
    description: "Digital distribution and marketing platform",
    url: "https://onerpm.com",
    icon: Globe,
    benefits: "Marketing support, YouTube monetization",
  }
];

export function DistributionCard() {
  return (
    <Card className="p-6">
      <div className="flex items-center gap-4 mb-6">
        <div className="h-12 w-12 rounded-lg bg-orange-500/10 flex items-center justify-center">
          <Globe className="h-6 w-6 text-orange-500" />
        </div>
        <div>
          <h2 className="text-xl font-semibold">Digital Distribution</h2>
          <p className="text-sm text-muted-foreground">
            Distribute your music on streaming platforms
          </p>
        </div>
      </div>

      <div className="grid gap-4">
        {distributors.map((distributor) => (
          <motion.div
            key={distributor.name}
            whileHover={{ scale: 1.02 }}
            className="p-4 rounded-lg border bg-card hover:bg-orange-500/5 transition-colors"
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-orange-500/10 rounded-md">
                  <distributor.icon className="h-5 w-5 text-orange-500" />
                </div>
                <div>
                  <h3 className="font-semibold">{distributor.name}</h3>
                  <p className="text-sm text-muted-foreground">
                    {distributor.description}
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="text-orange-500 hover:text-orange-600"
                onClick={() => window.open(distributor.url, '_blank')}
              >
                <ExternalLink className="h-4 w-4 mr-1" />
                Register
              </Button>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              {distributor.benefits}
            </p>
          </motion.div>
        ))}
      </div>

      <div className="mt-4 p-4 bg-orange-500/5 rounded-lg">
        <h4 className="font-semibold mb-2">Why Use a Digital Distributor?</h4>
        <ul className="space-y-2 text-sm text-muted-foreground">
          <li>• Distribute your music on all major platforms</li>
          <li>• Receive payments directly from streaming platforms</li>
          <li>• Maintain full control of your rights</li>
          <li>• Access detailed statistics and analytics</li>
        </ul>
      </div>
    </Card>
  );
}