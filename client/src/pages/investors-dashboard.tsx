import { Header } from "../components/layout/header";
import { logger } from "../lib/logger";
import { Card } from "../components/ui/card";
import { ScrollArea } from "../components/ui/scroll-area";
import { Button } from "../components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Slider } from "../components/ui/slider";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "../components/ui/form";
import {
  DollarSign,
  Download,
  FileText,
  TrendingUp,
  Calendar,
  BarChart2,
  Clock,
  AlertTriangle,
  ChevronRight,
  Users,
  BarChart,
  Target,
  CreditCard,
  Check, 
  Calculator,
  UserPlus,
  Save,
  PenSquare,
  Play,
  Pause,
  RotateCcw,
  Presentation,
  Rocket,
  Zap,
  Globe,
  Shield,
  Award,
  Sparkles,
  Music,
  Video,
  Cpu,
  Coins,
  PieChart,
  LineChart,
  ArrowUpRight,
  Building2,
  Briefcase,
  Star,
  Bot,
  Layers,
  Headphones,
  ImageIcon,
  Palette,
  Mic2,
  ShoppingBag,
  Workflow,
  Brain,
  LayoutGrid,
  Lock,
  KeyRound
} from "lucide-react";
import { useState, useEffect } from "react";
import { useAuth } from "../hooks/use-auth";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { db } from "../firebase";
import { doc, setDoc, collection, addDoc, serverTimestamp } from "firebase/firestore";
import { useToast } from "../hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { apiRequest } from "@/lib/queryClient";

// ─── Professional images generated with fal.ai flux-pro/kontext ────────────
const INVESTOR_IMAGES = {
  hero_dashboard:    '/investors/hero-dashboard.jpg',
  ai_music_platform: '/investors/ai-music-platform.jpg',
  market_opportunity:'/investors/market-opportunity.jpg',
  ai_technology:     '/investors/ai-technology.jpg',
  revenue_streams:   '/investors/revenue-streams.jpg',
  artist_ecosystem:  '/investors/artist-ecosystem.jpg',
};

// Revenue Simulations Calculator Component
function RevenueSimulationsCalculator() {
  const [activeUsers, setActiveUsers] = useState(5000);
  const [videoConversion, setVideoConversion] = useState(20);
  const [blockchainVolume, setBlockchainVolume] = useState(100000);
  
  // Calculate all revenue streams
  const calculations = {
    subscriptions: {
      basic: (activeUsers * 0.35 * 59.99),
      pro: (activeUsers * 0.40 * 99.99),
      premium: (activeUsers * 0.25 * 149.99),
      total: function() { return this.basic + this.pro + this.premium; }
    },
    musicVideos: (activeUsers * videoConversion / 100) * 199,
    blockchain: {
      dexTrading: (blockchainVolume * 0.05),
      tokenDeployment: (blockchainVolume * 0.03),
      royalties: (blockchainVolume * 0.02),
      total: function() { return this.dexTrading + this.tokenDeployment + this.royalties; }
    },
    merchandise: (activeUsers * 10 * 0.5) * 0.20, // avg 10 artists per 1k users, $500 sales, 20% commission
    licensing: {
      youtube: 50000,
      spotify: 30000,
      total: function() { return this.youtube + this.spotify; }
    },
    onlyFans: 75000,
    token: 50000,
    courses: 30000,
    artistCards: 60000,
    mocapApi: 40000,
  };

  const monthlyTotal = 
    calculations.subscriptions.total() +
    calculations.musicVideos +
    calculations.blockchain.total() +
    calculations.merchandise +
    calculations.licensing.total() +
    calculations.onlyFans +
    calculations.token +
    calculations.courses +
    calculations.artistCards +
    calculations.mocapApi;

  const annualTotal = monthlyTotal * 12;

  return (
    <Card className="p-3 sm:p-6 bg-black/30 border-orange-500/20 mb-8">
      <h5 className="font-bold text-white text-base sm:text-lg mb-4 sm:mb-6">Revenue Simulations Calculator - Adjust Parameters</h5>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-6 mb-6 sm:mb-8">
        {/* Active Users Slider */}
        <div className="p-3 sm:p-4 bg-orange-500/10 rounded-lg border border-orange-500/20">
          <div className="flex justify-between mb-2 sm:mb-3 flex-col sm:flex-row gap-1 sm:gap-0">
            <label className="text-xs sm:text-sm font-medium text-white">Active Users</label>
            <span className="text-base sm:text-lg font-bold text-orange-400">{activeUsers.toLocaleString()}</span>
          </div>
          <Slider
            value={[activeUsers]}
            min={1000}
            max={50000}
            step={500}
            onValueChange={(value) => setActiveUsers(value[0])}
            className="w-full"
          />
          <p className="text-[10px] sm:text-xs text-white/60 mt-2">Range: 1k - 50k users</p>
        </div>

        {/* Video Conversion Rate */}
        <div className="p-3 sm:p-4 bg-amber-500/10 rounded-lg border border-purple-500/20">
          <div className="flex justify-between mb-2 sm:mb-3 flex-col sm:flex-row gap-1 sm:gap-0">
            <label className="text-xs sm:text-sm font-medium text-white">Video Users %</label>
            <span className="text-base sm:text-lg font-bold text-purple-400">{videoConversion}%</span>
          </div>
          <Slider
            value={[videoConversion]}
            min={5}
            max={50}
            step={1}
            onValueChange={(value) => setVideoConversion(value[0])}
            className="w-full"
          />
          <p className="text-[10px] sm:text-xs text-white/60 mt-2">% generating videos</p>
        </div>

        {/* Blockchain Volume */}
        <div className="p-3 sm:p-4 bg-yellow-500/10 rounded-lg border border-yellow-500/20">
          <div className="flex justify-between mb-2 sm:mb-3 flex-col sm:flex-row gap-1 sm:gap-0">
            <label className="text-xs sm:text-sm font-medium text-white">Blockchain Volume</label>
            <span className="text-base sm:text-lg font-bold text-yellow-400">${(blockchainVolume/1000000).toFixed(2)}M</span>
          </div>
          <Slider
            value={[blockchainVolume]}
            min={50000}
            max={10000000}
            step={500000}
            onValueChange={(value) => setBlockchainVolume(value[0])}
            className="w-full"
          />
          <p className="text-[10px] sm:text-xs text-white/60 mt-2">Monthly trading volume</p>
        </div>
      </div>

      {/* Revenue Breakdown Table */}
      <div className="bg-black/50 rounded-lg p-3 sm:p-6 mb-4 sm:mb-6 overflow-x-auto -mx-1 px-1">
        <h6 className="text-xs sm:text-sm text-white font-bold mb-3 sm:mb-4">Monthly Revenue by Stream</h6>
        <table className="w-full min-w-[340px] text-[11px] sm:text-sm">
          <thead>
            <tr className="border-b border-white/10">
              <th className="text-left text-white/70 pb-3 font-medium">Revenue Stream</th>
              <th className="text-right text-white/70 pb-3 font-medium">Amount</th>
              <th className="text-right text-white/70 pb-3 font-medium">% of Total</th>
            </tr>
          </thead>
          <tbody className="space-y-2">
            <tr className="border-b border-white/10">
              <td className="text-white py-2">1. Subscriptions</td>
              <td className="text-right text-yellow-400 font-semibold">${calculations.subscriptions.total().toLocaleString('en-US', {maximumFractionDigits: 0})}/mo</td>
              <td className="text-right text-white/60">{((calculations.subscriptions.total() / monthlyTotal) * 100).toFixed(1)}%</td>
            </tr>
            <tr className="border-b border-white/10">
              <td className="text-white py-2">2. Music Video Generator ($199/video)</td>
              <td className="text-right text-purple-400 font-semibold">${calculations.musicVideos.toLocaleString('en-US', {maximumFractionDigits: 0})}/mo</td>
              <td className="text-right text-white/60">{((calculations.musicVideos / monthlyTotal) * 100).toFixed(1)}%</td>
            </tr>
            <tr className="border-b border-white/10">
              <td className="text-white py-2">3. Blockchain & Tokenization (5% fees)</td>
              <td className="text-right text-orange-400 font-semibold">${calculations.blockchain.total().toLocaleString('en-US', {maximumFractionDigits: 0})}/mo</td>
              <td className="text-right text-white/60">{((calculations.blockchain.total() / monthlyTotal) * 100).toFixed(1)}%</td>
            </tr>
            <tr className="border-b border-white/10">
              <td className="text-white py-2">4. Artist Merchandise (20% commission)</td>
              <td className="text-right text-amber-400 font-semibold">${calculations.merchandise.toLocaleString('en-US', {maximumFractionDigits: 0})}/mo</td>
              <td className="text-right text-white/60">{((calculations.merchandise / monthlyTotal) * 100).toFixed(1)}%</td>
            </tr>
            <tr className="border-b border-white/10">
              <td className="text-white py-2">5. Music Licensing & Streaming</td>
              <td className="text-right text-indigo-400 font-semibold">${calculations.licensing.total().toLocaleString('en-US', {maximumFractionDigits: 0})}/mo</td>
              <td className="text-right text-white/60">{((calculations.licensing.total() / monthlyTotal) * 100).toFixed(1)}%</td>
            </tr>
            <tr className="border-b border-white/10">
              <td className="text-white py-2">6. OnlyFans & Exclusive Content</td>
              <td className="text-right text-pink-400 font-semibold">${calculations.onlyFans.toLocaleString('en-US', {maximumFractionDigits: 0})}/mo</td>
              <td className="text-right text-white/60">{((calculations.onlyFans / monthlyTotal) * 100).toFixed(1)}%</td>
            </tr>
            <tr className="border-b border-white/10">
              <td className="text-white py-2">7. Boostify Token ($BOOST)</td>
              <td className="text-right text-orange-400 font-semibold">${calculations.token.toLocaleString('en-US', {maximumFractionDigits: 0})}/mo</td>
              <td className="text-right text-white/60">{((calculations.token / monthlyTotal) * 100).toFixed(1)}%</td>
            </tr>
            <tr className="border-b border-white/10">
              <td className="text-white py-2">8. Courses & Professional Services</td>
              <td className="text-right text-red-400 font-semibold">${calculations.courses.toLocaleString('en-US', {maximumFractionDigits: 0})}/mo</td>
              <td className="text-right text-white/60">{((calculations.courses / monthlyTotal) * 100).toFixed(1)}%</td>
            </tr>
            <tr className="border-b border-white/10">
              <td className="text-white py-2">9. Artist Card Marketplace</td>
              <td className="text-right text-yellow-400 font-semibold">${calculations.artistCards.toLocaleString('en-US', {maximumFractionDigits: 0})}/mo</td>
              <td className="text-right text-white/60">{((calculations.artistCards / monthlyTotal) * 100).toFixed(1)}%</td>
            </tr>
            <tr className="border-b border-white/10">
              <td className="text-white py-2">10. Motion Capture & API Services</td>
              <td className="text-right text-violet-400 font-semibold">${calculations.mocapApi.toLocaleString('en-US', {maximumFractionDigits: 0})}/mo</td>
              <td className="text-right text-white/60">{((calculations.mocapApi / monthlyTotal) * 100).toFixed(1)}%</td>
            </tr>
            <tr className="bg-orange-500/20">
              <td className="text-white font-bold py-3">TOTAL MONTHLY REVENUE</td>
              <td className="text-right text-orange-400 font-bold text-lg py-3">${monthlyTotal.toLocaleString('en-US', {maximumFractionDigits: 0})}</td>
              <td className="text-right text-white/60 py-3">100%</td>
            </tr>
            <tr>
              <td className="text-white font-bold py-3">ANNUAL REVENUE</td>
              <td className="text-right text-yellow-400 font-bold text-lg py-3">${annualTotal.toLocaleString('en-US', {maximumFractionDigits: 0})}</td>
              <td className="text-right text-white/60 py-3">-</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Key Metrics Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-4">
        <div className="p-2 sm:p-3 bg-orange-500/10 rounded-lg border border-orange-500/20">
          <p className="text-white/70 text-[10px] sm:text-xs mb-1">Monthly Revenue</p>
          <p className="text-lg sm:text-2xl font-bold text-orange-400">${(monthlyTotal/1000).toFixed(1)}k</p>
        </div>
        <div className="p-2 sm:p-3 bg-yellow-500/10 rounded-lg border border-yellow-500/20">
          <p className="text-white/70 text-[10px] sm:text-xs mb-1">Annual Revenue</p>
          <p className="text-lg sm:text-2xl font-bold text-yellow-400">${(annualTotal/1000000).toFixed(2)}M</p>
        </div>
        <div className="p-2 sm:p-3 bg-orange-500/10 rounded-lg border border-orange-500/20">
          <p className="text-white/70 text-[10px] sm:text-xs mb-1">Top Revenue Stream</p>
          <p className="text-base sm:text-lg font-bold text-orange-400">Subscriptions</p>
          <p className="text-[9px] sm:text-xs text-white/60">{((calculations.subscriptions.total() / monthlyTotal) * 100).toFixed(0)}% of revenue</p>
        </div>
        <div className="p-2 sm:p-3 bg-amber-500/10 rounded-lg border border-purple-500/20">
          <p className="text-white/70 text-[10px] sm:text-xs mb-1">Revenue per User</p>
          <p className="text-lg sm:text-2xl font-bold text-purple-400">${(monthlyTotal / activeUsers).toFixed(2)}</p>
          <p className="text-[9px] sm:text-xs text-white/60">per user/month</p>
        </div>
      </div>
    </Card>
  );
}

// Fund Allocation Simulator Component
function FundAllocationSimulator() {
  const [isRunning, setIsRunning] = useState(false);
  const [operations, setOperations] = useState<any[]>([]);
  const [totalFunds] = useState(1000000);
  const [spent, setSpent] = useState(0);

  const fundAllocation = {
    marketing: 0.60,
    development: 0.30,
    operations: 0.07,
    infrastructure: 0.03
  };

  const operationTypes = {
    marketing: {
      label: 'Marketing',
      color: 'from-orange-400 to-orange-500',
      items: [
        { desc: 'Instagram Ad Campaign', cost: 5000 },
        { desc: 'YouTube Influencer', cost: 8000 },
        { desc: 'Billboard Advertising', cost: 12000 },
        { desc: 'Social Media Content', cost: 3000 },
      ]
    },
    development: {
      label: 'Development',
      color: 'from-amber-500 to-orange-500',
      items: [
        { desc: 'API Development', cost: 15000 },
        { desc: 'Mobile App Improvement', cost: 20000 },
        { desc: 'AI Integration', cost: 25000 },
      ]
    },
    operations: {
      label: 'Operations',
      color: 'from-yellow-500 to-amber-500',
      items: [
        { desc: 'Customer Support Team', cost: 4000 },
        { desc: 'Legal Compliance', cost: 3000 },
      ]
    },
    infrastructure: {
      label: 'Infrastructure',
      color: 'from-orange-400 to-orange-600',
      items: [
        { desc: 'Server Hosting & CDN', cost: 5000 },
        { desc: 'Cloud Services', cost: 3000 },
      ]
    }
  };

  useEffect(() => {
    if (!isRunning) return;

    const interval = setInterval(() => {
      const categories = Object.keys(operationTypes) as Array<keyof typeof operationTypes>;
      const randomCategory = categories[Math.floor(Math.random() * categories.length)];
      const items = operationTypes[randomCategory].items;
      const randomItem = items[Math.floor(Math.random() * items.length)];

      const newOp = {
        id: Math.random().toString(),
        type: randomCategory,
        description: randomItem.desc,
        amount: randomItem.cost,
        timestamp: Date.now(),
      };

      setOperations(prev => [newOp, ...prev.slice(0, 9)]);
      setSpent(prev => {
        const newSpent = prev + randomItem.cost;
        return newSpent > totalFunds ? totalFunds : newSpent;
      });
    }, 1200);

    return () => clearInterval(interval);
  }, [isRunning, totalFunds]);

  const remaining = totalFunds - spent;
  const percentageSpent = (spent / totalFunds) * 100;

  return (
    <Card className="p-3 sm:p-6 bg-black/30 border-orange-500/20">
      <h5 className="font-bold text-white text-base sm:text-lg mb-4 sm:mb-6">Real-Time Fund Allocation Simulator - 100% Transparency</h5>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
        {/* Left: Animation & Feed */}
        <div className="md:col-span-2 space-y-3 sm:space-y-4">
          {/* Fund Status Bar */}
          <div className="p-4 bg-white/5 rounded-lg border border-white/10">
            <div className="flex justify-between items-center mb-3">
              <span className="text-white/70 font-medium">Total Fund Distribution</span>
              <span className="text-orange-400 font-bold">${(spent).toLocaleString()} / ${(totalFunds).toLocaleString()}</span>
            </div>
            <div className="w-full h-3 bg-white/10 rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-orange-400 to-red-500 rounded-full transition-all duration-300"
                style={{ width: `${percentageSpent}%` }}
              ></div>
            </div>
            <div className="text-sm text-white/50 mt-2">{percentageSpent.toFixed(1)}% allocated</div>
          </div>

          {/* Budget Allocation Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {Object.entries(fundAllocation).map(([key, percentage]) => (
              <div key={key} className="p-2 sm:p-3 bg-white/5 rounded-lg border border-white/10 text-center">
                <div className="text-[10px] sm:text-xs text-white/60 mb-1">{operationTypes[key as keyof typeof operationTypes].label}</div>
                <div className="text-xs sm:text-sm font-bold text-white">{(percentage * 100).toFixed(0)}%</div>
              </div>
            ))}
          </div>

          {/* Controls */}
          <div className="flex gap-2 flex-col sm:flex-row">
            <button
              onClick={() => setIsRunning(!isRunning)}
              className="flex-1 px-2 sm:px-3 py-2 rounded-lg bg-gradient-to-r from-orange-400 to-amber-600 text-white font-bold hover:shadow-lg hover:shadow-orange-500/50 transition-all flex items-center justify-center gap-2 text-xs sm:text-sm"
            >
              {isRunning ? (
                <>
                  <Pause className="h-4 w-4" />
                  Pause
                </>
              ) : (
                <>
                  <Play className="h-4 w-4" />
                  Start
                </>
              )}
            </button>
            <button
              onClick={() => {
                setOperations([]);
                setSpent(0);
                setIsRunning(false);
              }}
              className="px-2 sm:px-3 py-2 rounded-lg bg-white/10 text-white font-bold hover:bg-white/20 transition-all flex items-center justify-center gap-2 text-xs sm:text-sm"
            >
              <RotateCcw className="h-4 w-4" />
              Reset
            </button>
          </div>

          {/* Operations Feed */}
          <div className="max-h-40 sm:max-h-48 overflow-y-auto space-y-1 bg-black/40 rounded-lg p-2 sm:p-3 border border-white/10">
            {operations.length === 0 ? (
              <div className="text-center py-4 sm:py-6 text-white/40 text-[10px] sm:text-xs">Click Start to begin simulation</div>
            ) : (
              operations.map((op) => (
                <div
                  key={op.id}
                  className={`p-1.5 sm:p-2 rounded text-[10px] sm:text-xs border-l-2 bg-black/60 animate-pulse`}
                  style={{
                    borderLeftColor: op.type === 'marketing' ? '#3b82f6' : 
                                   op.type === 'development' ? '#a855f7' :
                                   op.type === 'operations' ? '#22c55e' : '#f97316'
                  }}
                >
                  <div className="flex justify-between items-start">
                    <div className="min-w-0 flex-1">
                      <div className="text-white font-semibold truncate">{op.description}</div>
                      <div className="text-white/50 text-[9px] sm:text-[10px]">{operationTypes[op.type as keyof typeof operationTypes].label}</div>
                    </div>
                    <div className="text-orange-400 font-bold flex-shrink-0 ml-1">-${op.amount.toLocaleString()}</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right: Summary */}
        <div className="space-y-2 sm:space-y-3">
          <div className="p-3 sm:p-4 bg-gradient-to-br from-orange-500/10 to-yellow-500/5 rounded-lg border border-yellow-500/20">
            <div className="text-white/70 text-xs mb-1">Remaining Budget</div>
            <div className="text-xl sm:text-2xl font-bold text-yellow-400">${(remaining).toLocaleString()}</div>
            <div className="text-[10px] sm:text-xs text-white/50 mt-1">{((remaining/totalFunds)*100).toFixed(1)}% available</div>
          </div>

          <div className="p-3 sm:p-4 bg-gradient-to-br from-orange-400/10 to-orange-600/5 rounded-lg border border-orange-500/20">
            <div className="text-white/70 text-xs mb-1">Total Spent</div>
            <div className="text-xl sm:text-2xl font-bold text-orange-400">${(spent).toLocaleString()}</div>
            <div className="text-[10px] sm:text-xs text-white/50 mt-1">{percentageSpent.toFixed(1)}% of budget</div>
          </div>

          <div className="p-3 sm:p-4 bg-black/40 rounded-lg border border-white/10">
            <h6 className="text-xs font-bold text-white mb-3">Allocation %</h6>
            <div className="space-y-2">
              {Object.entries(fundAllocation).map(([key, percentage]) => (
                <div key={key}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-white/70">{operationTypes[key as keyof typeof operationTypes].label}</span>
                    <span className="text-white font-semibold">{(percentage * 100).toFixed(0)}%</span>
                  </div>
                  <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                    <div
                      className={`h-full bg-gradient-to-r ${operationTypes[key as keyof typeof operationTypes].color} rounded-full`}
                      style={{ width: `${percentage * 100}%` }}
                    ></div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="p-2 sm:p-3 bg-gradient-to-br from-green-500/10 to-yellow-500/5 rounded-lg border border-orange-500/20">
            <div className="flex items-center gap-2 text-[10px] sm:text-xs">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              <span className="text-white/70">100% Transparent</span>
            </div>
            <p className="text-[10px] sm:text-xs text-white/50 mt-1">All operations tracked real-time</p>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 0.8; }
          50% { opacity: 0.4; }
        }
        .animate-pulse {
          animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }
      `}</style>
    </Card>
  );
}

// User Growth Simulator Component - Boostify User Acquisition & Conversion
function UserGrowthSimulator() {
  const [isRunning, setIsRunning] = useState(false);
  const [operations, setOperations] = useState<any[]>([]);
  const [totalUsers, setTotalUsers] = useState(1000);
  const [campaignType, setCampaignType] = useState('direct_send'); // direct_send, social, landing
  
  const campaignTypes = {
    direct_send: {
      label: '50K Direct Sends',
      conversionRate: 0.08, // 8% conversion
      color: 'from-green-500 to-yellow-500',
      description: 'Automated landing page emails to prospects'
    },
    social: {
      label: 'Social Media Campaign',
      conversionRate: 0.05, // 5% conversion
      color: 'from-amber-500 to-orange-600',
      description: 'Instagram, TikTok, Twitter campaigns'
    },
    landing: {
      label: 'Pre-created Landing Pages',
      conversionRate: 0.12, // 12% conversion
      color: 'from-orange-400 to-yellow-600',
      description: 'High-converting artist landing pages'
    }
  };

  const conversionActions = {
    signup: { label: 'Sign Up Free', rate: 0.40, icon: '👤' },
    artist_plan: { label: 'Artist Plan ($19.99)', rate: 0.30, icon: '🎵' },
    creator_plan: { label: 'Elevate Plan ($49.99)', rate: 0.25, icon: '📦' },
    professional_plan: { label: 'Amplify Plan ($89.99)', rate: 0.20, icon: '⭐' },
    enterprise_plan: { label: 'Dominate Plan ($149.99)', rate: 0.10, icon: '👑' },
    video_generator: { label: 'Video Generator ($199)', rate: 0.35, icon: '🎬' },
    tokenization: { label: 'Tokenization Service', rate: 0.15, icon: '🪙' },
  };

  useEffect(() => {
    if (!isRunning) return;

    const interval = setInterval(() => {
      const campaign = campaignTypes[campaignType as keyof typeof campaignTypes];
      
      // Random number of signups based on campaign type
      const baseSignups = campaignType === 'direct_send' ? 50000 : campaignType === 'social' ? 5000 : 10000;
      const signups = Math.floor(baseSignups * campaign.conversionRate / 100);
      
      // Pick a random conversion action
      const actions = Object.entries(conversionActions);
      const [action, actionData] = actions[Math.floor(Math.random() * actions.length)];
      
      // Calculate actual conversions from this action
      const conversions = Math.floor(signups * actionData.rate);
      
      if (conversions > 0) {
        const newOp = {
          id: Math.random().toString(),
          campaign: campaign.label,
          action: actionData.label,
          signups,
          conversions,
          revenue: action.includes('plan') ? conversions * parseInt(action.match(/\d+/)?.[0] || '59') : 
                   action === 'video_generator' ? conversions * 199 : 0,
          icon: actionData.icon,
          timestamp: Date.now(),
        };

        setOperations(prev => [newOp, ...prev.slice(0, 14)]);
        setTotalUsers(prev => {
          const newTotal = prev + conversions;
          return Math.min(newTotal, 50000);
        });
      }
    }, 1500);

    return () => clearInterval(interval);
  }, [isRunning, campaignType]);

  const growthPercentage = ((totalUsers - 1000) / 49000) * 100;
  const avgMonthlyRevenue = totalUsers * 15; // Average revenue per user

  return (
    <Card className="p-3 sm:p-6 bg-black/30 border-orange-500/20">
      <h5 className="font-bold text-white text-base sm:text-lg mb-4 sm:mb-6">User Acquisition & Conversion Simulator - Boostify Growth Engine</h5>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
        {/* Left: Campaign & Feed */}
        <div className="md:col-span-2 space-y-3 sm:space-y-4">
          {/* Campaign Selector */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {Object.entries(campaignTypes).map(([key, campaign]) => (
              <button
                key={key}
                onClick={() => setCampaignType(key)}
                className={`p-2 sm:p-3 rounded-lg border transition-all ${
                  campaignType === key
                    ? 'bg-gradient-to-r ' + campaign.color + ' border-white/30'
                    : 'bg-white/5 border-white/10 hover:border-white/20'
                }`}
              >
                <div className="text-[10px] sm:text-xs font-bold text-white">{campaign.label}</div>
                <div className="text-[8px] sm:text-[10px] text-white/60">{(campaign.conversionRate * 100).toFixed(0)}% conv</div>
              </button>
            ))}
          </div>

          {/* Growth Progress */}
          <div className="p-3 sm:p-4 bg-white/5 rounded-lg border border-white/10">
            <div className="flex justify-between items-center mb-2 sm:mb-3">
              <span className="text-white/70 font-medium text-xs sm:text-sm">Total Platform Users</span>
              <span className="text-orange-400 font-bold text-sm sm:text-base">{totalUsers.toLocaleString()} / 50,000</span>
            </div>
            <div className="w-full h-3 bg-white/10 rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-orange-400 to-red-500 rounded-full transition-all duration-300"
                style={{ width: `${growthPercentage}%` }}
              ></div>
            </div>
            <div className="text-xs text-white/50 mt-2">{growthPercentage.toFixed(1)}% growth target reached</div>
          </div>

          {/* Conversion Actions Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 sm:gap-2">
            {Object.entries(conversionActions).map(([key, action]) => (
              <div key={key} className="p-1.5 sm:p-2 bg-white/5 rounded-lg border border-white/10 text-center">
                <div className="text-lg sm:text-2xl mb-0.5">{action.icon}</div>
                <div className="text-[8px] sm:text-[10px] text-white/60 line-clamp-2">{action.label}</div>
              </div>
            ))}
          </div>

          {/* Controls */}
          <div className="flex gap-2 flex-col sm:flex-row">
            <button
              onClick={() => setIsRunning(!isRunning)}
              className="flex-1 px-2 sm:px-3 py-2 rounded-lg bg-gradient-to-r from-orange-400 to-amber-600 text-white font-bold hover:shadow-lg hover:shadow-orange-500/50 transition-all flex items-center justify-center gap-2 text-xs sm:text-sm"
            >
              {isRunning ? (
                <>
                  <Pause className="h-4 w-4" />
                  Pause Campaign
                </>
              ) : (
                <>
                  <Play className="h-4 w-4" />
                  Start Campaign
                </>
              )}
            </button>
            <button
              onClick={() => {
                setOperations([]);
                setTotalUsers(1000);
                setIsRunning(false);
              }}
              className="px-2 sm:px-3 py-2 rounded-lg bg-white/10 text-white font-bold hover:bg-white/20 transition-all flex items-center justify-center gap-2 text-xs sm:text-sm"
            >
              <RotateCcw className="h-4 w-4" />
              Reset
            </button>
          </div>

          {/* Acquisition Feed */}
          <div className="max-h-40 sm:max-h-48 overflow-y-auto space-y-1 bg-black/40 rounded-lg p-2 sm:p-3 border border-white/10">
            {operations.length === 0 ? (
              <div className="text-center py-4 sm:py-6 text-white/40 text-[10px] sm:text-xs">Click Start Campaign to begin user acquisition</div>
            ) : (
              operations.map((op) => (
                <div
                  key={op.id}
                  className={`p-1.5 sm:p-2 rounded text-[9px] sm:text-xs border-l-2 bg-black/60 animate-pulse border-orange-500`}
                >
                  <div className="flex justify-between items-start gap-1">
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-white truncate">{op.icon} {op.action}</div>
                      <div className="text-white/50 text-[8px]">{op.campaign}</div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="text-yellow-400 font-bold">+{op.conversions}</div>
                      {op.revenue > 0 && <div className="text-[8px] text-white/60">${op.revenue.toLocaleString()}</div>}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right: Statistics */}
        <div className="space-y-2 sm:space-y-3">
          <div className="p-3 sm:p-4 bg-gradient-to-br from-orange-500/10 to-blue-600/5 rounded-lg border border-orange-500/20">
            <div className="text-white/70 text-xs mb-1">Current Users</div>
            <div className="text-xl sm:text-2xl font-bold text-orange-400">{totalUsers.toLocaleString()}</div>
            <div className="text-[10px] sm:text-xs text-white/50 mt-1">Active on platform</div>
          </div>

          <div className="p-3 sm:p-4 bg-gradient-to-br from-green-500/10 to-emerald-600/5 rounded-lg border border-yellow-500/20">
            <div className="text-white/70 text-xs mb-1">Est. Monthly Revenue</div>
            <div className="text-xl sm:text-2xl font-bold text-yellow-400">${(avgMonthlyRevenue / 1000).toFixed(1)}k</div>
            <div className="text-[10px] sm:text-xs text-white/50 mt-1">@ $15 avg per user</div>
          </div>

          <div className="p-3 sm:p-4 bg-gradient-to-br from-purple-500/10 to-pink-600/5 rounded-lg border border-purple-500/20">
            <div className="text-white/70 text-xs mb-1">Conversion Rate</div>
            <div className="text-xl sm:text-2xl font-bold text-purple-400">{campaignTypes[campaignType as keyof typeof campaignTypes].conversionRate * 100}%</div>
            <div className="text-[10px] sm:text-xs text-white/50 mt-1">{campaignTypes[campaignType as keyof typeof campaignTypes].description}</div>
          </div>

          <div className="p-3 sm:p-4 bg-gradient-to-br from-yellow-500/10 to-orange-600/5 rounded-lg border border-yellow-500/20">
            <div className="text-white/70 text-xs mb-1">Growth Target</div>
            <div className="text-xl sm:text-2xl font-bold text-yellow-400">{growthPercentage.toFixed(0)}%</div>
            <div className="text-[10px] sm:text-xs text-white/50 mt-1">Progress to 50k users</div>
          </div>
        </div>
      </div>
    </Card>
  );
}

// =====================================
// PROFESSIONAL PITCH DECK COMPONENT
// =====================================
function PitchDeck({ setSelectedTab }: { setSelectedTab: (tab: string) => void }) {
  const [activeSlide, setActiveSlide] = useState(0);
  const { toast } = useToast();

  // Function to generate and download PDF
  const handleDownloadPDF = async () => {
    toast({
      title: "Generating PDF...",
      description: "Please wait while we prepare your Pitch Deck",
    });

    // Create a comprehensive pitch deck content
    const pitchDeckContent = `
BOOSTIFY MUSIC - INVESTOR PITCH DECK
=====================================

🎵 THE AI-POWERED MUSIC TECH PLATFORM

Empowering independent artists with AI-driven tools for music creation,
promotion, and monetization.

=====================================
💰 INVESTMENT OPPORTUNITY
=====================================

• Current Round: Seed (Post-Money SAFE)
• Minimum Ticket: $1,500,000 per investor
• Post-Money Valuation: ~$42.9M
• Equity Dilution: 3.5% of total platform
• Platform: Direct / Strategic Investors Only

=====================================
📊 MARKET OPPORTUNITY
=====================================

• TAM (Total Addressable Market): $43.6B
• SAM (Serviceable Market): $12.8B
• SOM (Target Market - 3 years): $2.4B
• Industry CAGR: 18.5%

=====================================
🚀 THE PROBLEM
=====================================

• 80% of artists struggle with distribution and promotion
• Traditional tools are expensive and fragmented
• Limited access to AI-powered creative tools
• Complex royalty and monetization systems

=====================================
✨ OUR SOLUTION
=====================================

Boostify Music provides an all-in-one platform:

1. AI Music Video Generation - Create professional videos in minutes
2. Smart Distribution - Multi-platform release management
3. Blockchain Royalties - Transparent, automated payments
4. AI Artists as Digital Assets - 50K AI artists generating autonomous revenue
5. Social Network - Real follows, email notifications, IG/YouTube publishing
6. Artist Branding Tools - AI-powered marketing suite
7. MotionDNA Technology - Unique visual identity for each artist

=====================================
💵 REVENUE MODEL
=====================================

• SaaS Subscriptions: 40% ($86M projected Y5)
• AI Video Generation: 22% ($47M projected Y5)
• AI Artists Ecosystem: 18% ($39M projected Y5)
• Blockchain & Tokenization: 13% ($28M projected Y5)
• Licensing & Royalties: 7% ($15M projected Y5)

=====================================
📈 FINANCIAL PROJECTIONS
=====================================

Year 1 (2026): $5.2M revenue | 8,000 users
Year 2 (2027): $18.5M revenue | 35,000 users
Year 3 (2028): $52M revenue | 90,000 users
Year 4 (2029): $115M revenue | 185,000 users
Year 5 (2030): $215M revenue | 380,000 users

=====================================
🎯 USE OF FUNDS ($1.5M)
=====================================

• Product Development & AI Infrastructure: $600,000 (40%)
• Marketing & Artist Acquisition: $450,000 (30%)
• Operations & Team: $225,000 (15%)
• Strategic Reserves & Partnerships: $225,000 (15%)

=====================================
🏆 COMPETITIVE ADVANTAGES
=====================================

1. AI-First Technology - 10x faster than traditional methods
2. Blockchain Integration - 100% transparent royalties
3. All-in-One Platform - 5 tools in 1 ecosystem
4. Artist-Centric Design - Built by musicians, for musicians

=====================================
📅 MILESTONES & ROADMAP
=====================================

Q1 2026: Platform Launch & Seed Round Close ($1.5M SAFE)
Q2 2026: 8,000 Active Artists + Social Network Live
Q4 2026: Series A ($3M) — 35,000 Users, $18.5M ARR
Q2 2027: 60,000 Active Artists + 50K AI Artists Deployed
Q4 2027: Series B ($10M) — 90,000 Users, $52M ARR
Q4 2028: 185,000 Users + $115M ARR + Series C Ready

=====================================
👥 LEADERSHIP TEAM
=====================================

• CEO/Founder - Tech & Music Industry Expert
• CTO - AI/ML Specialist
• Head of Product - SaaS Growth Expert
• Creative Director - Award-winning Designer

=====================================
📞 CONTACT & INVEST
=====================================

🌐 Website: boostify.music
💰 Invest: wefunder.com/boostify.music
📧 Email: investors@boostify.music

=====================================
DISCLAIMER
=====================================

Investment involves risk. Past performance is not indicative
of future results. Please review all documentation and consult
with financial advisors before investing.

© 2026 Boostify Music. All Rights Reserved.
    `;

    // Create a Blob and download
    const blob = new Blob([pitchDeckContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'Boostify_Music_Pitch_Deck_2026.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast({
      title: "✅ Pitch Deck Downloaded!",
      description: "Check your downloads folder for the file",
    });
  };

  // Market Data
  const marketData = {
    totalAddressableMarket: 43.6, // Billion USD
    serviceableMarket: 12.8, // Billion USD
    targetMarket: 2.4, // Billion USD - first 3 years
    growthRate: 18.5, // CAGR %
  };

  // Revenue Projections Data
  const revenueProjections = [
    { year: 'Y1 2026', revenue: 5.2, users: 8000, arr: 5.2 },
    { year: 'Y2 2027', revenue: 18.5, users: 35000, arr: 18.5 },
    { year: 'Y3 2028', revenue: 52.0, users: 90000, arr: 52.0 },
    { year: 'Y4 2029', revenue: 115.0, users: 185000, arr: 115.0 },
    { year: 'Y5 2030', revenue: 215.0, users: 380000, arr: 215.0 },
  ];

  // Revenue Streams
  const revenueStreams = [
    { name: 'SaaS Subscriptions & Credit Economy', percentage: 40, amount: '$86M', color: 'from-orange-400 to-orange-600' },
    { name: 'AI Video, Karaoke & Talk-to-Me', percentage: 22, amount: '$47M', color: 'from-purple-400 to-purple-600' },
    { name: 'AI Artists Ecosystem (Royalties, Social, Merch, Events, Vinyl)', percentage: 18, amount: '$39M', color: 'from-green-400 to-emerald-600' },
    { name: 'Blockchain & Tokenization (BTF + BoostiSwap)', percentage: 13, amount: '$28M', color: 'from-yellow-400 to-amber-600' },
    { name: 'Licensing & Royalties', percentage: 7, amount: '$15M', color: 'from-cyan-400 to-blue-600' },
  ];

  // Competitive Advantages
  const competitiveAdvantages = [
    {
      icon: Bot,
      title: '7 AI Agents + AAS Engine',
      description: '7 specialized AI agents with Function Calling (Composer, Marketing, Social, Video, Photo, Manager, Merch) + 7-agent Autonomous Artist System running 24/7',
      metric: '14 AI agents total'
    },
    {
      icon: Cpu,
      title: 'AI-First Technology',
      description: '122 pages, 569 components, 112 APIs — full AI creation suite for music, video, images, podcasts, and marketing content',
      metric: '10x faster than traditional'
    },
    {
      icon: Coins,
      title: 'Smart Credit Economy',
      description: 'Every AI action is billable: 1 credit = $0.01, 5x markup, 6 credit packs ($4.99-$249.99) + 4 subscription tiers generating predictable MRR',
      metric: '5x revenue per API call'
    },
    {
      icon: Users,
      title: 'Live Social + Distribution Network',
      description: 'Full social graph (follows, likes, notifications), Brevo email system, Chrome Extension bridge to Instagram/YouTube, and platform events engine auto-publishing content',
      metric: '5-layer integration stack'
    },
  ];

  // Team Members
  const teamMembers = [
    { role: 'CEO & Founder', expertise: 'Music Industry & AI', experience: '15+ years' },
    { role: 'CTO', expertise: 'AI/ML & Blockchain', experience: '12+ years' },
    { role: 'CPO', expertise: 'Product & UX', experience: '10+ years' },
    { role: 'CMO', expertise: 'Digital Marketing', experience: '8+ years' },
  ];

  // Milestones
  const milestones = [
    { date: 'Q1 2026', milestone: 'Platform Launch + Seed Round Close ($1.5M)', status: 'completed' },
    { date: 'Q2 2026', milestone: '8,000 Active Users + Social Network Live', status: 'in-progress' },
    { date: 'Q4 2026', milestone: 'Series A ($3M) — 35,000 Users', status: 'upcoming' },
    { date: 'Q2 2027', milestone: '60,000 Users + Mobile App + AI Artists 50K', status: 'upcoming' },
    { date: 'Q4 2027', milestone: 'Series B ($10M) — $52M ARR', status: 'upcoming' },
    { date: 'Q4 2028', milestone: '185,000 Users + $115M ARR + Series C Ready', status: 'upcoming' },
  ];

  // Use of Funds
  const useOfFunds = [
    { category: 'Product Development', percentage: 40, description: 'AI models, features, mobile apps' },
    { category: 'Marketing & Growth', percentage: 30, description: 'User acquisition, brand building' },
    { category: 'Operations', percentage: 15, description: 'Team, infrastructure, compliance' },
    { category: 'Strategic Reserves', percentage: 15, description: 'Partnerships, acquisitions, runway' },
  ];

  return (
    <div className="space-y-6">
      {/* Cover Slide */}
      <Card className="relative overflow-hidden bg-gradient-to-br from-gray-900 via-slate-900 to-black border-orange-500/30 p-4 sm:p-10">
        {/* Background Effects */}
        <div className="absolute top-0 right-0 w-48 sm:w-96 h-48 sm:h-96 bg-orange-500/10 rounded-full filter blur-3xl"></div>
        <div className="absolute bottom-0 left-0 w-40 sm:w-80 h-40 sm:h-80 bg-amber-500/10 rounded-full filter blur-3xl"></div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] sm:w-[600px] h-[300px] sm:h-[600px] bg-yellow-500/5 rounded-full filter blur-3xl"></div>
        
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-orange-400 to-amber-600 flex items-center justify-center shadow-lg shadow-orange-500/30">
              <Presentation className="h-8 w-8 text-white" />
            </div>
            <div>
              <span className="text-xs font-semibold text-orange-400 tracking-wider uppercase">Business Overview</span>
              <h2 className="text-2xl sm:text-3xl md:text-5xl font-bold bg-gradient-to-r from-orange-400 via-amber-300 to-yellow-400 bg-clip-text text-transparent">
                BOOSTIFY MUSIC
              </h2>
            </div>
          </div>

          <p className="text-base sm:text-xl md:text-2xl text-gray-300 max-w-3xl mb-6 sm:mb-8 leading-relaxed">
            The <span className="text-orange-400 font-semibold">AI-Powered Artist Operating System</span> — 
            7 AI Agents, Autonomous Career Engine, Smart Credit Economy & 122 Pages of Production-Ready Product
          </p>

          {/* Capital already deployed banner */}
          <div className="flex items-center gap-3 mb-6 sm:mb-8 p-3 sm:p-4 bg-gradient-to-r from-orange-500/15 to-transparent rounded-xl border border-orange-500/25">
            <Building2 className="h-5 w-5 sm:h-6 sm:w-6 text-orange-400 flex-shrink-0" />
            <p className="text-xs sm:text-sm text-gray-200 leading-relaxed">
              <span className="text-orange-400 font-bold">$1.8M already invested</span> by{' '}
              <span className="text-white font-semibold">Omnia Strategic Holding Corporation</span> across{' '}
              <span className="text-white font-semibold">3 years (2023–2025)</span> of R&D — a fully built, production-ready platform before raising a single external dollar.
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4 mb-6 sm:mb-8">
            <div className="text-center p-3 sm:p-4 bg-white/5 rounded-xl border border-white/10 backdrop-blur-sm">
              <div className="text-xl sm:text-2xl md:text-4xl font-bold text-orange-400">$1.8M</div>
              <div className="text-[10px] sm:text-xs text-gray-400 mt-1">Already Invested (R&D)</div>
            </div>
            <div className="text-center p-2 sm:p-4 bg-white/5 rounded-xl border border-white/10 backdrop-blur-sm">
              <div className="text-xl sm:text-2xl md:text-4xl font-bold text-yellow-400">$42.9M</div>
              <div className="text-[10px] sm:text-xs text-gray-400 mt-1">Post-Money Valuation</div>
            </div>
            <div className="text-center p-2 sm:p-4 bg-white/5 rounded-xl border border-white/10 backdrop-blur-sm">
              <div className="text-xl sm:text-2xl md:text-4xl font-bold text-amber-400">$215M</div>
              <div className="text-[10px] sm:text-xs text-gray-400 mt-1">Y5 Revenue Target</div>
            </div>
            <div className="text-center p-2 sm:p-4 bg-white/5 rounded-xl border border-white/10 backdrop-blur-sm">
              <div className="text-xl sm:text-2xl md:text-4xl font-bold text-green-400">380K</div>
              <div className="text-[10px] sm:text-xs text-gray-400 mt-1">Users by 2030</div>
            </div>
          </div>

          <div className="flex flex-wrap gap-1.5 sm:gap-3">
            <span className="px-2 sm:px-3 py-1 sm:py-1.5 bg-orange-500/20 text-orange-300 rounded-full text-[10px] sm:text-xs font-medium flex items-center gap-1">
              <Music className="w-3 h-3 flex-shrink-0" /> AI Music Tech
            </span>
            <span className="px-2 sm:px-3 py-1 sm:py-1.5 bg-purple-500/20 text-purple-300 rounded-full text-[10px] sm:text-xs font-medium flex items-center gap-1">
              <Video className="w-3 h-3 flex-shrink-0" /> Generative Video
            </span>
            <span className="px-2 sm:px-3 py-1 sm:py-1.5 bg-yellow-500/20 text-yellow-300 rounded-full text-[10px] sm:text-xs font-medium flex items-center gap-1">
              <Bot className="w-3 h-3 flex-shrink-0" /> 7 AI Agents
            </span>
            <span className="px-2 sm:px-3 py-1 sm:py-1.5 bg-green-500/20 text-green-300 rounded-full text-[10px] sm:text-xs font-medium flex items-center gap-1">
              <Workflow className="w-3 h-3 flex-shrink-0" /> AAS Engine
            </span>
            <span className="px-2 sm:px-3 py-1 sm:py-1.5 bg-cyan-500/20 text-cyan-300 rounded-full text-[10px] sm:text-xs font-medium flex items-center gap-1">
              <Coins className="w-3 h-3 flex-shrink-0" /> Credits
            </span>
            <span className="px-2 sm:px-3 py-1 sm:py-1.5 bg-amber-500/20 text-amber-300 rounded-full text-[10px] sm:text-xs font-medium flex items-center gap-1">
              <ShoppingBag className="w-3 h-3 flex-shrink-0" /> AI Merch
            </span>
            <span className="px-2 sm:px-3 py-1 sm:py-1.5 bg-blue-500/20 text-blue-300 rounded-full text-[10px] sm:text-xs font-medium flex items-center gap-1">
              <Zap className="w-3 h-3 flex-shrink-0" /> Web3 + BTF
            </span>
            <span className="px-2 sm:px-3 py-1 sm:py-1.5 bg-pink-500/20 text-pink-300 rounded-full text-[10px] sm:text-xs font-medium flex items-center gap-1">
              <Users className="w-3 h-3 flex-shrink-0" /> Social Network
            </span>
            <span className="px-2 sm:px-3 py-1 sm:py-1.5 bg-rose-500/20 text-rose-300 rounded-full text-[10px] sm:text-xs font-medium flex items-center gap-1">
              <Presentation className="w-3 h-3 flex-shrink-0" /> Cinematic Events
            </span>
            <span className="px-2 sm:px-3 py-1 sm:py-1.5 bg-indigo-500/20 text-indigo-300 rounded-full text-[10px] sm:text-xs font-medium flex items-center gap-1">
              <Mic2 className="w-3 h-3 flex-shrink-0" /> Karaoke & Talk-to-Me
            </span>
            <span className="px-2 sm:px-3 py-1 sm:py-1.5 bg-teal-500/20 text-teal-300 rounded-full text-[10px] sm:text-xs font-medium flex items-center gap-1">
              <Headphones className="w-3 h-3 flex-shrink-0" /> Vinyl & Physical
            </span>
            <span className="px-2 sm:px-3 py-1 sm:py-1.5 bg-emerald-500/20 text-emerald-300 rounded-full text-[10px] sm:text-xs font-medium flex items-center gap-1">
              <Globe className="w-3 h-3 flex-shrink-0" /> 3.5% Dilution
            </span>
          </div>

          {/* Platform screenshot banner */}
          <div className="mt-6 sm:mt-8 rounded-xl overflow-hidden border border-orange-500/20 shadow-2xl shadow-orange-500/10">
            <img
              src={INVESTOR_IMAGES.ai_music_platform}
              alt="Boostify AI music platform in action"
              className="w-full h-auto max-h-72 sm:max-h-96 object-cover object-top"
              loading="lazy"
            />
          </div>
        </div>
      </Card>

      {/* Problem & Solution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {/* The Problem */}
        <Card className="p-4 sm:p-6 bg-gradient-to-br from-red-950/20 to-gray-900/50 border-red-500/20">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-xl bg-red-500/20 flex items-center justify-center">
              <AlertTriangle className="h-6 w-6 text-red-400" />
            </div>
            <h3 className="text-xl font-bold text-white">The Problem</h3>
          </div>

          <div className="space-y-4">
            <div className="p-4 bg-black/30 rounded-lg border border-red-500/10">
              <h4 className="text-sm font-semibold text-red-400 mb-2">Fragmented Tools</h4>
              <p className="text-xs text-gray-400">Artists juggle 10+ platforms for creation, distribution, marketing, and monetization</p>
            </div>
            <div className="p-4 bg-black/30 rounded-lg border border-red-500/10">
              <h4 className="text-sm font-semibold text-red-400 mb-2">High Production Costs</h4>
              <p className="text-xs text-gray-400">Professional music videos cost $5K-$50K, putting them out of reach for indie artists</p>
            </div>
            <div className="p-4 bg-black/30 rounded-lg border border-red-500/10">
              <h4 className="text-sm font-semibold text-red-400 mb-2">Unfair Revenue Split</h4>
              <p className="text-xs text-gray-400">Artists receive only 12-20% of streaming revenue, labels and platforms take the rest</p>
            </div>
            <div className="p-4 bg-black/30 rounded-lg border border-red-500/10">
              <h4 className="text-sm font-semibold text-red-400 mb-2">No Direct Fan Connection</h4>
              <p className="text-xs text-gray-400">Streaming platforms own the fan relationship, artists lack direct monetization channels</p>
            </div>
          </div>
        </Card>

        {/* Our Solution */}
        <Card className="p-4 sm:p-6 bg-gradient-to-br from-green-950/20 to-gray-900/50 border-green-500/20">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-xl bg-green-500/20 flex items-center justify-center">
              <Rocket className="h-6 w-6 text-green-400" />
            </div>
            <h3 className="text-xl font-bold text-white">Our Solution</h3>
          </div>

          <div className="space-y-4">
            <div className="p-4 bg-black/30 rounded-lg border border-green-500/10">
              <h4 className="text-sm font-semibold text-green-400 mb-2">All-in-One AI Platform (122 Pages)</h4>
              <p className="text-xs text-gray-400">Music creation, AI video, distribution, marketing, merchandise, and fan engagement — all unified under one platform with 569 components</p>
            </div>
            <div className="p-4 bg-black/30 rounded-lg border border-green-500/10">
              <h4 className="text-sm font-semibold text-green-400 mb-2">7 AI Agents + AAS Autonomous Engine</h4>
              <p className="text-xs text-gray-400">Specialized AI agents (Composer, Marketing, Social, Video, Photo, Manager, Merch) with Function Calling + autonomous 7-agent system running 24/7 for each artist</p>
            </div>
            <div className="p-4 bg-black/30 rounded-lg border border-green-500/10">
              <h4 className="text-sm font-semibold text-green-400 mb-2">Smart Credit Economy + Subscriptions</h4>
              <p className="text-xs text-gray-400">Every AI call generates revenue: 1 credit = $0.01, 5x markup. 4 tiers (Free→$149.99/mo) + 6 credit packs ($4.99-$249.99) for scalable MRR</p>
            </div>
            <div className="p-4 bg-black/30 rounded-lg border border-green-500/10">
              <h4 className="text-sm font-semibold text-green-400 mb-2">AI Merch + Web3 Token Economy</h4>
              <p className="text-xs text-gray-400">Printful-integrated merchandise (6 products, artists keep 70%) + BTF utility token on Polygon, BTF Utility Hub, artist access packs, and service credit system</p>
            </div>
          </div>
        </Card>
      </div>

      {/* AI Artists as Digital Income-Producing Assets */}
      <Card className="p-4 sm:p-8 bg-gradient-to-br from-emerald-950/30 via-gray-900/90 to-black border-emerald-500/30">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500/30 to-green-500/20 flex items-center justify-center">
            <Bot className="h-6 w-6 text-emerald-400" />
          </div>
          <div>
            <span className="text-xs font-semibold text-emerald-400 tracking-wider uppercase">The Core Asset</span>
            <h3 className="text-xl sm:text-2xl font-bold text-white">AI Artists as Digital Income-Producing Assets</h3>
          </div>
        </div>

        <p className="text-gray-300 max-w-3xl mb-8 text-sm leading-relaxed">
          Each AI-generated artist on Boostify is not just a creative persona — it is a <span className="text-emerald-400 font-semibold">self-sustaining digital asset capable of generating continuous revenue</span> across multiple streams, autonomously, 24/7, without human intervention.
        </p>

        {/* AI ecosystem visual */}
        <div className="mb-8 rounded-xl overflow-hidden border border-emerald-500/20 shadow-xl shadow-emerald-500/10">
          <img
            src={INVESTOR_IMAGES.ai_technology}
            alt="AI technology neural network visualization"
            className="w-full h-auto max-h-56 sm:max-h-72 object-cover object-center"
            loading="lazy"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
          <div className="p-5 bg-black/40 rounded-xl border border-emerald-500/20 hover:border-emerald-500/40 transition-all">
            <div className="w-10 h-10 rounded-lg bg-emerald-500/20 flex items-center justify-center mb-4">
              <Music className="w-5 h-5 text-emerald-400" />
            </div>
            <h4 className="text-sm font-bold text-white mb-2">Autonomous Music Production</h4>
            <p className="text-xs text-gray-400">Each AI artist generates songs, albums, and releases on autopilot. Tracks are certified, distributed, and begin accumulating streaming royalties from day one.</p>
            <div className="mt-3 text-xs text-emerald-400 font-semibold">→ Streaming Royalties (24/7)</div>
          </div>

          <div className="p-5 bg-black/40 rounded-xl border border-purple-500/20 hover:border-purple-500/40 transition-all">
            <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center mb-4">
              <Coins className="w-5 h-5 text-purple-400" />
            </div>
            <h4 className="text-sm font-bold text-white mb-2">Token & NFT Economy</h4>
            <p className="text-xs text-gray-400">Every AI artist launches its own fan token on Polygon. The platform earns 5% on every trade, creating a compounding revenue flywheel as artists gain followers.</p>
            <div className="mt-3 text-xs text-purple-400 font-semibold">→ 5% Token Trading Fees</div>
          </div>

          <div className="p-5 bg-black/40 rounded-xl border border-amber-500/20 hover:border-amber-500/40 transition-all">
            <div className="w-10 h-10 rounded-lg bg-amber-500/20 flex items-center justify-center mb-4">
              <ShoppingBag className="w-5 h-5 text-amber-400" />
            </div>
            <h4 className="text-sm font-bold text-white mb-2">AI-Generated Merchandise</h4>
            <p className="text-xs text-gray-400">AI artists have unique visual identities. Their merch (T-shirts, hoodies, posters) is auto-generated and fulfilled via Printful. Platform earns 20% commission on every sale.</p>
            <div className="mt-3 text-xs text-amber-400 font-semibold">→ 20% Merch Commission</div>
          </div>

          <div className="p-5 bg-black/40 rounded-xl border border-pink-500/20 hover:border-pink-500/40 transition-all">
            <div className="w-10 h-10 rounded-lg bg-pink-500/20 flex items-center justify-center mb-4">
              <Users className="w-5 h-5 text-pink-400" />
            </div>
            <h4 className="text-sm font-bold text-white mb-2">Social Network Fan Growth</h4>
            <p className="text-xs text-gray-400">AI artists publish to the platform's social network, accumulate real followers, trigger email notifications, and auto-post to Instagram/YouTube via the Chrome Extension bridge.</p>
            <div className="mt-3 text-xs text-pink-400 font-semibold">→ Fan Engagement + Ad Revenue</div>
          </div>

          <div className="p-5 bg-black/40 rounded-xl border border-cyan-500/20 hover:border-cyan-500/40 transition-all">
            <div className="w-10 h-10 rounded-lg bg-cyan-500/20 flex items-center justify-center mb-4">
              <Zap className="w-5 h-5 text-cyan-400" />
            </div>
            <h4 className="text-sm font-bold text-white mb-2">Platform Event Automation</h4>
            <p className="text-xs text-gray-400">Song certified → auto-promotes. Token milestone → auto-announces. Every platform event triggers a chain of revenue-generating actions without human input.</p>
            <div className="mt-3 text-xs text-cyan-400 font-semibold">→ Autonomous Promotion Engine</div>
          </div>

          <div className="p-5 bg-black/40 rounded-xl border border-orange-500/20 hover:border-orange-500/40 transition-all">
            <div className="w-10 h-10 rounded-lg bg-orange-500/20 flex items-center justify-center mb-4">
              <TrendingUp className="w-5 h-5 text-orange-400" />
            </div>
            <h4 className="text-sm font-bold text-white mb-2">Compounding Asset Value</h4>
            <p className="text-xs text-gray-400">As an AI artist grows — more streams, more token holders, more merch buyers — its revenue compounds. The platform targets 50,000+ AI artists by end of 2026, each a revenue unit.</p>
            <div className="mt-3 text-xs text-orange-400 font-semibold">→ 50,000+ AI Artists by 2026</div>
          </div>
        </div>

        <div className="p-4 bg-gradient-to-r from-emerald-500/10 to-green-500/5 rounded-xl border border-emerald-500/20">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h4 className="text-sm font-bold text-white mb-1">Portfolio Logic: Each AI Artist = A Revenue-Generating Digital Asset</h4>
              <p className="text-xs text-gray-400">Think of each AI artist like a digital franchise unit. The platform owns the infrastructure; the AI artist generates the revenue. At 50K artists × average $400/year each = <span className="text-emerald-400 font-semibold">$20M ARR from AI artists alone.</span></p>
            </div>
            <div className="flex-shrink-0 text-center p-3 bg-emerald-500/20 rounded-xl border border-emerald-500/30">
              <div className="text-2xl font-bold text-emerald-400">50K</div>
              <div className="text-xs text-gray-400">AI Artists</div>
              <div className="text-xs text-emerald-400 mt-1">Target Y2026</div>
            </div>
          </div>
        </div>
      </Card>

      {/* Market Opportunity */}
      <Card className="p-4 sm:p-6 bg-gradient-to-br from-gray-900/90 to-gray-900/50 border-orange-500/20">
        <div className="flex items-center gap-3 mb-4 sm:mb-6">
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-orange-500/20 flex items-center justify-center flex-shrink-0">
            <Globe className="h-5 w-5 sm:h-6 sm:w-6 text-orange-400" />
          </div>
          <div>
            <h3 className="text-lg sm:text-xl font-bold text-white">Market Opportunity</h3>
            <p className="text-xs text-gray-400">Global Music Technology Market</p>
          </div>
        </div>

        {/* Market visualization image */}
        <div className="mb-6 rounded-xl overflow-hidden border border-orange-500/20 shadow-xl">
          <img
            src={INVESTOR_IMAGES.market_opportunity}
            alt="Global music market opportunity visualization"
            className="w-full h-auto max-h-52 sm:max-h-64 object-cover object-center"
            loading="lazy"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6 mb-6 sm:mb-8">
          {/* TAM */}
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-br from-orange-500/10 to-transparent rounded-2xl"></div>
            <div className="relative p-4 sm:p-6 text-center">
              <div className="w-24 sm:w-40 h-24 sm:h-40 mx-auto relative">
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="45" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="8"/>
                  <circle cx="50" cy="50" r="45" fill="none" stroke="url(#tamGradient)" strokeWidth="8" strokeDasharray="283" strokeDashoffset="0" strokeLinecap="round"/>
                  <defs>
                    <linearGradient id="tamGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#f97316" />
                      <stop offset="100%" stopColor="#eab308" />
                    </linearGradient>
                  </defs>
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-2xl sm:text-3xl font-bold text-orange-400">${marketData.totalAddressableMarket}B</span>
                  <span className="text-xs text-gray-400">by 2028</span>
                </div>
              </div>
              <h4 className="text-lg font-semibold text-white mt-4">TAM</h4>
              <p className="text-xs text-gray-400">Total Addressable Market</p>
              <p className="text-xs text-orange-400 mt-2">Global Music Tech Industry</p>
            </div>
          </div>

          {/* SAM */}
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 to-transparent rounded-2xl"></div>
            <div className="relative p-4 sm:p-6 text-center">
              <div className="w-24 sm:w-32 h-24 sm:h-32 mx-auto relative sm:mt-4">
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="45" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="8"/>
                  <circle cx="50" cy="50" r="45" fill="none" stroke="url(#samGradient)" strokeWidth="8" strokeDasharray="283" strokeDashoffset="85" strokeLinecap="round"/>
                  <defs>
                    <linearGradient id="samGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#a855f7" />
                      <stop offset="100%" stopColor="#ec4899" />
                    </linearGradient>
                  </defs>
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-2xl font-bold text-purple-400">${marketData.serviceableMarket}B</span>
                  <span className="text-[10px] text-gray-400">by 2028</span>
                </div>
              </div>
              <h4 className="text-lg font-semibold text-white mt-4">SAM</h4>
              <p className="text-xs text-gray-400">Serviceable Addressable Market</p>
              <p className="text-xs text-purple-400 mt-2">Independent Artist Tools & Services</p>
            </div>
          </div>

          {/* SOM */}
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-br from-yellow-500/10 to-transparent rounded-2xl"></div>
            <div className="relative p-4 sm:p-6 text-center">
              <div className="w-20 sm:w-24 h-20 sm:h-24 mx-auto relative sm:mt-8">
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="45" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="8"/>
                  <circle cx="50" cy="50" r="45" fill="none" stroke="url(#somGradient)" strokeWidth="8" strokeDasharray="283" strokeDashoffset="170" strokeLinecap="round"/>
                  <defs>
                    <linearGradient id="somGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#eab308" />
                      <stop offset="100%" stopColor="#22c55e" />
                    </linearGradient>
                  </defs>
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-xl font-bold text-yellow-400">${marketData.targetMarket}B</span>
                  <span className="text-[9px] text-gray-400">target</span>
                </div>
              </div>
              <h4 className="text-lg font-semibold text-white mt-4">SOM</h4>
              <p className="text-xs text-gray-400">Serviceable Obtainable Market</p>
              <p className="text-xs text-yellow-400 mt-2">Our 3-Year Target (0.2% capture)</p>
            </div>
          </div>
        </div>

        <div className="p-3 sm:p-4 bg-black/30 rounded-xl border border-orange-500/10">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
            <div>
              <span className="text-xs sm:text-sm text-gray-400">Market CAGR (2024-2030)</span>
              <div className="text-xl sm:text-2xl font-bold text-green-400">{marketData.growthRate}%</div>
            </div>
            <div className="grid grid-cols-3 gap-2 sm:gap-4 w-full sm:w-auto">
              <div className="text-center">
                <div className="text-sm sm:text-lg font-bold text-white">11M+</div>
                <div className="text-[10px] sm:text-xs text-gray-400">Independent Artists</div>
              </div>
              <div className="text-center">
                <div className="text-sm sm:text-lg font-bold text-white">60K+</div>
                <div className="text-[10px] sm:text-xs text-gray-400">Songs Uploaded/Day</div>
              </div>
              <div className="text-center">
                <div className="text-sm sm:text-lg font-bold text-white">$3.5B</div>
                <div className="text-[10px] sm:text-xs text-gray-400">AI Music Market 2025</div>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Business Model & Revenue Streams */}
      <Card className="p-4 sm:p-6 bg-gradient-to-br from-gray-900/90 to-gray-900/50 border-orange-500/20">
        <div className="flex items-center gap-3 mb-4 sm:mb-6">
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-green-500/20 flex items-center justify-center flex-shrink-0">
            <PieChart className="h-5 w-5 sm:h-6 sm:w-6 text-green-400" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-white">Business Model</h3>
            <p className="text-xs text-gray-400">Multiple Revenue Streams by Year 3 ($52M ARR)</p>
          </div>
        </div>

        {/* Revenue streams visual */}
        <div className="mb-6 rounded-xl overflow-hidden border border-green-500/20 shadow-xl">
          <img
            src={INVESTOR_IMAGES.revenue_streams}
            alt="Revenue streams financial dashboard"
            className="w-full h-auto max-h-52 sm:max-h-64 object-cover object-center"
            loading="lazy"
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
          {/* Revenue Streams Chart */}
          <div className="space-y-3 sm:space-y-4">
            {revenueStreams.map((stream, index) => (
              <div key={index}>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm text-white">{stream.name}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-gray-300">{stream.amount}</span>
                    <span className="text-xs text-gray-500">({stream.percentage}%)</span>
                  </div>
                </div>
                <div className="w-full h-3 bg-white/10 rounded-full overflow-hidden">
                  <div 
                    className={`h-full bg-gradient-to-r ${stream.color} rounded-full transition-all duration-1000`}
                    style={{ width: `${stream.percentage}%` }}
                  ></div>
                </div>
              </div>
            ))}
          </div>

          {/* Revenue Model Details */}
          <div className="grid grid-cols-2 gap-2 sm:gap-4">
            <div className="p-4 bg-black/30 rounded-xl border border-orange-500/10">
              <div className="flex items-center gap-2 mb-2">
                <CreditCard className="w-4 h-4 text-orange-400" />
                <span className="text-xs font-semibold text-white">Subscriptions</span>
              </div>
              <p className="text-[10px] text-gray-400 mb-2">Monthly recurring revenue from 5 tiers</p>
              <div className="space-y-1 text-[10px]">
                <div className="flex justify-between">
                  <span className="text-gray-500">Artist</span>
                  <span className="text-orange-400">$19.99/mo</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Elevate</span>
                  <span className="text-orange-400">$49.99/mo</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Amplify</span>
                  <span className="text-orange-400">$89.99/mo</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Dominate</span>
                  <span className="text-orange-400">$149.99/mo</span>
                </div>
              </div>
            </div>

            <div className="p-4 bg-black/30 rounded-xl border border-purple-500/10">
              <div className="flex items-center gap-2 mb-2">
                <Video className="w-4 h-4 text-purple-400" />
                <span className="text-xs font-semibold text-white">AI Videos</span>
              </div>
              <p className="text-[10px] text-gray-400 mb-2">Pay-per-video generation</p>
              <div className="space-y-1 text-[10px]">
                <div className="flex justify-between">
                  <span className="text-gray-500">Standard</span>
                  <span className="text-purple-400">$199</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Premium</span>
                  <span className="text-purple-400">$399</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Enterprise</span>
                  <span className="text-purple-400">$999+</span>
                </div>
              </div>
            </div>

            <div className="p-4 bg-black/30 rounded-xl border border-yellow-500/10">
              <div className="flex items-center gap-2 mb-2">
                <Coins className="w-4 h-4 text-yellow-400" />
                <span className="text-xs font-semibold text-white">Blockchain</span>
              </div>
              <p className="text-[10px] text-gray-400 mb-2">Transaction fees & tokenization</p>
              <div className="space-y-1 text-[10px]">
                <div className="flex justify-between">
                  <span className="text-gray-500">Trading Fee</span>
                  <span className="text-yellow-400">5%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Token Deploy</span>
                  <span className="text-yellow-400">3%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Royalties</span>
                  <span className="text-yellow-400">2%</span>
                </div>
              </div>
            </div>

            <div className="p-4 bg-black/30 rounded-xl border border-cyan-500/10">
              <div className="flex items-center gap-2 mb-2">
                <Award className="w-4 h-4 text-cyan-400" />
                <span className="text-xs font-semibold text-white">Licensing</span>
              </div>
              <p className="text-[10px] text-gray-400 mb-2">Music licensing & streaming royalties</p>
              <div className="space-y-1 text-[10px]">
                <div className="flex justify-between">
                  <span className="text-gray-500">Platform Fee</span>
                  <span className="text-cyan-400">15%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Sync License</span>
                  <span className="text-cyan-400">20%</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Financial Projections */}
      <Card className="p-4 sm:p-6 bg-gradient-to-br from-gray-900/90 to-gray-900/50 border-orange-500/20">
        <div className="flex items-center gap-3 mb-4 sm:mb-6">
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-cyan-500/20 flex items-center justify-center flex-shrink-0">
            <LineChart className="h-6 w-6 text-cyan-400" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-white">5-Year Financial Projections</h3>
            <p className="text-xs text-gray-400">Revenue & User Growth Trajectory</p>
          </div>
        </div>

        {/* Revenue Chart */}
        <div className="h-64 sm:h-80 bg-black/30 rounded-xl p-3 sm:p-6 mb-4 sm:mb-6 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-orange-500/5 to-cyan-500/5"></div>
          
          <div className="relative z-10 h-full flex flex-col">
            <div className="flex-1 flex items-end gap-1 sm:gap-4">
              {revenueProjections.map((item, index) => (
                <div key={index} className="flex-1 flex flex-col items-center">
                  <div className="w-full max-w-8 sm:max-w-16 relative">
                    {/* Bar */}
                    <div 
                      className="w-full bg-gradient-to-t from-orange-500 to-amber-400 rounded-t-lg transition-all duration-1000 mx-auto"
                      style={{ height: `${(item.revenue / 100) * 200}px`, maxHeight: '200px' }}
                    >
                      <div className="absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap">
                        <span className="text-sm font-bold text-orange-400">${item.revenue}M</span>
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 text-center">
                    <div className="text-xs font-semibold text-white">{item.year}</div>
                    <div className="text-[10px] text-gray-500">{(item.users / 1000).toFixed(0)}K users</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-4">
          <div className="p-3 sm:p-4 bg-gradient-to-br from-orange-500/10 to-transparent rounded-xl border border-orange-500/20 text-center">
            <div className="text-xl sm:text-2xl font-bold text-orange-400">43x</div>
            <div className="text-xs text-gray-400 mt-1">Revenue Growth (5Y)</div>
          </div>
          <div className="p-3 sm:p-4 bg-gradient-to-br from-green-500/10 to-transparent rounded-xl border border-green-500/20 text-center">
            <div className="text-xl sm:text-2xl font-bold text-green-400">74%</div>
            <div className="text-xs text-gray-400 mt-1">Gross Margin Target</div>
          </div>
          <div className="p-3 sm:p-4 bg-gradient-to-br from-purple-500/10 to-transparent rounded-xl border border-purple-500/20 text-center">
            <div className="text-xl sm:text-2xl font-bold text-purple-400">$620</div>
            <div className="text-xs text-gray-400 mt-1">LTV per User (Y3)</div>
          </div>
          <div className="p-3 sm:p-4 bg-gradient-to-br from-cyan-500/10 to-transparent rounded-xl border border-cyan-500/20 text-center">
            <div className="text-xl sm:text-2xl font-bold text-cyan-400">$52</div>
            <div className="text-xs text-gray-400 mt-1">CAC Target</div>
          </div>
        </div>
      </Card>

      {/* Competitive Advantage */}
      <Card className="p-4 sm:p-6 bg-gradient-to-br from-gray-900/90 to-gray-900/50 border-orange-500/20">
        <div className="flex items-center gap-3 mb-4 sm:mb-6">
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-yellow-500/20 flex items-center justify-center flex-shrink-0">
            <Shield className="h-5 w-5 sm:h-6 sm:w-6 text-yellow-400" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-white">Competitive Moat</h3>
            <p className="text-xs text-gray-400">What Makes Us Different</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {competitiveAdvantages.map((advantage, index) => (
            <div key={index} className="p-4 sm:p-5 bg-black/30 rounded-xl border border-white/10 hover:border-orange-500/30 transition-all group">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-orange-500/20 to-amber-500/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <advantage.icon className="w-5 h-5 text-orange-400" />
              </div>
              <h4 className="text-sm font-semibold text-white mb-2">{advantage.title}</h4>
              <p className="text-xs text-gray-400 mb-3">{advantage.description}</p>
              <div className="inline-flex items-center gap-1 px-2 py-1 bg-orange-500/10 rounded-full">
                <Sparkles className="w-3 h-3 text-orange-400" />
                <span className="text-[10px] text-orange-400 font-medium">{advantage.metric}</span>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Platform Integrations & Technology Moat */}
      <Card className="p-4 sm:p-6 bg-gradient-to-br from-blue-950/20 via-gray-900/90 to-black border-blue-500/20">
        <div className="flex items-center gap-3 mb-4 sm:mb-6">
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-blue-500/20 flex items-center justify-center flex-shrink-0">
            <Workflow className="h-5 w-5 sm:h-6 sm:w-6 text-blue-400" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-white">Platform Integrations & Technology Stack</h3>
            <p className="text-xs text-gray-400">5 Live Integration Layers — Production-Ready as of 2025</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          <div className="p-4 bg-black/40 rounded-xl border border-pink-500/20 hover:border-pink-500/40 transition-all">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-lg bg-pink-500/20 flex items-center justify-center">
                <Users className="w-4 h-4 text-pink-400" />
              </div>
              <span className="text-sm font-bold text-white">Social Network (5-Phase)</span>
            </div>
            <p className="text-xs text-gray-400 mb-2">Full social graph with real user follows, likes, comments, notifications. Artists and fans connect directly on-platform.</p>
            <div className="space-y-1">
              <div className="flex items-center gap-1 text-[10px] text-pink-400"><span className="w-1.5 h-1.5 bg-pink-400 rounded-full flex-shrink-0"></span> Real-time follow/unfollow system</div>
              <div className="flex items-center gap-1 text-[10px] text-pink-400"><span className="w-1.5 h-1.5 bg-pink-400 rounded-full flex-shrink-0"></span> Brevo email notifications (likes, follows, viral)</div>
              <div className="flex items-center gap-1 text-[10px] text-pink-400"><span className="w-1.5 h-1.5 bg-pink-400 rounded-full flex-shrink-0"></span> Weekly digest emails to all fans</div>
            </div>
          </div>

          <div className="p-4 bg-black/40 rounded-xl border border-orange-500/20 hover:border-orange-500/40 transition-all">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-lg bg-orange-500/20 flex items-center justify-center">
                <Globe className="w-4 h-4 text-orange-400" />
              </div>
              <span className="text-sm font-bold text-white">Chrome Extension Bridge</span>
            </div>
            <p className="text-xs text-gray-400 mb-2">Platform posts are queued and published automatically to Instagram and YouTube via a custom Chrome Extension — no manual posting required.</p>
            <div className="space-y-1">
              <div className="flex items-center gap-1 text-[10px] text-orange-400"><span className="w-1.5 h-1.5 bg-orange-400 rounded-full flex-shrink-0"></span> Instagram auto-publish queue</div>
              <div className="flex items-center gap-1 text-[10px] text-orange-400"><span className="w-1.5 h-1.5 bg-orange-400 rounded-full flex-shrink-0"></span> YouTube video scheduling</div>
              <div className="flex items-center gap-1 text-[10px] text-orange-400"><span className="w-1.5 h-1.5 bg-orange-400 rounded-full flex-shrink-0"></span> 5-min background dispatch worker</div>
            </div>
          </div>

          <div className="p-4 bg-black/40 rounded-xl border border-cyan-500/20 hover:border-cyan-500/40 transition-all">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-lg bg-cyan-500/20 flex items-center justify-center">
                <Zap className="w-4 h-4 text-cyan-400" />
              </div>
              <span className="text-sm font-bold text-white">Platform Events Engine</span>
            </div>
            <p className="text-xs text-gray-400 mb-2">Every major artist event (song certified, token launched, milestone reached) automatically triggers promotions and social actions — zero manual effort.</p>
            <div className="space-y-1">
              <div className="flex items-center gap-1 text-[10px] text-cyan-400"><span className="w-1.5 h-1.5 bg-cyan-400 rounded-full flex-shrink-0"></span> song_certified → auto-IG post</div>
              <div className="flex items-center gap-1 text-[10px] text-cyan-400"><span className="w-1.5 h-1.5 bg-cyan-400 rounded-full flex-shrink-0"></span> token_launched → fan notification blast</div>
              <div className="flex items-center gap-1 text-[10px] text-cyan-400"><span className="w-1.5 h-1.5 bg-cyan-400 rounded-full flex-shrink-0"></span> viral_post → cross-platform amplification</div>
            </div>
          </div>

          <div className="p-4 bg-black/40 rounded-xl border border-purple-500/20 hover:border-purple-500/40 transition-all">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center">
                <Bot className="w-4 h-4 text-purple-400" />
              </div>
              <span className="text-sm font-bold text-white">Agent NLP → External Actions</span>
            </div>
            <p className="text-xs text-gray-400 mb-2">Artists talk to AI agents in natural language. The agent understands intent and executes real external actions: publish to Instagram, email fans, schedule content.</p>
            <div className="space-y-1">
              <div className="flex items-center gap-1 text-[10px] text-purple-400"><span className="w-1.5 h-1.5 bg-purple-400 rounded-full flex-shrink-0"></span> Chat → IG post (auto-detected)</div>
              <div className="flex items-center gap-1 text-[10px] text-purple-400"><span className="w-1.5 h-1.5 bg-purple-400 rounded-full flex-shrink-0"></span> Chat → email blast to fans</div>
              <div className="flex items-center gap-1 text-[10px] text-purple-400"><span className="w-1.5 h-1.5 bg-purple-400 rounded-full flex-shrink-0"></span> Intent routing via external-action-router</div>
            </div>
          </div>

          <div className="p-4 bg-black/40 rounded-xl border border-yellow-500/20 hover:border-yellow-500/40 transition-all">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-lg bg-yellow-500/20 flex items-center justify-center">
                <Workflow className="w-4 h-4 text-yellow-400" />
              </div>
              <span className="text-sm font-bold text-white">Background Automation Worker</span>
            </div>
            <p className="text-xs text-gray-400 mb-2">A real-time background worker runs 24/7 orchestrating email flushes, post dispatches, and event processing — keeping the entire ecosystem alive automatically.</p>
            <div className="space-y-1">
              <div className="flex items-center gap-1 text-[10px] text-yellow-400"><span className="w-1.5 h-1.5 bg-yellow-400 rounded-full flex-shrink-0"></span> 2-min: email notification flush</div>
              <div className="flex items-center gap-1 text-[10px] text-yellow-400"><span className="w-1.5 h-1.5 bg-yellow-400 rounded-full flex-shrink-0"></span> 5-min: external post dispatch</div>
              <div className="flex items-center gap-1 text-[10px] text-yellow-400"><span className="w-1.5 h-1.5 bg-yellow-400 rounded-full flex-shrink-0"></span> Hourly: weekly digest scheduling</div>
            </div>
          </div>

          <div className="p-4 bg-black/40 rounded-xl border border-green-500/20 hover:border-green-500/40 transition-all">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-lg bg-green-500/20 flex items-center justify-center">
                <Shield className="w-4 h-4 text-green-400" />
              </div>
              <span className="text-sm font-bold text-white">Tech Stack Defensibility</span>
            </div>
            <p className="text-xs text-gray-400 mb-2">Built on a battle-tested stack: React + TypeScript, PostgreSQL/Neon, Drizzle ORM, Brevo email, Polygon blockchain, Printful fulfillment, and OpenRouter AI orchestration.</p>
            <div className="space-y-1">
              <div className="flex items-center gap-1 text-[10px] text-green-400"><span className="w-1.5 h-1.5 bg-green-400 rounded-full flex-shrink-0"></span> 122 pages, 569 components live</div>
              <div className="flex items-center gap-1 text-[10px] text-green-400"><span className="w-1.5 h-1.5 bg-green-400 rounded-full flex-shrink-0"></span> 112+ API endpoints production-ready</div>
              <div className="flex items-center gap-1 text-[10px] text-green-400"><span className="w-1.5 h-1.5 bg-green-400 rounded-full flex-shrink-0"></span> Multi-model AI (MiMo, Claude, GPT-4o)</div>
            </div>
          </div>
        </div>
      </Card>

      {/* Use of Funds */}
      <Card className="p-4 sm:p-6 bg-gradient-to-br from-gray-900/90 to-gray-900/50 border-orange-500/20">
        <div className="flex items-center gap-3 mb-4 sm:mb-6">
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-purple-500/20 flex items-center justify-center flex-shrink-0">
            <Briefcase className="h-5 w-5 sm:h-6 sm:w-6 text-purple-400" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-white">Use of Funds</h3>
            <p className="text-xs text-gray-400">Seed Round ($1.5M) Allocation Strategy</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
          {/* Pie Chart Visual */}
          <div className="relative flex items-center justify-center">
            <div className="w-48 sm:w-64 h-48 sm:h-64 relative">
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="40" fill="none" stroke="rgba(249,115,22,0.3)" strokeWidth="20" strokeDasharray="100.5 150.8" strokeDashoffset="0"/>
                <circle cx="50" cy="50" r="40" fill="none" stroke="rgba(168,85,247,0.3)" strokeWidth="20" strokeDasharray="75.4 175.9" strokeDashoffset="-100.5"/>
                <circle cx="50" cy="50" r="40" fill="none" stroke="rgba(34,197,94,0.3)" strokeWidth="20" strokeDasharray="37.7 213.6" strokeDashoffset="-175.9"/>
                <circle cx="50" cy="50" r="40" fill="none" stroke="rgba(59,130,246,0.3)" strokeWidth="20" strokeDasharray="37.7 213.6" strokeDashoffset="-213.6"/>
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-3xl font-bold text-white">$1.5M</span>
                <span className="text-xs text-gray-400">Seed Round</span>
              </div>
            </div>
          </div>

          {/* Fund Breakdown */}
          <div className="space-y-4">
            {useOfFunds.map((fund, index) => {
              const colors = ['from-orange-400 to-amber-500', 'from-purple-400 to-pink-500', 'from-green-400 to-emerald-500', 'from-blue-400 to-cyan-500'];
              const textColors = ['text-orange-400', 'text-purple-400', 'text-green-400', 'text-blue-400'];
              return (
                <div key={index} className="p-4 bg-black/30 rounded-xl border border-white/10">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-semibold text-white">{fund.category}</span>
                    <div className="flex items-center gap-2">
                      <span className={`text-lg font-bold ${textColors[index]}`}>{fund.percentage}%</span>
                      <span className="text-xs text-gray-500">${((fund.percentage / 100) * 1500).toFixed(0)}K</span>
                    </div>
                  </div>
                  <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden mb-2">
                    <div 
                      className={`h-full bg-gradient-to-r ${colors[index]} rounded-full`}
                      style={{ width: `${fund.percentage}%` }}
                    ></div>
                  </div>
                  <p className="text-[10px] text-gray-400">{fund.description}</p>
                </div>
              );
            })}
          </div>
        </div>
      </Card>

      {/* Team & Milestones */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {/* Team */}
        <Card className="p-4 sm:p-6 bg-gradient-to-br from-gray-900/90 to-gray-900/50 border-orange-500/20">
          <div className="flex items-center gap-3 mb-4 sm:mb-6">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-cyan-500/20 flex items-center justify-center flex-shrink-0">
              <Users className="h-5 w-5 sm:h-6 sm:w-6 text-cyan-400" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-white">Leadership Team</h3>
              <p className="text-xs text-gray-400">Experienced Founders</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:gap-4">
            {teamMembers.map((member, index) => (
              <div key={index} className="p-3 sm:p-4 bg-black/30 rounded-xl border border-white/10 text-center">
                <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-gradient-to-br from-orange-400 to-amber-600 flex items-center justify-center">
                  <Star className="w-6 h-6 text-white" />
                </div>
                <h4 className="text-sm font-semibold text-white">{member.role}</h4>
                <p className="text-[10px] text-orange-400 mt-1">{member.expertise}</p>
                <p className="text-[10px] text-gray-500 mt-1">{member.experience}</p>
              </div>
            ))}
          </div>
        </Card>

        {/* Milestones */}
        <Card className="p-4 sm:p-6 bg-gradient-to-br from-gray-900/90 to-gray-900/50 border-orange-500/20">
          <div className="flex items-center gap-3 mb-4 sm:mb-6">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-green-500/20 flex items-center justify-center flex-shrink-0">
              <Target className="h-5 w-5 sm:h-6 sm:w-6 text-green-400" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-white">Key Milestones</h3>
              <p className="text-xs text-gray-400">Execution Roadmap</p>
            </div>
          </div>

          <div className="space-y-3">
            {milestones.map((item, index) => (
              <div key={index} className="flex items-center gap-4 p-3 bg-black/30 rounded-lg border border-white/10">
                <div className="w-16 text-center">
                  <span className="text-xs font-semibold text-orange-400">{item.date}</span>
                </div>
                <div className="flex-1">
                  <span className="text-sm text-white">{item.milestone}</span>
                </div>
                <div className="w-8 h-8 rounded-full bg-yellow-500/20 flex items-center justify-center">
                  <ArrowUpRight className="w-4 h-4 text-yellow-400" />
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Investment Ask / CTA */}
      <Card className="relative overflow-hidden bg-gradient-to-br from-orange-500/20 via-amber-500/10 to-yellow-500/20 border-orange-500/40 p-4 sm:p-8">
        <div className="absolute top-0 right-0 w-80 h-80 bg-orange-500/10 rounded-full filter blur-3xl"></div>
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-yellow-500/10 rounded-full filter blur-3xl"></div>
        
        <div className="relative z-10 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-black/30 rounded-full mb-6">
            <Rocket className="w-4 h-4 text-orange-400" />
            <span className="text-sm font-semibold text-orange-400">Seed Round Now Open</span>
          </div>

          <h3 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white mb-3 sm:mb-4">
            Join the <span className="bg-gradient-to-r from-orange-400 to-yellow-400 bg-clip-text text-transparent">Revolution</span>
          </h3>

          <p className="text-gray-300 max-w-2xl mx-auto mb-8">
            Be part of the future of music technology. We're raising this Seed Round via a <strong className="text-orange-400">Post-Money SAFE</strong> with a minimum ticket of <strong className="text-orange-400">$1.5M per investor</strong> — offering only <strong className="text-orange-400">3.5% of the total platform equity</strong>, implying a <strong className="text-yellow-400">~$42.9M post-money valuation</strong>. This sits on top of <strong className="text-orange-400">$1.8M already invested by Omnia Strategic Holding Corporation</strong> over 3 years of development. Early strategic investors receive priority access to future rounds and board observer seats.
          </p>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-4 max-w-3xl mx-auto mb-6 sm:mb-8">
            <div className="p-3 sm:p-4 bg-black/40 rounded-xl border border-orange-500/30">
              <div className="text-xl sm:text-2xl font-bold text-orange-400">$1.5M</div>
              <div className="text-xs text-gray-400">Min Ticket / Investor</div>
            </div>
            <div className="p-3 sm:p-4 bg-black/40 rounded-xl border border-orange-500/30">
              <div className="text-xl sm:text-2xl font-bold text-yellow-400">$42.9M</div>
              <div className="text-xs text-gray-400">Post-Money Valuation</div>
            </div>
            <div className="p-3 sm:p-4 bg-black/40 rounded-xl border border-orange-500/30">
              <div className="text-xl sm:text-2xl font-bold text-green-400">3.5%</div>
              <div className="text-xs text-gray-400">Total Equity Dilution</div>
            </div>
            <div className="p-3 sm:p-4 bg-black/40 rounded-xl border border-orange-500/30">
              <div className="text-xl sm:text-2xl font-bold text-cyan-400">SAFE</div>
              <div className="text-xs text-gray-400">Instrument Type</div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row flex-wrap justify-center gap-3 sm:gap-4">
            <Button 
              size="lg" 
              onClick={() => setSelectedTab('register')}
              className="w-full sm:w-auto bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-white font-bold shadow-lg shadow-orange-500/30 sm:px-8"
            >
              <DollarSign className="mr-2 h-5 w-5" />
              Invest Now
            </Button>
            <Button 
              variant="outline" 
              size="lg" 
              onClick={() => window.location.href = '/investor-documents'}
              className="w-full sm:w-auto border-green-500/50 text-green-300 hover:bg-green-500/10 sm:px-8"
            >
              <FileText className="mr-2 h-5 w-5" />
              📄 Review & Sign Documents
            </Button>
            <Button 
              variant="outline" 
              size="lg" 
              onClick={handleDownloadPDF}
              className="w-full sm:w-auto border-orange-500/50 text-orange-300 hover:bg-orange-500/10 sm:px-8"
            >
              <Download className="mr-2 h-5 w-5" />
              Download Full Deck (PDF)
            </Button>
          </div>

          <p className="text-xs text-gray-500 mt-6 max-w-xl mx-auto">
            * Investment involves risk. Past performance is not indicative of future results. 
            Please review all documentation and consult with financial advisors before investing.
          </p>
        </div>
      </Card>
    </div>
  );
}

// Platform Metrics Overview (replaces ROI calculator — internal admin view only)
function InvestmentCalculator() {
  const platformMetrics = [
    { label: "AI Services Available", value: "12+", sub: "Song, video, cover, campaign tools" },
    { label: "Revenue Streams", value: "6+", sub: "SaaS, services, merch, licensing" },
    { label: "AI Agents", value: "7", sub: "Autonomous artist career engine" },
    { label: "Target Artists", value: "50K", sub: "End of 2026 goal" },
  ];

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-amber-500/30 bg-amber-900/10 px-4 py-3 text-xs text-amber-300">
        <strong>Note:</strong> Financial projections shown here are internal business estimates only. They do not represent
        promised returns to any token holder. BTF is a utility token; it does not provide investment returns, revenue share,
        or any financial benefit from platform revenue.
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {platformMetrics.map((m, i) => (
          <Card key={i} className="p-4 bg-black/30 border-orange-500/20 text-center">
            <p className="text-2xl font-bold text-orange-400">{m.value}</p>
            <p className="text-sm font-medium text-white mt-1">{m.label}</p>
            <p className="text-xs text-gray-500 mt-0.5">{m.sub}</p>
          </Card>
        ))}
      </div>
    </div>
  );
}

// Componente Timeline Roadmap
function RoadmapTimeline() {
  const [expandedItems, setExpandedItems] = useState<number[]>([]);
  
  const toggleExpand = (index: number) => {
    setExpandedItems(prev => 
      prev.includes(index) ? prev.filter(i => i !== index) : [...prev, index]
    );
  };

  const roadmapData = [
    {
      date: "January 2024",
      title: "Boostify Project Launch",
      description: "Development of technological foundation: platform architecture, initial Firebase integration, and business model design.",
      stats: "Foundation established",
      status: "completed",
      isKey: true
    },
    {
      date: "March 2024",
      title: "AI Music Video Generation Prototype",
      description: "Initial implementation of AI-powered music video generation. First tests with Gemini 2.5 Flash (Nano Banana).",
      stats: "10 test videos generated",
      status: "completed"
    },
    {
      date: "June 2024",
      title: "Director System & JSON Profiles",
      description: "Development of 10 cinematographic directors with unique styles, each with detailed JSON profiles for video customization.",
      stats: "10 directors configured",
      status: "completed"
    },
    {
      date: "August 2024",
      title: "Lip-Sync Integration with Fal.ai MuseTalk",
      description: "Implementation of automatic lip-sync for music videos, significantly improving final product quality.",
      stats: "Perfect lip-sync synchronization",
      status: "completed"
    },
    {
      date: "October 2024",
      title: "Firebase Storage & Media Management",
      description: "Complete cloud storage system for AI-generated videos, images, and assets.",
      stats: "Scalable infrastructure ready",
      status: "completed"
    },
    {
      date: "December 2024",
      title: "Distribution Tools & Manager Suite",
      description: "Launch of music distribution tools and comprehensive manager suite with automatic generation of 11 professional document types.",
      stats: "Closed beta with 50 users",
      status: "completed",
      isKey: true
    },
    {
      date: "February 2025",
      title: "Artist Social Network",
      description: "Internal social platform connecting artists, producers, and managers. Posts, comments, and collaboration system.",
      stats: "200 active beta users",
      status: "completed"
    },
    {
      date: "April 2025",
      title: "Stripe Integration",
      description: "Complete payment and subscription system. Artist ($19.99), Elevate ($49.99), Amplify ($89.99), and Dominate ($149.99) monthly plans.",
      stats: "Payment system operational",
      status: "completed"
    },
    {
      date: "June 2025",
      title: "Investors Dashboard",
      description: "Investor portal with financial simulations, roadmap, and registration system. Seed Round launch.",
      stats: "Seed Round open",
      status: "completed",
      isKey: true
    },
    {
      date: "August 2025",
      title: "Cinematic Cover Art Generation",
      description: "AI system for generating album covers with cinematic quality using renowned director styles.",
      stats: "1,000+ covers generated",
      status: "completed"
    },
    {
      date: "October 2025",
      title: "Infrastructure Optimization",
      description: "Preparation of infrastructure for massive growth. Database optimization, distributed caching, and global CDN.",
      stats: "Scalable infrastructure ready",
      status: "completed"
    },
    {
      date: "December 2025",
      title: "Spotify & Apple Music Integration",
      description: "Direct connection with major streaming platforms for automatic profile sync, analytics, and distribution.",
      stats: "APIs fully integrated",
      status: "completed"
    },
    {
      date: "January 2026",
      title: "Auto Music Video Generator + 1,000 Users Milestone",
      description: "Complete implementation of automatic music video generator. Fully operational system integrated with artist platform. First growth milestone achieved.",
      stats: "100% functional videos, 1,000 users, $100K MRR",
      status: "completed",
      isKey: true
    },
    {
      date: "February 2026",
      title: "Boostify Records Launch",
      description: "Creation of Boostify Records: world's first AI-powered record label identifying, signing, and developing artists with predictive AI analysis.",
      stats: "World's first 100% AI label",
      status: "completed",
      isKey: true
    },
    {
      date: "March 2026",
      title: "Collaboration Marketplace",
      description: "Platform connecting artists with producers, engineers, videographers, and other creative professionals.",
      stats: "500+ active collaborations",
      status: "completed"
    },
    {
      date: "April 2026",
      title: "New Revenue Engines: Cinematic Events, Karaoke & Vinyl",
      description: "Launch of multiple new business models: AI Cinematic Events page, Karaoke & Talk-to-Me (ElevenLabs voice), AI Merch (Printful) and physical Vinyl editions — expanding ARPU across the artist ecosystem.",
      stats: "5+ new revenue streams live",
      status: "completed",
      isKey: true
    },
    {
      date: "May 2026",
      title: "Seed Round Close - $1.5M (SAFE)",
      description: "Seed Round closed via Post-Money SAFE at a ~$42.9M post-money valuation (3.5% equity). Capital deployed on top of $1.8M already invested by Omnia Strategic Holding Corporation to scale AI infrastructure and artist acquisition.",
      stats: "$1.5M raised, ~$42.9M post-money",
      status: "in-progress",
      isKey: true
    },
    {
      date: "June 2026",
      title: "AI Record Label - Predictive System",
      description: "Implementation of machine learning algorithms to identify artists with viral potential. Streaming data, engagement, and trend analysis.",
      stats: "AI identifies hits with 85% accuracy",
      status: "upcoming"
    },
    {
      date: "July 2026",
      title: "Milestone: 5,000 Active Users",
      description: "Significant user base expansion. Target of $550K monthly recurring revenue.",
      stats: "5,000 users, $550K MRR",
      status: "upcoming",
      isKey: true
    },
    {
      date: "August 2026",
      title: "Boostify Blockchain - Music Tokenization",
      description: "Launch of proprietary blockchain for tokenizing music rights, creating song NFTs, and automatic smart contract royalties.",
      stats: "First music blockchain",
      status: "upcoming",
      isKey: true
    },
    {
      date: "September 2026",
      title: "TikTok & YouTube Integration",
      description: "Automatic distribution of music videos to social networks. Promotion tools and engagement analytics.",
      stats: "Complete multi-platform",
      status: "upcoming"
    },
    {
      date: "October 2026",
      title: "Series A - $3M",
      description: "Priced equity round focused on market expansion and enterprise features for record labels. Target 35,000 active users and $18.5M ARR.",
      stats: "$3M raised, 35K users, $18.5M ARR",
      status: "upcoming",
      isKey: true
    },
    {
      date: "December 2026",
      title: "Milestone: 35,000 Active Users",
      description: "Strategic milestone achieved. Consolidation as leading AI-powered music platform. Projected $18.5M ARR.",
      stats: "35,000 users, $18.5M ARR",
      status: "upcoming",
      isKey: true
    },
    {
      date: "Q4 2027",
      title: "Series B - $10M",
      description: "Priced equity round for global scaling, advanced AI features development, and strategic partnerships. Target 90,000 active users and $52M ARR.",
      stats: "$10M raised, 90K users, $52M ARR",
      status: "upcoming",
      isKey: true
    },
    {
      date: "March 2027",
      title: "Boostify Records - First Signed Artists",
      description: "Signing of first 10 AI-identified artists. Production, marketing, and distribution completely algorithm-managed.",
      stats: "10 artists under AI management",
      status: "upcoming"
    },
    {
      date: "June 2027",
      title: "Live Blockchain Royalties",
      description: "Real-time royalty payment system using Boostify Blockchain. Complete transparency and automatic distribution to all stakeholders.",
      stats: "Instant 24/7 payments",
      status: "upcoming",
      isKey: true
    }
  ];

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Projected Growth Chart */}
      <div className="bg-gradient-to-r from-orange-400/10 to-transparent p-3 sm:p-6 rounded-lg mb-4 sm:mb-8">
        <h4 className="text-sm sm:text-lg font-semibold mb-3 sm:mb-4">Projected User Growth</h4>
        <div className="h-48 sm:h-64 relative">
          {/* Y-Axis */}
          <div className="absolute left-0 top-0 bottom-0 w-8 sm:w-12 flex flex-col justify-between items-end pr-1 sm:pr-2">
            <span className="text-[10px] sm:text-xs text-muted-foreground">90K</span>
            <span className="text-[10px] sm:text-xs text-muted-foreground">67.5K</span>
            <span className="text-[10px] sm:text-xs text-muted-foreground">45K</span>
            <span className="text-[10px] sm:text-xs text-muted-foreground">22.5K</span>
            <span className="text-[10px] sm:text-xs text-muted-foreground">0</span>
          </div>
          
          {/* Chart */}
          <div className="ml-8 sm:ml-12 h-full flex items-end">
            <div className="flex-1 flex items-end gap-0.5 sm:gap-1">
              {[
                { month: "Jan '26", users: 1000, height: "4px" },
                { month: "Apr '26", users: 4000, height: "14px" },
                { month: "Jul '26", users: 8000, height: "25px" },
                { month: "Oct '26", users: 18000, height: "54px" },
                { month: "Dec '26", users: 35000, height: "104px" },
                { month: "Mar '27", users: 48000, height: "140px" },
                { month: "Jun '27", users: 60000, height: "176px" },
                { month: "Sep '27", users: 75000, height: "218px" },
                { month: "Dec '27", users: 90000, height: "260px" }
              ].map((item, index) => (
                <div key={index} className="flex flex-col items-center flex-1 min-w-0">
                  <div 
                    className="w-full max-w-[20px] sm:max-w-[50px] bg-gradient-to-t from-orange-400 to-orange-400 rounded-t relative group cursor-pointer transition-all hover:from-orange-600 hover:to-orange-500"
                    style={{ height: item.height }}
                  >
                    <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-black/80 text-white text-[10px] sm:text-xs py-1 px-2 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                      {item.users.toLocaleString()} users
                    </div>
                  </div>
                  <span className="text-[7px] sm:text-xs mt-1 sm:mt-2 text-muted-foreground whitespace-nowrap">{item.month}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      
      {/* Timeline */}
      <div className="relative mt-4 sm:mt-8">
        <div className="absolute left-4 sm:left-8 top-0 bottom-0 w-0.5 bg-orange-500/20"></div>
        <div className="space-y-4 sm:space-y-8">
          {roadmapData.map((item, index) => (
            <div key={index} className="relative pl-10 sm:pl-16">
              <div className={`absolute left-1 sm:left-5 top-1 w-6 h-6 sm:w-7 sm:h-7 rounded-full flex items-center justify-center border-2 cursor-pointer hover:scale-110 transition-transform ${
                item.status === 'completed' ? 'bg-orange-500 border-orange-500' : 
                item.status === 'in-progress' ? 'bg-background border-orange-500' : 
                item.isKey ? 'bg-background border-yellow-500' : 'bg-background border-muted-foreground'
              }`} onClick={() => toggleExpand(index)}>
                {item.status === 'completed' ? (
                  <Check className="h-3.5 w-3.5 text-white" />
                ) : item.status === 'in-progress' ? (
                  <Clock className="h-3.5 w-3.5 text-orange-500" />
                ) : item.isKey ? (
                  <Calendar className="h-3.5 w-3.5 text-yellow-500" />
                ) : (
                  <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                )}
              </div>

              <div className={`pb-3 sm:pb-4 cursor-pointer transition-all ${item.isKey ? 'bg-orange-500/5 p-3 sm:p-4 rounded-lg border border-orange-500/20' : ''}`} onClick={() => toggleExpand(index)}>
                <div className="flex justify-between items-start">
                  <div className="flex-1 min-w-0">
                    <span className={`text-xs sm:text-sm font-medium ${item.isKey ? 'text-orange-500' : 'text-muted-foreground'} px-2 py-1 ${item.isKey ? 'bg-orange-500/10' : 'bg-muted/50'} rounded mb-2 inline-block`}>
                      {item.date}
                    </span>
                    <h4 className={`text-sm sm:text-base font-medium mt-2 mb-1 ${item.isKey ? 'text-orange-500' : ''}`}>{item.title}</h4>
                  </div>
                  <span className={`ml-2 text-sm sm:text-lg transform transition-transform flex-shrink-0 ${expandedItems.includes(index) ? 'rotate-180' : ''}`}>
                    ▼
                  </span>
                </div>
                
                {expandedItems.includes(index) && (
                  <div className="mt-2 sm:mt-3 pt-2 sm:pt-3 border-t border-white/10 animate-in fade-in">
                    <p className="text-xs sm:text-sm text-muted-foreground mb-2">{item.description}</p>
                    {item.stats && (
                      <div className="mt-2 text-xs inline-block px-2 py-1 bg-black/20 rounded font-medium">
                        {item.stats}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Componente Gráfico de Rendimiento de Inversión
function InvestmentPerformanceChart({ data }: { data: { month: string; return: number }[] }) {
  return (
    <div className="w-full h-64 flex flex-col justify-center">
      <div className="flex justify-between items-center h-full">
        {data.map((item, index) => (
          <div key={index} className="flex flex-col items-center justify-end h-full flex-1">
            <div 
              className="w-8 bg-orange-500 rounded-t-sm relative group"
              style={{ height: `${(item.return / 6) * 100}%` }}
            >
              <div className="absolute -top-10 left-1/2 transform -translate-x-1/2 bg-background border border-border px-2 py-1 rounded text-xs opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                {item.return}% en {item.month}
              </div>
            </div>
            <span className="text-xs text-muted-foreground mt-2">{item.month}</span>
          </div>
        ))}
      </div>
      <div className="mt-4 text-center text-sm text-muted-foreground">
        Rendimiento mensual en porcentaje (%)
      </div>
    </div>
  );
}

// Componente Tabla de Riesgo/Retorno
function RiskReturnTable() {
  const riskReturnData = [
    { riskLevel: "Bajo", returnRange: "4.0 - 4.5%", volatility: "Baja", recommendation: "Conservadores" },
    { riskLevel: "Medio", returnRange: "4.5 - 5.5%", volatility: "Media", recommendation: "Balanceados" },
    { riskLevel: "Alto", returnRange: "5.5 - 6.0%", volatility: "Alta", recommendation: "Crecimiento" }
  ];

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b">
            <th className="text-left py-2 px-3">Nivel de Riesgo</th>
            <th className="text-left py-2 px-3">Retorno Mensual</th>
            <th className="text-left py-2 px-3">Volatilidad</th>
            <th className="text-left py-2 px-3">Recomendado para</th>
          </tr>
        </thead>
        <tbody>
          {riskReturnData.map((item, index) => (
            <tr key={index} className="border-b hover:bg-muted/50">
              <td className="py-3 px-3">
                <div className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${
                    item.riskLevel === "Bajo" ? "bg-blue-500" :
                    item.riskLevel === "Medio" ? "bg-orange-500" : "bg-red-500"
                  }`}></div>
                  {item.riskLevel}
                </div>
              </td>
              <td className="py-3 px-3">{item.returnRange}</td>
              <td className="py-3 px-3">{item.volatility}</td>
              <td className="py-3 px-3">Inversores {item.recommendation}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Investor Registration Form Component
function InvestorRegistrationForm() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Define form validation schema
  const formSchema = z.object({
    fullName: z.string().min(2, { message: "Full name must be at least 2 characters." }),
    email: z.string().email({ message: "Please enter a valid email address." }),
    phone: z.string().min(10, { message: "Please enter a valid phone number." }),
    country: z.string().min(2, { message: "Please select your country." }),
    investmentAmount: z.string().min(1, { message: "Please enter your investment amount." }),
    investmentGoals: z.string().min(10, { message: "Please describe your investment goals." }),
    riskTolerance: z.enum(["low", "medium", "high"], {
      required_error: "Please select your risk tolerance.",
    }),
    investorType: z.enum(["individual", "corporate", "institutional"], {
      required_error: "Please select your investor type.",
    }),
    termsAccepted: z.boolean().refine((val) => val === true, {
      message: "You must accept the terms and conditions.",
    }),
  });

  // Create form
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      fullName: "",
      email: user?.email || "",
      phone: "",
      country: "",
      investmentAmount: "",
      investmentGoals: "",
      riskTolerance: "medium",
      investorType: "individual",
      termsAccepted: false,
    },
  });

  // Handle form submission using Firestore directly
  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    try {
      setIsSubmitting(true);
      
      const investorData = {
        fullName: values.fullName,
        email: values.email,
        phone: values.phone,
        country: values.country,
        investmentAmount: parseFloat(values.investmentAmount),
        investmentGoals: values.investmentGoals,
        riskTolerance: values.riskTolerance,
        investorType: values.investorType,
        termsAccepted: values.termsAccepted,
        userId: user?.uid || "guest",
        status: "pending",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };
      
      // Save to Firestore
      const docRef = await addDoc(collection(db, 'investors'), investorData);
      
      logger.info("Investor registered with ID:", docRef.id);
      
      // Send webhook notification to Make.com
      try {
        await axios.post('https://hook.us2.make.com/hfnbfse1q9gtm71xeamn5p5tj48fyv8x', {
          investorId: docRef.id,
          userId: user?.uid || "guest",
          fullName: values.fullName,
          email: values.email,
          phone: values.phone,
          country: values.country,
          investmentAmount: parseFloat(values.investmentAmount),
          investmentGoals: values.investmentGoals,
          riskTolerance: values.riskTolerance,
          investorType: values.investorType,
          termsAccepted: values.termsAccepted,
          status: "pending",
          registrationDate: new Date().toISOString()
        });
        logger.info("Webhook sent to Make.com successfully");
      } catch (webhookError) {
        logger.error("Failed to send webhook to Make.com:", webhookError);
        // Continue even if webhook fails
      }
      
      toast({
        title: "Registration Successful",
        description: "Your investor registration has been submitted successfully.",
      });
      
      // Reset form
      form.reset();
      
      // Refresh investor data
      window.location.reload();
      
    } catch (error: any) {
      logger.error("Error submitting investor registration:", error);
      
      const errorMessage = error.message || "There was an unexpected error. Please try again.";
      
      toast({
        title: "Registration Failed",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="p-6">
      <div className="flex items-center gap-4 mb-6">
        <div className="p-3 bg-orange-500/10 rounded-full">
          <UserPlus className="h-6 w-6 text-orange-500" />
        </div>
        <div>
          <h3 className="text-xl font-semibold">Investor Registration</h3>
          <p className="text-sm text-muted-foreground">
            Register to become an investor in Boostify Music
          </p>
        </div>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <FormField
              control={form.control}
              name="fullName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Full Name</FormLabel>
                  <FormControl>
                    <Input placeholder="John Doe" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input placeholder="john@example.com" type="email" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Phone Number</FormLabel>
                  <FormControl>
                    <Input placeholder="+1 (123) 456-7890" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="country"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Country</FormLabel>
                  <FormControl>
                    <Input placeholder="United States" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="investmentAmount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Investment Amount (USD)</FormLabel>
                  <FormControl>
                    <Input placeholder="5000" type="number" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="investorType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Investor Type</FormLabel>
                  <Select 
                    onValueChange={field.onChange} 
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select investor type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="individual">Individual</SelectItem>
                      <SelectItem value="corporate">Corporate</SelectItem>
                      <SelectItem value="institutional">Institutional</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="riskTolerance"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Risk Tolerance</FormLabel>
                  <Select 
                    onValueChange={field.onChange} 
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select risk tolerance" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="md:col-span-2">
              <FormField
                control={form.control}
                name="investmentGoals"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Investment Goals</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Describe your investment goals and expectations..." 
                        className="min-h-[120px]" 
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="md:col-span-2">
              <FormField
                control={form.control}
                name="termsAccepted"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md p-4 bg-muted/50">
                    <FormControl>
                      <input
                        type="checkbox"
                        className="h-4 w-4 mt-1"
                        checked={field.value}
                        onChange={field.onChange}
                      />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel>
                        I accept the terms and conditions of investment
                      </FormLabel>
                      <p className="text-sm text-muted-foreground">
                        By checking this box, you agree to our investment terms, privacy policy, and acknowledge the risks involved.
                      </p>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </div>

          <Button 
            type="submit" 
            className="w-full md:w-auto bg-orange-500 hover:bg-orange-600"
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <span className="mr-2">Submitting</span>
                <Clock className="h-4 w-4 animate-spin" />
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Register as Investor
              </>
            )}
          </Button>
        </form>
      </Form>
    </Card>
  );
}

// =====================================
// PLATFORM OVERVIEW COMPONENT - REAL CODEBASE DATA
// =====================================
function PlatformOverview() {
  const platformModules = [
    {
      title: 'AI Creation Studio',
      icon: Brain,
      color: 'from-purple-500 to-violet-600',
      borderColor: 'border-purple-500/30',
      description: 'Full AI-powered creation suite for music, video, images, and marketing content',
      features: [
        { name: 'AI Music Generation', detail: 'Text-to-music, style-guided composition (FAL AI, MiniMax V2)' },
        { name: 'AI Video Production', detail: 'Script-to-video pipeline, lip-sync, choreography, VFX (Kling)' },
        { name: 'AI Image Generation', detail: 'Album art, promo graphics, merch designs (FAL AI, DALL-E)' },
        { name: 'Professional Editor', detail: 'Timeline editor with layers, effects, and real-time preview' },
        { name: 'Live Podcast Studio', detail: 'Real-time streaming with AI-enhanced audio processing' },
      ],
      stats: { pages: 12, components: 85, apis: 18 }
    },
    {
      title: '7 AI Agents (Function Calling)',
      icon: Bot,
      color: 'from-orange-500 to-amber-600',
      borderColor: 'border-orange-500/30',
      description: 'Specialized AI agents with OpenAI Function Calling — they execute real actions, not just chat',
      features: [
        { name: 'Composer Agent', detail: 'Lyrics, melodies, arrangements, music theory assistance' },
        { name: 'Marketing Agent', detail: 'Creates campaigns, schedules posts, analyzes audiences' },
        { name: 'Social Media Agent', detail: 'Content calendars, post packs, hashtag strategies' },
        { name: 'Video Director Agent', detail: 'Scripts scenes, selects VFX, directs AI video generation' },
        { name: 'Photographer Agent', detail: 'Photo shoots, style guides, image editing direction' },
        { name: 'Manager Agent', detail: 'Career strategy, planning, deal pipeline management' },
        { name: 'Merchandise Agent', detail: 'AI product design, store management, inventory' },
      ],
      stats: { pages: 3, components: 15, apis: 8 }
    },
    {
      title: 'AAS Autonomous Engine',
      icon: Workflow,
      color: 'from-yellow-500 to-orange-600',
      borderColor: 'border-yellow-500/30',
      description: 'Toggle-based per-artist autonomous system — 7 sub-agents run daily cycles to grow the artist\'s career 24/7',
      features: [
        { name: 'Survival Strategist', detail: 'Daily planning, priority setting, survival score calculation' },
        { name: 'Revenue Operator', detail: 'Monetization optimization across all revenue streams' },
        { name: 'Deal Closer', detail: 'CRM pipeline with 11 stages, automated follow-ups' },
        { name: 'Growth Operator', detail: 'Audience expansion across all connected channels' },
        { name: 'Community Operator', detail: 'Fan engagement, loyalty programs, community health' },
        { name: 'Risk & Compliance', detail: 'Safety net with veto power on high-risk actions' },
        { name: 'Finance Controller', detail: 'Budget auditing, financial health monitoring' },
      ],
      stats: { pages: 1, components: 7, apis: 12 }
    },
    {
      title: 'Multi-Channel Growth Engine',
      icon: TrendingUp,
      color: 'from-green-500 to-emerald-600',
      borderColor: 'border-green-500/30',
      description: 'Automated growth tools for Instagram, YouTube, Spotify, and cross-platform campaigns',
      features: [
        { name: 'Instagram Boost', detail: 'Automated follower growth and engagement optimization' },
        { name: 'YouTube Views', detail: 'View amplification and channel optimization strategies' },
        { name: 'Spotify Growth', detail: 'Playlist placement and stream growth tools' },
        { name: 'Campaign Engine', detail: 'AI-driven promotional campaigns across all channels' },
        { name: 'Unified Analytics', detail: 'Cross-platform dashboard with real-time metrics' },
      ],
      stats: { pages: 8, components: 45, apis: 15 }
    },
    {
      title: 'Commerce & Monetization',
      icon: ShoppingBag,
      color: 'from-cyan-500 to-blue-600',
      borderColor: 'border-cyan-500/30',
      description: 'Subscriptions, AI merch via Printful, credit packs, and BTF token economy',
      features: [
        { name: 'Subscription Tiers', detail: 'Discover (Free) → Artist ($19.99) → Elevate ($49.99) → Amplify ($89.99) → Dominate ($149.99)' },
        { name: 'Smart Credit System', detail: '1 credit = $0.01, 5x markup, every AI action is billable' },
        { name: 'Credit Packs', detail: '$4.99 (500) to $249.99 (60,000) pay-as-you-go credits' },
        { name: 'AI Merchandise', detail: '6 product types via Printful (T-Shirt, Hoodie, Cap, Poster, Sticker, Mug)' },
        { name: 'Merch Revenue Split', detail: 'Paid artists keep 70% profit / Boostify 30%' },
      ],
      stats: { pages: 10, components: 55, apis: 20 }
    },
    {
      title: 'Web3 & Token Economy',
      icon: Coins,
      color: 'from-amber-500 to-yellow-600',
      borderColor: 'border-amber-500/30',
      description: 'BTF token on Polygon, BTF Utility Hub, artist access packs, NFT metadata system',
      features: [
        { name: 'BTF Token', detail: 'Native utility token on Polygon network for platform services' },
        { name: 'BTF Utility Hub', detail: 'Built-in hub for acquiring and using BTF service credits' },
        { name: 'Artist Tokenization', detail: 'Artists can mint their own access packs for fan engagement' },
        { name: 'Token Lock System', detail: 'BTF lock-up with service credit multipliers' },
        { name: 'Wallet Integration', detail: 'RainbowKit + Wagmi for seamless Web3 UX' },
      ],
      stats: { pages: 6, components: 35, apis: 10 }
    },
  ];

  const tierData = [
    { tier: 'Free', price: '$0', credits: '50/mo', songs: '3', videos: '2', photos: '6', watermark: true, drag: false },
    { tier: 'Artist', price: '$19.99', credits: '200/mo', songs: '10', videos: '5', photos: '20', watermark: false, drag: true },
    { tier: 'Elevate', price: '$49.99', credits: '500/mo', songs: '20', videos: '10', photos: '50', watermark: false, drag: true },
    { tier: 'Amplify', price: '$89.99', credits: '2,000/mo', songs: '∞', videos: '∞', photos: '∞', watermark: false, drag: true },
    { tier: 'Dominate', price: '$149.99', credits: '10,000/mo', songs: '∞', videos: '∞', photos: '∞', watermark: false, drag: true },
  ];

  return (
    <div className="space-y-6">
      {/* Platform Scale Hero */}
      <Card className="relative overflow-hidden bg-gradient-to-br from-gray-900 via-slate-900 to-black border-orange-500/30">
        <div className="absolute top-0 right-0 w-96 h-96 bg-orange-500/10 rounded-full filter blur-3xl"></div>
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-purple-500/10 rounded-full filter blur-3xl"></div>

        {/* Full-width artist image at top */}
        <div className="relative w-full h-52 sm:h-72 overflow-hidden">
          <img
            src={INVESTOR_IMAGES.artist_ecosystem}
            alt="Artists using the Boostify platform"
            className="w-full h-full object-cover object-center"
            loading="lazy"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-black/30 to-black/80 pointer-events-none" />
        </div>

        <div className="relative z-10 p-6 sm:p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-orange-400 to-amber-600 flex items-center justify-center">
              <LayoutGrid className="h-6 w-6 text-white" />
            </div>
            <div>
              <h2 className="text-2xl sm:text-3xl font-bold text-white">Live Platform Scale</h2>
              <p className="text-xs text-gray-400">Real metrics from current codebase — not projections</p>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-4">
            <div className="p-4 bg-white/5 rounded-xl border border-white/10 text-center">
              <div className="text-2xl sm:text-3xl font-bold text-orange-400">122</div>
              <div className="text-[10px] sm:text-xs text-gray-400 mt-1">Frontend Pages</div>
            </div>
            <div className="p-4 bg-white/5 rounded-xl border border-white/10 text-center">
              <div className="text-2xl sm:text-3xl font-bold text-purple-400">569</div>
              <div className="text-[10px] sm:text-xs text-gray-400 mt-1">UI Components</div>
            </div>
            <div className="p-4 bg-white/5 rounded-xl border border-white/10 text-center">
              <div className="text-2xl sm:text-3xl font-bold text-yellow-400">112</div>
              <div className="text-[10px] sm:text-xs text-gray-400 mt-1">API Endpoints</div>
            </div>
            <div className="p-4 bg-white/5 rounded-xl border border-white/10 text-center">
              <div className="text-2xl sm:text-3xl font-bold text-green-400">137</div>
              <div className="text-[10px] sm:text-xs text-gray-400 mt-1">Backend Modules</div>
            </div>
            <div className="p-4 bg-white/5 rounded-xl border border-white/10 text-center">
              <div className="text-2xl sm:text-3xl font-bold text-cyan-400">7</div>
              <div className="text-[10px] sm:text-xs text-gray-400 mt-1">AI Agent Types</div>
            </div>
            <div className="p-4 bg-white/5 rounded-xl border border-white/10 text-center">
              <div className="text-2xl sm:text-3xl font-bold text-amber-400">6+</div>
              <div className="text-[10px] sm:text-xs text-gray-400 mt-1">Revenue Streams</div>
            </div>
          </div>

          <p className="text-xs text-gray-500 mt-4 flex items-center gap-2">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            Data extracted from live codebase — client/src/pages, client/src/components, server/routes.ts
          </p>
        </div>
      </Card>

      {/* Platform Modules */}
      <div className="space-y-4">
        <h3 className="text-xl font-bold text-white">Platform Modules — Deep Dive</h3>
        <p className="text-sm text-gray-400">Each module represents a fully implemented business surface with its own pages, components, and API layer</p>
        
        {platformModules.map((module, idx) => (
          <Card key={idx} className={`p-5 sm:p-6 bg-black/30 ${module.borderColor} hover:border-opacity-60 transition-all`}>
            <div className="flex items-start gap-4 mb-4">
              <div className={`p-3 rounded-xl bg-gradient-to-br ${module.color} flex-shrink-0`}>
                <module.icon className="h-6 w-6 text-white" />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <h4 className="text-lg font-bold text-white">{module.title}</h4>
                  <div className="flex gap-2">
                    <span className="text-[10px] px-2 py-1 bg-white/10 rounded-full text-gray-300">{module.stats.pages} pages</span>
                    <span className="text-[10px] px-2 py-1 bg-white/10 rounded-full text-gray-300">{module.stats.components} components</span>
                    <span className="text-[10px] px-2 py-1 bg-white/10 rounded-full text-gray-300">{module.stats.apis} APIs</span>
                  </div>
                </div>
                <p className="text-sm text-gray-400 mt-1">{module.description}</p>
              </div>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-3">
              {module.features.map((feature, fIdx) => (
                <div key={fIdx} className="p-3 bg-white/5 rounded-lg border border-white/10">
                  <h5 className="text-xs font-semibold text-white mb-1">{feature.name}</h5>
                  <p className="text-[10px] text-gray-400">{feature.detail}</p>
                </div>
              ))}
            </div>
          </Card>
        ))}
      </div>

      {/* Subscription Tier System */}
      <Card className="p-5 sm:p-6 bg-black/30 border-orange-500/20">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-amber-600 flex items-center justify-center">
            <Layers className="h-5 w-5 text-white" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">Subscription Tier System (Live)</h3>
            <p className="text-xs text-gray-400">Implemented in shared/tier-limits.ts — enforced on frontend + backend</p>
          </div>
        </div>

        <div className="overflow-x-auto -mx-2 px-2">
          <table className="w-full min-w-[560px] text-xs sm:text-sm">
            <thead>
              <tr className="border-b border-white/10">
                <th className="text-left text-white/70 pb-3 font-medium">Tier</th>
                <th className="text-center text-white/70 pb-3 font-medium">Price</th>
                <th className="text-center text-white/70 pb-3 font-medium">Credits/mo</th>
                <th className="text-center text-white/70 pb-3 font-medium">Songs</th>
                <th className="text-center text-white/70 pb-3 font-medium">Videos</th>
                <th className="text-center text-white/70 pb-3 font-medium">Photos</th>
                <th className="text-center text-white/70 pb-3 font-medium">Watermark</th>
                <th className="text-center text-white/70 pb-3 font-medium">Drag & Drop</th>
              </tr>
            </thead>
            <tbody>
              {tierData.map((t, i) => (
                <tr key={i} className={`border-b border-white/10 ${i === 3 ? 'bg-orange-500/10' : ''}`}>
                  <td className="py-3 font-semibold text-white">{t.tier}</td>
                  <td className="py-3 text-center text-orange-400 font-bold">{t.price}</td>
                  <td className="py-3 text-center text-yellow-400">{t.credits}</td>
                  <td className="py-3 text-center text-white">{t.songs}</td>
                  <td className="py-3 text-center text-white">{t.videos}</td>
                  <td className="py-3 text-center text-white">{t.photos}</td>
                  <td className="py-3 text-center">{t.watermark ? <span className="text-red-400">Yes</span> : <span className="text-green-400">No</span>}</td>
                  <td className="py-3 text-center">{t.drag ? <Check className="h-4 w-4 text-green-400 mx-auto" /> : <span className="text-red-400">—</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Smart Credit System */}
      <Card className="p-5 sm:p-6 bg-black/30 border-yellow-500/20">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-yellow-500 to-amber-600 flex items-center justify-center">
            <Coins className="h-5 w-5 text-white" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">Smart Credit Engine (Live)</h3>
            <p className="text-xs text-gray-400">Every AI action = measurable, billable event — implemented in shared/credit-pricing.ts + server/services/credit-engine.ts</p>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <div className="p-4 bg-white/5 rounded-xl border border-yellow-500/20 text-center">
            <div className="text-2xl font-bold text-yellow-400">$0.01</div>
            <div className="text-[10px] text-gray-400 mt-1">= 1 Credit</div>
          </div>
          <div className="p-4 bg-white/5 rounded-xl border border-yellow-500/20 text-center">
            <div className="text-2xl font-bold text-orange-400">5x</div>
            <div className="text-[10px] text-gray-400 mt-1">Default Markup</div>
          </div>
          <div className="p-4 bg-white/5 rounded-xl border border-yellow-500/20 text-center">
            <div className="text-2xl font-bold text-green-400">1-20x</div>
            <div className="text-[10px] text-gray-400 mt-1">Admin Configurable</div>
          </div>
          <div className="p-4 bg-white/5 rounded-xl border border-yellow-500/20 text-center">
            <div className="text-2xl font-bold text-purple-400">Auto</div>
            <div className="text-[10px] text-gray-400 mt-1">Post-API Billing</div>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
          {[
            { name: 'Starter', price: '$4.99', credits: '500' },
            { name: 'Popular', price: '$9.99', credits: '1,200' },
            { name: 'Pro Pack', price: '$24.99', credits: '3,000' },
            { name: 'Studio', price: '$49.99', credits: '7,500' },
            { name: 'Enterprise', price: '$99.99', credits: '20,000' },
            { name: 'Mega Pack', price: '$249.99', credits: '60,000' },
          ].map((pack, i) => (
            <div key={i} className="p-3 bg-white/5 rounded-lg border border-white/10 text-center">
              <div className="text-[10px] text-gray-400 mb-1">{pack.name}</div>
              <div className="text-sm font-bold text-orange-400">{pack.price}</div>
              <div className="text-[10px] text-yellow-400">{pack.credits} credits</div>
            </div>
          ))}
        </div>
      </Card>

      {/* AI Merch System */}
      <Card className="p-5 sm:p-6 bg-black/30 border-cyan-500/20">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center">
            <ShoppingBag className="h-5 w-5 text-white" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">AI Merchandise via Printful (Live)</h3>
            <p className="text-xs text-gray-400">AI generates designs → Printful prints & ships → Artist earns 70%</p>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {[
            { product: 'T-Shirt', price: '$29.99', method: 'DTG', catalog: 'Bella+Canvas 3001' },
            { product: 'Hoodie', price: '$54.99', method: 'DTG', catalog: 'Cotton Heritage M2580' },
            { product: 'Cap', price: '$27.99', method: 'Embroidery', catalog: 'Otto Foam Trucker' },
            { product: 'Poster', price: '$19.99', method: 'Poster', catalog: 'Enhanced Matte' },
            { product: 'Sticker Pack', price: '$4.99', method: 'Sublimation', catalog: 'Kiss-Cut' },
            { product: 'Mug', price: '$16.99', method: 'Sublimation', catalog: 'White Glossy' },
          ].map((p, i) => (
            <div key={i} className="p-3 bg-white/5 rounded-lg border border-white/10 text-center">
              <div className="text-sm font-bold text-white mb-1">{p.product}</div>
              <div className="text-lg font-bold text-cyan-400">{p.price}</div>
              <div className="text-[9px] text-gray-400 mt-1">{p.method}</div>
              <div className="text-[8px] text-gray-500">{p.catalog}</div>
            </div>
          ))}
        </div>
        
        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="p-3 bg-green-500/10 rounded-lg border border-green-500/20">
            <span className="text-xs text-green-400 font-semibold">Paid Artists Revenue Split</span>
            <div className="text-sm text-white mt-1">Artist: <strong className="text-green-400">70%</strong> / Boostify: <strong className="text-orange-400">30%</strong></div>
          </div>
          <div className="p-3 bg-orange-500/10 rounded-lg border border-orange-500/20">
            <span className="text-xs text-orange-400 font-semibold">Free Tier Revenue Split</span>
            <div className="text-sm text-white mt-1">Artist: <strong className="text-orange-300">20%</strong> / Boostify: <strong className="text-orange-400">80%</strong></div>
          </div>
        </div>
      </Card>

      {/* Tech Stack */}
      <Card className="p-5 sm:p-6 bg-black/30 border-orange-500/20">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center">
            <Cpu className="h-5 w-5 text-white" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">Technology Stack</h3>
            <p className="text-xs text-gray-400">Production-grade infrastructure already deployed</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="p-4 bg-white/5 rounded-xl border border-white/10">
            <h5 className="text-xs font-semibold text-orange-400 mb-3">FRONTEND</h5>
            <div className="space-y-1 text-[10px] text-gray-300">
              <div>React + TypeScript</div>
              <div>Tailwind CSS</div>
              <div>Wouter Router (lazy loading)</div>
              <div>React Query (data sync)</div>
              <div>Clerk Auth (identity)</div>
              <div>RainbowKit + Wagmi (Web3)</div>
            </div>
          </div>
          <div className="p-4 bg-white/5 rounded-xl border border-white/10">
            <h5 className="text-xs font-semibold text-purple-400 mb-3">BACKEND</h5>
            <div className="space-y-1 text-[10px] text-gray-300">
              <div>Express.js + Node.js</div>
              <div>112 API mount points</div>
              <div>Clerk Auth middleware</div>
              <div>CORS + CSP headers</div>
              <div>Rate limiting + upload safety</div>
              <div>Health monitoring endpoint</div>
            </div>
          </div>
          <div className="p-4 bg-white/5 rounded-xl border border-white/10">
            <h5 className="text-xs font-semibold text-yellow-400 mb-3">AI PROVIDERS</h5>
            <div className="space-y-1 text-[10px] text-gray-300">
              <div>OpenAI GPT-4 (function calling)</div>
              <div>Google Gemini (analysis)</div>
              <div>FAL AI (image/music/video)</div>
              <div>Kling (video/lipsync/VFX)</div>
              <div>MiniMax (music V2)</div>
            </div>
          </div>
          <div className="p-4 bg-white/5 rounded-xl border border-white/10">
            <h5 className="text-xs font-semibold text-green-400 mb-3">DATA & PAYMENTS</h5>
            <div className="space-y-1 text-[10px] text-gray-300">
              <div>PostgreSQL (Neon) + Drizzle ORM</div>
              <div>Firebase Firestore + Storage</div>
              <div>Stripe (subscriptions + payments)</div>
              <div>Printful API (merchandise)</div>
              <div>Polygon Network (BTF token)</div>
            </div>
          </div>
        </div>
      </Card>

      {/* Competitive Comparison */}
      <Card className="p-5 sm:p-6 bg-black/30 border-green-500/20">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center">
            <Shield className="h-5 w-5 text-white" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">Competitive Advantage (Feature Parity)</h3>
            <p className="text-xs text-gray-400">Boostify vs industry — based on actual implemented features</p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs sm:text-sm">
            <thead>
              <tr className="border-b border-white/10">
                <th className="text-left text-white/70 pb-3 font-medium">Capability</th>
                <th className="text-center text-orange-400 pb-3 font-bold">Boostify</th>
                <th className="text-center text-white/50 pb-3 font-medium">DistroKid</th>
                <th className="text-center text-white/50 pb-3 font-medium">Landr</th>
                <th className="text-center text-white/50 pb-3 font-medium">BandLab</th>
              </tr>
            </thead>
            <tbody>
              {[
                { feature: 'AI Music Generation', boostify: true, d: false, l: true, b: true },
                { feature: 'AI Video Production', boostify: true, d: false, l: false, b: false },
                { feature: 'AI Agent Team (7 agents)', boostify: true, d: false, l: false, b: false },
                { feature: 'Autonomous Engine (AAS)', boostify: true, d: false, l: false, b: false },
                { feature: 'Merch (Printful)', boostify: true, d: false, l: false, b: false },
                { feature: 'Multi-Channel Growth', boostify: true, d: false, l: false, b: false },
                { feature: 'Token Economy (Web3)', boostify: true, d: false, l: false, b: false },
                { feature: 'Credit-Based AI Billing', boostify: true, d: false, l: false, b: false },
                { feature: 'Live Podcast Studio', boostify: true, d: false, l: false, b: false },
                { feature: 'Viral Product Generator', boostify: true, d: false, l: false, b: false },
              ].map((row, i) => (
                <tr key={i} className="border-b border-white/10">
                  <td className="py-2 text-white">{row.feature}</td>
                  <td className="py-2 text-center">{row.boostify ? <Check className="h-4 w-4 text-green-400 mx-auto" /> : <span className="text-red-400">—</span>}</td>
                  <td className="py-2 text-center">{row.d ? <Check className="h-4 w-4 text-green-400 mx-auto" /> : <span className="text-white/30">—</span>}</td>
                  <td className="py-2 text-center">{row.l ? <Check className="h-4 w-4 text-green-400 mx-auto" /> : <span className="text-white/30">—</span>}</td>
                  <td className="py-2 text-center">{row.b ? <Check className="h-4 w-4 text-green-400 mx-auto" /> : <span className="text-white/30">—</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-[10px] text-gray-500 mt-3">Boostify is the only platform that unifies the entire artist lifecycle with AI automation, Web3 economy, and autonomous career management.</p>
      </Card>
    </div>
  );
}

// Componente Estadísticas del Inversor 
function InvestorStats({ investorData, globalStats }: { investorData?: any; globalStats?: any }) {
  const stats = [
    { 
      title: "TOTAL INVESTMENTS", 
      value: `$${(investorData?.stats?.totalInvested || 500000).toLocaleString()}`, 
      growth: "+15.3%", 
      icon: DollarSign,
      color: "text-orange-400",
      bgColor: "bg-cyan-500/10" 
    },
    { 
      title: "CURRENT RETURN", 
      value: `+${(investorData?.stats?.currentReturn || 12.5).toFixed(1)}%`, 
      growth: "+3.2%", 
      icon: TrendingUp,
      color: "text-yellow-400",
      bgColor: "bg-yellow-500/10" 
    },
    { 
      title: "PROJECTED YIELD", 
      value: `${(investorData?.stats?.projectedYield || 38.0).toFixed(1)}%`, 
      growth: "+5.8%", 
      icon: Target,
      color: "text-yellow-400",
      bgColor: "bg-yellow-500/10" 
    },
    { 
      title: "PLATFORM CAPITAL", 
      value: `$${((globalStats?.data?.totalCapital || 500000) / 1000000).toFixed(1)}M`, 
      growth: "+15.3%", 
      icon: BarChart,
      color: "text-purple-400",
      bgColor: "bg-amber-500/10" 
    }
  ];

  return (
    <>
      {stats.map((stat, index) => (
        <Card 
          key={index} 
          className="relative p-3 sm:p-6 bg-gradient-to-br from-gray-900/90 to-gray-900/50 border border-orange-500/20 hover:border-orange-500/50 transition-all duration-300 overflow-hidden group"
        >
          {/* Glow effect on hover */}
          <div className={`absolute inset-0 ${stat.bgColor} opacity-0 group-hover:opacity-10 transition-opacity duration-300`}></div>
          
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-2 sm:mb-4">
              <div className={`p-2 sm:p-3 ${stat.bgColor} rounded-xl shadow-lg`}>
                <stat.icon className={`h-4 w-4 sm:h-6 sm:w-6 ${stat.color}`} />
              </div>
              <span className="text-xs sm:text-sm font-semibold text-yellow-400">{stat.growth}</span>
            </div>
            <div>
              <p className="text-xs sm:text-sm text-gray-400 mb-1 sm:mb-2">{stat.title}</p>
              <p className="text-xl sm:text-3xl lg:text-4xl font-bold bg-gradient-to-r from-orange-400 to-orange-200 bg-clip-text text-transparent">{stat.value}</p>
            </div>
          </div>
        </Card>
      ))}
    </>
  );
}

// ───────────────────────────────────────────────────────────────────
// Investor Access Gate — password + confidentiality (NDA) e-signature.
// Step 1: access password ("OMNIA 2026"). Step 2: the visitor must read and
// electronically sign a Confidentiality / Non-Disclosure Agreement before any
// investor material is revealed. The signature is best-effort logged to
// Firestore (collection: investor_nda_signatures) and the unlock is kept for
// the browser session via sessionStorage.
// ───────────────────────────────────────────────────────────────────
const INVESTOR_ACCESS_PASSWORD = "OMNIA 2026";
const INVESTOR_GATE_STORAGE_KEY = "boostify_investor_access_v1";

function InvestorAccessGate({ onGranted }: { onGranted: () => void }) {
  const { toast } = useToast();
  const [step, setStep] = useState<"password" | "nda">("password");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [signerName, setSignerName] = useState("");
  const [signerEmail, setSignerEmail] = useState("");
  const [signerCompany, setSignerCompany] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const checkPassword = () => {
    if (password.trim().toUpperCase() === INVESTOR_ACCESS_PASSWORD.toUpperCase()) {
      setError("");
      setStep("nda");
    } else {
      setError("Incorrect password · Contraseña incorrecta");
    }
  };

  const handleSign = async () => {
    if (!signerName.trim()) {
      toast({ title: "Full legal name required", description: "Please type your full legal name to sign.", variant: "destructive" });
      return;
    }
    if (!agreed) {
      toast({ title: "Please accept the agreement", description: "You must accept the confidentiality terms to continue.", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      await addDoc(collection(db, "investor_nda_signatures"), {
        name: signerName.trim(),
        email: signerEmail.trim() || null,
        company: signerCompany.trim() || null,
        document: "Boostify Music — Investor Confidentiality & Non-Disclosure Agreement",
        version: "v1-2026",
        agreedAt: serverTimestamp(),
        userAgent: typeof navigator !== "undefined" ? navigator.userAgent : null,
      });
    } catch (err) {
      logger.warn("Could not log investor NDA signature", err);
    }
    try {
      sessionStorage.setItem(INVESTOR_GATE_STORAGE_KEY, "granted");
      sessionStorage.setItem(INVESTOR_GATE_STORAGE_KEY + "_signer", signerName.trim());
    } catch { /* storage unavailable */ }
    setSubmitting(false);
    toast({ title: "✅ Access granted · Acceso concedido", description: "Confidentiality agreement signed. Welcome." });
    onGranted();
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-950">
      <Header />
      <main className="flex-1 flex items-center justify-center px-4 py-16 sm:py-20">
        <div className="w-full max-w-2xl">
          {step === "password" && (
            <Card className="border-orange-500/30 bg-gradient-to-br from-slate-900 to-gray-950 p-6 sm:p-10 shadow-2xl">
              <div className="flex flex-col items-center text-center mb-6">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-orange-400 to-amber-600 flex items-center justify-center mb-4">
                  <Lock className="h-8 w-8 text-white" />
                </div>
                <h1 className="text-2xl sm:text-3xl font-bold text-white">Investor Access · Acceso a Inversores</h1>
                <p className="text-gray-400 mt-2 text-sm sm:text-base">
                  This area is private and confidential. Enter the access password to continue.
                  <span className="block text-gray-500 mt-1">Esta área es privada y confidencial. Introduce la contraseña de acceso.</span>
                </p>
              </div>
              <div className="space-y-4 max-w-md mx-auto">
                <div>
                  <Label htmlFor="investor-access-password" className="text-gray-300">Access Password · Contraseña</Label>
                  <Input
                    id="investor-access-password"
                    type="password"
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); if (error) setError(""); }}
                    onKeyDown={(e) => { if (e.key === "Enter") checkPassword(); }}
                    placeholder="••••••••••"
                    autoFocus
                    className="mt-1 bg-gray-900 border-gray-700 text-white placeholder:text-gray-600"
                  />
                  {error && <p className="text-red-400 text-sm mt-2">{error}</p>}
                </div>
                <Button onClick={checkPassword} className="w-full bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-white font-semibold">
                  <KeyRound className="h-4 w-4 mr-2" /> Continue · Continuar
                </Button>
                <p className="text-xs text-gray-600 text-center pt-2">
                  Protected area — © {new Date().getFullYear()} Boostify Music, Inc.
                </p>
              </div>
            </Card>
          )}

          {step === "nda" && (
            <Card className="border-orange-500/30 bg-gradient-to-br from-slate-900 to-gray-950 p-6 sm:p-8 shadow-2xl">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-orange-400 to-amber-600 flex items-center justify-center flex-shrink-0">
                  <FileText className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h1 className="text-xl sm:text-2xl font-bold text-white">Confidentiality Agreement</h1>
                  <p className="text-gray-400 text-sm">Acuerdo de Confidencialidad — please read &amp; sign to continue</p>
                </div>
              </div>

              <ScrollArea className="h-60 sm:h-72 rounded-lg border border-gray-800 bg-gray-900/60 p-4 mb-4">
                <div className="text-xs sm:text-sm text-gray-300 space-y-3 pr-2">
                  <p className="font-semibold text-orange-300">BOOSTIFY MUSIC — INVESTOR CONFIDENTIALITY &amp; NON-DISCLOSURE AGREEMENT</p>
                  <p>By accessing this investor area you (“Recipient”) agree to the following with Boostify Music, Inc. and its parent Omnia Strategic Holding Corporation (together, the “Company”):</p>
                  <p><strong>1. Confidential Information.</strong> All materials on this page — including the business plan, financial model, projections, valuation, cap table, technology, and the terms of any proposed financing — are confidential and proprietary to the Company.</p>
                  <p><strong>2. Permitted Use.</strong> Recipient will use the information solely to evaluate a potential investment and for no other purpose.</p>
                  <p><strong>3. Non-Disclosure.</strong> Recipient will not copy, reproduce, distribute, publish, or disclose the information to any third party without the Company’s prior written consent, and will protect it with reasonable care.</p>
                  <p><strong>4. No Offer / No Advice.</strong> These materials are for information only, are not investment, legal, or tax advice, and do not constitute an offer to sell or a solicitation to buy any security.</p>
                  <p><strong>5. Return or Destruction.</strong> Upon the Company’s request, Recipient will return or destroy all confidential materials.</p>
                  <p><strong>6. Term.</strong> These obligations remain in effect for three (3) years from the date of access.</p>
                  <p><strong>7. Governing Law.</strong> This agreement is governed by the laws of the State of Delaware, USA.</p>
                  <hr className="border-gray-700" />
                  <p className="text-gray-400"><em>ES — Al acceder a esta área usted (“Receptor”) acepta lo siguiente con Boostify Music, Inc. y su matriz Omnia Strategic Holding Corporation (la “Compañía”): (1) toda la información de esta página es confidencial y propiedad de la Compañía; (2) la usará únicamente para evaluar una posible inversión; (3) no la copiará ni divulgará a terceros sin consentimiento previo por escrito; (4) los materiales son solo informativos y no constituyen una oferta de valores ni asesoría; (5) devolverá o destruirá los materiales a solicitud; (6) estas obligaciones duran tres (3) años; (7) se rige por las leyes del Estado de Delaware, EE. UU. En caso de conflicto, prevalece la versión en inglés.</em></p>
                </div>
              </ScrollArea>

              <div className="grid sm:grid-cols-2 gap-3 mb-4">
                <div>
                  <Label className="text-gray-300">Full legal name · Nombre legal *</Label>
                  <Input value={signerName} onChange={(e) => setSignerName(e.target.value)} placeholder="Jane Q. Investor" className="mt-1 bg-gray-900 border-gray-700 text-white placeholder:text-gray-600" />
                </div>
                <div>
                  <Label className="text-gray-300">Email</Label>
                  <Input type="email" value={signerEmail} onChange={(e) => setSignerEmail(e.target.value)} placeholder="you@fund.com" className="mt-1 bg-gray-900 border-gray-700 text-white placeholder:text-gray-600" />
                </div>
                <div className="sm:col-span-2">
                  <Label className="text-gray-300">Company / Fund · Empresa (optional)</Label>
                  <Input value={signerCompany} onChange={(e) => setSignerCompany(e.target.value)} placeholder="Acme Ventures" className="mt-1 bg-gray-900 border-gray-700 text-white placeholder:text-gray-600" />
                </div>
              </div>

              <label className="flex items-start gap-3 mb-4 cursor-pointer">
                <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="mt-1 h-4 w-4 accent-orange-500" />
                <span className="text-xs sm:text-sm text-gray-300">
                  I have read and agree to the Confidentiality &amp; Non-Disclosure Agreement above, and I am signing it electronically.
                  <span className="block text-gray-500 mt-0.5">He leído y acepto el Acuerdo de Confidencialidad anterior y lo firmo electrónicamente.</span>
                </span>
              </label>

              <div className="flex flex-col sm:flex-row gap-3">
                <Button variant="outline" onClick={() => setStep("password")} className="border-gray-700 text-gray-300 hover:bg-gray-800">
                  Back · Atrás
                </Button>
                <Button onClick={handleSign} disabled={submitting || !agreed || !signerName.trim()} className="flex-1 bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-white font-semibold disabled:opacity-50">
                  <PenSquare className="h-4 w-4 mr-2" /> {submitting ? "Signing…" : "Sign & Access · Firmar y Acceder"}
                </Button>
              </div>
            </Card>
          )}
        </div>
      </main>
    </div>
  );
}

export default function InvestorsDashboard() {
  const [selectedTab, setSelectedTab] = useState("pitchdeck");
  const [accessGranted, setAccessGranted] = useState<boolean>(() => {
    try { return sessionStorage.getItem(INVESTOR_GATE_STORAGE_KEY) === "granted"; } catch { return false; }
  });
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Query investor data from API
  const { data: investorData, isLoading: isLoadingInvestor } = useQuery<any>({
    queryKey: ['/api/investors/me'],
    enabled: true,
  });

  // Query global stats from API
  const { data: globalStats } = useQuery<any>({
    queryKey: ['/api/investors/stats'],
  });

  // Extract investment data
  const investmentData = {
    totalInvested: 0,
    currentValue: 0,
    monthlyReturns: [
      { month: 'Jan', return: 4.5 },
      { month: 'Feb', return: 5.2 },
      { month: 'Mar', return: 4.8 },
      { month: 'Apr', return: 5.6 },
      { month: 'May', return: 5.1 },
      { month: 'Jun', return: 5.9 }
    ],
    nextPaymentDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    investmentRounds: [
      { 
        name: 'Seed / Community Round', 
        timing: 'Q1 2026', 
        status: 'Active', 
        target: '$1,500,000',
        minTarget: '$1,500,000',
        instrument: 'Post-Money SAFE',
        dilutionRange: '3.5%',
        raisedStatus: 'Active Round',
        goal: '8,000 Active Users + AI Artists Launch',
        description: 'Minimum investment ticket of $1.5M. Only 3.5% of the entire platform equity is offered at this round, implying a ~$42.9M post-money valuation. Funds used to scale AI infrastructure, launch 50K AI artists, and activate the social + distribution network.'
      },
      { 
        name: 'Series A', 
        timing: 'Q4 2026 (Planned)', 
        status: 'Planned', 
        target: '$3,000,000',
        minTarget: null,
        instrument: 'Priced Round (Equity)',
        dilutionRange: '5-8%',
        raisedStatus: 'Planned Round',
        goal: '35,000 Active Users + $18.5M ARR',
        description: 'Scale AI artist ecosystem to 50K+ artists, expand social network, accelerate global artist acquisition, and grow MRR through subscription + AI artist monetization.'
      },
      { 
        name: 'Series B', 
        timing: 'Q4 2027 (Planned)', 
        status: 'Planned', 
        target: '$10,000,000',
        minTarget: null,
        instrument: 'Priced Round (Equity)',
        dilutionRange: '5-8%',
        raisedStatus: 'Strategic Round',
        goal: '90,000 Active Users + $52M ARR',
        description: 'Global expansion, enterprise label partnerships, advanced rights/royalty automation, and AI artist marketplace consolidation at scale.'
      }
    ]
  };

  // ─── Omnia Strategic Holding Corporation — Founder/Strategic R&D capital ALREADY deployed (2023–2025) ───
  // $1.8M of capitalized development representing 3 years of building Boostify before opening external rounds.
  // Yearly buckets and category breakdown both sum to exactly $1,800,000.
  const omniaCapital = {
    total: 1800000,
    years: 3,
    entity: 'Omnia Strategic Holding Corporation',
    period: '2023 – 2025',
    yearly: [
      { year: '2023', phase: 'Foundation & Architecture', amount: 480000 },
      { year: '2024', phase: 'AI Engine & Core Platform', amount: 720000 },
      { year: '2025', phase: 'Full Product Suite & Polish', amount: 600000 },
    ],
    breakdown: [
      { icon: Cpu, label: 'Engineering & Product Development', detail: '122 pages · 569 components · 112 APIs', amount: 760000 },
      { icon: Brain, label: 'AI / ML Infrastructure & Integration', detail: '14 AI agents · AAS autonomous engine', amount: 430000 },
      { icon: Palette, label: 'Product, UX & Brand Design', detail: 'Design system · brand · UI/UX', amount: 210000 },
      { icon: Globe, label: 'Cloud, APIs & Third-Party Services', detail: 'Firebase · OpenRouter · ElevenLabs · Replicate', amount: 180000 },
      { icon: Coins, label: 'Blockchain & Web3 Development', detail: 'BTF token · smart contracts · BoostiSwap', amount: 135000 },
      { icon: Shield, label: 'Legal, IP & Corporate Structure', detail: 'Incorporation · IP protection · compliance', amount: 85000 },
    ],
  };

  const isRegistered = investorData?.data?.registered || false;

  // Handle investment button click - Directs the user to the registration form
  const handleInvestNow = () => {
    logger.info("Directing to investment registration form");
    // Switch to the register tab
    setSelectedTab("register");
    // Scroll to the form
    setTimeout(() => {
      const registrationForm = document.getElementById("investor-registration-form");
      if (registrationForm) {
        registrationForm.scrollIntoView({ behavior: "smooth" });
      }
    }, 100);
  };

  // Handle contract download - Generates and downloads the investment contract
  const handleDownloadContract = () => {
    logger.info("Generating investment contract...");

    toast({
      title: "Generating Contract...",
      description: "Please wait while we prepare your investment contract",
    });

    const today = new Date().toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    const contractContent = `
BOOSTIFY MUSIC, INC.
SIMPLE AGREEMENT FOR FUTURE EQUITY (SAFE)
(Post-Money Valuation Cap, No Discount)

=========================================================
THIS IS A PREVIEW / DEMO CONTRACT
=========================================================
The official, legally binding contract will be sent to you
by email after your application is reviewed and approved.
=========================================================

Date: ${today}

THIS CERTIFIES THAT in exchange for the payment by the undersigned
investor (the "Investor") of the Purchase Amount set forth below,
Boostify Music, Inc., a Delaware corporation (the "Company"), issues
to the Investor the right to certain shares of the Company's capital
stock, subject to the terms set forth below.

---------------------------------------------------------
1. KEY TERMS
---------------------------------------------------------
• Instrument:            Post-Money SAFE (Y Combinator standard)
• Round:                 Seed
• Minimum Ticket:        $1,500,000 USD per investor
• Post-Money Valuation:  ~$42,900,000 USD
• Equity / Dilution:     3.5% of total platform (at the Valuation Cap)
• Discount Rate:         None
• Pro Rata Rights:       Included

---------------------------------------------------------
2. INVESTOR INFORMATION (to be completed)
---------------------------------------------------------
Investor Name:        _______________________________________
Entity (if any):      _______________________________________
Email:                _______________________________________
Purchase Amount:      $______________________________________
Date:                 _______________________________________
Signature:            _______________________________________

---------------------------------------------------------
3. EVENTS
---------------------------------------------------------
(a) Equity Financing. If there is an Equity Financing before the
    termination of this SAFE, the Company will automatically issue to
    the Investor a number of shares of SAFE Preferred Stock equal to
    the Purchase Amount divided by the Conversion Price.

(b) Liquidity Event. If there is a Liquidity Event before the
    termination of this SAFE, the Investor will be entitled to receive
    a portion of Proceeds equal to the greater of (i) the Purchase
    Amount or (ii) the amount payable on the number of shares of Common
    Stock equal to the Purchase Amount divided by the Liquidity Price.

(c) Dissolution Event. If there is a Dissolution Event before this SAFE
    terminates, the Company will pay the Investor an amount equal to the
    Purchase Amount, subject to availability of legally distributable
    funds.

---------------------------------------------------------
4. COMPANY REPRESENTATIONS
---------------------------------------------------------
The Company is duly organized and validly existing under the laws of
the State of Delaware and has the power and authority to enter into
this agreement and to carry out its obligations hereunder.

---------------------------------------------------------
5. INVESTOR REPRESENTATIONS
---------------------------------------------------------
The Investor has full legal capacity, power and authority to execute
and deliver this SAFE and acknowledges that this is a high-risk
investment and that they may lose their entire investment.

---------------------------------------------------------
6. MISCELLANEOUS
---------------------------------------------------------
This SAFE shall be governed by the laws of the State of Delaware. Any
dispute shall be resolved in the state or federal courts located in
Delaware.

=========================================================
DISCLAIMER: This document is a non-binding PREVIEW for informational
purposes only and does not constitute an offer to sell or a
solicitation of an offer to buy securities. Investing involves risk,
including the possible loss of capital. Consult your legal and
financial advisors before investing.
=========================================================

© 2026 Boostify Music, Inc. All Rights Reserved.
`;

    const blob = new Blob([contractContent], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "Boostify_Music_Investment_Contract_PREVIEW.txt";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast({
      title: "✅ Contract Downloaded!",
      description: "This is a preview. The official contract will be sent by email after your application is approved.",
    });
  };

  if (!accessGranted) {
    return <InvestorAccessGate onGranted={() => setAccessGranted(true)} />;
  }

  return (
    <div className="min-h-screen flex flex-col bg-gray-950 pb-14 sm:pb-0 overflow-x-hidden">
      <Header />
      <main className="flex-1 pt-14 sm:pt-16 overflow-x-hidden">
        <ScrollArea className="flex-1 h-[calc(100vh-5rem)] w-full [&_[data-radix-scroll-area-viewport]>div]:!block [&_[data-radix-scroll-area-viewport]>div]:!w-full [&_[data-radix-scroll-area-viewport]>div]:!min-w-0">
          <div className="w-full max-w-6xl mx-auto px-3 sm:px-4 py-3 sm:py-6">

            {/* ─── Legal Disclaimer Banner ─── */}
            <div className="mb-6 rounded-xl border border-amber-500/40 bg-amber-900/20 px-4 py-4 text-sm text-amber-200">
              <strong className="block mb-1">⚠️ Internal Business Overview — Not a Public Investment Offer</strong>
              This page contains business projections and partnership information for review purposes only.
              BTF is a utility token used exclusively to access digital services inside Boostify.
              BTF does not represent equity, debt, securities, dividends, royalties, revenue share, ownership, investment returns, or profit rights.
              Any equity or SAFE instruments discussed here are offered only to qualified investors in compliance with applicable securities law and are separate from BTF or artist access tokens.
            </div>

            {/* Hero Section - Modern Design */}
            <section className="relative rounded-xl sm:rounded-2xl overflow-hidden mb-6 sm:mb-12 bg-gradient-to-br from-orange-500/10 via-slate-900 to-gray-950 border border-orange-500/20">
              {/* Glowing effect */}
              <div className="absolute top-0 right-0 w-96 h-96 bg-cyan-500/10 rounded-full filter blur-3xl opacity-20"></div>
              <div className="absolute bottom-0 left-0 w-96 h-96 bg-yellow-500/10 rounded-full filter blur-3xl opacity-20"></div>

              {/* Hero image — full bleed on mobile, right panel on desktop */}
              <div className="relative lg:flex lg:items-stretch">
                <div className="relative z-10 p-4 sm:p-8 lg:p-10 lg:flex-1 lg:min-w-0">
                <div className="flex items-center gap-2 sm:gap-3 mb-3 sm:mb-4">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-br from-orange-400 to-amber-600 flex items-center justify-center flex-shrink-0">
                    <TrendingUp className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
                  </div>
                  <div className="min-w-0">
                    <h1 className="text-2xl sm:text-3xl md:text-5xl font-bold bg-gradient-to-r from-orange-400 via-orange-300 to-amber-400 bg-clip-text text-transparent leading-tight">
                      BOOSTIFY BUSINESS OVERVIEW
                    </h1>
                  </div>
                </div>
                <p className="text-base md:text-xl text-gray-300 max-w-3xl mb-4">
                  The AI-Powered Artist Operating System — 122 pages, 112 APIs, 7 AI agents, 6+ revenue streams
                </p>
                <div className="flex flex-wrap gap-1.5 sm:gap-3 mb-4 sm:mb-6">
                  <span className="px-2 sm:px-3 py-1 sm:py-1.5 bg-orange-500/20 text-orange-300 rounded-full text-[10px] sm:text-xs font-medium">122 Frontend Pages</span>
                  <span className="px-2 sm:px-3 py-1 sm:py-1.5 bg-purple-500/20 text-purple-300 rounded-full text-[10px] sm:text-xs font-medium">569 Components</span>
                  <span className="px-2 sm:px-3 py-1 sm:py-1.5 bg-yellow-500/20 text-yellow-300 rounded-full text-[10px] sm:text-xs font-medium">112 API Endpoints</span>
                  <span className="px-2 sm:px-3 py-1 sm:py-1.5 bg-green-500/20 text-green-300 rounded-full text-[10px] sm:text-xs font-medium">7 AI Agents</span>
                  <span className="px-2 sm:px-3 py-1 sm:py-1.5 bg-cyan-500/20 text-cyan-300 rounded-full text-[10px] sm:text-xs font-medium">AAS Autonomous Engine</span>
                </div>
                <div className="flex flex-wrap gap-2 sm:gap-4">
                  <Button 
                    onClick={handleInvestNow} 
                    size="lg" 
                    className="w-full sm:w-auto bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-600 hover:to-yellow-700 text-gray-950 font-semibold shadow-lg shadow-yellow-500/30 text-sm sm:text-base"
                  >
                    <DollarSign className="mr-2 h-5 w-5" />
                    Partner With Us
                  </Button>
                  <Button 
                    variant="outline" 
                    size="lg" 
                    className="w-full sm:w-auto border-orange-500/50 text-orange-300 hover:bg-cyan-500/10 hover:text-orange-200 text-sm sm:text-base"
                    onClick={handleDownloadContract}
                  >
                    <Download className="mr-2 h-5 w-5" />
                    Download Contract
                  </Button>
                </div>
                </div>{/* end left column */}

                {/* Right column: platform screenshot — visible from lg up */}
                <div className="hidden lg:block lg:w-[480px] xl:w-[560px] flex-shrink-0 relative">
                  <img
                    src={INVESTOR_IMAGES.hero_dashboard}
                    alt="Boostify platform dashboard"
                    className="w-full h-full object-cover object-left"
                    loading="eager"
                  />
                  {/* gradient overlay to blend left edge into the dark bg */}
                  <div className="absolute inset-0 bg-gradient-to-r from-slate-900/80 via-transparent to-transparent pointer-events-none" />
                  {/* bottom overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-900/40 via-transparent to-transparent pointer-events-none" />
                </div>

                {/* Mobile hero image — below text, with gradient overlay */}
                <div className="lg:hidden relative w-full h-44 sm:h-56 overflow-hidden">
                  <img
                    src={INVESTOR_IMAGES.hero_dashboard}
                    alt="Boostify platform dashboard"
                    className="w-full h-full object-cover object-top"
                    loading="eager"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/60 to-transparent pointer-events-none" />
                </div>
              </div>{/* end two-column flex */}
            </section>

            {/* Main Content Tabs - Modern Design */}
            <Tabs value={selectedTab} onValueChange={setSelectedTab}>
              <div className="-mx-3 sm:mx-0 px-3 sm:px-0 overflow-x-auto scrollbar-hide mb-6 sm:mb-10">
                <TabsList className="inline-flex w-auto min-w-full sm:grid sm:grid-cols-8 max-w-[1600px] bg-gray-900/50 border border-orange-500/20 p-1 gap-0.5">
                  <TabsTrigger 
                    value="pitchdeck" 
                    className="flex-shrink-0 data-[state=active]:bg-gradient-to-r data-[state=active]:from-orange-500 data-[state=active]:to-amber-600 data-[state=active]:text-white text-gray-400 data-[state=active]:shadow-lg data-[state=active]:shadow-orange-500/30 px-2 sm:px-2"
                  >
                    <Presentation className="w-3.5 h-3.5 sm:w-4 sm:h-4 sm:mr-2" />
                    <span className="hidden sm:inline text-xs sm:text-sm whitespace-nowrap">Pitch Deck</span>
                    <span className="inline sm:hidden text-[10px] whitespace-nowrap ml-1">Deck</span>
                  </TabsTrigger>
                  <TabsTrigger 
                    value="platform" 
                    className="flex-shrink-0 data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-500 data-[state=active]:to-violet-600 data-[state=active]:text-white text-gray-400 data-[state=active]:shadow-lg data-[state=active]:shadow-purple-500/30 px-2 sm:px-2"
                  >
                    <LayoutGrid className="w-3.5 h-3.5 sm:w-4 sm:h-4 sm:mr-2" />
                    <span className="hidden sm:inline text-xs sm:text-sm whitespace-nowrap">Platform</span>
                    <span className="inline sm:hidden text-[10px] whitespace-nowrap ml-1">Platform</span>
                  </TabsTrigger>
                  <TabsTrigger 
                    value="investments" 
                    className="flex-shrink-0 data-[state=active]:bg-gradient-to-r data-[state=active]:from-orange-500 data-[state=active]:to-amber-600 data-[state=active]:text-white text-gray-400 data-[state=active]:shadow-lg data-[state=active]:shadow-orange-500/30 px-2 sm:px-2"
                  >
                    <TrendingUp className="w-3.5 h-3.5 sm:w-4 sm:h-4 sm:mr-2" />
                    <span className="hidden sm:inline text-xs sm:text-sm whitespace-nowrap">Investments</span>
                    <span className="inline sm:hidden text-[10px] whitespace-nowrap ml-1">Invest</span>
                  </TabsTrigger>
                  <TabsTrigger 
                    value="roadmap" 
                    className="flex-shrink-0 data-[state=active]:bg-gradient-to-r data-[state=active]:from-orange-500 data-[state=active]:to-amber-600 data-[state=active]:text-white text-gray-400 data-[state=active]:shadow-lg data-[state=active]:shadow-orange-500/30 px-2 sm:px-2"
                  >
                    <Calendar className="w-3.5 h-3.5 sm:w-4 sm:h-4 sm:mr-2" />
                    <span className="hidden sm:inline text-xs sm:text-sm whitespace-nowrap">Roadmap</span>
                    <span className="inline sm:hidden text-[10px] whitespace-nowrap ml-1">Roadmap</span>
                  </TabsTrigger>
                  <TabsTrigger 
                    value="projections" 
                    className="flex-shrink-0 data-[state=active]:bg-gradient-to-r data-[state=active]:from-orange-500 data-[state=active]:to-amber-600 data-[state=active]:text-white text-gray-400 data-[state=active]:shadow-lg data-[state=active]:shadow-orange-500/30 px-2 sm:px-2"
                  >
                    <BarChart className="w-3.5 h-3.5 sm:w-4 sm:h-4 sm:mr-2" />
                    <span className="hidden sm:inline text-xs sm:text-sm whitespace-nowrap">Projections</span>
                    <span className="inline sm:hidden text-[10px] whitespace-nowrap ml-1">Projects</span>
                  </TabsTrigger>
                  <TabsTrigger 
                    value="calculator" 
                    className="flex-shrink-0 data-[state=active]:bg-gradient-to-r data-[state=active]:from-orange-500 data-[state=active]:to-amber-600 data-[state=active]:text-white text-gray-400 data-[state=active]:shadow-lg data-[state=active]:shadow-orange-500/30 px-2 sm:px-2"
                  >
                    <DollarSign className="w-3.5 h-3.5 sm:w-4 sm:h-4 sm:mr-2" />
                    <span className="hidden sm:inline text-xs sm:text-sm whitespace-nowrap">Calculator</span>
                    <span className="inline sm:hidden text-[10px] whitespace-nowrap ml-1">Calc</span>
                  </TabsTrigger>
                  <TabsTrigger 
                    value="overview" 
                    className="flex-shrink-0 data-[state=active]:bg-gradient-to-r data-[state=active]:from-orange-500 data-[state=active]:to-amber-600 data-[state=active]:text-white text-gray-400 data-[state=active]:shadow-lg data-[state=active]:shadow-orange-500/30 px-2 sm:px-2"
                  >
                    <BarChart2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 sm:mr-2" />
                    <span className="hidden sm:inline text-xs sm:text-sm whitespace-nowrap">Overview</span>
                    <span className="inline sm:hidden text-[10px] whitespace-nowrap ml-1">Overview</span>
                  </TabsTrigger>
                  <TabsTrigger 
                    value="register" 
                    className="flex-shrink-0 data-[state=active]:bg-gradient-to-r data-[state=active]:from-orange-500 data-[state=active]:to-amber-600 data-[state=active]:text-white text-gray-400 data-[state=active]:shadow-lg data-[state=active]:shadow-orange-500/30 px-2 sm:px-2"
                  >
                    <UserPlus className="w-3.5 h-3.5 sm:w-4 sm:h-4 sm:mr-2" />
                    <span className="hidden sm:inline text-xs sm:text-sm whitespace-nowrap">Register</span>
                    <span className="inline sm:hidden text-[10px] whitespace-nowrap ml-1">Register</span>
                  </TabsTrigger>
                </TabsList>
              </div>

              {/* Pitch Deck Tab */}
              <TabsContent value="pitchdeck">
                <PitchDeck setSelectedTab={setSelectedTab} />
              </TabsContent>

              {/* Platform Overview Tab */}
              <TabsContent value="platform">
                <PlatformOverview />
              </TabsContent>

              {/* Overview Tab */}
              <TabsContent value="overview">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6 mb-8">
                  <InvestorStats investorData={investorData?.data} globalStats={globalStats} />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-6 mb-8">
                  <Card className="p-3 sm:p-6 bg-gradient-to-br from-gray-900/90 to-gray-900/50 border border-orange-500/20">
                    <h3 className="text-base sm:text-lg font-semibold mb-4 sm:mb-6 text-orange-300">Portfolio Value Over Time</h3>
                    <InvestmentPerformanceChart data={investmentData.monthlyReturns} />
                  </Card>

                  <div className="grid grid-cols-2 gap-2 sm:gap-4">
                    <Card className="p-4 sm:p-6 bg-gradient-to-br from-gray-900/90 to-gray-900/50 border border-orange-500/20 flex flex-col items-center justify-center">
                      <p className="text-xs sm:text-sm text-gray-400 mb-2">Diversification</p>
                      <div className="relative w-20 sm:w-32 h-20 sm:h-32">
                        <svg className="w-full h-full transform -rotate-90" viewBox="0 0 128 128">
                          <circle cx="64" cy="64" r="56" fill="none" stroke="rgb(30 41 59)" strokeWidth="12"/>
                          <circle cx="64" cy="64" r="56" fill="none" stroke="rgb(6 182 212)" strokeWidth="12" strokeDasharray="264" strokeDashoffset="66" strokeLinecap="round"/>
                        </svg>
                        <div className="absolute inset-0 flex items-center justify-center">
                          <span className="text-lg sm:text-3xl font-bold text-orange-300">75%</span>
                        </div>
                      </div>
                    </Card>
                    
                    <Card className="p-4 sm:p-6 bg-gradient-to-br from-gray-900/90 to-gray-900/50 border border-yellow-500/20 flex flex-col items-center justify-center">
                      <p className="text-xs sm:text-sm text-gray-400 mb-2">Risk Level</p>
                      <div className="relative w-20 sm:w-32 h-20 sm:h-32">
                        <svg className="w-full h-full transform -rotate-90" viewBox="0 0 128 128">
                          <circle cx="64" cy="64" r="56" fill="none" stroke="rgb(30 41 59)" strokeWidth="12"/>
                          <circle cx="64" cy="64" r="56" fill="none" stroke="rgb(234 179 8)" strokeWidth="12" strokeDasharray="264" strokeDashoffset="184" strokeLinecap="round"/>
                        </svg>
                        <div className="absolute inset-0 flex items-center justify-center">
                          <span className="text-lg sm:text-3xl font-bold text-yellow-400">30%</span>
                        </div>
                      </div>
                    </Card>
                  </div>
                </div>

                <Card className="p-3 sm:p-6 bg-gradient-to-br from-gray-900/90 to-gray-900/50 border border-orange-500/20 mb-8">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4 sm:mb-6">
                    <h3 className="text-base sm:text-lg font-semibold text-orange-300">Investor Information</h3>
                    <Button variant="outline" size="sm" className="border-orange-500/50 text-orange-300 hover:bg-cyan-500/10">
                      <Download className="h-4 w-4 mr-2" />
                      Download Info
                    </Button>
                  </div>

                  <div className="space-y-3 sm:space-y-4 text-gray-300">
                    <div>
                      <h4 className="text-sm sm:text-base font-semibold mb-2 text-white">Investing in Boostify Music</h4>
                      <p className="text-xs sm:text-sm">
                        Boostify Music offers a unique opportunity to invest in the future of the music industry. Our AI-powered platform is revolutionizing how artists, producers, and fans interact with music.
                      </p>
                    </div>
                    
                    <div>
                      <h4 className="text-sm sm:text-base font-semibold mb-3 text-white">Investment Benefits</h4>
                      <ul className="space-y-2 text-xs sm:text-sm">
                        <li className="flex items-start gap-2">
                          <Check className="h-4 w-4 text-yellow-400 mt-0.5 flex-shrink-0" />
                          <span><strong className="text-orange-300">Monthly Returns:</strong> 4-6% based on your selected investment plan</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <Check className="h-4 w-4 text-yellow-400 mt-0.5 flex-shrink-0" />
                          <span><strong className="text-orange-300">Minimum Investment:</strong> $2,000 USD</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <Check className="h-4 w-4 text-yellow-400 mt-0.5 flex-shrink-0" />
                          <span><strong className="text-orange-300">Monthly Payments:</strong> Profit distribution on the 15th of each month</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <Check className="h-4 w-4 text-yellow-400 mt-0.5 flex-shrink-0" />
                          <span><strong className="text-orange-300">Transparent Contracts:</strong> Clear terms and comprehensive documentation</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <Check className="h-4 w-4 text-yellow-400 mt-0.5 flex-shrink-0" />
                          <span><strong className="text-orange-300">Exclusive Dashboard:</strong> Access to real-time statistics and analysis tools</span>
                        </li>
                      </ul>
                    </div>

                    <div>
                      <h4 className="text-sm sm:text-base font-semibold mb-2 text-white">Upcoming Milestones</h4>
                      <p className="text-xs sm:text-sm">
                        We're rapidly expanding, with the upcoming launch of our AI-enhanced streaming platform and new creator tools. Series B funding will accelerate our international growth.
                      </p>
                    </div>
                    
                    <div className="pt-4">
                      <Button 
                        onClick={handleInvestNow} 
                        className="bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-600 hover:to-yellow-700 text-gray-950 font-semibold w-full sm:w-auto"
                      >
                        <DollarSign className="mr-2 h-4 w-4" />
                        Start Investing
                      </Button>
                    </div>
                  </div>
                </Card>
              </TabsContent>

              {/* Calculator Tab */}
              <TabsContent value="calculator">
                <Card className="p-4 sm:p-6 mb-8">
                  <h3 className="text-lg sm:text-xl font-semibold mb-4 sm:mb-6">Investment Calculator</h3>
                  <InvestmentCalculator />
                </Card>

                <Card className="p-4 sm:p-6">
                  <div className="flex justify-between items-center mb-4 sm:mb-6">
                    <h3 className="text-base sm:text-lg font-semibold">Investment Plans</h3>
                    <Button variant="outline" size="sm">
                      <FileText className="h-4 w-4 mr-2" />
                      View Full Details
                    </Button>
                  </div>

                  <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6">
                    <Card className="p-4 sm:p-6 border-2 border-muted">
                      <div className="flex justify-between items-start mb-4">
                        <h4 className="text-base sm:text-lg font-medium">Standard Plan</h4>
                        <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs">Low Risk</span>
                      </div>
                      <div className="flex items-baseline mb-4 sm:mb-6">
                        <span className="text-3xl sm:text-4xl font-bold">4%</span>
                        <span className="text-muted-foreground ml-1">monthly</span>
                      </div>
                      <ul className="space-y-2 mb-4 sm:mb-6 text-sm sm:text-base">
                        <li className="flex items-center">
                          <ChevronRight className="h-4 w-4 text-orange-500 mr-2 flex-shrink-0" />
                          <span>Minimum investment: $2,000</span>
                        </li>
                        <li className="flex items-center">
                          <ChevronRight className="h-4 w-4 text-orange-500 mr-2 flex-shrink-0" />
                          <span>Minimum term: 6 months</span>
                        </li>
                        <li className="flex items-center">
                          <ChevronRight className="h-4 w-4 text-orange-500 mr-2 flex-shrink-0" />
                          <span>Monthly payments</span>
                        </li>
                      </ul>
                      <Button className="w-full" variant="outline">Select Plan</Button>
                    </Card>

                    <Card className="p-4 sm:p-6 border-2 border-orange-500 shadow-lg relative">
                      <div className="absolute -top-3 right-4 px-3 py-1 bg-orange-500 text-white text-xs rounded-full">
                        Recommended
                      </div>
                      <div className="flex justify-between items-start mb-4">
                        <h4 className="text-base sm:text-lg font-medium">Premium Plan</h4>
                        <span className="px-2 py-1 bg-orange-100 text-orange-800 rounded-full text-xs">Medium Risk</span>
                      </div>
                      <div className="flex items-baseline mb-4 sm:mb-6">
                        <span className="text-3xl sm:text-4xl font-bold">5%</span>
                        <span className="text-muted-foreground ml-1">monthly</span>
                      </div>
                      <ul className="space-y-2 mb-4 sm:mb-6 text-sm sm:text-base">
                        <li className="flex items-center">
                          <ChevronRight className="h-4 w-4 text-orange-500 mr-2 flex-shrink-0" />
                          <span>Minimum investment: $5,000</span>
                        </li>
                        <li className="flex items-center">
                          <ChevronRight className="h-4 w-4 text-orange-500 mr-2 flex-shrink-0" />
                          <span>Minimum term: 12 months</span>
                        </li>
                        <li className="flex items-center">
                          <ChevronRight className="h-4 w-4 text-orange-500 mr-2 flex-shrink-0" />
                          <span>Monthly payments</span>
                        </li>
                        <li className="flex items-center">
                          <ChevronRight className="h-4 w-4 text-orange-500 mr-2 flex-shrink-0" />
                          <span>Access to exclusive events</span>
                        </li>
                      </ul>
                      <Button className="w-full bg-orange-500 hover:bg-orange-600">Select Plan</Button>
                    </Card>

                    <Card className="p-4 sm:p-6 border-2 border-muted sm:col-span-2 md:col-span-1">
                      <div className="flex justify-between items-start mb-4">
                        <h4 className="text-base sm:text-lg font-medium">Elite Plan</h4>
                        <span className="px-2 py-1 bg-red-100 text-red-800 rounded-full text-xs">High Potential</span>
                      </div>
                      <div className="flex items-baseline mb-4 sm:mb-6">
                        <span className="text-3xl sm:text-4xl font-bold">6%</span>
                        <span className="text-muted-foreground ml-1">monthly</span>
                      </div>
                      <ul className="space-y-2 mb-4 sm:mb-6 text-sm sm:text-base">
                        <li className="flex items-center">
                          <ChevronRight className="h-4 w-4 text-orange-500 mr-2 flex-shrink-0" />
                          <span>Minimum investment: $25,000</span>
                        </li>
                        <li className="flex items-center">
                          <ChevronRight className="h-4 w-4 text-orange-500 mr-2 flex-shrink-0" />
                          <span>Minimum term: 18 months</span>
                        </li>
                        <li className="flex items-center">
                          <ChevronRight className="h-4 w-4 text-orange-500 mr-2 flex-shrink-0" />
                          <span>Monthly payments</span>
                        </li>
                        <li className="flex items-center">
                          <ChevronRight className="h-4 w-4 text-orange-500 mr-2 flex-shrink-0" />
                          <span>Participation in strategic decisions</span>
                        </li>
                      </ul>
                      <Button className="w-full" variant="outline">Select Plan</Button>
                    </Card>
                  </div>

                  <div className="mt-6 sm:mt-8 p-3 sm:p-4 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 rounded-lg">
                    <div className="flex items-start">
                      <AlertTriangle className="h-5 w-5 text-amber-500 mr-2 sm:mr-3 mt-0.5 flex-shrink-0" />
                      <div>
                        <h4 className="font-medium text-amber-800 dark:text-amber-300 text-sm sm:text-base">Important Notice</h4>
                        <p className="text-xs sm:text-sm text-amber-700 dark:text-amber-400">
                          All investments involve risks. Past returns do not guarantee future results. Please read the contract carefully and consult a financial advisor before investing.
                        </p>
                      </div>
                    </div>
                  </div>
                </Card>
              </TabsContent>

              {/* Investments Tab */}
              <TabsContent value="investments">
                {/* ─── Omnia Strategic Holding Corporation — Capital Already Deployed ($1.8M / 3 years) ─── */}
                <Card className="p-5 sm:p-8 mb-4 sm:mb-6 bg-gradient-to-br from-amber-500/15 via-orange-500/10 to-black/40 border-orange-500/30 relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-40 h-40 bg-orange-500/10 rounded-full blur-3xl pointer-events-none" />
                  <div className="relative">
                    <div className="flex items-start justify-between gap-4 flex-wrap mb-5">
                      <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-orange-500/20 rounded-xl flex-shrink-0">
                          <Building2 className="h-6 w-6 text-orange-400" />
                        </div>
                        <div>
                          <span className="inline-block px-2 py-0.5 bg-green-500/20 text-green-400 rounded-full text-[10px] font-bold uppercase tracking-wide mb-1">Capital Already Deployed</span>
                          <h3 className="text-base sm:text-xl font-bold text-white leading-tight">{omniaCapital.entity}</h3>
                          <p className="text-xs text-muted-foreground">Founding entity · {omniaCapital.period} · {omniaCapital.years} years of R&D</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-amber-300 to-orange-500 bg-clip-text text-transparent">$1.8M</p>
                        <p className="text-[11px] text-muted-foreground">invested in development</p>
                      </div>
                    </div>

                    <p className="text-xs sm:text-sm text-white/80 leading-relaxed mb-5">
                      Before opening this round, <span className="text-orange-400 font-semibold">Omnia Strategic Holding Corporation</span> has already
                      capitalized <span className="text-white font-semibold">$1.8M</span> of R&D into Boostify across <span className="text-white font-semibold">3 years (2023–2025)</span>.
                      This is not a concept — it is a <span className="text-white font-semibold">production-ready platform</span> with 122 pages, 569 components,
                      112 APIs and 14 AI agents already built and live. New capital scales an asset that already exists, dramatically de-risking the investment.
                    </p>

                    {/* 3-Year investment timeline */}
                    <div className="grid grid-cols-3 gap-2 sm:gap-4 mb-5">
                      {omniaCapital.yearly.map((y) => (
                        <div key={y.year} className="p-3 bg-black/30 rounded-xl border border-orange-500/15 text-center">
                          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{y.year}</p>
                          <p className="text-lg sm:text-2xl font-bold text-orange-400">${(y.amount / 1000).toFixed(0)}K</p>
                          <p className="text-[10px] sm:text-xs text-white/60 leading-tight mt-1">{y.phase}</p>
                        </div>
                      ))}
                    </div>

                    {/* Capital allocation breakdown */}
                    <p className="text-xs font-semibold text-white/70 uppercase tracking-wide mb-3">How the $1.8M was invested</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3 mb-4">
                      {omniaCapital.breakdown.map((b, i) => {
                        const Icon = b.icon;
                        const pct = ((b.amount / omniaCapital.total) * 100).toFixed(0);
                        return (
                          <div key={i} className="flex items-center gap-3 p-3 bg-black/30 rounded-lg border border-white/5">
                            <div className="p-2 bg-orange-500/15 rounded-lg flex-shrink-0">
                              <Icon className="h-4 w-4 text-orange-400" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs sm:text-sm font-semibold text-white truncate">{b.label}</p>
                              <p className="text-[10px] text-muted-foreground truncate">{b.detail}</p>
                            </div>
                            <div className="text-right flex-shrink-0">
                              <p className="text-xs sm:text-sm font-bold text-orange-400">${(b.amount / 1000).toFixed(0)}K</p>
                              <p className="text-[10px] text-muted-foreground">{pct}%</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <div className="flex items-center justify-between p-3 bg-orange-500/15 rounded-lg border border-orange-500/25">
                      <span className="text-xs sm:text-sm font-bold text-white">Total R&D Capital Deployed by Omnia</span>
                      <span className="text-base sm:text-lg font-bold text-orange-400">${omniaCapital.total.toLocaleString()}</span>
                    </div>

                    <p className="text-[11px] text-muted-foreground mt-4 leading-relaxed">
                      <span className="text-white/80 font-semibold">Why it matters:</span> This $1.8M of founder capital already sits behind the current
                      ~$42.9M post-money valuation. Combined with the planned $14.5M across the Seed, Series A and Series B rounds, the total
                      capital program backing Boostify reaches <span className="text-orange-400 font-semibold">$16.3M</span>.
                    </p>
                  </div>
                </Card>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6 mb-4 sm:mb-6">
                  <Card className="p-4 sm:p-6 bg-black/20 border-orange-500/20">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-orange-500/20 rounded-lg flex-shrink-0">
                        <Building2 className="h-5 w-5 text-orange-500" />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Capital Deployed (Omnia)</p>
                        <p className="text-lg sm:text-xl font-bold">$1.8M</p>
                      </div>
                    </div>
                  </Card>

                  <Card className="p-4 sm:p-6 bg-black/20 border-orange-500/20">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-orange-500/20 rounded-lg flex-shrink-0">
                        <TrendingUp className="h-5 w-5 text-orange-500" />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Current Value</p>
                        <p className="text-lg sm:text-xl font-bold">${investmentData.currentValue}</p>
                      </div>
                    </div>
                  </Card>

                  <Card className="p-4 sm:p-6 bg-black/20 border-orange-500/20">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-orange-500/20 rounded-lg flex-shrink-0">
                        <Clock className="h-5 w-5 text-orange-500" />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Next Payment</p>
                        <p className="text-lg sm:text-xl font-bold">{new Date(investmentData.nextPaymentDate).toLocaleDateString()}</p>
                      </div>
                    </div>
                  </Card>
                </div>

                <Card className="p-4 sm:p-6 bg-black/20 border-orange-500/20 mb-4 sm:mb-6">
                  <h3 className="text-base sm:text-lg font-semibold mb-4 sm:mb-6 text-white">Investment History</h3>
                  
                  <div className="space-y-3">
                    <div className="flex justify-between items-center py-2 border-b border-white/10">
                      <span className="text-xs text-muted-foreground">Status</span>
                      <span className="px-2 py-0.5 bg-gray-500/20 text-gray-400 rounded-full text-xs">No investments yet</span>
                    </div>
                    <div className="text-center py-4">
                      <p className="text-xs sm:text-sm text-muted-foreground mb-3">Start investing in Boostify Music today!</p>
                      <Button 
                        size="sm" 
                        onClick={handleInvestNow}
                        className="bg-orange-500 hover:bg-orange-600"
                      >
                        <DollarSign className="h-4 w-4 mr-2" />
                        Register as Investor
                      </Button>
                    </div>
                  </div>
                </Card>

                <Card className="p-4 sm:p-6 bg-black/20 border-orange-500/20">
                  <h3 className="text-base sm:text-lg font-semibold mb-4 sm:mb-6 text-white">Investment Funding Rounds</h3>
                  <p className="text-xs sm:text-sm text-muted-foreground mb-4 sm:mb-6">Professional funding opportunities with tiered growth targets</p>

                  <div className="flex flex-col sm:flex-row gap-3 mb-4 sm:mb-6">
                    <Button 
                      onClick={handleInvestNow}
                      className="flex-1 bg-gradient-to-r from-orange-400 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white font-semibold shadow-lg"
                    >
                      <CreditCard className="h-4 w-4 mr-2" />
                      Invest Now
                    </Button>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 mb-4 sm:mb-6">
                    {investmentData.investmentRounds.map((round: any, index: number) => (
                      <Card key={index} className={`p-4 sm:p-6 relative ${
                        round.status === 'Active' 
                          ? 'bg-gradient-to-br from-orange-400/20 to-orange-500/5 border-orange-500/30' 
                          : 'bg-gradient-to-br from-slate-800/50 to-gray-900/50 border-slate-700/30'
                      }`}>
                        {round.status === 'Active' && (
                          <div className="absolute top-3 right-3 px-3 py-1 bg-orange-500 text-white text-xs rounded-full font-semibold">
                            OPEN NOW
                          </div>
                        )}
                        
                        <div className="mb-3 sm:mb-4 pr-16">
                          <h4 className="text-sm sm:text-lg font-bold mb-2">{round.name}</h4>
                          <span className={`inline-block px-2 py-1 rounded-full text-xs font-semibold ${
                            round.status === 'Active' ? 'bg-green-500/20 text-yellow-400' : 'bg-blue-500/20 text-orange-400'
                          }`}>
                            {round.status}
                          </span>
                        </div>
                        
                        <p className="text-xs sm:text-sm text-muted-foreground mb-4">{round.description}</p>
                        
                        <div className="space-y-3 mb-4">
                          <div>
                            <p className="text-xs text-muted-foreground">Instrument</p>
                            <p className="text-xs sm:text-sm font-semibold text-cyan-400">{round.instrument}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Timing</p>
                            <p className="text-xs sm:text-sm font-semibold">{round.timing}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Funding Target</p>
                            <p className="text-sm font-bold">{round.target}{round.minTarget && <span className="text-xs text-muted-foreground ml-1">(min {round.minTarget})</span>}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Expected Dilution Range</p>
                            <p className="text-sm font-bold text-orange-400">{round.dilutionRange} <span className="text-[10px] text-muted-foreground">(indicative)</span></p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Round Status</p>
                            <p className="text-xs font-semibold text-orange-400">{round.raisedStatus}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">User Growth Goal</p>
                            <p className="text-sm font-bold text-yellow-400">{round.goal}</p>
                          </div>
                        </div>
                        
                        {round.status === 'Active' && (
                          <div className="space-y-2">
                            <Button 
                              onClick={handleInvestNow}
                              className="w-full bg-gradient-to-r from-orange-400 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white font-semibold"
                            >
                              <DollarSign className="h-4 w-4 mr-2" />
                              Register to Invest
                            </Button>
                          </div>
                        )}
                        {round.status === 'Planned' && (
                          <Button 
                            disabled
                            variant="outline"
                            className="w-full"
                          >
                            Planned
                          </Button>
                        )}
                      </Card>
                    ))}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
                    <Card className="p-4 sm:p-6 bg-orange-500/10 border-orange-500/20">
                      <div className="flex items-start gap-3">
                        <div className="p-2 bg-orange-500/20 rounded-lg flex-shrink-0">
                          <Target className="h-5 w-5 text-orange-500" />
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">Total Capital Target</p>
                          <p className="text-xl sm:text-2xl font-bold">~$14.5M</p>
                          <p className="text-xs text-muted-foreground mt-1">Seed $1.5M + Series A $3M + Series B $10M</p>
                        </div>
                      </div>
                    </Card>

                    <Card className="p-4 sm:p-6 bg-cyan-500/10 border-orange-500/20">
                      <div className="flex items-start gap-3">
                        <div className="p-2 bg-cyan-500/20 rounded-lg flex-shrink-0">
                          <Users className="h-5 w-5 text-orange-500" />
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">User Growth Goal</p>
                          <p className="text-xl sm:text-2xl font-bold">90K+</p>
                          <p className="text-xs text-muted-foreground mt-1">Active users by Series B close</p>
                        </div>
                      </div>
                    </Card>

                    <Card className="p-4 sm:p-6 bg-yellow-500/10 border-yellow-500/20">
                      <div className="flex items-start gap-3">
                        <div className="p-2 bg-yellow-500/20 rounded-lg flex-shrink-0">
                          <TrendingUp className="h-5 w-5 text-yellow-500" />
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">Indicative Dilution Range</p>
                          <p className="text-xl sm:text-2xl font-bold">13.5-19.5%</p>
                          <p className="text-xs text-muted-foreground mt-1">Cumulative across all rounds</p>
                        </div>
                      </div>
                    </Card>
                  </div>
                </Card>
              </TabsContent>

              {/* Roadmap Tab */}
              <TabsContent value="roadmap">
                <Card className="p-4 sm:p-6 bg-black/20 border-orange-500/20">
                  <h3 className="text-base sm:text-lg font-semibold mb-4 sm:mb-6 text-white">Boostify Music Roadmap</h3>
                  <RoadmapTimeline />
                </Card>
              </TabsContent>

              {/* Financial Projections Tab */}
              <TabsContent value="projections">
                <Card className="p-4 sm:p-6 bg-black/20 border-orange-500/20">
                  <h3 className="text-base sm:text-lg font-semibold mb-4 sm:mb-6 text-white">Financial Projections</h3>
                  
                  <div className="grid sm:grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8">
                    <div>
                      <h4 className="text-sm sm:text-base font-medium mb-3 sm:mb-4 text-white">Projected User Growth</h4>
                      <div className="h-64 bg-black/30 rounded-lg p-4 overflow-visible relative">
                        <div className="absolute inset-0 bg-gradient-to-r from-orange-400/5 to-orange-500/10 rounded-lg"></div>
                        <div className="relative z-10 h-56 flex flex-col">
                          <div className="flex justify-between items-center mb-2">
                            <span className="text-xs text-white/70">Users (thousands)</span>
                            <div className="flex space-x-2">
                              <span className="text-xs px-1.5 py-0.5 rounded bg-orange-500/20 text-orange-200">Projected Growth</span>
                            </div>
                          </div>
                          
                          <div className="flex-1 flex items-end gap-1">
                            {[
                              { label: "Jan '26", height: "4px" },
                              { label: "Mar '26", height: "7px" },
                              { label: "May '26", height: "12px" },
                              { label: "Jul '26", height: "17px" },
                              { label: "Sep '26", height: "25px" },
                              { label: "Nov '26", height: "35px" },
                              { label: "Jan '27", height: "52px" },
                              { label: "Mar '27", height: "70px" },
                              { label: "May '27", height: "91px" },
                              { label: "Jul '27", height: "112px" },
                              { label: "Sep '27", height: "137px" },
                              { label: "Nov '27", height: "158px" },
                              { label: "Dec '28", height: "175px" }
                            ].map((item, index) => (
                              <div key={index} className="flex-1 flex flex-col items-center justify-end">
                                <div 
                                  className="w-full bg-gradient-to-t from-orange-400 to-orange-400 rounded-sm relative group cursor-pointer transition-all hover:from-orange-600 hover:to-orange-500 shadow-lg"
                                  style={{ height: item.height, maxWidth: "24px", margin: "0 auto" }}
                                >
                                  <div className="absolute -top-6 left-1/2 transform -translate-x-1/2 bg-black/80 text-white text-[9px] py-1 px-2 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                                    {item.label}
                                  </div>
                                </div>
                                <span className="text-[7px] mt-2 text-white/60">{item.label}</span>
                              </div>
                            ))}
                          </div>
                          
                          <div className="mt-2 pt-2 border-t border-white/10">
                            <div className="flex justify-between">
                              <span className="text-xs text-white/70">1K users Jan '26</span>
                              <span className="text-xs text-white/70">50K users Dec '28</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <div>
                      <h4 className="text-xs sm:text-base font-medium mb-2 sm:mb-4 text-white">Projected Revenue Growth</h4>
                      <div className="h-48 sm:h-64 bg-black/30 rounded-lg p-2 sm:p-4 overflow-hidden relative">
                        <div className="absolute inset-0 bg-gradient-to-r from-green-500/5 to-green-500/10 rounded-lg"></div>
                        <div className="relative z-10 h-full flex flex-col">
                          <div className="flex justify-between items-center mb-2 sm:mb-3 flex-col sm:flex-row gap-1 sm:gap-2">
                            <span className="text-[10px] sm:text-xs text-white/70">Revenue ($ millions)</span>
                            <div className="flex space-x-2">
                              <span className="text-[9px] sm:text-xs px-1.5 py-0.5 rounded bg-green-500/20 text-green-200">Monthly Revenue</span>
                            </div>
                          </div>
                          
                          <div className="flex-1 relative">
                            <svg className="w-full h-full" viewBox="0 0 1300 200" preserveAspectRatio="none">
                              <defs>
                                <linearGradient id="revenueGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                                  <stop offset="0%" stopColor="#22c55e" stopOpacity="0.3" />
                                  <stop offset="100%" stopColor="#22c55e" stopOpacity="0.05" />
                                </linearGradient>
                              </defs>
                              
                              {/* Grid lines */}
                              <line x1="0" y1="200" x2="1300" y2="200" stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
                              <line x1="0" y1="150" x2="1300" y2="150" stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
                              <line x1="0" y1="100" x2="1300" y2="100" stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
                              <line x1="0" y1="50" x2="1300" y2="50" stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
                              
                              {/* Area under curve */}
                              <path
                                d="M 0,190 L 100,175 L 200,155 L 300,135 L 400,115 L 500,95 L 600,70 L 700,50 L 800,32 L 900,18 L 1000,8 L 1100,2 L 1300,0 L 1300,200 L 0,200 Z"
                                fill="url(#revenueGradient)"
                              />
                              
                              {/* Main line */}
                              <path
                                d="M 0,190 L 100,175 L 200,155 L 300,135 L 400,115 L 500,95 L 600,70 L 700,50 L 800,32 L 900,18 L 1000,8 L 1100,2 L 1300,0"
                                fill="none"
                                stroke="#22c55e"
                                strokeWidth="3"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                              
                              {/* Data points */}
                              <circle cx="0" cy="190" r="4" fill="#22c55e" opacity="0.8" />
                              <circle cx="100" cy="175" r="4" fill="#22c55e" opacity="0.8" />
                              <circle cx="200" cy="155" r="4" fill="#22c55e" opacity="0.8" />
                              <circle cx="300" cy="135" r="4" fill="#22c55e" opacity="0.8" />
                              <circle cx="400" cy="115" r="4" fill="#22c55e" opacity="0.8" />
                              <circle cx="500" cy="95" r="4" fill="#22c55e" opacity="0.8" />
                              <circle cx="600" cy="70" r="4" fill="#22c55e" opacity="0.8" />
                              <circle cx="700" cy="50" r="4" fill="#22c55e" opacity="0.8" />
                              <circle cx="800" cy="32" r="4" fill="#22c55e" opacity="0.8" />
                              <circle cx="900" cy="18" r="4" fill="#22c55e" opacity="0.8" />
                              <circle cx="1000" cy="8" r="4" fill="#22c55e" opacity="0.8" />
                              <circle cx="1100" cy="2" r="4" fill="#22c55e" opacity="0.8" />
                              <circle cx="1300" cy="0" r="4" fill="#22c55e" opacity="0.8" />
                            </svg>
                          </div>
                          
                          <div className="flex justify-between mt-1 sm:mt-2 text-[6px] sm:text-[7px] text-white/50 px-0.5 sm:px-1">
                            {["Jan '26", "Mar", "May", "Jul", "Sep", "Nov", "Jan '27", "Mar", "May", "Jul", "Sep", "Nov", "Dec '28"].map((month, i) => (
                              <span key={i}>{month}</span>
                            ))}
                          </div>
                          
                          <div className="mt-1 sm:mt-2 pt-1 sm:pt-2 border-t border-white/10">
                            <div className="flex justify-between">
                              <span className="text-[10px] sm:text-xs text-white/70">$0.8M Jan '26</span>
                              <span className="text-[10px] sm:text-xs text-white/70">$45M Dec '28</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Interactive Revenue Simulations Calculator & Fund Simulator */}
                  <div className="mt-6 sm:mt-8 grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-8">
                    <div>
                      <RevenueSimulationsCalculator />
                    </div>
                    <div>
                      <FundAllocationSimulator />
                    </div>
                  </div>

                  {/* User Growth & Acquisition Simulator */}
                  <div className="mt-6 sm:mt-8">
                    <UserGrowthSimulator />
                  </div>

                  {/* Revenue Simulations Based on Business Model */}
                  <div className="mt-8">
                    <h4 className="text-base sm:text-lg font-semibold mb-6 text-white">Revenue Projections - User Growth Scenarios</h4>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                      {/* Simulation 1: 1,000 Active Users */}
                      <Card className="p-4 bg-black/30 border-orange-500/20">
                        <div className="mb-4">
                          <div className="flex items-center justify-between mb-2">
                            <h5 className="font-semibold text-white">1,000 Users</h5>
                            <Users className="h-5 w-5 text-orange-400" />
                          </div>
                          <p className="text-xs text-white/60">Conservative Growth Scenario</p>
                        </div>
                        
                        <div className="space-y-3 text-xs">
                          <div className="flex justify-between items-center pb-2 border-b border-white/10">
                            <span className="text-white/70">Artist Plan (25%)</span>
                            <span className="font-semibold text-white">$4,998/mo</span>
                          </div>
                          <div className="flex justify-between items-center pb-2 border-b border-white/10">
                            <span className="text-white/70">Elevate Plan (30%)</span>
                            <span className="font-semibold text-white">$14,997/mo</span>
                          </div>
                          <div className="flex justify-between items-center pb-2 border-b border-white/10">
                            <span className="text-white/70">Amplify Plan (25%)</span>
                            <span className="font-semibold text-white">$22,498/mo</span>
                          </div>
                          <div className="flex justify-between items-center pb-2 border-b border-white/10">
                            <span className="text-white/70">Dominate Plan (20%)</span>
                            <span className="font-semibold text-white">$29,998/mo</span>
                          </div>
                          <div className="flex justify-between items-center pb-2 border-b border-white/10">
                            <span className="text-white/70">Music Videos (20 units)</span>
                            <span className="font-semibold text-white">$3,980/mo</span>
                          </div>
                          <div className="flex justify-between items-center pb-2 border-b border-white/10">
                            <span className="text-white/70">Distribution Fees (5%)</span>
                            <span className="font-semibold text-white">$5,024/mo</span>
                          </div>
                          <div className="flex justify-between items-center pt-2">
                            <span className="font-bold text-orange-400">Total Monthly</span>
                            <span className="font-bold text-orange-400 text-lg">$105,495</span>
                          </div>
                          <div className="flex justify-between items-center pt-1">
                            <span className="font-bold text-white">Annual Revenue</span>
                            <span className="font-bold text-white text-lg">$1.27M</span>
                          </div>
                        </div>
                      </Card>

                      {/* Simulation 2: 5,000 Active Users */}
                      <Card className="p-4 bg-black/30 border-orange-500/20 ring-2 ring-orange-500/50">
                        <div className="mb-4">
                          <div className="flex items-center justify-between mb-2">
                            <h5 className="font-semibold text-white">5,000 Users</h5>
                            <Users className="h-5 w-5 text-orange-400" />
                          </div>
                          <p className="text-xs text-white/60">Target Growth Scenario</p>
                        </div>
                        
                        <div className="space-y-3 text-xs">
                          <div className="flex justify-between items-center pb-2 border-b border-white/10">
                            <span className="text-white/70">Artist Plan (20%)</span>
                            <span className="font-semibold text-white">$19,990/mo</span>
                          </div>
                          <div className="flex justify-between items-center pb-2 border-b border-white/10">
                            <span className="text-white/70">Elevate Plan (30%)</span>
                            <span className="font-semibold text-white">$74,985/mo</span>
                          </div>
                          <div className="flex justify-between items-center pb-2 border-b border-white/10">
                            <span className="text-white/70">Amplify Plan (30%)</span>
                            <span className="font-semibold text-white">$134,985/mo</span>
                          </div>
                          <div className="flex justify-between items-center pb-2 border-b border-white/10">
                            <span className="text-white/70">Dominate Plan (20%)</span>
                            <span className="font-semibold text-white">$149,990/mo</span>
                          </div>
                          <div className="flex justify-between items-center pb-2 border-b border-white/10">
                            <span className="text-white/70">Music Videos (120 units)</span>
                            <span className="font-semibold text-white">$23,880/mo</span>
                          </div>
                          <div className="flex justify-between items-center pb-2 border-b border-white/10">
                            <span className="text-white/70">Distribution Fees (8%)</span>
                            <span className="font-semibold text-white">$41,228/mo</span>
                          </div>
                          <div className="flex justify-between items-center pt-2">
                            <span className="font-bold text-orange-400">Total Monthly</span>
                            <span className="font-bold text-orange-400 text-lg">$557,559</span>
                          </div>
                          <div className="flex justify-between items-center pt-1">
                            <span className="font-bold text-white">Annual Revenue</span>
                            <span className="font-bold text-white text-lg">$6.69M</span>
                          </div>
                        </div>
                      </Card>

                      {/* Simulation 3: 10,000 Active Users */}
                      <Card className="p-4 bg-black/30 border-orange-500/20">
                        <div className="mb-4">
                          <div className="flex items-center justify-between mb-2">
                            <h5 className="font-semibold text-white">10,000 Users</h5>
                            <Users className="h-5 w-5 text-orange-400" />
                          </div>
                          <p className="text-xs text-white/60">Optimistic Growth Scenario</p>
                        </div>
                        
                        <div className="space-y-3 text-xs">
                          <div className="flex justify-between items-center pb-2 border-b border-white/10">
                            <span className="text-white/70">Artist Plan (15%)</span>
                            <span className="font-semibold text-white">$29,985/mo</span>
                          </div>
                          <div className="flex justify-between items-center pb-2 border-b border-white/10">
                            <span className="text-white/70">Elevate Plan (30%)</span>
                            <span className="font-semibold text-white">$149,970/mo</span>
                          </div>
                          <div className="flex justify-between items-center pb-2 border-b border-white/10">
                            <span className="text-white/70">Amplify Plan (30%)</span>
                            <span className="font-semibold text-white">$269,970/mo</span>
                          </div>
                          <div className="flex justify-between items-center pb-2 border-b border-white/10">
                            <span className="text-white/70">Dominate Plan (25%)</span>
                            <span className="font-semibold text-white">$374,975/mo</span>
                          </div>
                          <div className="flex justify-between items-center pb-2 border-b border-white/10">
                            <span className="text-white/70">Music Videos (280 units)</span>
                            <span className="font-semibold text-white">$55,720/mo</span>
                          </div>
                          <div className="flex justify-between items-center pb-2 border-b border-white/10">
                            <span className="text-white/70">Distribution Fees (10%)</span>
                            <span className="font-semibold text-white">$108,562/mo</span>
                          </div>
                          <div className="flex justify-between items-center pt-2">
                            <span className="font-bold text-orange-400">Total Monthly</span>
                            <span className="font-bold text-orange-400 text-lg">$1,194,182</span>
                          </div>
                          <div className="flex justify-between items-center pt-1">
                            <span className="font-bold text-white">Annual Revenue</span>
                            <span className="font-bold text-white text-lg">$14.33M</span>
                          </div>
                        </div>
                      </Card>
                    </div>

                    {/* Revenue Breakdown Details - Business Model Components */}
                    <Card className="p-4 bg-black/30 border-orange-500/20">
                      <h5 className="font-semibold text-white mb-6">Business Model Components - Comprehensive Revenue Streams</h5>
                      
                      {/* Subscription Plans */}
                      <div className="mb-6">
                        <h6 className="text-white/80 text-xs font-bold mb-3 uppercase">1. Subscription Plans Revenue</h6>
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                          <div className="p-3 bg-orange-500/10 rounded-lg border border-orange-500/20">
                            <p className="text-white/70 text-xs mb-1">Artist Plan</p>
                            <p className="font-bold text-white">$19.99/mo</p>
                            <p className="text-xs text-white/60 mt-2">• Core features + 10 productions</p>
                            <p className="text-xs text-white/60">• Entry tier for emerging artists</p>
                          </div>
                          <div className="p-3 bg-orange-500/10 rounded-lg border border-orange-500/20">
                            <p className="text-white/70 text-xs mb-1">Elevate Plan</p>
                            <p className="font-bold text-white">$49.99/mo</p>
                            <p className="text-xs text-white/60 mt-2">• Growth tools + 20 productions</p>
                            <p className="text-xs text-white/60">• Spotify, PR Kit, Content Studio</p>
                          </div>
                          <div className="p-3 bg-orange-500/10 rounded-lg border border-orange-500/20">
                            <p className="text-white/70 text-xs mb-1">Amplify Plan</p>
                            <p className="font-bold text-white">$89.99/mo</p>
                            <p className="text-xs text-white/60 mt-2">• Advanced AI + 30 productions</p>
                            <p className="text-xs text-white/60">• YouTube, Instagram, Analytics</p>
                          </div>
                          <div className="p-3 bg-orange-500/10 rounded-lg border border-orange-500/20">
                            <p className="text-white/70 text-xs mb-1">Dominate Plan</p>
                            <p className="font-bold text-white">$149.99/mo</p>
                            <p className="text-xs text-white/60 mt-2">• Unlimited + AI Agents</p>
                            <p className="text-xs text-white/60">• Label Creator, VIP Support</p>
                          </div>
                        </div>
                      </div>

                      {/* Music Video Generator */}
                      <div className="mb-6">
                        <h6 className="text-white/80 text-xs font-bold mb-3 uppercase">2. Music Video Generator ($199/video)</h6>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                          <div className="p-3 bg-amber-500/10 rounded-lg border border-purple-500/20">
                            <p className="text-white/70 text-xs mb-1">1,000 Users</p>
                            <p className="text-xs text-white/60 mb-2">20% generate videos (200 videos)</p>
                            <p className="font-bold text-white">$39,800/mo</p>
                            <p className="text-xs text-white/60 mt-2">Annual: $477,600</p>
                          </div>
                          <div className="p-3 bg-amber-500/10 rounded-lg border border-purple-500/20">
                            <p className="text-white/70 text-xs mb-1">5,000 Users</p>
                            <p className="text-xs text-white/60 mb-2">20% generate videos (1,000 videos)</p>
                            <p className="font-bold text-white">$199,000/mo</p>
                            <p className="text-xs text-white/60 mt-2">Annual: $2,388,000</p>
                          </div>
                          <div className="p-3 bg-amber-500/10 rounded-lg border border-purple-500/20">
                            <p className="text-white/70 text-xs mb-1">10,000 Users</p>
                            <p className="text-xs text-white/60 mb-2">20% generate videos (2,000 videos)</p>
                            <p className="font-bold text-white">$398,000/mo</p>
                            <p className="text-xs text-white/60 mt-2">Annual: $4,776,000</p>
                          </div>
                        </div>
                      </div>

                      {/* Blockchain & Tokenization */}
                      <div className="mb-6">
                        <h6 className="text-white/80 text-xs font-bold mb-3 uppercase">3. Blockchain Fees & Tokenization (5% per transaction)</h6>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                          <div className="p-3 bg-yellow-500/10 rounded-lg border border-yellow-500/20">
                            <p className="text-white/70 text-xs mb-1">BTF Utility Hub Transactions</p>
                            <p className="text-xs text-white/60 mb-2">5% commission on trades</p>
                            <p className="font-bold text-white">$50,000-150k/mo*</p>
                            <p className="text-xs text-white/60 mt-2">*Depends on trading volume</p>
                          </div>
                          <div className="p-3 bg-yellow-500/10 rounded-lg border border-yellow-500/20">
                            <p className="text-white/70 text-xs mb-1">Artist Token Deployment</p>
                            <p className="text-xs text-white/60 mb-2">Gas fees + platform commission</p>
                            <p className="font-bold text-white">$20,000-80k/mo*</p>
                            <p className="text-xs text-white/60 mt-2">*Per deployment volume</p>
                          </div>
                          <div className="p-3 bg-yellow-500/10 rounded-lg border border-yellow-500/20">
                            <p className="text-white/70 text-xs mb-1">Smart Contract Royalties</p>
                            <p className="text-xs text-white/60 mb-2">Automated royalty distribution 2-3%</p>
                            <p className="font-bold text-white">$30,000-100k/mo*</p>
                            <p className="text-xs text-white/60 mt-2">*Recurring from volume</p>
                          </div>
                        </div>
                      </div>

                      {/* Artist Merchandise & Products */}
                      <div className="mb-6">
                        <h6 className="text-white/80 text-xs font-bold mb-3 uppercase">4. Artist Merchandise & Product Sales (20% commission)</h6>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                          <div className="p-3 bg-amber-500/10 rounded-lg border border-amber-500/20">
                            <p className="text-white/70 text-xs mb-1">1,000 Active Artists</p>
                            <p className="text-xs text-white/60 mb-2">$500/mo avg sales per artist</p>
                            <p className="font-bold text-white">$100,000/mo</p>
                            <p className="text-xs text-white/60 mt-2">20% = $20,000/mo</p>
                          </div>
                          <div className="p-3 bg-amber-500/10 rounded-lg border border-amber-500/20">
                            <p className="text-white/70 text-xs mb-1">5,000 Active Artists</p>
                            <p className="text-xs text-white/60 mb-2">$500/mo avg sales per artist</p>
                            <p className="font-bold text-white">$500,000/mo</p>
                            <p className="text-xs text-white/60 mt-2">20% = $100,000/mo</p>
                          </div>
                          <div className="p-3 bg-amber-500/10 rounded-lg border border-amber-500/20">
                            <p className="text-white/70 text-xs mb-1">10,000 Active Artists</p>
                            <p className="text-xs text-white/60 mb-2">$500/mo avg sales per artist</p>
                            <p className="font-bold text-white">$1,000,000/mo</p>
                            <p className="text-xs text-white/60 mt-2">20% = $200,000/mo</p>
                          </div>
                        </div>
                      </div>

                      {/* Music Licensing & Streaming Revenue */}
                      <div className="mb-6">
                        <h6 className="text-white/80 text-xs font-bold mb-3 uppercase">5. Music Licensing & Streaming Revenue</h6>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div className="p-3 bg-indigo-500/10 rounded-lg border border-indigo-500/20">
                            <p className="text-white/70 text-xs mb-1">AI Artist YouTube Channels</p>
                            <p className="text-xs text-white/60 mb-2">100+ AI-generated channels</p>
                            <p className="text-xs text-white/60 mb-2">Ad revenue share: $2k-5k/mo per channel</p>
                            <p className="font-bold text-white">$200,000-500k/mo</p>
                          </div>
                          <div className="p-3 bg-indigo-500/10 rounded-lg border border-indigo-500/20">
                            <p className="text-white/70 text-xs mb-1">Streaming Royalties (Spotify, Apple Music)</p>
                            <p className="text-xs text-white/60 mb-2">API integration with platforms</p>
                            <p className="text-xs text-white/60 mb-2">30-50% of artist royalties</p>
                            <p className="font-bold text-white">$150,000-400k/mo</p>
                          </div>
                        </div>
                      </div>

                      {/* Digital Artist Channels */}
                      <div className="mb-6">
                        <h6 className="text-white/80 text-xs font-bold mb-3 uppercase">6. OnlyFans & Explicit Digital Artist Channels</h6>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div className="p-3 bg-pink-500/10 rounded-lg border border-pink-500/20">
                            <p className="text-white/70 text-xs mb-1">OnlyFans Integration</p>
                            <p className="text-xs text-white/60 mb-2">50+ artist channels active</p>
                            <p className="text-xs text-white/60 mb-2">$3k-8k/mo per channel</p>
                            <p className="font-bold text-white">$150,000-400k/mo</p>
                          </div>
                          <div className="p-3 bg-pink-500/10 rounded-lg border border-pink-500/20">
                            <p className="text-white/70 text-xs mb-1">Exclusive Content Revenue</p>
                            <p className="text-xs text-white/60 mb-2">Behind-the-scenes + explicit content</p>
                            <p className="text-xs text-white/60 mb-2">Platform takes 15-20% cut</p>
                            <p className="font-bold text-white">$80,000-250k/mo</p>
                          </div>
                        </div>
                      </div>

                      {/* Boostify Token Revenue */}
                      <div className="mb-6">
                        <h6 className="text-white/80 text-xs font-bold mb-3 uppercase">7. Boostify Token ($BOOST) Ecosystem</h6>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div className="p-3 bg-cyan-500/10 rounded-lg border border-orange-500/20">
                            <p className="text-white/70 text-xs mb-1">Token Sales & Staking</p>
                            <p className="text-xs text-white/60 mb-2">IDO + ongoing secondary sales</p>
                            <p className="text-xs text-white/60 mb-2">3-5% platform commission</p>
                            <p className="font-bold text-white">$100,000-300k/mo</p>
                          </div>
                          <div className="p-3 bg-cyan-500/10 rounded-lg border border-orange-500/20">
                            <p className="text-white/70 text-xs mb-1">Service Credit Lock Pool</p>
                            <p className="text-xs text-white/60 mb-2">Token lock-up program for service credits</p>
                            <p className="text-xs text-white/60 mb-2">Platform revenue from credit multipliers</p>
                            <p className="font-bold text-white">$50,000-150k/mo</p>
                          </div>
                        </div>
                      </div>

                      {/* Educational & Services */}
                      <div className="mb-6">
                        <h6 className="text-white/80 text-xs font-bold mb-3 uppercase">8. Courses, Masterclasses & Professional Services</h6>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                          <div className="p-3 bg-red-500/10 rounded-lg border border-red-500/20">
                            <p className="text-white/70 text-xs mb-1">Premium Courses</p>
                            <p className="text-xs text-white/60 mb-2">Music production, AI tools, Web3</p>
                            <p className="text-xs text-white/60 mb-2">$29-99 per course</p>
                            <p className="font-bold text-white">$20,000-60k/mo</p>
                          </div>
                          <div className="p-3 bg-red-500/10 rounded-lg border border-red-500/20">
                            <p className="text-white/70 text-xs mb-1">Musician Services (20% commission)</p>
                            <p className="text-xs text-white/60 mb-2">Production, mixing, mastering services</p>
                            <p className="text-xs text-white/60 mb-2">$500-5k per service</p>
                            <p className="font-bold text-white">$50,000-150k/mo</p>
                          </div>
                          <div className="p-3 bg-red-500/10 rounded-lg border border-red-500/20">
                            <p className="text-white/70 text-xs mb-1">Artist Management Packages</p>
                            <p className="text-xs text-white/60 mb-2">Profile customization, branding</p>
                            <p className="text-xs text-white/60 mb-2">$99-499/mo premium tiers</p>
                            <p className="font-bold text-white">$30,000-100k/mo</p>
                          </div>
                        </div>
                      </div>

                      {/* Artist Cards */}
                      <div className="mb-6">
                        <h6 className="text-white/80 text-xs font-bold mb-3 uppercase">9. Artist Cards</h6>
                        <div className="grid grid-cols-1 md:grid-cols-1 gap-3">
                          <div className="p-3 bg-yellow-500/10 rounded-lg border border-yellow-500/20">
                            <p className="text-white/70 text-xs mb-1">Artist Card Marketplace</p>
                            <p className="text-xs text-white/60 mb-2">2.5-5% commission on secondary sales</p>
                            <p className="text-xs text-white/60 mb-2">Growing trading volume between users</p>
                            <p className="font-bold text-white">$40,000-120k/mo</p>
                          </div>
                        </div>
                      </div>

                      {/* Motion Capture & API Services */}
                      <div className="mb-6">
                        <h6 className="text-white/80 text-xs font-bold mb-3 uppercase">10. Motion Capture & Advanced API Services</h6>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div className="p-3 bg-violet-500/10 rounded-lg border border-violet-500/20">
                            <p className="text-white/70 text-xs mb-1">Motion Capture API</p>
                            <p className="text-xs text-white/60 mb-2">Professional mocap data licensing</p>
                            <p className="text-xs text-white/60 mb-2">$500-2k per project/license</p>
                            <p className="font-bold text-white">$30,000-100k/mo</p>
                          </div>
                          <div className="p-3 bg-violet-500/10 rounded-lg border border-violet-500/20">
                            <p className="text-white/70 text-xs mb-1">Premium API & Webhooks</p>
                            <p className="text-xs text-white/60 mb-2">For external developers & studios</p>
                            <p className="text-xs text-white/60 mb-2">$99-999/mo tier pricing</p>
                            <p className="font-bold text-white">$20,000-60k/mo</p>
                          </div>
                        </div>
                      </div>

                      {/* Total Projection */}
                      <div className="p-4 bg-orange-500/20 rounded-lg border border-orange-500/40 mt-6">
                        <h6 className="text-white font-bold mb-3">Projected Monthly Revenue by User Base</h6>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
                          <div>
                            <p className="text-white/70 mb-1">1,000 Users (Jan 2026)</p>
                            <p className="text-2xl font-bold text-orange-400">$600k - $950k/mo</p>
                            <p className="text-xs text-white/60 mt-2">Annual: $7.2M - $11.4M</p>
                          </div>
                          <div>
                            <p className="text-white/70 mb-1">5,000 Users (Jul 2026)</p>
                            <p className="text-2xl font-bold text-orange-400">$3M - $4.5M/mo</p>
                            <p className="text-xs text-white/60 mt-2">Annual: $36M - $54M</p>
                          </div>
                          <div>
                            <p className="text-white/70 mb-1">10,000 Users (Dec 2026)</p>
                            <p className="text-2xl font-bold text-orange-400">$5.5M - $9M/mo</p>
                            <p className="text-xs text-white/60 mt-2">Annual: $66M - $108M</p>
                          </div>
                          <div className="ring-2 ring-orange-400/50">
                            <p className="text-white/70 mb-1">50,000 Users (2027 Goal)</p>
                            <p className="text-2xl font-bold text-orange-300">$27M - $45M/mo</p>
                            <p className="text-xs text-white/60 mt-2">Annual: $324M - $540M</p>
                          </div>
                        </div>
                      </div>
                    </Card>
                  </div>

                  <div className="mt-6 sm:mt-8 grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
                    <Card className="p-3 sm:p-4 bg-black/30 border-orange-500/20">
                      <div className="flex items-center gap-2 sm:gap-3 mb-2">
                        <div className="p-1.5 rounded-full bg-blue-500/20">
                          <Users className="h-4 w-4 sm:h-5 sm:w-5 text-orange-400" />
                        </div>
                        <h4 className="text-sm sm:text-base font-medium text-white">Projected Users</h4>
                      </div>
                      <p className="text-2xl sm:text-3xl font-bold text-white">2.5M</p>
                      <p className="text-xs sm:text-sm text-white/70">By the end of 2028</p>
                    </Card>
                    
                    <Card className="p-3 sm:p-4 bg-black/30 border-orange-500/20">
                      <div className="flex items-center gap-2 sm:gap-3 mb-2">
                        <div className="p-1.5 rounded-full bg-green-500/20">
                          <BarChart className="h-4 w-4 sm:h-5 sm:w-5 text-yellow-400" />
                        </div>
                        <h4 className="text-sm sm:text-base font-medium text-white">Annual Revenue</h4>
                      </div>
                      <p className="text-2xl sm:text-3xl font-bold text-white">$12M</p>
                      <p className="text-xs sm:text-sm text-white/70">Projected for 2026</p>
                    </Card>
                    
                    <Card className="p-3 sm:p-4 bg-black/30 border-orange-500/20">
                      <div className="flex items-center gap-2 sm:gap-3 mb-2">
                        <div className="p-1.5 rounded-full bg-orange-500/20">
                          <Target className="h-4 w-4 sm:h-5 sm:w-5 text-orange-400" />
                        </div>
                        <h4 className="text-sm sm:text-base font-medium text-white">Return on Investment</h4>
                      </div>
                      <p className="text-2xl sm:text-3xl font-bold text-white">78%</p>
                      <p className="text-xs sm:text-sm text-white/70">Projected ROI over 24 months</p>
                    </Card>
                  </div>
                </Card>
              </TabsContent>
              
              {/* Register Tab */}
              <TabsContent value="register">
                <div className="max-w-4xl mx-auto">
                  <div className="mb-6 sm:mb-8">
                    <h3 className="text-xl sm:text-2xl font-bold mb-2">Investor Registration</h3>
                    <p className="text-muted-foreground">
                      Complete the form below to register as an investor in Boostify Music. 
                      All information will be kept confidential and secure.
                    </p>
                  </div>
                  
                  <div id="investor-registration-form">
                    <InvestorRegistrationForm />
                  </div>
                  
                  <div className="mt-8 bg-muted p-4 sm:p-6 rounded-lg">
                    <h4 className="text-lg font-medium mb-4">After Registration</h4>
                    <div className="space-y-3">
                      <div className="flex gap-3">
                        <div className="bg-orange-500/10 p-2 rounded h-min">
                          <Check className="h-5 w-5 text-orange-500" />
                        </div>
                        <div>
                          <h5 className="font-medium">Verification Process</h5>
                          <p className="text-sm text-muted-foreground">
                            Our team will review your application and contact you within 48 hours.
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex gap-3">
                        <div className="bg-orange-500/10 p-2 rounded h-min">
                          <Check className="h-5 w-5 text-orange-500" />
                        </div>
                        <div>
                          <h5 className="font-medium">Investment Options</h5>
                          <p className="text-sm text-muted-foreground">
                            You'll receive personalized investment plans based on your profile and preferences.
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex gap-3">
                        <div className="bg-orange-500/10 p-2 rounded h-min">
                          <Check className="h-5 w-5 text-orange-500" />
                        </div>
                        <div>
                          <h5 className="font-medium">Contract Signing</h5>
                          <p className="text-sm text-muted-foreground">
                            Once approved, you'll receive a digital contract to sign securely online.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </ScrollArea>
      </main>
    </div>
  );
}