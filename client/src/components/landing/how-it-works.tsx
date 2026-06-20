import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Music2, Coins, TrendingUp, ArrowRight } from "lucide-react";

interface Step {
  icon: React.ReactNode;
  title: string;
  description: string;
  details: string[];
}

const steps: Step[] = [
  {
    icon: <Music2 className="w-12 h-12" />,
    title: "Create Your Token",
    description: "Artists create access tokens in seconds",
    details: [
      "Upload song details and artwork",
      "AI generates professional metadata",
      "Set supply and access tiers",
      "Deploy to blockchain instantly"
    ]
  },
  {
    icon: <Coins className="w-12 h-12" />,
    title: "Launch to Community",
    description: "Access packs go live on Boostify",
    details: [
      "Instant on-chain activation",
      "5% platform fee to Boostify",
      "Transparent on-chain records",
      "24/7 access available"
    ]
  },
  {
    icon: <TrendingUp className="w-12 h-12" />,
    title: "Fans Activate Access",
    description: "Community unlocks exclusive artist content",
    details: [
      "Direct support for your favorite artists",
      "Participate in artist community",
      "Unlock exclusive content and events",
      "Holder-only perks and rewards"
    ]
  }
];

export function HowItWorks() {
  return (
    <section className="relative py-24 px-4 bg-gradient-to-b from-black to-slate-900 overflow-hidden">
      {/* Background elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/2 left-0 w-96 h-96 bg-gradient-to-r from-orange-500/20 to-transparent rounded-full blur-3xl transform -translate-y-1/2"></div>
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-gradient-to-l from-purple-500/20 to-transparent rounded-full blur-3xl"></div>
      </div>

      <div className="relative z-10 container mx-auto max-w-6xl">
        {/* Header */}
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold mb-4">
            <span className="bg-gradient-to-r from-orange-400 to-orange-300 bg-clip-text text-transparent">
              How It Works
            </span>
          </h2>
          <p className="text-lg text-slate-300 max-w-2xl mx-auto">
            Three simple steps to connect artists and fans through blockchain access tokens
          </p>
        </div>

        {/* Steps */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {steps.map((step, index) => (
            <div key={index}>
              <Card className="relative h-full bg-gradient-to-br from-slate-800/50 to-slate-900/50 border-slate-700/50 hover:border-orange-500/30 transition group">
                {/* Step number */}
                <div className="absolute -top-4 -left-4 w-12 h-12 rounded-full bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center text-white font-bold text-lg border-4 border-black">
                  {index + 1}
                </div>

                <CardHeader className="pt-8">
                  <div className="mb-4 text-orange-400 group-hover:scale-110 group-hover:text-orange-300 transition transform">
                    {step.icon}
                  </div>
                  <CardTitle className="text-2xl text-white">{step.title}</CardTitle>
                  <CardDescription className="text-slate-300 text-base">{step.description}</CardDescription>
                </CardHeader>

                <CardContent>
                  <ul className="space-y-3">
                    {step.details.map((detail, i) => (
                      <li key={i} className="flex items-start gap-3">
                        <div className="w-1.5 h-1.5 rounded-full bg-gradient-to-r from-orange-400 to-orange-300 mt-2 flex-shrink-0"></div>
                        <span className="text-sm text-slate-300">{detail}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>

              {/* Arrow between steps */}
              {index < steps.length - 1 && (
                <div className="hidden md:flex justify-center mt-6 -mb-6">
                  <ArrowRight className="w-6 h-6 text-orange-400/60 transform rotate-90" />
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Key Features */}
        <div className="mt-20 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: "Smart Contracts", value: "ERC-1155" },
            { label: "Gas Optimized", value: "Polygon Chain" },
            { label: "Instant Activation", value: "On-Chain" },
            { label: "Fair Launch", value: "No Presale" }
          ].map((feature, i) => (
            <Card key={i} className="bg-gradient-to-br from-slate-800/30 to-slate-900/30 border-slate-700/50">
              <CardContent className="pt-6 text-center">
                <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">{feature.label}</p>
                <p className="text-lg font-semibold text-orange-400">{feature.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
