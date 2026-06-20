import { useState } from "react";
import { motion } from "framer-motion";
import { Link } from "wouter";
import { UtilityDisclaimer } from "../components/btf/utility-disclaimer";
import { 
  Music2, 
  Wallet, 
  TrendingUp, 
  Shield, 
  DollarSign, 
  Globe, 
  User, 
  Users, 
  Share2 
} from "lucide-react";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Footer } from "../components/layout/footer";
import MiniTutorial from "../components/tokenization/mini-tutorial";
import SmartContractVisualizer from "../components/tokenization/smart-contract-visualizer";
import ArtistTestimonials from "../components/tokenization/artist-testimonials";
// No need to import MainNav as navigation is handled by the main layout

// Animation variants
const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.1 } }
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4 } }
};

// UI components specific to tokenization
const TokenizationHero = () => {
  return (
    <div className="relative overflow-hidden bg-black pt-20 pb-24 text-white">
      <div className="absolute inset-0 z-0 opacity-30">
        <video 
          className="h-full w-full object-cover" 
          autoPlay 
          muted 
          loop 
          playsInline
        >
          <source src="/background-video.mp4" type="video/mp4" />
        </video>
        <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/40 to-black"></div>
      </div>

      <div className="container relative z-10 mx-auto px-4 pt-10 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <Badge className="mb-4 bg-purple-500/20 text-purple-400 border-purple-500/30 px-4 py-1 text-sm">
              BTF-2300 • NFT 3.0 STANDARD
            </Badge>
            <h1 className="text-5xl md:text-6xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-purple-400 via-blue-500 to-purple-500 leading-tight mb-6">
              BTF-2300: The Artist Token
            </h1>
          </motion.div>
          
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="mt-4 text-xl text-gray-300 max-w-3xl mx-auto"
          >
            Transform your entire creative catalog into a programmable digital entity. One smart contract that represents you as an artist — your music, videos, licenses, and royalties, all unified on-chain.
          </motion.p>
          
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
            className="mt-10 flex flex-col sm:flex-row gap-4 justify-center"
          >
            <Link href="/boostiswap">
              <Button 
                size="lg"
                className="bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 text-white"
              >
                Deploy Your BTF-2300
              </Button>
            </Link>
            <Link href="/boostiswap">
              <Button 
                size="lg"
                variant="outline"
                className="border-purple-500/30 bg-black/30 backdrop-blur-sm text-white hover:bg-black/50"
              >
                Read Whitepaper
              </Button>
            </Link>
          </motion.div>
        </div>
      </div>
    </div>
  );
};

// Benefits section
const BenefitsSection = () => {
  const benefits = [
    {
      icon: <DollarSign className="h-10 w-10 text-purple-500" />,
      title: "80/20 Revenue Split",
      description: "Automated royalty distribution: 80% to you, 20% platform fee. No intermediaries, no delays."
    },
    {
      icon: <User className="h-10 w-10 text-purple-500" />,
      title: "Artist Identity Token",
      description: "One ERC-721 token represents your complete digital identity as an artist on-chain."
    },
    {
      icon: <Users className="h-10 w-10 text-purple-500" />,
      title: "Complete Catalog",
      description: "Music, videos, images, stems — all your creative assets unified under one smart contract."
    },
    {
      icon: <Share2 className="h-10 w-10 text-purple-500" />,
      title: "On-Chain Licensing",
      description: "EIP-712 signed licenses for sync rights, advertising, and commercial use — legally enforceable."
    },
    {
      icon: <Shield className="h-10 w-10 text-purple-500" />,
      title: "OpenZeppelin Security",
      description: "Audited smart contracts with role-based access, reentrancy protection, and emergency pause."
    },
    {
      icon: <Globe className="h-10 w-10 text-purple-500" />,
      title: "Polygon Deployment",
      description: "Ultra-low gas fees, high throughput, and Ethereum compatibility for global artist adoption."
    }
  ];

  return (
    <section id="benefits" className="py-20 bg-gray-900">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <Badge variant="outline" className="mb-4 bg-purple-500/20 text-purple-400 border-purple-500/30 px-3 py-1">
            BTF-2300 BENEFITS
          </Badge>
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
            Why deploy your artist token with <span className="text-purple-500">BTF-2300</span>
          </h2>
          <p className="text-xl text-gray-300 max-w-3xl mx-auto">
            The next-generation smart contract standard designed to represent complete digital artists on-chain.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {benefits.map((benefit, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              viewport={{ once: true }}
              className="bg-gray-800 rounded-xl shadow-xl p-8 hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-1"
            >
              <div className="rounded-full bg-gray-700 w-16 h-16 flex items-center justify-center mb-6">
                {benefit.icon}
              </div>
              <h3 className="text-xl font-bold text-white mb-3">{benefit.title}</h3>
              <p className="text-gray-300">{benefit.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

// How it works section
const HowItWorksSection = () => {
  const steps = [
    {
      number: 1,
      title: "Connect Your Wallet",
      description: "Connect your Polygon-compatible wallet to start deploying your BTF-2300 artist contract.",
      icon: <Wallet className="h-10 w-10 text-purple-500" />
    },
    {
      number: 2,
      title: "Upload Your Catalog",
      description: "Upload your music, videos, images, and stems. All assets are linked to your artist identity token.",
      icon: <Music2 className="h-10 w-10 text-purple-500" />
    },
    {
      number: 3,
      title: "Deploy BTF-2300",
      description: "One-click deployment creates your ERC-721 identity, royalty splitter, and ERC-1155 asset tokens.",
      icon: <DollarSign className="h-10 w-10 text-purple-500" />
    },
    {
      number: 4,
      title: "Trade & License",
      description: "Your tokens are live on the BTF Utility Hub. Fans can activate access packs, and brands can license your work on-chain.",
      icon: <TrendingUp className="h-10 w-10 text-purple-500" />
    }
  ];

  return (
    <section id="how-it-works" className="py-20 bg-gray-800 text-white">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <Badge variant="outline" className="mb-4 bg-purple-500/20 text-purple-400 border-purple-500/30 px-3 py-1">
            ONE-CLICK DEPLOYMENT
          </Badge>
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
            How <span className="text-purple-500">BTF-2300</span> works
          </h2>
          <p className="text-xl text-gray-300 max-w-3xl mx-auto">
            Deploy your complete artist identity on Polygon blockchain in four simple steps.
          </p>
        </div>

        <div className="flex flex-col space-y-16 max-w-4xl mx-auto">
          {steps.map((step, index) => (
            <motion.div 
              key={index}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              viewport={{ once: true }}
              className={`flex flex-col md:flex-row ${index % 2 === 1 ? 'md:flex-row-reverse' : ''} items-center gap-6 md:gap-12`}
            >
              <div className="md:w-1/2">
                <div className="relative">
                  <div className="absolute -left-4 -top-4 w-12 h-12 bg-orange-500 rounded-full flex items-center justify-center text-white font-bold text-xl">
                    {step.number}
                  </div>
                  <div className="bg-gray-700 rounded-xl p-10 flex items-center justify-center h-64">
                    <div className="w-20 h-20 rounded-full bg-gray-800 flex items-center justify-center shadow-lg">
                      {step.icon}
                    </div>
                  </div>
                </div>
              </div>
              <div className="md:w-1/2">
                <h3 className="text-2xl font-bold text-white mb-4">{step.title}</h3>
                <p className="text-gray-300 text-lg">{step.description}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

// FAQ section
const FAQSection = () => {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const faqs = [
    {
      question: "What is BTF-2300?",
      answer: "BTF-2300 (Boostify Token Framework 2300) is a next-generation blockchain standard that represents a complete digital artist as a single programmable on-chain entity. Unlike traditional NFTs that represent individual files, BTF-2300 unifies your identity, catalog, licenses, revenues, and legal permissions under one interoperable smart contract. It's the NFT 3.0 standard."
    },
    {
      question: "How is BTF-2300 different from regular NFTs?",
      answer: "Traditional NFTs represent individual assets. BTF-2300 represents YOU as an artist. It includes: an ERC-721 identity token, ERC-1155 assets for your catalog (music, videos, stems), an automated royalty splitter (80/20), and EIP-712 on-chain licensing. All deployed in one transaction."
    },
    {
      question: "What can I include in my BTF-2300 token?",
      answer: "Your BTF-2300 can include: music tracks, albums, music videos, images, stems, commercial licenses, sync rights, advertising usage rights, and any digital asset you create. Each asset has its own supply configuration and royalty settings."
    },
    {
      question: "How do royalties work with BTF-2300?",
      answer: "Each artist automatically gets a dedicated royalty splitter contract. The default split is 80% to the artist and 20% to the platform. All distributions happen on-chain with transparent accounting. This is trustless monetization — no intermediaries needed."
    },
    {
      question: "What about licensing my music?",
      answer: "BTF-2300 introduces on-chain legal licensing using EIP-712 cryptographic signatures. Licenses include asset ID, licensee, usage scope, territory, media channel, expiration, and maximum uses. Each license is verified on-chain, registered immutably, and auditable by third parties."
    },
    {
      question: "Why is BTF-2300 deployed on Polygon?",
      answer: "Polygon PoS offers ultra-low gas fees, high throughput, Ethereum compatibility, enterprise adoption, and marketplace support. This enables global artist adoption without cost barriers — you can deploy your entire artist identity for just a few cents."
    }
  ];

  const toggleFAQ = (index: number) => {
    setActiveIndex(activeIndex === index ? null : index);
  };

  return (
    <section className="py-20 bg-gray-900 text-white">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <Badge className="mb-4 bg-purple-500/20 text-purple-400 border-purple-500/20 px-3 py-1">
            BTF-2300 FAQ
          </Badge>
          <h2 className="text-4xl md:text-5xl font-bold mb-6">
            Everything about BTF-2300
          </h2>
          <p className="text-xl text-gray-400 max-w-3xl mx-auto">
            Answers to the most common questions about the Boostify Token Framework.
          </p>
        </div>

        <div className="max-w-3xl mx-auto">
          {faqs.map((faq, index) => (
            <motion.div 
              key={index}
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: index * 0.1 }}
              viewport={{ once: true }}
              className="mb-4"
            >
              <button
                className={`w-full text-left p-6 rounded-lg ${
                  activeIndex === index ? 'bg-gray-800' : 'bg-gray-800/50'
                } hover:bg-gray-800 transition-colors duration-200`}
                onClick={() => toggleFAQ(index)}
              >
                <div className="flex justify-between items-center">
                  <h3 className="text-xl font-bold">{faq.question}</h3>
                  <span className="text-orange-500 text-xl">
                    {activeIndex === index ? '−' : '+'}
                  </span>
                </div>
                {activeIndex === index && (
                  <p className="mt-4 text-gray-400">
                    {faq.answer}
                  </p>
                )}
              </button>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

// Call to Action section
const CTASection = () => {
  return (
    <section className="py-20 bg-gradient-to-r from-purple-600 to-blue-600 text-white">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl md:text-5xl font-bold mb-6">
            Become a Programmable Digital Entity
          </h2>
          <p className="text-xl mb-10 text-white/90">
            Join the BTF-2300 revolution. Deploy your artist smart contract, automate your royalties, and license your work globally — all in one click.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/boostiswap">
              <Button 
                size="lg"
                className="bg-white text-purple-600 hover:bg-gray-100"
              >
                Deploy BTF-2300 Now
              </Button>
            </Link>
            <Button 
              size="lg"
              variant="outline"
              className="border-white text-white hover:bg-white/10"
            >
              Read Whitepaper
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
};

// Main page component
const TokenizationPage = () => {
  return (
    <div>
      <main>
        <TokenizationHero />
        <BenefitsSection />
        <MiniTutorial />
        <SmartContractVisualizer />
        <ArtistTestimonials />
        <HowItWorksSection />
        <FAQSection />
        <CTASection />
        <div className="container mx-auto px-4 pb-8">
          <UtilityDisclaimer variant="long" size="sm" />
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default TokenizationPage;