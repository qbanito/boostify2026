/**
 * 🚀 ASAAS Section - Artist As A System
 * 
 * Animated section explaining Boostify's revolutionary concept:
 * The first platform to generate complete artists from a single click
 */

import React, { useEffect, useRef, useState } from 'react';
import { motion, useAnimation, useInView, AnimatePresence } from 'framer-motion';
import { 
  Music2, Video, Globe, TrendingUp, Sparkles, Zap, 
  ArrowRight, Play, Users, Coins, Radio, Mic2,
  Share2, BarChart2, Palette, Headphones, Rocket,
  Star, Heart, Eye, MessageCircle
} from 'lucide-react';
import { Link } from 'wouter';

// ASAAS Pillars - What makes an artist complete
const asaasPillars = [
  {
    id: 'music',
    icon: Music2,
    title: 'Music Creation',
    description: 'AI-generated tracks & remixes',
    color: 'from-purple-500 to-violet-600',
    shadowColor: 'shadow-purple-500/30',
    delay: 0
  },
  {
    id: 'video',
    icon: Video,
    title: 'Visual Content',
    description: 'Music videos & social clips',
    color: 'from-orange-500 to-red-600',
    shadowColor: 'shadow-orange-500/30',
    delay: 0.1
  },
  {
    id: 'marketing',
    icon: TrendingUp,
    title: 'Marketing',
    description: 'Automated campaigns',
    color: 'from-green-500 to-emerald-600',
    shadowColor: 'shadow-green-500/30',
    delay: 0.2
  },
  {
    id: 'distribution',
    icon: Globe,
    title: 'Distribution',
    description: 'Worldwide reach',
    color: 'from-blue-500 to-cyan-600',
    shadowColor: 'shadow-blue-500/30',
    delay: 0.3
  },
  {
    id: 'analytics',
    icon: BarChart2,
    title: 'Analytics',
    description: 'Real-time insights',
    color: 'from-pink-500 to-rose-600',
    shadowColor: 'shadow-pink-500/30',
    delay: 0.4
  },
  {
    id: 'monetization',
    icon: Coins,
    title: 'Monetization',
    description: 'Multiple revenue streams',
    color: 'from-yellow-500 to-amber-600',
    shadowColor: 'shadow-yellow-500/30',
    delay: 0.5
  }
];

// Floating icons for background animation
const FloatingIcon = ({ icon: Icon, delay, x, y, size = 24 }: { icon: any; delay: number; x: string; y: string; size?: number }) => (
  <motion.div
    className="absolute text-orange-500/20"
    style={{ left: x, top: y }}
    initial={{ opacity: 0, scale: 0 }}
    animate={{ 
      opacity: [0.1, 0.3, 0.1],
      scale: [0.8, 1.2, 0.8],
      rotate: [0, 360],
      y: [0, -20, 0]
    }}
    transition={{
      duration: 8,
      delay,
      repeat: Infinity,
      ease: "easeInOut"
    }}
  >
    <Icon size={size} />
  </motion.div>
);

// Central Orb with pulsating rings
const CentralOrb = () => {
  return (
    <div className="relative w-40 h-40 md:w-56 md:h-56">
      {/* Multiple pulsing rings */}
      {[...Array(4)].map((_, i) => (
        <motion.div
          key={i}
          className="absolute inset-0 rounded-full border-2 border-orange-500/30"
          animate={{
            scale: [1, 1.5 + i * 0.3, 1],
            opacity: [0.5, 0, 0.5]
          }}
          transition={{
            duration: 3,
            delay: i * 0.5,
            repeat: Infinity,
            ease: "easeOut"
          }}
        />
      ))}
      
      {/* Rotating gradient ring */}
      <motion.div
        className="absolute inset-2 rounded-full"
        style={{
          background: 'conic-gradient(from 0deg, transparent, #f97316, transparent)',
        }}
        animate={{ rotate: 360 }}
        transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
      />
      
      {/* Inner glow */}
      <div className="absolute inset-4 rounded-full bg-gradient-to-br from-orange-500/50 to-red-500/50 blur-xl" />
      
      {/* Main orb */}
      <motion.div 
        className="absolute inset-6 rounded-full bg-gradient-to-br from-orange-500 via-red-500 to-orange-600 shadow-2xl shadow-orange-500/50 flex items-center justify-center overflow-hidden"
        animate={{ 
          boxShadow: [
            '0 0 40px rgba(249,115,22,0.5)',
            '0 0 80px rgba(249,115,22,0.8)',
            '0 0 40px rgba(249,115,22,0.5)'
          ]
        }}
        transition={{ duration: 2, repeat: Infinity }}
      >
        {/* Inner pattern */}
        <div className="absolute inset-0 opacity-30">
          {[...Array(6)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute inset-0 border border-white/20 rounded-full"
              style={{ scale: 0.3 + i * 0.15 }}
              animate={{ rotate: i % 2 === 0 ? 360 : -360 }}
              transition={{ duration: 20 + i * 5, repeat: Infinity, ease: "linear" }}
            />
          ))}
        </div>
        
        <motion.div
          animate={{ 
            scale: [1, 1.2, 1],
            rotate: [0, 180, 360]
          }}
          transition={{ duration: 4, repeat: Infinity }}
        >
          <Sparkles className="w-10 h-10 md:w-14 md:h-14 text-white" />
        </motion.div>
      </motion.div>
    </div>
  );
};

// Orbital items rotating around center
const OrbitalItem = ({ icon: Icon, label, angle, delay, color }: { icon: any; label: string; angle: number; delay: number; color: string }) => {
  const radius = 140; // Distance from center
  const x = Math.cos((angle * Math.PI) / 180) * radius;
  const y = Math.sin((angle * Math.PI) / 180) * radius;
  
  return (
    <motion.div
      className="absolute"
      style={{ 
        left: '50%',
        top: '50%',
      }}
      initial={{ opacity: 0, scale: 0 }}
      animate={{ 
        opacity: 1, 
        scale: 1,
        x: x - 24,
        y: y - 24
      }}
      transition={{ delay, duration: 0.5 }}
    >
      <motion.div
        className={`w-12 h-12 rounded-full bg-gradient-to-br ${color} flex items-center justify-center shadow-lg cursor-pointer`}
        whileHover={{ scale: 1.3, zIndex: 10 }}
        animate={{
          y: [0, -5, 0]
        }}
        transition={{
          y: { duration: 2, repeat: Infinity, delay: delay * 0.5 }
        }}
      >
        <Icon className="w-6 h-6 text-white" />
      </motion.div>
    </motion.div>
  );
};

// Pillar Card Component with enhanced animation
const PillarCard = ({ pillar, index, isActive }: { pillar: typeof asaasPillars[0]; index: number; isActive: boolean }) => {
  const Icon = pillar.icon;
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 30, scale: 0.9 }}
      whileInView={{ opacity: 1, y: 0, scale: 1 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ delay: pillar.delay, duration: 0.5 }}
      whileHover={{ scale: 1.08, y: -8 }}
      className="relative group cursor-pointer"
    >
      {/* Glow effect on hover */}
      <motion.div 
        className={`absolute -inset-1 bg-gradient-to-br ${pillar.color} rounded-2xl opacity-0 group-hover:opacity-40 blur-xl transition-opacity duration-500`}
        animate={isActive ? { opacity: 0.4 } : {}}
      />
      
      <div className={`relative bg-zinc-900/90 backdrop-blur-sm border border-white/10 rounded-2xl p-4 md:p-5 transition-all duration-300 ${isActive ? 'border-orange-500/50' : 'group-hover:border-orange-500/30'}`}>
        {/* Animated icon container */}
        <motion.div 
          className={`w-12 h-12 md:w-14 md:h-14 rounded-xl bg-gradient-to-br ${pillar.color} flex items-center justify-center mb-3 ${pillar.shadowColor} shadow-lg`}
          animate={isActive ? { 
            rotate: [0, 10, -10, 0],
            scale: [1, 1.1, 1]
          } : {}}
          transition={{ duration: 0.5 }}
        >
          <Icon className="w-6 h-6 md:w-7 md:h-7 text-white" />
        </motion.div>
        
        <h3 className="text-sm md:text-base font-bold text-white mb-1">{pillar.title}</h3>
        <p className="text-xs text-white/50">{pillar.description}</p>
        
        {/* Active indicator */}
        {isActive && (
          <motion.div
            className="absolute top-2 right-2 w-2 h-2 rounded-full bg-orange-500"
            animate={{ scale: [1, 1.5, 1], opacity: [1, 0.5, 1] }}
            transition={{ duration: 1, repeat: Infinity }}
          />
        )}
      </div>
    </motion.div>
  );
};

// Props interface
interface AsaasSectionProps {
  onGetStarted?: () => void;
}

// Main ASAAS Section Component
export function AsaasSection({ onGetStarted }: AsaasSectionProps) {
  const sectionRef = useRef<HTMLElement>(null);
  const isInView = useInView(sectionRef, { once: true, margin: "-100px" });
  const controls = useAnimation();
  const [activeStep, setActiveStep] = useState(0);
  const [activePillar, setActivePillar] = useState(0);

  // Animate through the steps
  useEffect(() => {
    if (isInView) {
      controls.start("visible");
      
      // Cycle through steps for the animation
      const stepInterval = setInterval(() => {
        setActiveStep(prev => (prev + 1) % 4);
      }, 3000);
      
      // Cycle through pillars
      const pillarInterval = setInterval(() => {
        setActivePillar(prev => (prev + 1) % 6);
      }, 2000);
      
      return () => {
        clearInterval(stepInterval);
        clearInterval(pillarInterval);
      };
    }
  }, [isInView, controls]);

  const steps = [
    { title: "Upload Your Song", icon: Music2, description: "Start with your audio", emoji: "🎵" },
    { title: "AI Creates Everything", icon: Sparkles, description: "Magic happens", emoji: "✨" },
    { title: "Distribute Worldwide", icon: Globe, description: "All platforms", emoji: "🌍" },
    { title: "Grow & Monetize", icon: TrendingUp, description: "Build your empire", emoji: "🚀" }
  ];

  const handleGetStarted = () => {
    if (onGetStarted) {
      onGetStarted();
    } else {
      window.location.href = '/auth';
    }
  };

  return (
    <section 
      ref={sectionRef}
      className="relative py-16 md:py-24 lg:py-32 overflow-hidden bg-gradient-to-b from-black via-zinc-950 to-black"
    >
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {/* Gradient orbs */}
        <motion.div 
          className="absolute -top-40 -left-40 w-80 h-80 bg-orange-500/10 rounded-full filter blur-3xl"
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.1, 0.2, 0.1],
            x: [0, 50, 0],
            y: [0, 30, 0]
          }}
          transition={{ duration: 8, repeat: Infinity }}
        />
        <motion.div 
          className="absolute -bottom-40 -right-40 w-96 h-96 bg-red-500/10 rounded-full filter blur-3xl"
          animate={{
            scale: [1, 1.3, 1],
            opacity: [0.1, 0.2, 0.1],
            x: [0, -50, 0],
            y: [0, -30, 0]
          }}
          transition={{ duration: 10, repeat: Infinity }}
        />
        <motion.div 
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-purple-500/5 rounded-full filter blur-3xl"
          animate={{
            scale: [1, 1.1, 1],
            rotate: [0, 180, 360]
          }}
          transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
        />
        
        {/* Grid pattern */}
        <div 
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `linear-gradient(rgba(249,115,22,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(249,115,22,0.5) 1px, transparent 1px)`,
            backgroundSize: '60px 60px'
          }}
        />
        
        {/* Floating icons */}
        <FloatingIcon icon={Music2} delay={0} x="10%" y="20%" size={32} />
        <FloatingIcon icon={Video} delay={1} x="85%" y="15%" size={28} />
        <FloatingIcon icon={Mic2} delay={2} x="15%" y="70%" size={24} />
        <FloatingIcon icon={Headphones} delay={3} x="90%" y="60%" size={30} />
        <FloatingIcon icon={Star} delay={4} x="5%" y="45%" size={20} />
        <FloatingIcon icon={Heart} delay={5} x="95%" y="35%" size={22} />
        <FloatingIcon icon={Globe} delay={1.5} x="20%" y="85%" size={26} />
        <FloatingIcon icon={Coins} delay={2.5} x="80%" y="80%" size={24} />
      </div>

      <div className="container relative z-10 mx-auto px-4">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.8 }}
          className="text-center mb-12 md:mb-16"
        >
          {/* ASAAS Badge with glow */}
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={isInView ? { opacity: 1, scale: 1 } : {}}
            transition={{ delay: 0.2, duration: 0.5 }}
            className="relative inline-block mb-6 md:mb-8"
          >
            <motion.div
              className="absolute inset-0 bg-orange-500/30 rounded-full blur-xl"
              animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.6, 0.3] }}
              transition={{ duration: 2, repeat: Infinity }}
            />
            <div className="relative inline-flex items-center gap-2 px-5 md:px-8 py-2.5 md:py-3 rounded-full bg-gradient-to-r from-orange-500/20 to-red-500/20 border border-orange-500/40">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
              >
                <Zap className="w-4 h-4 md:w-5 md:h-5 text-orange-500" />
              </motion.div>
              <span className="text-sm md:text-base font-bold text-orange-400 tracking-wide">WORLD'S FIRST ASAAS PLATFORM</span>
              <motion.div
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ duration: 1, repeat: Infinity }}
              >
                <Rocket className="w-4 h-4 md:w-5 md:h-5 text-orange-500" />
              </motion.div>
            </div>
          </motion.div>
          
          {/* Main title with letter animation */}
          <h2 className="text-4xl md:text-6xl lg:text-7xl font-extrabold mb-4 md:mb-6">
            <motion.span 
              className="block text-white mb-2"
              initial={{ opacity: 0, x: -50 }}
              animate={isInView ? { opacity: 1, x: 0 } : {}}
              transition={{ delay: 0.3, duration: 0.6 }}
            >
              Artist As A
            </motion.span>
            <motion.span 
              className="block"
              initial={{ opacity: 0, x: 50 }}
              animate={isInView ? { opacity: 1, x: 0 } : {}}
              transition={{ delay: 0.5, duration: 0.6 }}
            >
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-orange-400 via-red-500 to-orange-500 animate-gradient">
                System
              </span>
            </motion.span>
          </h2>
          
          <motion.p 
            className="text-base md:text-xl lg:text-2xl text-white/70 max-w-3xl mx-auto leading-relaxed px-4"
            initial={{ opacity: 0 }}
            animate={isInView ? { opacity: 1 } : {}}
            transition={{ delay: 0.7, duration: 0.6 }}
          >
            The revolutionary concept that transforms how artists are created.
            <motion.span 
              className="text-orange-400 font-semibold"
              animate={{ opacity: [1, 0.5, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
            > One click</motion.span> generates a complete artist:
            music, videos, marketing, and monetization.
          </motion.p>
        </motion.div>

        {/* Central Visualization - Mobile Version */}
        <div className="md:hidden relative max-w-sm mx-auto mb-12">
          <motion.div
            initial={{ opacity: 0, scale: 0.5 }}
            animate={isInView ? { opacity: 1, scale: 1 } : {}}
            transition={{ delay: 0.6, duration: 0.6 }}
            className="relative flex flex-col items-center"
          >
            {/* Compact Orb for Mobile */}
            <div className="relative w-28 h-28 mb-6">
              {/* Pulsing rings */}
              {[...Array(3)].map((_, i) => (
                <motion.div
                  key={i}
                  className="absolute inset-0 rounded-full border border-orange-500/30"
                  animate={{
                    scale: [1, 1.4 + i * 0.2, 1],
                    opacity: [0.4, 0, 0.4]
                  }}
                  transition={{
                    duration: 2.5,
                    delay: i * 0.4,
                    repeat: Infinity,
                    ease: "easeOut"
                  }}
                />
              ))}
              
              {/* Rotating ring */}
              <motion.div
                className="absolute inset-1 rounded-full"
                style={{
                  background: 'conic-gradient(from 0deg, transparent, #f97316, transparent)',
                }}
                animate={{ rotate: 360 }}
                transition={{ duration: 6, repeat: Infinity, ease: "linear" }}
              />
              
              {/* Inner glow */}
              <div className="absolute inset-3 rounded-full bg-gradient-to-br from-orange-500/40 to-red-500/40 blur-lg" />
              
              {/* Main orb */}
              <motion.div 
                className="absolute inset-4 rounded-full bg-gradient-to-br from-orange-500 via-red-500 to-orange-600 shadow-xl shadow-orange-500/40 flex items-center justify-center"
                animate={{ 
                  boxShadow: [
                    '0 0 20px rgba(249,115,22,0.4)',
                    '0 0 40px rgba(249,115,22,0.6)',
                    '0 0 20px rgba(249,115,22,0.4)'
                  ]
                }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                <motion.div
                  animate={{ 
                    scale: [1, 1.15, 1],
                    rotate: [0, 180, 360]
                  }}
                  transition={{ duration: 3, repeat: Infinity }}
                >
                  <Sparkles className="w-7 h-7 text-white" />
                </motion.div>
              </motion.div>
            </div>
            
            {/* Mobile Orbital Icons - Horizontal scroll */}
            <div className="flex gap-3 justify-center flex-wrap px-4">
              {[
                { icon: Music2, color: 'from-purple-500 to-violet-600', label: 'Music' },
                { icon: Video, color: 'from-orange-500 to-red-600', label: 'Video' },
                { icon: TrendingUp, color: 'from-green-500 to-emerald-600', label: 'Marketing' },
                { icon: Globe, color: 'from-blue-500 to-cyan-600', label: 'Distribution' },
                { icon: BarChart2, color: 'from-pink-500 to-rose-600', label: 'Analytics' },
                { icon: Coins, color: 'from-yellow-500 to-amber-600', label: 'Revenue' }
              ].map((item, idx) => {
                const Icon = item.icon;
                return (
                  <motion.div
                    key={item.label}
                    initial={{ opacity: 0, scale: 0 }}
                    animate={isInView ? { opacity: 1, scale: 1 } : {}}
                    transition={{ delay: 0.8 + idx * 0.1, duration: 0.3 }}
                    className="flex flex-col items-center gap-1"
                  >
                    <motion.div
                      className={`w-10 h-10 rounded-full bg-gradient-to-br ${item.color} flex items-center justify-center shadow-lg`}
                      animate={{ y: [0, -3, 0] }}
                      transition={{ duration: 2, delay: idx * 0.2, repeat: Infinity }}
                    >
                      <Icon className="w-5 h-5 text-white" />
                    </motion.div>
                    <span className="text-[10px] text-white/50">{item.label}</span>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>
        </div>

        {/* Central Visualization - Desktop */}
        <div className="hidden md:block relative max-w-3xl mx-auto mb-20">
          <motion.div
            initial={{ opacity: 0, scale: 0.5 }}
            animate={isInView ? { opacity: 1, scale: 1 } : {}}
            transition={{ delay: 0.8, duration: 0.8 }}
            className="relative h-[350px] flex items-center justify-center"
          >
            {/* Central orb */}
            <CentralOrb />
            
            {/* Orbital items */}
            <OrbitalItem icon={Music2} label="Music" angle={0} delay={1} color="from-purple-500 to-violet-600" />
            <OrbitalItem icon={Video} label="Video" angle={60} delay={1.1} color="from-orange-500 to-red-600" />
            <OrbitalItem icon={TrendingUp} label="Marketing" angle={120} delay={1.2} color="from-green-500 to-emerald-600" />
            <OrbitalItem icon={Globe} label="Distribution" angle={180} delay={1.3} color="from-blue-500 to-cyan-600" />
            <OrbitalItem icon={BarChart2} label="Analytics" angle={240} delay={1.4} color="from-pink-500 to-rose-600" />
            <OrbitalItem icon={Coins} label="Revenue" angle={300} delay={1.5} color="from-yellow-500 to-amber-600" />
            
            {/* Connection lines */}
            <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: -1 }}>
              <defs>
                <linearGradient id="lineGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="rgba(249,115,22,0.3)" />
                  <stop offset="100%" stopColor="rgba(249,115,22,0)" />
                </linearGradient>
              </defs>
              <motion.circle
                cx="50%"
                cy="50%"
                r="140"
                fill="none"
                stroke="url(#lineGradient)"
                strokeWidth="1"
                strokeDasharray="10 5"
                initial={{ pathLength: 0 }}
                animate={isInView ? { pathLength: 1, rotate: 360 } : {}}
                transition={{ duration: 2, delay: 1 }}
                style={{ transformOrigin: 'center' }}
              />
            </svg>
          </motion.div>
        </div>

        {/* The 4-Step Flow */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={isInView ? { opacity: 1 } : {}}
          transition={{ delay: 0.5, duration: 1 }}
          className="relative max-w-5xl mx-auto mb-16 md:mb-20 px-4"
        >
          <h3 className="text-lg md:text-xl font-semibold text-center text-white/60 mb-8">
            How it works in <span className="text-orange-400">4 simple steps</span>
          </h3>
          
          <div className="flex flex-col md:grid md:grid-cols-2 lg:flex lg:flex-row items-center justify-center gap-4 md:gap-6 lg:gap-2">
            {steps.map((step, index) => {
              const Icon = step.icon;
              const isActive = activeStep === index;
              
              return (
                <React.Fragment key={step.title}>
                  {/* Step Card */}
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={isInView ? { opacity: 1, y: 0 } : {}}
                    transition={{ delay: 0.3 + index * 0.15, duration: 0.5 }}
                    className={`relative w-full lg:flex-shrink-0 lg:w-auto ${isActive ? 'z-10' : 'z-0'}`}
                  >
                    <motion.div
                      animate={isActive ? { scale: 1.05 } : { scale: 1 }}
                      transition={{ duration: 0.3 }}
                      className={`
                        relative p-4 md:p-5 rounded-2xl border transition-all duration-500
                        ${isActive 
                          ? 'bg-gradient-to-br from-orange-500/20 to-red-500/20 border-orange-500/50 shadow-xl shadow-orange-500/20' 
                          : 'bg-zinc-900/50 border-white/10 hover:border-orange-500/30'}
                      `}
                    >
                      {/* Step number badge */}
                      <motion.div 
                        className={`
                          absolute -top-3 -left-3 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold
                          ${isActive ? 'bg-gradient-to-br from-orange-500 to-red-500 text-white shadow-lg shadow-orange-500/50' : 'bg-zinc-800 text-white/60'}
                        `}
                        animate={isActive ? { scale: [1, 1.2, 1] } : {}}
                        transition={{ duration: 0.5 }}
                      >
                        {index + 1}
                      </motion.div>
                      
                      {/* Emoji */}
                      <motion.div
                        className="text-2xl md:text-3xl mb-2 text-center"
                        animate={isActive ? { scale: [1, 1.3, 1], rotate: [0, 10, -10, 0] } : {}}
                        transition={{ duration: 0.6 }}
                      >
                        {step.emoji}
                      </motion.div>
                      
                      <div className={`
                        w-12 h-12 md:w-14 md:h-14 rounded-xl flex items-center justify-center mb-2 mx-auto transition-all duration-300
                        ${isActive 
                          ? 'bg-gradient-to-br from-orange-500 to-red-500 shadow-lg shadow-orange-500/30' 
                          : 'bg-zinc-800'}
                      `}>
                        <Icon className={`w-6 h-6 md:w-7 md:h-7 ${isActive ? 'text-white' : 'text-white/60'}`} />
                      </div>
                      
                      <h4 className={`text-sm md:text-base font-bold text-center mb-1 transition-colors ${isActive ? 'text-white' : 'text-white/80'}`}>
                        {step.title}
                      </h4>
                      <p className="text-xs text-white/50 text-center">
                        {step.description}
                      </p>
                      
                      {/* Active pulse ring */}
                      <AnimatePresence>
                        {isActive && (
                          <motion.div
                            className="absolute inset-0 rounded-2xl border-2 border-orange-500"
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: [0.5, 1, 0.5], scale: 1 }}
                            exit={{ opacity: 0, scale: 1.1 }}
                            transition={{ duration: 1.5, repeat: Infinity }}
                          />
                        )}
                      </AnimatePresence>
                    </motion.div>
                  </motion.div>
                  
                  {/* Arrow connector - Desktop */}
                  {index < steps.length - 1 && (
                    <motion.div
                      initial={{ opacity: 0, scaleX: 0 }}
                      animate={isInView ? { opacity: 1, scaleX: 1 } : {}}
                      transition={{ delay: 0.5 + index * 0.15, duration: 0.3 }}
                      className="hidden lg:flex items-center justify-center w-8 lg:w-16"
                    >
                      <div className="relative w-full h-0.5 bg-gradient-to-r from-orange-500/50 to-orange-500/20 overflow-hidden">
                        <motion.div
                          className="absolute top-0 left-0 w-full h-full bg-gradient-to-r from-transparent via-orange-500 to-transparent"
                          animate={{ x: ['-100%', '200%'] }}
                          transition={{ duration: 1.5, repeat: Infinity, delay: index * 0.2 }}
                        />
                      </div>
                      <ArrowRight className="w-4 h-4 text-orange-500/50 ml-0.5 flex-shrink-0" />
                    </motion.div>
                  )}
                  
                  {/* Arrow for mobile - vertical */}
                  {index < steps.length - 1 && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={isInView ? { opacity: 1 } : {}}
                      transition={{ delay: 0.5 + index * 0.15 }}
                      className="md:hidden flex flex-col items-center h-6"
                    >
                      <motion.div 
                        className="w-0.5 h-full bg-gradient-to-b from-orange-500/50 to-transparent"
                        animate={{ scaleY: [1, 1.2, 1] }}
                        transition={{ duration: 1, repeat: Infinity }}
                      />
                    </motion.div>
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </motion.div>

        {/* The 6 Pillars Grid */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={isInView ? { opacity: 1 } : {}}
          transition={{ delay: 0.8, duration: 0.5 }}
          className="mb-12 md:mb-16"
        >
          <h3 className="text-xl md:text-2xl font-bold text-center text-white/80 mb-8 md:mb-10">
            One Platform. <span className="text-orange-400">Complete Artist.</span>
          </h3>
          
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 md:gap-4 max-w-6xl mx-auto">
            {asaasPillars.map((pillar, index) => (
              <PillarCard 
                key={pillar.id} 
                pillar={pillar} 
                index={index} 
                isActive={activePillar === index}
              />
            ))}
          </div>
        </motion.div>

        {/* Bottom CTA */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ delay: 1.2, duration: 0.5 }}
          className="text-center"
        >
          <motion.div 
            className="inline-flex flex-col sm:flex-row items-center gap-4 p-5 md:p-8 rounded-2xl bg-gradient-to-r from-orange-500/10 via-red-500/10 to-orange-500/10 border border-orange-500/20 backdrop-blur-sm"
            whileHover={{ borderColor: 'rgba(249,115,22,0.5)' }}
          >
            <div className="text-center sm:text-left">
              <motion.p 
                className="text-lg md:text-2xl font-bold text-white"
                animate={{ opacity: [1, 0.8, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                Ready to become a complete artist?
              </motion.p>
              <p className="text-sm md:text-base text-white/60">Join the ASAAS revolution today — it's free to start</p>
            </div>
            <motion.button
              onClick={handleGetStarted}
              whileHover={{ scale: 1.05, boxShadow: '0 0 30px rgba(249,115,22,0.5)' }}
              whileTap={{ scale: 0.95 }}
              className="px-8 md:px-10 py-3.5 md:py-4 rounded-xl bg-gradient-to-r from-orange-500 to-red-500 text-white font-bold text-base md:text-lg shadow-lg shadow-orange-500/30 flex items-center gap-2 relative overflow-hidden group"
            >
              {/* Shine effect */}
              <motion.div
                className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
                initial={{ x: '-100%' }}
                whileHover={{ x: '100%' }}
                transition={{ duration: 0.5 }}
              />
              <Play className="w-5 h-5" />
              <span>Get Started Free</span>
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </motion.button>
          </motion.div>
        </motion.div>
      </div>

      {/* Bottom gradient fade */}
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-black to-transparent pointer-events-none" />
      
      {/* Custom styles for gradient animation */}
      <style>{`
        @keyframes gradient {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }
        .animate-gradient {
          background-size: 200% 200%;
          animation: gradient 3s ease infinite;
        }
      `}</style>
    </section>
  );
}

export default AsaasSection;
