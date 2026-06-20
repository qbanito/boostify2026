import { Header } from "../components/layout/header";
import { motion } from "framer-motion";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Card, CardContent } from "../components/ui/card";
import { 
  Sparkles, 
  ShoppingCart, 
  Zap, 
  Shield, 
  DollarSign, 
  Users, 
  TrendingUp,
  Calendar,
  ArrowRight,
  Star,
  Cpu,
  Image as ImageIcon
} from "lucide-react";

const heroImage = "/images/AI_influencer_hero_image_0af5142f.png";
const marketplaceImage = "/images/Marketplace_visualization_concept_77d2bbde.png";
const aiProcessImage = "/images/AI_generation_process_visual_35b62c25.png";

export default function BoostifyExplicitPage() {
  return (
    <div className="min-h-screen bg-black">
      <Header />
      
      {/* Hero Section */}
      <section className="relative overflow-hidden pt-20">
        <div className="absolute inset-0 bg-gradient-to-br from-orange-600/20 via-black to-black" />
        <div 
          className="absolute inset-0 opacity-30"
          style={{
            backgroundImage: `url(${heroImage})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            filter: 'blur(2px)'
          }}
        />
        
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 lg:py-32">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center"
          >
            <Badge className="mb-6 bg-orange-600 hover:bg-orange-700 text-white border-orange-500 text-lg px-6 py-2">
              <Calendar className="w-4 h-4 mr-2" />
              Coming Soon - January 2026
            </Badge>
            
            <h1 className="text-5xl lg:text-7xl font-bold mb-6 bg-gradient-to-r from-orange-500 via-orange-400 to-orange-600 bg-clip-text text-transparent">
              Boostify Explicit
            </h1>
            
            <p className="text-2xl lg:text-3xl text-orange-100 mb-4 font-light">
              AI-Powered Digital Influencer Platform
            </p>
            
            <p className="text-lg text-gray-300 mb-8 max-w-3xl mx-auto">
              Create and monetize AI-generated digital influencers for adult content platforms. 
              Maintain your privacy while maximizing your earning potential.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <Button 
                size="lg" 
                className="bg-orange-600 hover:bg-orange-700 text-white text-lg px-8 py-6"
                data-testid="button-notify-launch"
              >
                <Star className="w-5 h-5 mr-2" />
                Notify Me at Launch
              </Button>
              
              <Button 
                size="lg" 
                variant="outline" 
                className="border-orange-600 text-orange-500 hover:bg-orange-600/10 text-lg px-8 py-6"
                data-testid="button-learn-more"
              >
                Learn More
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* What is Boostify Explicit */}
      <section className="py-20 bg-gradient-to-b from-black to-gray-950">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl lg:text-5xl font-bold mb-6 text-white">
              What is <span className="text-orange-500">Boostify Explicit</span>?
            </h2>
            <p className="text-xl text-gray-300 max-w-3xl mx-auto">
              The revolutionary platform that allows artists and content creators to generate AI-powered 
              digital personas for explicit content platforms without compromising their real identity.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 gap-12 items-center">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
            >
              <img 
                src={aiProcessImage} 
                alt="AI Generation Process" 
                className="rounded-2xl shadow-2xl border-2 border-orange-600/30"
              />
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="space-y-6"
            >
              <Card className="bg-gray-900 border-orange-600/20 hover:border-orange-600/50 transition-all">
                <CardContent className="p-6">
                  <Cpu className="w-12 h-12 text-orange-500 mb-4" />
                  <h3 className="text-2xl font-bold text-white mb-2">AI-Generated Personas</h3>
                  <p className="text-gray-300">
                    Create ultra-realistic digital influencers that look, act, and engage like real people, 
                    powered by cutting-edge AI technology.
                  </p>
                </CardContent>
              </Card>

              <Card className="bg-gray-900 border-orange-600/20 hover:border-orange-600/50 transition-all">
                <CardContent className="p-6">
                  <Shield className="w-12 h-12 text-orange-500 mb-4" />
                  <h3 className="text-2xl font-bold text-white mb-2">Privacy Protected</h3>
                  <p className="text-gray-300">
                    Keep your real identity completely private while building a lucrative presence 
                    on platforms like OnlyFans, Fansly, and more.
                  </p>
                </CardContent>
              </Card>

              <Card className="bg-gray-900 border-orange-600/20 hover:border-orange-600/50 transition-all">
                <CardContent className="p-6">
                  <DollarSign className="w-12 h-12 text-orange-500 mb-4" />
                  <h3 className="text-2xl font-bold text-white mb-2">Monetize Your Creativity</h3>
                  <p className="text-gray-300">
                    Artists and creators can generate income from exclusive content without personal exposure, 
                    maintaining complete control over their brand.
                  </p>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Key Features */}
      <section className="py-20 bg-black">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl lg:text-5xl font-bold mb-6 text-white">
              Platform <span className="text-orange-500">Features</span>
            </h2>
            <p className="text-xl text-gray-300 max-w-3xl mx-auto">
              Everything you need to create, manage, and monetize your AI digital influencer
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            <FeatureCard
              icon={<ImageIcon className="w-10 h-10" />}
              title="AI Content Generation"
              description="Generate unlimited high-quality explicit images and videos with advanced AI that learns your preferences and style."
            />
            
            <FeatureCard
              icon={<Users className="w-10 h-10" />}
              title="Multiple Personas"
              description="Create and manage multiple digital influencers, each with unique characteristics, personalities, and content styles."
            />
            
            <FeatureCard
              icon={<Zap className="w-10 h-10" />}
              title="Instant Generation"
              description="Generate content in seconds, not hours. Our AI works at lightning speed to keep your content pipeline full."
            />
            
            <FeatureCard
              icon={<TrendingUp className="w-10 h-10" />}
              title="Analytics Dashboard"
              description="Track earnings, engagement, and subscriber growth across all platforms with comprehensive analytics."
            />
            
            <FeatureCard
              icon={<ShoppingCart className="w-10 h-10" />}
              title="Influencer Marketplace"
              description="Buy and sell pre-made AI influencers with established looks, personalities, and content libraries."
            />
            
            <FeatureCard
              icon={<Sparkles className="w-10 h-10" />}
              title="Custom Training"
              description="Train the AI on specific looks, styles, and preferences to create truly unique and consistent personas."
            />
          </div>
        </div>
      </section>

      {/* Marketplace Preview */}
      <section className="py-20 bg-gradient-to-b from-gray-950 to-black">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="space-y-6"
            >
              <Badge className="bg-orange-600 hover:bg-orange-700 text-white">
                Marketplace
              </Badge>
              
              <h2 className="text-4xl lg:text-5xl font-bold text-white">
                Buy & Sell <span className="text-orange-500">AI Influencers</span>
              </h2>
              
              <p className="text-xl text-gray-300">
                Our marketplace allows you to purchase ready-made digital influencers with established 
                content libraries, or sell your own creations to other creators.
              </p>

              <ul className="space-y-4">
                <MarketplaceFeature text="Pre-made influencers with complete content packages" />
                <MarketplaceFeature text="Verified and tested personas ready to monetize" />
                <MarketplaceFeature text="Customizable after purchase to fit your brand" />
                <MarketplaceFeature text="Secure transactions and instant delivery" />
              </ul>

              <Button 
                size="lg" 
                className="bg-orange-600 hover:bg-orange-700 text-white"
                data-testid="button-marketplace-access"
              >
                <ShoppingCart className="w-5 h-5 mr-2" />
                Get Early Access to Marketplace
              </Button>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
            >
              <img 
                src={marketplaceImage} 
                alt="Marketplace Preview" 
                className="rounded-2xl shadow-2xl border-2 border-orange-600/30"
              />
            </motion.div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-gradient-to-r from-orange-600 to-orange-700">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <h2 className="text-4xl lg:text-5xl font-bold mb-6 text-white">
              Be Among the First
            </h2>
            
            <p className="text-xl text-orange-100 mb-8">
              Join the waitlist and get exclusive early access when we launch in January 2026. 
              Plus, receive special pricing for early adopters.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button 
                size="lg" 
                className="bg-white text-orange-600 hover:bg-gray-100 text-lg px-8 py-6"
                data-testid="button-join-waitlist"
              >
                <Star className="w-5 h-5 mr-2" />
                Join Waitlist Now
              </Button>
            </div>

            <p className="mt-6 text-orange-100 text-sm">
              🔒 100% secure · No credit card required · Cancel anytime
            </p>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-black border-t border-orange-600/20 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h3 className="text-2xl font-bold bg-gradient-to-r from-orange-500 to-orange-600 bg-clip-text text-transparent mb-4">
              Boostify Explicit
            </h3>
            <p className="text-gray-400 mb-4">
              The future of AI-generated digital influencers
            </p>
            <p className="text-gray-500 text-sm">
              © 2025 Boostify. All rights reserved. · Launching January 2026
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.6 }}
    >
      <Card className="bg-gray-900 border-orange-600/20 hover:border-orange-600/50 transition-all h-full">
        <CardContent className="p-6">
          <div className="text-orange-500 mb-4">
            {icon}
          </div>
          <h3 className="text-xl font-bold text-white mb-3">{title}</h3>
          <p className="text-gray-300">{description}</p>
        </CardContent>
      </Card>
    </motion.div>
  );
}

function MarketplaceFeature({ text }: { text: string }) {
  return (
    <li className="flex items-start gap-3">
      <div className="flex-shrink-0 w-6 h-6 rounded-full bg-orange-600 flex items-center justify-center mt-1">
        <ArrowRight className="w-4 h-4 text-white" />
      </div>
      <span className="text-gray-300">{text}</span>
    </li>
  );
}
