import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { motion, useScroll, useTransform } from "framer-motion";
import { Sparkles, Video, ArrowRight, Brain, Database, Cpu, Activity, Network, CheckCircle2, Zap, TrendingUp, Play, ChevronRight, X, Star, Code, Layers } from "lucide-react";
import { Link } from "wouter";
import { logger } from "@/lib/logger";

export default function MotionDNAPage() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    city: '',
    role: '',
    message: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showVideoModal, setShowVideoModal] = useState(false);
  const { toast } = useToast();
  const { scrollYProgress } = useScroll();
  const y = useTransform(scrollYProgress, [0, 1], ['0%', '50%']);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    try {
      const webhookData = {
        type: 'motion_dna_beta_request',
        name: formData.name,
        email: formData.email,
        city: formData.city,
        role: formData.role,
        message: formData.message,
        timestamp: new Date().toISOString(),
        source: 'motion_dna_page'
      };

      const response = await fetch('https://hook.us2.make.com/vie6k5f6ryrv7fk5d51qqiu1msr49e0a', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(webhookData),
      });

      if (response.ok) {
        toast({
          title: "Application Submitted!",
          description: "We'll contact you soon with more information about Boostify MotionDNA.",
        });

        setFormData({
          name: '',
          email: '',
          city: '',
          role: '',
          message: ''
        });
      } else {
        throw new Error('Failed to submit application');
      }
    } catch (error) {
      logger.error('Error submitting beta form', { error });
      toast({
        title: "Error",
        description: "There was a problem submitting your application. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white overflow-x-hidden">
      {/* Navigation */}
      <nav className="border-b border-gray-800/50 bg-black/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <Link href="/" className="text-2xl font-black bg-gradient-to-r from-orange-500 via-pink-500 to-orange-500 bg-clip-text text-transparent">
            Boostify
          </Link>
          <div className="flex gap-6 items-center">
            <Link href="/music-video-creator" className="text-gray-400 hover:text-white transition-colors font-medium">
              Music Videos
            </Link>
            <Button
              size="sm"
              className="bg-gradient-to-r from-orange-600 to-pink-600 hover:from-orange-700 hover:to-pink-700 shadow-lg shadow-orange-600/30 hover:shadow-orange-600/50 transition-all"
              onClick={() => document.getElementById('beta-form')?.scrollIntoView({ behavior: 'smooth' })}
              data-testid="button-nav-beta"
            >
              <Sparkles className="h-3 w-3 mr-2" />
              Join Beta
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero Section - Improved */}
      <section className="relative min-h-screen flex items-center overflow-hidden">
        {/* Enhanced Animated Background */}
        <div className="absolute inset-0 -z-10">
          <motion.div style={{ y }} className="absolute inset-0">
            <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-orange-600/30 rounded-full blur-3xl animate-pulse" />
            <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-pink-600/30 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-purple-600/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '2s' }} />
          </motion.div>
          
          {/* Grid Pattern */}
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]" />
        </div>

        <div className="container mx-auto px-4 py-20 max-w-7xl relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="text-center mb-16"
          >
            {/* Launch Badge */}
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-gradient-to-r from-orange-600 via-pink-600 to-orange-600 text-white font-bold text-sm mb-8 shadow-2xl shadow-orange-600/50 border border-orange-400/20"
            >
              <Sparkles className="h-5 w-5 animate-pulse" />
              <span>Launching Q2 2026</span>
              <div className="absolute inset-0 rounded-full bg-gradient-to-r from-orange-600 to-pink-600 blur-xl opacity-50 -z-10" />
            </motion.div>

            {/* Main Title with Enhanced Typography */}
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="text-6xl sm:text-7xl md:text-9xl font-black mb-8 leading-none"
            >
              <span className="inline-block bg-gradient-to-r from-orange-500 via-pink-500 to-orange-500 bg-clip-text text-transparent drop-shadow-2xl">
                Boostify
              </span>
              <br />
              <span className="inline-block bg-gradient-to-r from-pink-400 via-orange-400 to-pink-400 bg-clip-text text-transparent">
                MotionDNA
              </span>
            </motion.h1>

            {/* Subtitle */}
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="text-2xl sm:text-3xl md:text-5xl text-gray-200 mb-6 font-light max-w-5xl mx-auto"
            >
              The Motion Model Trained on{' '}
              <span className="font-bold bg-gradient-to-r from-orange-500 to-pink-500 bg-clip-text text-transparent">
                +700 Real Music Videos
              </span>
            </motion.p>

            {/* Description */}
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="text-lg sm:text-xl text-gray-400 max-w-4xl mx-auto mb-12 leading-relaxed"
            >
              Transform any song into a professional video with real artist movements, natural choreography, 
              and stage energy… without filming a single take. The future of music video creation is here.
            </motion.p>

            {/* CTA Buttons - Enhanced */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
              className="flex flex-wrap justify-center gap-4 mb-20"
            >
              <Button
                size="lg"
                className="bg-gradient-to-r from-orange-600 to-pink-600 hover:from-orange-700 hover:to-pink-700 text-white text-lg px-10 py-8 shadow-2xl shadow-orange-600/50 hover:shadow-orange-600/70 transition-all group border border-orange-400/20"
                onClick={() => document.getElementById('beta-form')?.scrollIntoView({ behavior: 'smooth' })}
                data-testid="button-hero-beta"
              >
                <Sparkles className="h-5 w-5 mr-2 group-hover:rotate-12 transition-transform" />
                Join Early Access
                <ArrowRight className="h-5 w-5 ml-2 group-hover:translate-x-1 transition-transform" />
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="border-2 border-gray-700 hover:border-orange-600 bg-black/50 backdrop-blur text-white hover:bg-orange-600/10 text-lg px-10 py-8 transition-all group"
                onClick={() => setShowVideoModal(true)}
                data-testid="button-hero-learn"
              >
                <Play className="h-5 w-5 mr-2 group-hover:scale-110 transition-transform" />
                Watch Demo
              </Button>
            </motion.div>

            {/* Hero Image - Enhanced with Floating Effect */}
            <motion.div
              initial={{ opacity: 0, y: 60, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 1, delay: 0.7 }}
              className="relative max-w-6xl mx-auto"
            >
              <motion.div
                animate={{ y: [0, -20, 0] }}
                transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
                className="relative"
              >
                <div className="absolute -inset-4 bg-gradient-to-r from-orange-600/30 to-pink-600/30 rounded-3xl blur-3xl" />
                <div className="relative rounded-3xl overflow-hidden border-2 border-gray-800/50 shadow-2xl backdrop-blur">
                  <img 
                    src="/api/images/motion-dna/hero-launch" 
                    alt="MotionDNA Hero" 
                    className="w-full h-auto"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent" />
                </div>
              </motion.div>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Stats Section - Redesigned */}
      <section className="py-24 border-y border-gray-800/50 bg-gradient-to-b from-gray-950/50 via-black to-black relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-orange-900/5 via-transparent to-transparent" />
        <div className="container mx-auto px-4 relative z-10">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 max-w-6xl mx-auto">
            {[
              { icon: Database, value: "700+", label: "Music Videos Trained", color: "orange", gradient: "from-orange-500 to-amber-500" },
              { icon: Brain, value: "AI", label: "Powered Technology", color: "pink", gradient: "from-pink-500 to-rose-500" },
              { icon: Activity, value: "Real", label: "Artist Movements", color: "orange", gradient: "from-orange-500 to-red-500" },
              { icon: Cpu, value: "Q2 2026", label: "Launch Date", color: "pink", gradient: "from-pink-500 to-purple-500" }
            ].map((stat, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                whileHover={{ scale: 1.05, y: -5 }}
                className="text-center group cursor-default"
              >
                <div className="relative mb-6">
                  <div className={`absolute inset-0 bg-gradient-to-r ${stat.gradient} rounded-2xl blur-xl opacity-50 group-hover:opacity-75 transition-opacity`} />
                  <div className="relative bg-gradient-to-br from-gray-900 to-black border border-gray-800 group-hover:border-gray-700 rounded-2xl p-6 transition-all">
                    <stat.icon className={`h-12 w-12 mx-auto ${stat.color === 'orange' ? 'text-orange-500' : 'text-pink-500'}`} />
                  </div>
                </div>
                <div className={`text-5xl font-black mb-2 bg-gradient-to-r ${stat.gradient} bg-clip-text text-transparent`}>
                  {stat.value}
                </div>
                <div className="text-sm text-gray-400 font-medium">{stat.label}</div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Technology Core - Enhanced Layout */}
      <section className="py-32 relative">
        <div className="container mx-auto px-4 max-w-7xl">
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-20"
          >
            <div className="inline-block mb-6">
              <div className="flex items-center gap-2 px-5 py-2 rounded-full bg-gradient-to-r from-orange-600/20 to-pink-600/20 border border-orange-600/30 text-orange-500 font-semibold text-sm">
                <Code className="h-4 w-4" />
                <span>Core Technology</span>
              </div>
            </div>
            <h2 className="text-5xl sm:text-6xl md:text-7xl font-black mb-8 bg-gradient-to-r from-orange-500 via-pink-500 to-orange-500 bg-clip-text text-transparent leading-tight">
              Powered by AI Motion Technology
            </h2>
            <p className="text-xl text-gray-400 max-w-3xl mx-auto leading-relaxed">
              Our neural network analyzes thousands of professional music videos to understand 
              how real artists move, perform, and connect with their music.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 gap-10">
            {[
              {
                image: "/api/images/motion-dna/neural-network-core",
                title: "Neural Network Core",
                description: "Advanced AI brain that processes and learns movement patterns from professional performances",
                icon: Brain,
                color: "orange"
              },
              {
                image: "/api/images/motion-dna/motion-capture-hologram",
                title: "3D Motion Capture",
                description: "Holographic motion tracking that captures every nuance of artistic expression and movement",
                icon: Layers,
                color: "pink"
              }
            ].map((item, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: i === 0 ? -40 : 40 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                className="group relative"
              >
                <div className="relative rounded-3xl overflow-hidden border border-gray-800 hover:border-orange-600/50 transition-all duration-500 h-full">
                  <div className="relative aspect-video overflow-hidden">
                    <img 
                      src={item.image}
                      alt={item.title}
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent" />
                  </div>
                  <div className="relative bg-gradient-to-br from-gray-900 to-black p-8">
                    <div className={`inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-r ${item.color === 'orange' ? 'from-orange-600 to-amber-600' : 'from-pink-600 to-rose-600'} mb-4 shadow-lg`}>
                      <item.icon className="h-7 w-7 text-white" />
                    </div>
                    <h3 className="text-3xl font-bold text-white mb-3">{item.title}</h3>
                    <p className="text-gray-400 text-lg leading-relaxed">{item.description}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Movement Analysis - Card Grid */}
      <section className="py-32 bg-gradient-to-b from-black via-gray-950 to-black">
        <div className="container mx-auto px-4 max-w-7xl">
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-20"
          >
            <h2 className="text-5xl sm:text-6xl md:text-7xl font-black mb-8 bg-gradient-to-r from-orange-500 to-pink-500 bg-clip-text text-transparent">
              Intelligent Movement Analysis
            </h2>
            <p className="text-xl text-gray-400 max-w-3xl mx-auto">
              MotionDNA doesn't just copy movements—it understands rhythm, emotion, and performance style.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 gap-8">
            {[
              {
                image: "/api/images/motion-dna/motion-trails",
                title: "Motion Trail Analysis",
                description: "Captures the flow and energy of movements over time, creating natural and expressive choreography.",
                icon: Activity,
                gradient: "from-orange-600 to-amber-600"
              },
              {
                image: "/api/images/motion-dna/body-movement-analysis",
                title: "Pose Estimation",
                description: "Advanced body tracking maps every joint and limb position for realistic human-like movement.",
                icon: Network,
                gradient: "from-pink-600 to-rose-600"
              }
            ].map((item, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 40 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                whileHover={{ y: -8 }}
                className="group"
              >
                <Card className="bg-gradient-to-br from-gray-900 via-gray-900 to-black border-gray-800 hover:border-orange-600/50 p-0 overflow-hidden transition-all duration-500 h-full">
                  <div className="relative aspect-video overflow-hidden">
                    <img 
                      src={item.image}
                      alt={item.title}
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-transparent" />
                  </div>
                  <div className="p-8">
                    <div className={`inline-flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-r ${item.gradient} mb-4 shadow-lg`}>
                      <item.icon className="h-6 w-6 text-white" />
                    </div>
                    <h3 className="text-2xl font-bold text-white mb-3">{item.title}</h3>
                    <p className="text-gray-400 leading-relaxed">{item.description}</p>
                  </div>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Training & Dataset - 3 Column Grid */}
      <section className="py-32">
        <div className="container mx-auto px-4 max-w-7xl">
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-20"
          >
            <h2 className="text-5xl sm:text-6xl md:text-7xl font-black mb-8 bg-gradient-to-r from-orange-500 to-pink-500 bg-clip-text text-transparent">
              Trained on Real Music Videos
            </h2>
            <p className="text-xl text-gray-400 max-w-3xl mx-auto">
              Unlike generic AI models, MotionDNA was trained exclusively on professional music videos, 
              capturing the authentic movements and performance styles of real artists.
            </p>
          </motion.div>

          <div className="grid lg:grid-cols-3 gap-8">
            {[
              {
                image: "/api/images/motion-dna/training-lab",
                title: "AI Training Pipeline",
                description: "Massive datasets processed through state-of-the-art neural networks to learn movement intelligence.",
                gradient: "from-orange-600 to-amber-600"
              },
              {
                image: "/api/images/motion-dna/dataset-visualization",
                title: "700+ Video Dataset",
                description: "Thousands of frames from professional music videos form the foundation of our motion model.",
                gradient: "from-pink-600 to-rose-600"
              },
              {
                image: "/api/images/motion-dna/700-videos-collage",
                title: "Diverse Movement Styles",
                description: "From hip-hop to pop, reggaeton to rock—our model understands every genre's unique performance style.",
                gradient: "from-purple-600 to-pink-600"
              }
            ].map((item, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                whileHover={{ y: -10, scale: 1.02 }}
                className="group"
              >
                <Card className="bg-gradient-to-br from-gray-900 to-black border-gray-800 hover:border-orange-600/50 p-0 overflow-hidden h-full transition-all duration-500">
                  <div className="relative aspect-video overflow-hidden">
                    <img 
                      src={item.image}
                      alt={item.title}
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                    />
                    <div className={`absolute inset-0 bg-gradient-to-t from-black via-black/70 to-transparent`} />
                  </div>
                  <div className="p-6">
                    <div className={`inline-block px-3 py-1 rounded-full bg-gradient-to-r ${item.gradient} text-white text-xs font-bold mb-3`}>
                      PREMIUM
                    </div>
                    <h3 className="text-xl font-bold text-white mb-3">{item.title}</h3>
                    <p className="text-gray-400 text-sm leading-relaxed">{item.description}</p>
                  </div>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Architecture - Side by Side */}
      <section className="py-32 bg-gradient-to-b from-black to-gray-950 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-pink-900/10 via-transparent to-transparent" />
        <div className="container mx-auto px-4 max-w-7xl relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-20"
          >
            <h2 className="text-5xl sm:text-6xl md:text-7xl font-black mb-8 bg-gradient-to-r from-orange-500 to-pink-500 bg-clip-text text-transparent">
              Advanced System Architecture
            </h2>
            <p className="text-xl text-gray-400 max-w-3xl mx-auto">
              A powerful backend engine processes your music and generates realistic choreography in real-time.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 gap-10">
            {[
              { image: "/api/images/motion-dna/architecture-diagram", title: "System Architecture" },
              { image: "/api/images/motion-dna/ai-engine", title: "AI Processing Engine" }
            ].map((item, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: i === 0 ? -40 : 40 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                className="relative group"
              >
                <div className="absolute -inset-1 bg-gradient-to-r from-orange-600 to-pink-600 rounded-3xl blur-xl opacity-25 group-hover:opacity-50 transition-opacity" />
                <div className="relative rounded-3xl overflow-hidden border border-gray-800 group-hover:border-orange-600/50 transition-all">
                  <img 
                    src={item.image}
                    alt={item.title}
                    className="w-full h-auto group-hover:scale-105 transition-transform duration-700"
                  />
                  <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black via-black/90 to-transparent">
                    <h3 className="text-2xl font-bold text-white">{item.title}</h3>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Output Examples */}
      <section className="py-32">
        <div className="container mx-auto px-4 max-w-7xl">
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-20"
          >
            <h2 className="text-5xl sm:text-6xl md:text-7xl font-black mb-8 bg-gradient-to-r from-orange-500 to-pink-500 bg-clip-text text-transparent">
              Generate Professional Choreography
            </h2>
            <p className="text-xl text-gray-400 max-w-3xl mx-auto">
              Watch MotionDNA transform static images into dynamic performances with natural movement and stage presence.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 gap-8">
            {[
              {
                image: "/api/images/motion-dna/choreography-output",
                title: "AI-Generated Movement",
                description: "Natural choreography with motion trails showing the flow of performance energy.",
                badge: "Real-time"
              },
              {
                image: "/api/images/motion-dna/virtual-avatar",
                title: "Virtual Performance",
                description: "Full-body avatars performing with UI controls for customization and adjustments.",
                badge: "Interactive"
              }
            ].map((item, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 40 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                whileHover={{ scale: 1.02 }}
                className="group"
              >
                <Card className="bg-gradient-to-br from-gray-900 to-black border-gray-800 hover:border-orange-600/50 p-0 overflow-hidden transition-all duration-500">
                  <div className="relative aspect-video overflow-hidden">
                    <img 
                      src={item.image}
                      alt={item.title}
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                    />
                    <div className="absolute top-4 right-4">
                      <span className="px-4 py-2 rounded-full bg-gradient-to-r from-orange-600 to-pink-600 text-white text-xs font-bold shadow-lg">
                        {item.badge}
                      </span>
                    </div>
                  </div>
                  <div className="p-8">
                    <h3 className="text-2xl font-bold text-white mb-3">{item.title}</h3>
                    <p className="text-gray-400 leading-relaxed">{item.description}</p>
                  </div>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works - Timeline Style */}
      <section className="py-32 bg-gradient-to-b from-gray-950 to-black">
        <div className="container mx-auto px-4 max-w-7xl">
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-20"
          >
            <h2 className="text-5xl sm:text-6xl md:text-7xl font-black mb-8 bg-gradient-to-r from-orange-500 to-pink-500 bg-clip-text text-transparent">
              How MotionDNA Works
            </h2>
            <p className="text-xl text-gray-400 max-w-3xl mx-auto">
              From your song to a professional music video in 5 simple steps
            </p>
          </motion.div>

          <div className="max-w-5xl mx-auto space-y-6">
            {[
              {
                step: "01",
                title: "Upload Your Audio",
                description: "Upload your song and let our AI analyze the rhythm, tempo, and musical structure.",
                icon: Zap
              },
              {
                step: "02",
                title: "Choose Movement Style",
                description: "Select from various performance styles: energetic dance, chill vibes, stage performance, or let AI decide.",
                icon: Activity
              },
              {
                step: "03",
                title: "AI Processes & Generates",
                description: "MotionDNA analyzes your music and creates natural choreography matching the song's energy.",
                icon: Brain
              },
              {
                step: "04",
                title: "Customize & Refine",
                description: "Adjust camera angles, movement intensity, and visual effects to match your vision.",
                icon: TrendingUp
              },
              {
                step: "05",
                title: "Export & Share",
                description: "Download your professional music video ready for YouTube, Instagram, TikTok, and more.",
                icon: CheckCircle2
              }
            ].map((item, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -40 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                whileHover={{ x: 10 }}
                className="group"
              >
                <Card className="bg-gradient-to-br from-gray-900 to-black border-gray-800 hover:border-orange-600/50 p-8 transition-all duration-300 cursor-default">
                  <div className="flex items-center gap-6">
                    <div className="flex-shrink-0">
                      <div className="relative">
                        <div className="absolute inset-0 bg-gradient-to-r from-orange-600 to-pink-600 rounded-2xl blur-xl opacity-50" />
                        <div className="relative w-20 h-20 rounded-2xl bg-gradient-to-r from-orange-600 to-pink-600 flex items-center justify-center text-3xl font-black shadow-lg">
                          {item.step}
                        </div>
                      </div>
                    </div>
                    <div className="flex-grow">
                      <div className="flex items-center gap-3 mb-2">
                        <item.icon className="h-7 w-7 text-orange-500" />
                        <h3 className="text-2xl font-bold text-white">{item.title}</h3>
                      </div>
                      <p className="text-gray-400 text-lg leading-relaxed">{item.description}</p>
                    </div>
                    <ChevronRight className="h-8 w-8 text-gray-600 group-hover:text-orange-500 flex-shrink-0 transition-colors" />
                  </div>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Premium Visuals - Full Width Gallery */}
      <section className="py-32 bg-black">
        <div className="container mx-auto px-4 max-w-7xl">
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl sm:text-5xl md:text-6xl font-black mb-6 bg-gradient-to-r from-orange-500 to-pink-500 bg-clip-text text-transparent">
              Premium Visual Quality
            </h2>
          </motion.div>

          <div className="grid md:grid-cols-2 gap-8">
            {[
              { image: "/api/images/motion-dna/holographic-dancer-crystal", title: "Holographic Performance" },
              { image: "/api/images/motion-dna/glass-orb-motion", title: "Motion Dynamics" }
            ].map((item, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, scale: 0.95 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                whileHover={{ scale: 1.02 }}
                className="relative group rounded-3xl overflow-hidden"
              >
                <div className="absolute -inset-1 bg-gradient-to-r from-orange-600 to-pink-600 rounded-3xl blur-2xl opacity-25 group-hover:opacity-50 transition-opacity" />
                <div className="relative rounded-3xl overflow-hidden border border-gray-800">
                  <img 
                    src={item.image}
                    alt={item.title}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="absolute bottom-0 left-0 right-0 p-8">
                      <h3 className="text-3xl font-bold text-white">{item.title}</h3>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Beta Access Form - Enhanced */}
      <section id="beta-form" className="py-32 bg-gradient-to-b from-black via-gray-950 to-black scroll-mt-20 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-orange-900/10 via-transparent to-transparent" />
        <div className="container mx-auto px-4 max-w-7xl relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <div className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-gradient-to-r from-orange-600/30 to-pink-600/30 border border-orange-600/50 text-orange-400 font-bold text-sm mb-8">
              <Sparkles className="h-4 w-4" />
              Launching Q2 2026
            </div>
            <h2 className="text-5xl sm:text-6xl md:text-7xl font-black mb-8 bg-gradient-to-r from-orange-500 to-pink-500 bg-clip-text text-transparent leading-tight">
              Join the First Generation
            </h2>
            <p className="text-xl text-gray-400 max-w-3xl mx-auto leading-relaxed">
              We're opening a <span className="font-semibold text-white">closed beta</span> for a limited group of artists, 
              producers, directors, managers and labels who want to use this revolutionary technology before anyone else.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="max-w-2xl mx-auto"
          >
            <div className="relative">
              <div className="absolute -inset-4 bg-gradient-to-r from-orange-600/30 to-pink-600/30 rounded-3xl blur-2xl" />
              <Card className="relative bg-gradient-to-br from-gray-900 via-black to-gray-900 border-orange-600/50 p-10 shadow-2xl">
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div>
                    <Label htmlFor="name" className="text-gray-200 text-base font-medium mb-2 block">Name / Artist Name</Label>
                    <Input
                      id="name"
                      name="name"
                      type="text"
                      placeholder="Your name or artist name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                      className="bg-black/50 border-gray-700 focus:border-orange-600 text-white text-base py-6 rounded-xl"
                      data-testid="input-name"
                    />
                  </div>

                  <div>
                    <Label htmlFor="email" className="text-gray-200 text-base font-medium mb-2 block">Email</Label>
                    <Input
                      id="email"
                      name="email"
                      type="email"
                      placeholder="your@email.com"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      required
                      className="bg-black/50 border-gray-700 focus:border-orange-600 text-white text-base py-6 rounded-xl"
                      data-testid="input-email"
                    />
                  </div>

                  <div>
                    <Label htmlFor="city" className="text-gray-200 text-base font-medium mb-2 block">Country / City</Label>
                    <Input
                      id="city"
                      name="city"
                      type="text"
                      placeholder="e.g. Miami, FL – USA"
                      value={formData.city}
                      onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                      className="bg-black/50 border-gray-700 focus:border-orange-600 text-white text-base py-6 rounded-xl"
                      data-testid="input-city"
                    />
                  </div>

                  <div>
                    <Label htmlFor="role" className="text-gray-200 text-base font-medium mb-2 block">Role</Label>
                    <Select
                      value={formData.role}
                      onValueChange={(value) => setFormData({ ...formData, role: value })}
                    >
                      <SelectTrigger className="bg-black/50 border-gray-700 focus:border-orange-600 text-white text-base py-6 rounded-xl" data-testid="select-role">
                        <SelectValue placeholder="Select your role" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="artist">Artist</SelectItem>
                        <SelectItem value="producer">Producer</SelectItem>
                        <SelectItem value="director">Director / Creative</SelectItem>
                        <SelectItem value="manager">Manager</SelectItem>
                        <SelectItem value="label">Record Label</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="message" className="text-gray-200 text-base font-medium mb-2 block">Tell us about your project (optional)</Label>
                    <Textarea
                      id="message"
                      name="message"
                      rows={4}
                      placeholder="Share your vision or the type of videos you want to create with MotionDNA..."
                      value={formData.message}
                      onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                      className="bg-black/50 border-gray-700 focus:border-orange-600 text-white text-base rounded-xl"
                      data-testid="textarea-message"
                    />
                  </div>

                  <Button
                    type="submit"
                    size="lg"
                    disabled={isSubmitting}
                    className="w-full bg-gradient-to-r from-orange-600 to-pink-600 hover:from-orange-700 hover:to-pink-700 text-white text-lg py-8 shadow-2xl shadow-orange-600/50 hover:shadow-orange-600/70 disabled:opacity-50 disabled:cursor-not-allowed transition-all rounded-xl group"
                    data-testid="button-submit-beta"
                  >
                    <Sparkles className={`h-5 w-5 mr-2 ${isSubmitting ? 'animate-spin' : 'group-hover:rotate-12'} transition-transform`} />
                    {isSubmitting ? 'Submitting...' : 'Request Beta Access'}
                    {!isSubmitting && <ArrowRight className="h-5 w-5 ml-2 group-hover:translate-x-1 transition-transform" />}
                  </Button>
                  
                  <p className="text-sm text-gray-500 text-center pt-2">
                    Limited spots. We'll select projects that best fit Boostify's roadmap.<br />
                    <span className="text-orange-500 font-semibold">Available Q2 2026</span>
                  </p>
                </form>
              </Card>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Footer - Enhanced */}
      <footer className="border-t border-gray-800/50 py-12 bg-black">
        <div className="container mx-auto px-4 text-center">
          <div className="mb-6">
            <span className="text-2xl font-black bg-gradient-to-r from-orange-500 to-pink-500 bg-clip-text text-transparent">
              Boostify MotionDNA
            </span>
          </div>
          <p className="text-sm text-gray-500 mb-4">
            A project by <span className="font-semibold text-gray-400">Boostify Music</span>
          </p>
          <p className="text-sm text-gray-600">
            Created by Neiver Alvarez, CEO Metafeed APPS · Tel: +1 (786) 543 2478 · 
            Ecosystem: <a href="https://www.autoleadsx.com" target="_blank" rel="noopener noreferrer" className="text-orange-500 hover:text-orange-400 transition-colors font-medium">www.autoleadsx.com</a>
          </p>
        </div>
      </footer>

      {/* Video Demo Modal */}
      <Dialog open={showVideoModal} onOpenChange={setShowVideoModal}>
        <DialogContent className="max-w-2xl w-full bg-black border-orange-600/50 p-0 rounded-3xl overflow-hidden">
          <DialogHeader className="sr-only">
            <DialogTitle>Boostify MotionDNA Demo Video</DialogTitle>
          </DialogHeader>
          <div className="relative">
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-4 right-4 z-10 bg-black/70 hover:bg-black/90 text-white rounded-full backdrop-blur"
              onClick={() => setShowVideoModal(false)}
            >
              <X className="h-4 w-4" />
            </Button>
            <div className="w-full bg-black rounded-3xl overflow-hidden" style={{ aspectRatio: '9/16' }}>
              <iframe
                className="w-full h-full"
                src="https://app.heygen.com/embedded-player/7bddaadc9d474b65b77d97d781f7429a"
                title="HeyGen video player"
                frameBorder="0"
                allow="encrypted-media; fullscreen;"
                allowFullScreen
              />
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
