import { useState } from "react";
import { logger } from "@/lib/logger";
import { Button } from "../ui/button";
import { Card } from "../ui/card";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { motion, useScroll, useTransform } from "framer-motion";
import { Sparkles, Video, Users, Zap, TrendingUp, CheckCircle2, Database, Cpu, Activity, Network, Brain, Play, X } from "lucide-react";
import aiMotionVizImage from "../../../../attached_assets/generated_images/AI_motion_capture_visualization_c0ac82f5.png";
import aiTrainingImage from "../../../../attached_assets/generated_images/AI_training_process_diagram_b2342b3f.png";
import danceAnalysisImage from "../../../../attached_assets/generated_images/Dance_movement_analysis_visualization_ea1514ba.png";

export function MotionDNASection() {
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
        source: 'music_video_creator_section'
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
      logger.error('Error submitting form:', error);
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
    <div className="w-full bg-gradient-to-b from-background via-black/95 to-background py-16 sm:py-24 overflow-hidden">
      <div className="container mx-auto px-4 max-w-7xl">
        {/* Animated Hero */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="relative mb-20"
        >
          {/* Animated background gradient */}
          <div className="absolute inset-0 -z-10">
            <motion.div
              className="absolute top-0 left-1/4 w-96 h-96 bg-orange-600/20 rounded-full blur-3xl"
              animate={{
                scale: [1, 1.2, 1],
                opacity: [0.3, 0.5, 0.3],
              }}
              transition={{
                duration: 8,
                repeat: Infinity,
                ease: "easeInOut"
              }}
            />
            <motion.div
              className="absolute bottom-0 right-1/4 w-96 h-96 bg-pink-600/20 rounded-full blur-3xl"
              animate={{
                scale: [1.2, 1, 1.2],
                opacity: [0.5, 0.3, 0.5],
              }}
              transition={{
                duration: 8,
                repeat: Infinity,
                ease: "easeInOut"
              }}
            />
          </div>

          <div className="text-center mb-12">
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              whileInView={{ scale: 1, opacity: 1 }}
              viewport={{ once: true }}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-gradient-to-r from-orange-600 to-pink-600 text-white font-bold text-sm mb-6 shadow-lg shadow-orange-600/50"
            >
              <Sparkles className="h-5 w-5 animate-pulse" />
              Coming Q2 2026
            </motion.div>
            
            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2 }}
              className="text-4xl sm:text-5xl md:text-7xl font-black mb-6 bg-gradient-to-r from-orange-500 via-pink-500 to-orange-500 bg-clip-text text-transparent leading-tight"
            >
              Boostify MotionDNA
            </motion.h2>
            
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.3 }}
              className="text-xl sm:text-2xl md:text-3xl text-gray-300 mb-4 font-light"
            >
              The Motion Model Trained on <span className="text-orange-500 font-bold">+700 Real Music Videos</span>
            </motion.p>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.4 }}
              className="text-base sm:text-lg text-gray-400 max-w-4xl mx-auto mb-8"
            >
              Transform any song into a video with real artist movements, natural choreography, and stage energy… without filming a single take.
            </motion.p>

            {/* Stats Grid with Icons */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.5 }}
              className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto mb-12"
            >
              {[
                { icon: Database, value: "700+", label: "Music Videos", color: "orange" },
                { icon: Brain, value: "AI", label: "Powered", color: "pink" },
                { icon: Activity, value: "Real", label: "Movements", color: "orange" },
                { icon: Cpu, value: "Q2 2026", label: "Launch", color: "pink" }
              ].map((stat, i) => (
                <motion.div
                  key={i}
                  whileHover={{ scale: 1.05 }}
                  className="bg-gradient-to-br from-gray-900 to-black border border-gray-800 rounded-xl p-4 hover:border-orange-600/50 transition-all"
                >
                  <stat.icon className={`h-8 w-8 mx-auto mb-2 ${stat.color === 'orange' ? 'text-orange-500' : 'text-pink-500'}`} />
                  <div className="text-2xl font-bold text-white">{stat.value}</div>
                  <div className="text-sm text-gray-400">{stat.label}</div>
                </motion.div>
              ))}
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.6 }}
              className="flex flex-wrap justify-center gap-4"
            >
              <Button
                size="lg"
                className="bg-gradient-to-r from-orange-600 to-pink-600 hover:from-orange-700 hover:to-pink-700 text-white text-lg px-8 py-6 shadow-lg shadow-orange-600/50 hover:shadow-xl hover:shadow-orange-600/70 transition-all"
                onClick={() => document.getElementById('beta-form')?.scrollIntoView({ behavior: 'smooth' })}
                data-testid="button-join-early-access"
              >
                <Sparkles className="h-5 w-5 mr-2" />
                Join Early Access
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="border-2 border-orange-600 text-orange-500 hover:bg-orange-600/10 text-lg px-8 py-6"
                onClick={() => setShowVideoModal(true)}
                data-testid="button-view-demo"
              >
                <Play className="h-5 w-5 mr-2" />
                Watch Demo
              </Button>
            </motion.div>
          </div>
        </motion.div>

        {/* Visual Showcase with Generated Images */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-20"
        >
          {[
            { img: aiMotionVizImage, title: "Motion Capture AI", desc: "Advanced neural networks analyze real artist performances" },
            { img: aiTrainingImage, title: "Training Pipeline", desc: "700+ music videos transformed into movement patterns" },
            { img: danceAnalysisImage, title: "Real-Time Analysis", desc: "Instant motion generation synced to your music" }
          ].map((item, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              whileHover={{ y: -8, scale: 1.02 }}
              className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-gray-900 to-black border border-gray-800 hover:border-orange-600/50 transition-all"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-orange-600/20 to-pink-600/20 opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="relative aspect-video overflow-hidden">
                <img 
                  src={item.img} 
                  alt={item.title}
                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                />
              </div>
              <div className="p-6 relative">
                <h3 className="text-xl font-bold text-white mb-2">{item.title}</h3>
                <p className="text-gray-400 text-sm">{item.desc}</p>
              </div>
            </motion.div>
          ))}
        </motion.div>

        {/* What is MotionDNA */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-20"
        >
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <h3 className="text-3xl sm:text-4xl font-bold mb-6 bg-gradient-to-r from-orange-500 to-pink-500 bg-clip-text text-transparent">
                What is Boostify MotionDNA?
              </h3>
              <div className="space-y-4 text-gray-300 text-lg">
                <p>
                  Boostify MotionDNA is the <span className="text-orange-500 font-semibold">official motion capture model of Boostify</span>, trained on over 700 music videos filmed in real productions.
                </p>
                <p>
                  Instead of generating static images, MotionDNA focuses on something even more valuable: <span className="font-semibold text-white">movement</span>.
                </p>
              </div>
            </div>
            
            <Card className="bg-gradient-to-br from-gray-900 to-black border-orange-600/30 p-8">
              <ul className="space-y-4">
                {[
                  { icon: Activity, text: "How an artist moves on stage" },
                  { icon: Zap, text: "How choreography breathes" },
                  { icon: Video, text: "How a camera follows the performance" }
                ].map((item, i) => (
                  <motion.li
                    key={i}
                    initial={{ opacity: 0, x: -20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.1 }}
                    className="flex items-start gap-3"
                  >
                    <item.icon className="h-6 w-6 text-orange-500 flex-shrink-0 mt-1" />
                    <span className="text-gray-300 text-lg">{item.text}</span>
                  </motion.li>
                ))}
              </ul>
              <p className="text-gray-400 mt-6 pt-6 border-t border-gray-800">
                All this knowledge becomes a <span className="font-semibold text-white">proprietary motion model</span> that Boostify applies to your AI-generated videos, making them look like music videos directed by real professionals, not generic algorithms.
              </p>
            </Card>
          </div>
        </motion.div>

        {/* Built For */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-20"
        >
          <h3 className="text-3xl sm:text-4xl font-bold mb-8 text-center bg-gradient-to-r from-orange-500 to-pink-500 bg-clip-text text-transparent">
            Built for Artists, Directors & Labels Who Want More Than Templates
          </h3>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { icon: Users, title: "Independent Artists", desc: "Get music videos with real stage presence" },
              { icon: Video, title: "Music Producers", desc: "Constant visual content without 20 shoots per month" },
              { icon: Zap, title: "Directors & Creatives", desc: "Use AI without losing professional video language" },
              { icon: TrendingUp, title: "Labels & Managers", desc: "Standardize visual quality with automated workflows" }
            ].map((item, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 40 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                whileHover={{ y: -8 }}
              >
                <Card className="bg-gradient-to-br from-gray-900 to-black border-gray-800 hover:border-orange-600/50 p-6 h-full transition-all">
                  <item.icon className="h-12 w-12 text-orange-500 mb-4" />
                  <h4 className="font-bold text-white mb-2 text-lg">{item.title}</h4>
                  <p className="text-gray-400 text-sm">{item.desc}</p>
                </Card>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* How It Works - Animated Steps */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-20"
        >
          <h3 className="text-3xl sm:text-4xl font-bold mb-4 text-center bg-gradient-to-r from-orange-500 to-pink-500 bg-clip-text text-transparent">
            How Boostify MotionDNA Works
          </h3>
          <p className="text-gray-300 mb-12 text-center text-lg max-w-3xl mx-auto">
            The workflow is simple. We handle the technical complexity, you focus on music and creativity.
          </p>
          
          <div className="relative">
            {/* Connection line */}
            <div className="hidden md:block absolute top-1/2 left-0 right-0 h-1 bg-gradient-to-r from-orange-600 via-pink-600 to-orange-600 -z-10" />
            
            <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
              {[
                { num: "1", title: "Analyze Music", desc: "Upload your song. System analyzes tempo, energy, structure", icon: Activity },
                { num: "2", title: "Select MotionDNA", desc: "Boostify chooses movement profile based on your style", icon: Brain },
                { num: "3", title: "Generate Movements", desc: "AI creates timeline of poses, intensities, camera angles", icon: Network },
                { num: "4", title: "Apply to Video", desc: "Motion skeleton applied to your AI-generated clips", icon: Video },
                { num: "5", title: "Fine-tune & Export", desc: "Adjust intensity, speed, camera. Export ready to publish", icon: CheckCircle2 }
              ].map((step, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, scale: 0.8 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.15 }}
                  whileHover={{ scale: 1.05 }}
                  className="relative"
                >
                  <Card className="bg-gradient-to-br from-gray-900 to-black border-gray-800 hover:border-orange-600/50 p-6 h-full transition-all relative overflow-hidden group">
                    <div className="absolute inset-0 bg-gradient-to-br from-orange-600/0 to-pink-600/0 group-hover:from-orange-600/10 group-hover:to-pink-600/10 transition-all" />
                    <div className="relative">
                      <div className="flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-r from-orange-600 to-pink-600 text-white font-bold text-2xl mb-4 mx-auto">
                        {step.num}
                      </div>
                      <step.icon className="h-8 w-8 text-orange-500 mb-3 mx-auto" />
                      <h4 className="font-bold text-white mb-2 text-center">{step.title}</h4>
                      <p className="text-gray-400 text-sm text-center">{step.desc}</p>
                    </div>
                  </Card>
                </motion.div>
              ))}
            </div>
          </div>
        </motion.div>

        {/* Unique Features */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-20"
        >
          <h3 className="text-3xl sm:text-4xl font-bold mb-8 text-center bg-gradient-to-r from-orange-500 to-pink-500 bg-clip-text text-transparent">
            What Makes Boostify MotionDNA Unique
          </h3>
          <Card className="bg-gradient-to-br from-gray-900 to-black border-orange-600/30 p-8">
            <div className="grid md:grid-cols-2 gap-6">
              {[
                { title: "Trained on Real Productions", desc: "700+ professional music videos as foundation" },
                { title: "Music Video Language", desc: "Patterns learned from real artists on stage, not templates" },
                { title: "Genre Adaptive", desc: "Rock, urban, pop, bachata, salsa, electronic & more" },
                { title: "Modern AI Ready", desc: "Integrates with text-to-video, image-to-video & avatars" },
                { title: "Brand Consistency", desc: "Define movement lines to maintain personality across videos" },
                { title: "Proprietary Dataset", desc: "Impossible to replicate with generic datasets" }
              ].map((item, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: i % 2 === 0 ? -20 : 20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1 }}
                  className="flex items-start gap-3"
                >
                  <CheckCircle2 className="h-6 w-6 text-orange-500 flex-shrink-0 mt-1" />
                  <div>
                    <span className="font-semibold text-white text-lg">{item.title}:</span>
                    <span className="text-gray-400"> {item.desc}</span>
                  </div>
                </motion.div>
              ))}
            </div>
          </Card>
        </motion.div>

        {/* Use Cases */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-20"
        >
          <h3 className="text-3xl sm:text-4xl font-bold mb-8 text-center bg-gradient-to-r from-orange-500 to-pink-500 bg-clip-text text-transparent">
            What You Can Create with MotionDNA
          </h3>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              "Complete AI-generated music videos with real artist movements",
              "Visualizers and loops with expressive motion for Spotify, YouTube, TikTok",
              "Lyric videos with live camera and dynamic scenes",
              "Social media content (shorts, reels, stories) with choreography hooks",
              "Creative experiments combining different movement styles",
              "Performance videos without expensive production costs"
            ].map((useCase, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                whileHover={{ scale: 1.05 }}
              >
                <Card className="bg-gradient-to-br from-gray-900 to-black border-gray-800 hover:border-orange-600/50 p-6 h-full transition-all">
                  <div className="flex items-start gap-3">
                    <Video className="h-6 w-6 text-orange-500 flex-shrink-0 mt-1" />
                    <span className="text-gray-300">{useCase}</span>
                  </div>
                </Card>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Beta Form */}
        <motion.div
          id="beta-form"
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-12 scroll-mt-20"
        >
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-orange-600/20 border border-orange-600/50 text-orange-500 font-semibold text-sm mb-4">
              <Sparkles className="h-4 w-4" />
              Launching Q2 2026
            </div>
            <h3 className="text-3xl sm:text-4xl font-bold mb-4 bg-gradient-to-r from-orange-500 to-pink-500 bg-clip-text text-transparent">
              Join the First Generation of Artists with MotionDNA
            </h3>
            <p className="text-gray-300 text-lg max-w-3xl mx-auto">
              We're opening a <span className="font-semibold text-white">closed beta</span> for a limited group of artists,
              producers, directors, managers and labels who want to use this model before anyone else and help us refine the system.
            </p>
          </div>

          <Card className="bg-gradient-to-br from-black to-gray-950 border-orange-600/50 p-8 max-w-2xl mx-auto shadow-2xl shadow-orange-600/20">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <Label htmlFor="name" className="text-gray-200 text-base">Name / Artist Name</Label>
                <Input
                  id="name"
                  name="name"
                  type="text"
                  placeholder="Your name or artist name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  className="bg-black/50 border-gray-700 focus:border-orange-600 text-white text-base py-6"
                  data-testid="input-name"
                />
              </div>

              <div>
                <Label htmlFor="email" className="text-gray-200 text-base">Email</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="your@email.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                  className="bg-black/50 border-gray-700 focus:border-orange-600 text-white text-base py-6"
                  data-testid="input-email"
                />
              </div>

              <div>
                <Label htmlFor="city" className="text-gray-200 text-base">Country / City</Label>
                <Input
                  id="city"
                  name="city"
                  type="text"
                  placeholder="e.g. Miami, FL – USA"
                  value={formData.city}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  className="bg-black/50 border-gray-700 focus:border-orange-600 text-white text-base py-6"
                  data-testid="input-city"
                />
              </div>

              <div>
                <Label htmlFor="role" className="text-gray-200 text-base">Role</Label>
                <Select
                  value={formData.role}
                  onValueChange={(value) => setFormData({ ...formData, role: value })}
                >
                  <SelectTrigger className="bg-black/50 border-gray-700 focus:border-orange-600 text-white text-base py-6" data-testid="select-role">
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
                <Label htmlFor="message" className="text-gray-200 text-base">Tell us about your project (optional)</Label>
                <Textarea
                  id="message"
                  name="message"
                  rows={4}
                  placeholder="Share your vision or the type of videos you want to create with MotionDNA..."
                  value={formData.message}
                  onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                  className="bg-black/50 border-gray-700 focus:border-orange-600 text-white text-base"
                  data-testid="textarea-message"
                />
              </div>

              <Button
                type="submit"
                size="lg"
                disabled={isSubmitting}
                className="w-full bg-gradient-to-r from-orange-600 to-pink-600 hover:from-orange-700 hover:to-pink-700 text-white text-lg py-7 shadow-lg shadow-orange-600/50 hover:shadow-xl hover:shadow-orange-600/70 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                data-testid="button-submit-beta"
              >
                <Sparkles className={`h-5 w-5 mr-2 ${isSubmitting ? 'animate-spin' : ''}`} />
                {isSubmitting ? 'Submitting...' : 'Request Beta Access'}
              </Button>
              
              <p className="text-sm text-gray-500 text-center pt-2">
                Limited spots. We'll select projects that best fit Boostify's roadmap.<br />
                <span className="text-orange-500 font-semibold">Available Q2 2026</span>
              </p>
            </form>
          </Card>
        </motion.div>

        {/* Footer */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="border-t border-gray-800 pt-8 text-center"
        >
          <p className="text-sm text-gray-500">
            Boostify MotionDNA is a project by <span className="font-semibold text-gray-400">Boostify Music</span> · 
            Created by Neiver Alvarez, CEO Metafeed APPS · 
            Tel: +1 (786) 543 2478 · 
            Ecosystem: <a href="https://www.autoleadsx.com" target="_blank" rel="noopener noreferrer" className="text-orange-500 hover:text-orange-400 transition-colors">www.autoleadsx.com</a>
          </p>
        </motion.div>
      </div>

      {/* Video Demo Modal */}
      <Dialog open={showVideoModal} onOpenChange={setShowVideoModal}>
        <DialogContent className="max-w-2xl w-full bg-black border-orange-600/50 p-0">
          <DialogHeader className="sr-only">
            <DialogTitle>Boostify MotionDNA Demo Video</DialogTitle>
          </DialogHeader>
          <div className="relative">
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-2 right-2 z-10 bg-black/50 hover:bg-black/70 text-white rounded-full"
              onClick={() => setShowVideoModal(false)}
            >
              <X className="h-4 w-4" />
            </Button>
            <div className="w-full bg-black rounded-lg overflow-hidden" style={{ aspectRatio: '9/16' }}>
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
