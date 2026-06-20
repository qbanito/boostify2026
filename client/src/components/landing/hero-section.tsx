import React from "react";
import { Button } from "@/components/ui/button";
import { Sparkles, TrendingUp, Music2, Zap } from "lucide-react";
import { Link } from "wouter";

export function HeroSection() {
  return (
    <div className="relative min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-black overflow-hidden">
      {/* Animated background gradient */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-gradient-to-br from-orange-500/30 to-transparent rounded-full blur-3xl"></div>
        <div className="absolute top-1/2 -left-40 w-80 h-80 bg-gradient-to-br from-purple-500/30 to-transparent rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 right-1/3 w-80 h-80 bg-gradient-to-br from-blue-500/20 to-transparent rounded-full blur-3xl"></div>
      </div>

      {/* Grid pattern overlay */}
      <div className="absolute inset-0 opacity-5" style={{
        backgroundImage: 'linear-gradient(rgba(255,255,255,.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.1) 1px, transparent 1px)',
        backgroundSize: '50px 50px'
      }}></div>

      {/* Content */}
      <div className="relative z-10 container mx-auto px-4 h-screen flex flex-col justify-center items-center text-center">
        {/* Badge */}
        <div className="mb-6 inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-orange-500/10 to-purple-500/10 border border-orange-500/30 rounded-full">
          <Sparkles className="w-4 h-4 text-orange-400" />
          <span className="text-sm font-medium bg-gradient-to-r from-orange-400 to-orange-300 bg-clip-text text-transparent">
            The Future of Music Finance
          </span>
        </div>

        {/* Main Headline */}
        <h1 className="text-5xl md:text-7xl font-bold mb-6 max-w-4xl leading-tight">
          <span className="bg-gradient-to-r from-white via-orange-200 to-orange-400 bg-clip-text text-transparent">
            Tokenize Music
          </span>
          <br />
          <span className="bg-gradient-to-r from-slate-300 to-slate-400 bg-clip-text text-transparent">
            Trade Artists
          </span>
        </h1>

        {/* Subheading */}
        <p className="text-xl md:text-2xl text-slate-300 mb-8 max-w-2xl leading-relaxed">
          Turn songs into blockchain tokens. Artists earn, fans invest, community grows. The decentralized music marketplace built for the future.
        </p>

        {/* CTA Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
          <Link href="/boostiswap">
            <Button className="h-12 px-8 text-lg bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white rounded-lg font-semibold gap-2 group">
              <Zap className="w-5 h-5 group-hover:scale-110 transition" />
              Start Trading
            </Button>
          </Link>
          <Link href="/tokenization">
            <Button variant="outline" className="h-12 px-8 text-lg border-orange-500/50 text-orange-400 hover:bg-orange-500/10 rounded-lg font-semibold gap-2 group">
              <Music2 className="w-5 h-5 group-hover:scale-110 transition" />
              Tokenize Song
            </Button>
          </Link>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-8 text-center mt-16">
          <div className="space-y-2">
            <p className="text-3xl md:text-4xl font-bold text-orange-400">1000+</p>
            <p className="text-slate-400 text-sm">Artists Tokenized</p>
          </div>
          <div className="space-y-2">
            <p className="text-3xl md:text-4xl font-bold text-purple-400">$50M+</p>
            <p className="text-slate-400 text-sm">Trading Volume</p>
          </div>
          <div className="space-y-2">
            <p className="text-3xl md:text-4xl font-bold text-blue-400">50K+</p>
            <p className="text-slate-400 text-sm">Active Investors</p>
          </div>
        </div>
      </div>

      {/* Scroll indicator */}
      <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 z-10 animate-bounce">
        <div className="flex flex-col items-center gap-2">
          <span className="text-xs text-slate-400">Scroll to explore</span>
          <svg className="w-5 h-5 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
          </svg>
        </div>
      </div>
    </div>
  );
}
