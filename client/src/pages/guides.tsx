import React, { useState } from "react";
import { Link, useLocation } from "wouter";

// Define the Guide type based on our existing data structure
type Guide = {
  id: string;
  title: string;
  description: string;
  category: string;
  topics: string[];
  difficulty: string;
  author: string;
  authorRole: string;
  readTime: string;
  publishDate: string;
  image?: string;
  likes: number;
  content: string;
};

// Props for the guide card component
interface GuideCardProps {
  guide: Guide;
  onClick: (guide: Guide) => void;
}

// Props for the guide details component
interface GuideDetailsProps {
  guide: Guide;
  onBack: (selectedGuide?: Guide | null) => void;
}
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Calendar,
  ChevronRight,
  Clock,
  Download,
  FileText,
  Filter,
  Music,
  Search,
  Share2,
  Star,
  Tag,
  ThumbsUp,
  TrendingUp,
  User
} from "lucide-react";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "../components/ui/card";
import Layout from "../components/layout";
import { Input } from "../components/ui/input";

// Categories for guides
const categories = [
  { id: "all", label: "All Guides" },
  { id: "distribution", label: "Distribution" },
  { id: "branding", label: "Branding" },
  { id: "marketing", label: "Marketing" },
  { id: "publishing", label: "Publishing" },
  { id: "business", label: "Business" },
];

// Topics/Tags for guides
const topics = [
  "Marketing", "Royalties", "Social Media", "Strategy", "Legal", 
  "Streaming", "Promotion", "Monetization", "Branding", "Touring"
];

// Difficulty levels
const difficultyLevels = ["Beginner", "Intermediate", "Advanced"];

// Comprehensive guides data
const allGuides = [
  {
    id: "music-distribution",
    title: "The Complete Guide to Music Distribution",
    description: "Everything you need to know about getting your music on streaming platforms and maximizing revenue.",
    category: "distribution",
    topics: ["Streaming", "Monetization", "Strategy"],
    difficulty: "Beginner",
    author: "Sarah Wilson",
    authorRole: "Digital Distribution Manager",
    readTime: "15 min",
    publishDate: "2025-02-10",
    image: "/assets/distribution-guide.jpg",
    likes: 427,
    content: `
# The Complete Guide to Music Distribution

In today's digital landscape, effective distribution is crucial for artists seeking to reach listeners and monetize their music. This comprehensive guide covers everything from selecting the right distributor to optimizing your release strategy.

## Selecting the Right Distributor

When choosing a distributor, consider these key factors:

1. **Commission Structure**: Some distributors take a percentage (typically 10-15%), while others charge a flat annual fee.
2. **Platform Coverage**: Ensure your distributor delivers to all major platforms (Spotify, Apple Music, Amazon, etc.) and emerging markets.
3. **Payment Frequency**: Monthly payments are ideal, but some distributors pay quarterly.
4. **Additional Services**: Look for distributors that offer playlist pitching, marketing tools, and analytics.
5. **Ownership Rights**: Always maintain 100% ownership of your masters and publishing.

### Top Distributors Comparison

| Distributor | Fee Structure | Payment Frequency | Advanced Features |
|-------------|---------------|-------------------|-------------------|
| DistroKid | $19.99/year | Weekly | Unlimited releases, splits |
| TuneCore | $29.99/album | Monthly | Publishing administration |
| CD Baby | 9% + $9.95/single | Weekly | Sync licensing opportunities |
| Ditto | $19/year | Monthly | Label services available |
| Amuse | Free to $59.99/year | Monthly | Advance funding options |

## Optimizing Your Release Strategy

Modern distribution requires strategic planning:

1. **Pre-Save Campaigns**: Set up pre-saves 3-4 weeks before release to build momentum.
2. **Release Schedule**: Consider releasing singles every 6-8 weeks rather than full albums.
3. **Release Timing**: Aim for Friday releases to maximize first-week streams.
4. **Territorial Staggering**: Consider releasing in different territories at different times to maintain algorithm favor.

## Maximizing Streaming Revenue

Streaming economics require understanding how to maximize earnings:

1. **Playlist Pitching**: Submit to editorial playlists through your distributor's tools.
2. **Complete Metadata**: Ensure all songwriter, producer and featured artist information is accurate.
3. **Smart Links**: Use services like Linkfire or Feature.fm to track listener behavior.
4. **Cross-Platform Promotion**: Encourage fans to follow you on multiple platforms.

## Alternative Revenue Streams

Beyond traditional streaming:

1. **Sync Licensing**: Register your music with sync licensing platforms.
2. **Direct-to-Fan Sales**: Use Bandcamp or your own website for higher margin sales.
3. **Limited Edition Physical Products**: Vinyl and special editions still generate significant revenue.
4. **Emerging Markets**: Pay attention to platforms popular in territories like India, China, and Latin America.

## Case Study: Independent Success

Artist Jamie Reynolds increased his streaming revenue by 300% by:

1. Releasing singles consistently (one every 6 weeks)
2. Targeting playlist submissions strategically
3. Cross-promoting releases across platforms
4. Using pre-save campaigns for each release
5. Analyzing streaming data to identify growth markets

## Common Distribution Mistakes to Avoid

1. Rushing releases without proper planning
2. Inconsistent release schedules
3. Ignoring metadata and rights management
4. Not registering with performance rights organizations
5. Focusing exclusively on Spotify at the expense of other platforms

## Future Trends in Music Distribution

1. Direct platform licensing options
2. Blockchain-based payment systems
3. AI-powered marketing and audience targeting
4. Expansion of streaming into new territories
5. Integration of social media and streaming platforms

## Conclusion

Effective distribution strategy requires continuous learning and adaptation as platforms evolve. By approaching distribution systematically and staying informed about industry developments, independent artists can build sustainable careers in the digital music economy.
    `
  },
  {
    id: "artist-branding",
    title: "Building Your Artist Brand",
    description: "Step-by-step process to define, develop and maintain a consistent artist brand that resonates with fans.",
    category: "branding",
    topics: ["Branding", "Marketing", "Strategy"],
    difficulty: "Intermediate", 
    author: "Marcus Johnson",
    authorRole: "Brand Strategist",
    readTime: "12 min",
    publishDate: "2025-01-15",
    image: "/assets/branding-guide.jpg",
    likes: 389,
    content: `
# Building Your Artist Brand

Your artist brand is much more than a logo or aesthetic—it's the complete experience you create for your audience. This guide provides a framework for developing an authentic, compelling artist brand that resonates with fans and industry professionals alike.

## What Is an Artist Brand?

An artist brand encompasses:

1. **Visual Identity**: Logo, colors, typography, photography style
2. **Sonic Identity**: Consistent sound, production qualities, and musical themes
3. **Personality**: Your public persona, communication style, and values
4. **Narrative**: The story you tell about your music and career
5. **Experience**: How fans interact with you across touchpoints

## Defining Your Brand Foundation

Before designing visuals, define these foundational elements:

### Core Brand Values
List 3-5 values that drive your artistic decisions. Examples:
- Authenticity
- Innovation
- Community
- Craftsmanship
- Inclusivity

### Target Audience
Define who your music is for:
- Demographics: Age, location, interests
- Psychographics: Attitudes, aspirations, pain points
- Existing Fan Analysis: Study your current followers

### Brand Positioning
Position yourself in relation to:
- Genre contemporaries
- Artistic influences
- Cultural movements
- Market gaps

### Brand Voice & Personality
Develop consistent communication traits:
- Tone: Casual vs. formal? Serious vs. playful?
- Language: Technical vs. accessible? Poetic vs. direct?
- Values Expression: How do your values show in communication?

## Developing Your Visual Identity

Visual elements should support your brand foundation:

1. **Mood Board Creation**: Collect visual inspiration aligned with your values
2. **Color Palette Development**: Choose 2-3 primary colors and 2-3 secondary colors
3. **Typography Selection**: Pick consistent fonts for headlines and body text
4. **Logo/Wordmark Design**: Create a recognizable symbol or typographic treatment
5. **Photography Direction**: Establish consistent photographic style and themes

## Digital Brand Implementation

Apply your brand consistently across platforms:

1. **Website Design**: Your hub should fully express your brand identity
2. **Social Media Profiles**: Maintain visual consistency while adapting to platform requirements
3. **Streaming Profiles**: Optimize artist pages on Spotify, Apple Music, etc.
4. **Email Marketing**: Design templates that reflect your visual identity
5. **Video Content**: Establish consistent video intro/outro treatments

## Brand Touchpoints Beyond Digital

Physical and experiential brand elements:

1. **Merchandise Design**: Align products with your visual identity
2. **Album/Single Artwork**: Create cohesive visual systems for releases
3. **Live Performance**: Bring your brand to life through staging, lighting, and presentation
4. **Press Materials**: Provide consistent brand assets to media partners
5. **Fan Community**: Create branded experiences for superfans

## Measuring Brand Effectiveness

Assess your brand's performance through:

1. **Engagement Metrics**: Are fans interacting more with branded content?
2. **Recognition Testing**: Can new audiences quickly understand your identity?
3. **Consistency Analysis**: Audit touchpoints for brand alignment
4. **Audience Feedback**: Collect direct input from fans
5. **Conversion Impact**: Track how branding affects streaming, ticket and merch sales

## Brand Evolution Strategy

Plan for how your brand will grow:

1. **Album Cycle Adaptations**: Evolve visuals while maintaining recognition
2. **Career Stage Transitions**: Adjust as you move from emerging to established artist
3. **Audience Expansion**: Modify elements to reach new demographics
4. **Brand Architecture**: Manage sub-brands for side projects or collaborations
5. **Crisis Management**: Prepare for potential brand challenges

## Case Study: Evolution of a Successful Artist Brand

Indie artist Elena Vega built her brand by:
1. Identifying "nostalgic futurism" as her core positioning
2. Developing a distinctive neon/retro visual palette
3. Creating consistent visual language across releases
4. Building photographic style guidelines for all promotional images
5. Evolving her brand subtly with each album cycle while maintaining recognition

## Action Steps

1. Create your brand strategy document
2. Develop a visual identity guide
3. Audit and update all digital touchpoints
4. Design templates for ongoing content
5. Schedule quarterly brand reviews to ensure consistency

## Conclusion

A strong artist brand creates recognition, builds fan loyalty, and opens industry opportunities. By developing a strategic, consistent brand identity that authentically reflects your artistic vision, you'll create a foundation for sustainable career growth.
    `
  },
  {
    id: "music-marketing-budget",
    title: "Music Marketing on a Budget",
    description: "Effective strategies to promote your music with limited resources and maximize your marketing impact.",
    category: "marketing",
    topics: ["Marketing", "Strategy", "Social Media"],
    difficulty: "Beginner",
    author: "James Rodriguez",
    authorRole: "Digital Marketing Specialist",
    readTime: "10 min",
    publishDate: "2025-03-01",
    image: "/assets/marketing-guide.jpg",
    likes: 342,
    content: `
# Music Marketing on a Budget

Promoting your music effectively doesn't require a major label budget. This guide explores practical, low-cost marketing strategies that independent artists can implement to grow their audience and increase engagement.

## Setting Marketing Foundations

Before spending any money, establish these essentials:

1. **Clear Artist Positioning**: Define what makes your music unique
2. **Target Audience Definition**: Identify who is most likely to connect with your music
3. **Measurable Goals**: Set specific objectives for streams, followers, engagement, etc.
4. **Content Calendar**: Plan regular content to maintain momentum
5. **Analytics Setup**: Ensure you can track results across platforms

## No-Cost Marketing Strategies

### Content Creation
Leverage free content opportunities:
- Behind-the-scenes studio footage
- Acoustic versions of your songs
- Song explainer videos
- Creation process documentation
- Instrument/gear tutorials

### Platform Optimization
Maximize existing platform potential:
- Complete all profile information on streaming services
- Optimize your artist bio with keywords
- Create and update playlists regularly
- Use all content formats (Stories, Reels, regular posts)
- Implement proper metadata on all releases

### Community Building
Develop relationships without spending:
- Engage authentically with fan comments
- Support and interact with similar artists
- Join relevant online communities
- Host virtual listening sessions
- Create user-generated content opportunities

## Low-Cost Marketing Investments

When you do have budget, prioritize these areas:

### Content Quality Upgrades
- Basic lighting kit ($50-150)
- Entry-level microphone for better audio ($50-100)
- Simple background/backdrop materials ($25-75)
- Mobile apps for content editing ($5-15/month)

### Targeted Promotion
- Instagram/Facebook ads with tight targeting ($5-10/day)
- Reddit community ads ($50-100)
- Genre-specific blog submissions ($0-50)
- Micro-influencer partnerships ($50-200)
- Playlist pitching services ($20-100)

### Fan Relationship Tools
- Email marketing platform ($0-15/month)
- SMS marketing for super fans ($25-50/month)
- Community platform subscription ($0-50/month)
- Virtual meet & greet software ($0-25/month)

## Marketing Funnel on a Budget

Structure your marketing to guide casual listeners to superfans:

1. **Awareness (Top Funnel)**
   - Social content optimization for discovery
   - Strategic hashtag usage
   - Collaboration with peer artists
   - User-generated content campaigns

2. **Consideration (Mid Funnel)**
   - Remarketing to engaged viewers
   - Email captures from interested audiences
   - Extended content for interested listeners
   - Playlist placement campaigns

3. **Conversion (Bottom Funnel)**
   - Direct calls-to-action for streaming/purchasing
   - Limited special offers
   - Superfan community access
   - Exclusive content opportunities

## Measuring ROI on Limited Budget

Track these metrics to ensure efficient spending:

1. **Cost Per New Listener**: Divide spending by new listeners gained
2. **Engagement Rate**: Percentage of audience engaging with content
3. **Email Conversion Rate**: Visitors who join your mailing list
4. **Content Efficiency**: Identify which content types perform best per dollar
5. **Platform ROI**: Compare results across different marketing channels

## Case Study: Budget Marketing Success

Indie artist Carlos Martinez grew from 500 to 25,000 monthly listeners in six months by:

1. Investing $300 in quality microphone and basic lighting
2. Creating consistent weekly content series (Studio Sunday)
3. Spending $150/month on hyper-targeted Instagram ads
4. Building an email list with free download incentives
5. Collaborating with 10 similar-sized artists for cross-promotion

## Common Budget Marketing Mistakes

Avoid these pitfalls:

1. **Spreading budget too thin** across too many initiatives
2. **Inconsistent branding** across marketing materials
3. **Ignoring analytics** when making spending decisions
4. **Chasing trends** rather than building sustainable systems
5. **Neglecting email** in favor of social-only strategy

## 30-Day Marketing Plan Template

A ready-to-implement plan for your next release:

**Pre-Release (Days 1-10)**
- Create 5 teaser content pieces
- Build email announcement sequence
- Prepare streaming pre-save links
- Reach out to 10 playlist curators
- Set up $50 in targeted ads

**Release Week (Days 11-17)**
- Post release announcements across platforms
- Activate email sequence
- Launch user-generated content contest
- Release behind-the-scenes content
- Activate first week ad campaign

**Post-Release (Days 18-30)**
- Share listener/fan reactions
- Release acoustic or alternate version
- Create song story/meaning content
- Analyze first-week performance data
- Adjust targeting for second phase ads

## Conclusion

Effective music marketing is about creativity and strategic thinking more than budget size. By focusing on clear positioning, consistent content, community building, and smart allocation of limited resources, independent artists can achieve significant growth without major financial investment.
    `
  },
  {
    id: "music-publishing",
    title: "Understanding Music Publishing",
    description: "Comprehensive breakdown of publishing rights, royalties, and how to protect your intellectual property.",
    category: "publishing",
    topics: ["Royalties", "Legal", "Monetization"],
    difficulty: "Advanced",
    author: "Alexandra Chen",
    authorRole: "Music Publishing Attorney",
    readTime: "20 min",
    publishDate: "2025-02-20",
    image: "/assets/publishing-guide.jpg",
    likes: 295,
    content: `
# Understanding Music Publishing

Music publishing is often the most misunderstood yet financially significant aspect of the music business. This comprehensive guide breaks down the complex world of music publishing rights, revenue streams, and protection strategies.

## The Fundamentals of Music Publishing

### Copyright Basics
- **Musical Composition Copyright**: Protects the underlying musical work (melody, harmony, lyrics)
- **Sound Recording Copyright**: Protects the specific recording of a composition
- **Copyright Duration**: Life of author plus 70 years (in most countries)
- **Copyright Formation**: Exists automatically upon creation in fixed form
- **Copyright Registration**: Formal registration provides additional legal protections

### Publishing Rights Categories
- **Performance Rights**: When music is performed publicly (radio, venues, streaming)
- **Mechanical Rights**: Reproduction of music in physical/digital formats
- **Synchronization Rights**: Using music with visual media (film, TV, ads)
- **Print Rights**: Sheet music and written representations
- **Digital Rights**: Various online/streaming usages

### Key Publishing Entities
- **Publishers**: Administer and monetize composition rights
- **Performing Rights Organizations (PROs)**: Collect and distribute performance royalties
- **Mechanical Rights Organizations**: Collect and distribute mechanical royalties
- **Sync Licensing Agencies**: Facilitate placement in visual media
- **Sub-Publishers**: Represent catalogs in foreign territories

## Publishing Revenue Streams

### Performance Royalties
- **Terrestrial Radio**: Payments when songs play on AM/FM radio
- **Digital Radio**: Payments from Sirius XM, Pandora, etc.
- **Live Performances**: Venues pay PROs for music usage
- **Streaming Services**: Performance component of streaming royalties
- **Business Establishments**: Restaurants, retail stores, etc.

#### PRO Comparison

| PRO | Commission | Payment Schedule | International Reach | Special Features |
|-----|------------|------------------|---------------------|------------------|
| ASCAP | 12.5% | Quarterly | 11 million+ works | ASCAP Plus Awards |
| BMI | 12-15% | Quarterly | 17 million+ works | BMI Live program |
| SESAC | Varies | Monthly | Focused catalog | Invitation only |
| GMR | Varies | Quarterly | Boutique catalog | Higher rates |

### Mechanical Royalties
- **Physical Formats**: CDs, vinyl, cassettes
- **Digital Downloads**: Permanent downloads (iTunes, etc.)
- **Streaming Mechanicals**: Reproduction component of streams
- **International Mechanicals**: Collection from foreign markets

### Synchronization Income
- **Films**: Feature films and documentaries
- **Television**: Shows, commercials, network promos
- **Advertising**: Commercial spots across media
- **Video Games**: Background and featured placements
- **Online Content**: YouTube videos, web series, etc.

### Additional Revenue Sources
- **Lyric Display**: Websites and services displaying lyrics
- **Print Sales**: Sheet music, songbooks, arrangements
- **Foreign Sub-Publishing**: Territory-specific administration
- **Admin Fees**: If administering other writers' works
- **Library/Production Music**: Pre-cleared music for media

## Publishing Deals and Structures

### Traditional Publishing Deals
- **Single Song Agreement**: Covers individual compositions
- **Co-Publishing Deal**: Split ownership (typically 50/50)
- **Administration Agreement**: Publisher administers but doesn't own
- **Work for Hire**: Creator surrenders all rights for a fee
- **Exclusive Songwriter Agreement**: Publisher acquires all works created during term

### Deal Terms to Negotiate
- **Advance Amount**: Upfront payment against future royalties
- **Royalty Split**: Percentage of income retained by songwriter
- **Term Length**: Duration of the agreement
- **Reversion Rights**: When rights return to the creator
- **Territory**: Geographic regions covered
- **Options**: Publisher's right to extend the agreement
- **Minimum Delivery**: Required number of compositions

### Administration Percentage Ranges
- **Major Publishers**: 15-25%
- **Independent Publishers**: 10-20%
- **Admin-Only Deals**: 10-15%
- **Self-Publishing Platforms**: 10-15%
- **Sub-Publishing**: 10-25% (additional to main publisher)

## Digital Publishing Challenges

### Metadata Management
- **Proper Registration**: Ensuring works are properly registered with PROs
- **Unique Identifiers**: IPI, ISWC, and ISRC codes
- **Split Sheets**: Documentation of ownership percentages
- **Publisher Information**: Correct assignment of publishers to works
- **Version Control**: Tracking remixes, edits, and alternative versions

### Streaming Complexities
- **Mechanical vs. Performance Rights**: Dual revenue streams
- **Direct Licensing**: Bypassing traditional collection societies
- **Rate Setting**: Mechanical rates set by Copyright Royalty Board
- **International Collection**: Navigating global streaming payments
- **Transparency Issues**: Tracking plays and payment accuracy

## Self-Publishing Strategies

### DIY Publishing Administration
- **PRO Registration**: Direct membership and work registration
- **Mechanical Collection**: MLC registration in the US
- **Publishing Entity Creation**: Setting up your own publishing company
- **International Collection**: Working with foreign societies
- **Sync Licensing Platforms**: Direct placement opportunities

### Publishing Administration Platforms
- **Songtrust**: Wide-ranging global collection
- **CD Baby Pro**: Publishing tied to distribution
- **TuneCore Publishing**: Collection service for independents
- **Sentric Music**: Hybrid admin model with creative services
- **Kobalt**: Premium publishing administration

## Advanced Publishing Topics

### Copyright Termination
- **Section 203 Rights**: Ability to reclaim rights after 35 years
- **Filing Requirements**: Specific notice periods and documentation
- **Works Eligible**: Works not created as "work for hire"
- **Strategic Planning**: Planning catalog management around termination dates

### Catalog Valuation
- **Multiple of NPS**: Typically 8-18x net publisher share
- **Income Stability**: Predictable revenue raises value
- **Growth Potential**: Emerging markets and usage trends
- **Administration Quality**: Clean data increases value
- **Valuation Methodology**: Running royalty vs. lump sum purchases

### Music NFTs and Blockchain
- **Smart Contracts**: Automated royalty distribution
- **Fractional Ownership**: New models for rights sharing
- **Direct-to-Fan Royalties**: Fans as rights participants
- **Authentication Systems**: Verifiable ownership records
- **Emerging Standards**: Industry adoption considerations

## Action Plan for Songwriters

1. **Register with appropriate PRO**
2. **Create split sheets for all collaborations**
3. **Register with mechanical collection societies**
4. **Develop sync licensing strategy**
5. **Audit catalog for unclaimed royalties**
6. **Establish proper metadata management system**
7. **Consider administration options for your catalog**
8. **Plan for international collection**
9. **Explore direct licensing opportunities**
10. **Stay informed on industry developments**

## Conclusion

Music publishing represents a crucial revenue stream for songwriters and composers. By understanding the complex systems of rights, registration, and collection, creators can maximize their income and protect their intellectual property in an evolving digital landscape.
    `
  },
  {
    id: "music-business-models",
    title: "Modern Music Business Models",
    description: "Analysis of sustainable revenue streams and business structures for today's independent artists.",
    category: "business",
    topics: ["Monetization", "Strategy", "Marketing"],
    difficulty: "Intermediate",
    author: "David Thompson",
    authorRole: "Music Business Consultant",
    readTime: "18 min",
    publishDate: "2025-01-05",
    image: "/assets/business-guide.jpg",
    likes: 278,
    content: `
# Modern Music Business Models

The music industry has transformed dramatically in the digital era, creating both challenges and opportunities for independent artists. This guide explores viable business models that enable sustainable careers without traditional label support.

## The Evolution of Music Business Models

### Historical Revenue Structures
- **Traditional Label Model**: Advances against royalties, marketing support
- **Physical Sales Era**: Albums as primary revenue driver
- **Early Digital Transition**: Downloads replacing physical formats
- **Streaming Revolution**: Access replacing ownership
- **Current Landscape**: Multi-revenue hybrid approaches

### Key Industry Shifts
- **Creator Independence**: Direct artist-to-fan relationship
- **Passive to Active Income**: Diversification beyond royalties
- **Service Integration**: Artists providing expanded value offerings
- **Community Centrality**: Fan communities as business foundation
- **Global Accessibility**: Removal of traditional gatekeepers

## Core Business Model Frameworks

### 1. Subscription-Based Artist Model
- **Fan Club Memberships**: Tiered access to exclusive content
- **Patreon/Subscription Services**: Recurring revenue from supporters
- **Content Release Schedules**: Consistent delivery of value
- **Member Communities**: Private spaces for subscriber interaction
- **Exclusive Experiences**: Digital and physical member benefits

#### Subscription Tier Structure Example:
| Tier | Price Point | Key Offerings | Renewal Focus |
|------|-------------|---------------|---------------|
| Entry | $3-5/month | Early access, exclusive content | Consistent delivery |
| Mid | $8-15/month | Behind scenes, creative process | Community engagement |
| Premium | $20-50/month | Direct access, input privileges | Personalization |

### 2. Direct-to-Fan Sales Model
- **D2F Platforms**: Bandcamp, artist websites, direct sales tools
- **Limited Editions**: Scarcity-based product offerings
- **Bundling Strategies**: Combining digital and physical products
- **Name-Your-Price Options**: Allowing fan valuation flexibility
- **Release Campaigns**: Coordinated product launches

### 3. Creator Economy Integration
- **Content Monetization**: YouTube, Twitch, TikTok creator programs
- **Brand Partnerships**: Authentic product integrations
- **Teaching/Educational Content**: Skills-based revenue streams
- **Production Services**: Offering expertise to other creators
- **Digital Product Creation**: Templates, samples, presets

### 4. Decentralized Music Models
- **NFT-Based Releases**: Limited edition digital assets
- **Community-Owned Royalties**: Fractional sharing with fans
- **Token-Gated Experiences**: Exclusive access through ownership
- **DAO Structures**: Decentralized autonomous organization funding
- **Smart Contract Royalties**: Automated payment distribution

## Implementing Hybrid Revenue Models

### Revenue Stream Integration
- **Core vs. Supplementary Streams**: Identifying primary income sources
- **Seasonal Planning**: Timing different revenue activations
- **Fan Journey Mapping**: Aligning offerings to fan engagement levels
- **Platform Synergy**: Using each platform's strengths
- **Marketing Efficiency**: Promoting multiple streams with single campaigns

### Financial Planning for Artists
- **Revenue Forecasting**: Projecting income across streams
- **Reinvestment Strategies**: Allocating earnings to growth
- **Sustainability Metrics**: Measuring long-term vs. short-term gains
- **Expense Management**: Controlling costs across business areas
- **Tax Planning**: Optimizing structure for various income types

## Case Studies in Sustainable Artist Businesses

### Case Study 1: Community-Centric Model
Indie artist Maria Chen built a sustainable business by:
1. Building a core Patreon community (450 members at $8/month average)
2. Releasing quarterly limited edition vinyl to superfans
3. Offering production tutorials through a specialized platform
4. Hosting bi-monthly virtual concerts with tiered ticket options
5. Creating a sample pack business from her production techniques

### Case Study 2: Content Ecosystem Model
Hip-hop producer JayZ Focus developed a system based on:
1. Weekly beat-making livestreams monetized through Twitch
2. Beat licensing through multiple tiers and platforms
3. Sample pack and preset sales through own website
4. Artist development services for emerging rappers
5. YouTube tutorial content with affiliate marketing integration

### Case Study 3: Tokenized Artist Model
Electronic artist Pulse Wave implemented:
1. Limited NFT collections tied to lifetime experiences
2. Token-gated Discord community with production masterclasses
3. Royalty-sharing NFTs for flagship releases
4. Collaborative governance for creative decisions
5. Direct-to-collector special releases

## Technology Stack for Modern Music Business

### Essential Business Tools
- **CRM System**: Managing fan relationships and communication
- **E-commerce Platform**: Handling direct sales transactions
- **Content Management**: Organizing and distributing digital content
- **Analytics Suite**: Tracking performance across platforms
- **Financial Management**: Accounting and royalty tracking
- **Community Tools**: Forums, Discord, or custom community spaces
- **Email/Messaging Systems**: Direct communication channels

### Platform Selection Strategy
- **Ownership vs. Convenience**: Balancing control and ease
- **Integration Capabilities**: How tools work together
- **Scalability Factors**: Growing with your business
- **Fee Structures**: Understanding total cost impact
- **Data Portability**: Ability to move between services

## Long-Term Business Development

### Building Assets vs. Income
- **Catalog Development**: Creating long-term royalty generators
- **Audience Building**: Growing owned marketing channels
- **System Creation**: Developing repeatable business processes
- **Team Development**: Moving from solo to collaborative operation
- **Brand Equity**: Increasing the value of your artist brand

### Scaling Strategies
- **Horizontal Expansion**: Adding complementary revenue streams
- **Vertical Integration**: Controlling more of your value chain
- **Geographic Expansion**: Entering new market territories
- **Team Growth**: Strategic hiring and partnership
- **Automation Implementation**: Systematizing repetitive tasks

## Action Steps

1. **Audit Current Revenue Streams**: Evaluate performance and potential
2. **Identify Fan Segments**: Map different audience groups and needs
3. **Select Core Business Model**: Choose primary framework
4. **Build Complementary Streams**: Add supporting revenue sources
5. **Develop Content Calendar**: Plan delivery across platforms
6. **Implement Measurement Systems**: Track key performance indicators
7. **Create Scalable Processes**: Document repeatable workflows
8. **Test New Offerings**: Validate with small audience segments
9. **Optimize Based on Data**: Refine approach using performance metrics
10. **Plan Long-Term Asset Development**: Build sustainable business value

## Conclusion

The modern music business offers unprecedented opportunities for independent artists to build sustainable careers through diverse, integrated business models. By focusing on direct fan relationships, multiple revenue streams, and strategic use of emerging technologies, artists can create resilient businesses that support their creative work while maintaining independence and ownership.
    `
  }
];

interface GuideCardProps {
  guide: typeof allGuides[0];
  onClick: (guide: typeof allGuides[0]) => void;
}

// Details view for a full guide
const GuideDetails = ({ guide, onBack }: GuideDetailsProps) => {
  return (
    <div className="space-y-6">
      <button 
        onClick={onBack}
        className="text-zinc-400 hover:text-white flex items-center mb-4"
      >
        <ArrowLeft className="mr-2 h-4 w-4" /> Back to guides
      </button>
      
      <div className="bg-zinc-900 rounded-xl overflow-hidden">
        <div className="relative">
          {/* If there's an image, show it, otherwise use a placeholder gradient */}
          <div className="w-full h-48 bg-gradient-to-r from-blue-600 to-indigo-700"></div>
          
          <div className="absolute bottom-0 left-0 w-full p-6 bg-gradient-to-t from-black/80 to-transparent">
            <div className="flex flex-wrap gap-2 mb-2">
              {guide.topics.map((topic, i) => (
                <span key={i} className="px-2 py-0.5 bg-blue-600/80 text-white rounded-full text-xs">
                  {topic}
                </span>
              ))}
              <span className="px-2 py-0.5 bg-orange-600/80 text-white rounded-full text-xs">
                {guide.difficulty}
              </span>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold text-white">{guide.title}</h1>
          </div>
        </div>
        
        <div className="p-6">
          <div className="flex flex-wrap items-center justify-between gap-4 mb-6 text-sm text-zinc-400">
            <div className="flex items-center">
              <User className="h-4 w-4 mr-1" /> 
              <span className="mr-4">{guide.author}, {guide.authorRole}</span>
              <Calendar className="h-4 w-4 mr-1" /> 
              <span>{new Date(guide.publishDate).toLocaleDateString()}</span>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center">
                <Clock className="h-4 w-4 mr-1" /> 
                <span>{guide.readTime} read</span>
              </div>
              <div className="flex items-center">
                <ThumbsUp className="h-4 w-4 mr-1" /> 
                <span>{guide.likes}</span>
              </div>
            </div>
          </div>
          
          <div className="flex flex-wrap gap-4 mb-6">
            <Button className="bg-blue-600 hover:bg-blue-700">
              <Download className="mr-2 h-4 w-4" /> Download PDF
            </Button>
            <Button variant="outline" className="border-zinc-700 text-white hover:bg-zinc-800">
              <Share2 className="mr-2 h-4 w-4" /> Share Guide
            </Button>
          </div>
          
          <div className="prose prose-invert max-w-none prose-headings:text-white prose-headings:font-bold prose-p:text-zinc-300 prose-a:text-blue-400 prose-strong:text-white prose-li:text-zinc-300 prose-hr:border-zinc-700 prose-blockquote:border-blue-500 prose-blockquote:bg-zinc-800/50 prose-blockquote:p-4 prose-blockquote:rounded-md prose-blockquote:italic prose-table:border-zinc-700">
            {/* Render the markdown content */}
            <div dangerouslySetInnerHTML={{ __html: parseMarkdown(guide.content) }} />
          </div>
          
          <div className="border-t border-zinc-800 mt-10 pt-6">
            <h3 className="text-xl font-medium text-white mb-4">Related Guides</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {allGuides
                .filter(g => g.id !== guide.id && g.topics.some(t => guide.topics.includes(t)))
                .slice(0, 3)
                .map((relatedGuide, index) => (
                  <div 
                    key={index} 
                    className="p-4 bg-zinc-900 border border-zinc-800 rounded-lg cursor-pointer hover:bg-zinc-800/50 transition-colors"
                    onClick={() => onBack(relatedGuide)}
                  >
                    <h4 className="font-medium text-white mb-1">{relatedGuide.title}</h4>
                    <p className="text-sm text-zinc-400 line-clamp-2">{relatedGuide.description}</p>
                    <div className="flex items-center text-xs text-zinc-500 mt-2">
                      <Clock className="h-3 w-3 mr-1" /> {relatedGuide.readTime} read
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Simple function to parse markdown to HTML
// In a real application, you would use a proper markdown parser like marked or remark
function parseMarkdown(markdown: string): string {
  // Create simplified HTML from markdown
  const html = markdown
    // Headers
    .replace(/^# (.*$)/gim, '<h1>$1</h1>')
    .replace(/^## (.*$)/gim, '<h2>$1</h2>')
    .replace(/^### (.*$)/gim, '<h3>$1</h3>')
    // Lists
    .replace(/^\* (.*$)/gim, '<li>$1</li>')
    // Bold & Italic
    .replace(/\*\*(.*)\*\*/gim, '<strong>$1</strong>')
    .replace(/\*(.*)\*/gim, '<em>$1</em>')
    // Line breaks
    .replace(/\n/gim, '<br />');
  
  return `<div class="markdown-content">${html}</div>`;
}

// Guide card for the listing page
const GuideCard = ({ guide, onClick }: GuideCardProps) => {
  return (
    <Card 
      className="bg-zinc-900 border-zinc-800 text-white h-full hover:border-zinc-700 transition-colors cursor-pointer flex flex-col"
      onClick={() => onClick(guide)}
    >
      <div className="h-40 bg-gradient-to-r from-blue-600 to-indigo-700 relative overflow-hidden rounded-t-lg">
        <div className="absolute bottom-0 left-0 w-full p-3 bg-gradient-to-t from-black/70 to-transparent">
          <div className="flex flex-wrap gap-1">
            {guide.topics.slice(0, 2).map((topic, i) => (
              <span key={i} className="px-2 py-0.5 bg-blue-600/80 text-white rounded-full text-xs">
                {topic}
              </span>
            ))}
            <span className="px-2 py-0.5 bg-orange-600/80 text-white rounded-full text-xs">
              {guide.difficulty}
            </span>
          </div>
        </div>
      </div>
      
      <CardHeader className="pb-2">
        <CardTitle className="text-xl line-clamp-2">{guide.title}</CardTitle>
        <CardDescription className="flex items-center text-zinc-400">
          <Clock className="h-4 w-4 mr-1" /> {guide.readTime} read
        </CardDescription>
      </CardHeader>
      
      <CardContent className="flex-grow">
        <p className="text-zinc-400 line-clamp-3">{guide.description}</p>
      </CardContent>
      
      <CardFooter className="pt-2 border-t border-zinc-800 flex justify-between items-center">
        <div className="text-sm text-zinc-500">
          {new Date(guide.publishDate).toLocaleDateString()}
        </div>
        <div className="flex items-center text-zinc-400">
          <ThumbsUp className="h-4 w-4 mr-1" /> {guide.likes}
        </div>
      </CardFooter>
    </Card>
  );
};

export default function GuidesPage() {
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedTopics, setSelectedTopics] = useState<string[]>([]);
  const [selectedDifficulty, setSelectedDifficulty] = useState<string[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedGuide, setSelectedGuide] = useState<typeof allGuides[0] | null>(null);
  const [, setLocation] = useLocation();
  
  // Filter guides based on selected category, topics, difficulty, and search query
  const filteredGuides = allGuides.filter(guide => {
    const categoryMatch = selectedCategory === "all" || guide.category === selectedCategory;
    const topicsMatch = selectedTopics.length === 0 || selectedTopics.some(topic => guide.topics.includes(topic));
    const difficultyMatch = selectedDifficulty.length === 0 || selectedDifficulty.includes(guide.difficulty);
    const searchMatch = !searchQuery || 
      guide.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      guide.description.toLowerCase().includes(searchQuery.toLowerCase());
    
    return categoryMatch && topicsMatch && difficultyMatch && searchMatch;
  });
  
  const toggleTopic = (topic: string) => {
    if (selectedTopics.includes(topic)) {
      setSelectedTopics(selectedTopics.filter(t => t !== topic));
    } else {
      setSelectedTopics([...selectedTopics, topic]);
    }
  };
  
  const toggleDifficulty = (difficulty: string) => {
    if (selectedDifficulty.includes(difficulty)) {
      setSelectedDifficulty(selectedDifficulty.filter(d => d !== difficulty));
    } else {
      setSelectedDifficulty([...selectedDifficulty, difficulty]);
    }
  };
  
  const clearFilters = () => {
    setSelectedCategory("all");
    setSelectedTopics([]);
    setSelectedDifficulty([]);
    setSearchQuery("");
  };
  
  const viewGuide = (guide: typeof allGuides[0]) => {
    setSelectedGuide(guide);
    // Update URL without navigation
    setLocation(`/guides/${guide.id}`, { replace: true });
  };
  
  const backToList = (selectedRelatedGuide = null) => {
    if (selectedRelatedGuide) {
      viewGuide(selectedRelatedGuide);
    } else {
      setSelectedGuide(null);
      setLocation('/guides', { replace: true });
    }
  };
  
  if (selectedGuide) {
    return (
      <Layout>
        <div className="container max-w-5xl mx-auto px-4 py-12">
          <GuideDetails guide={selectedGuide} onBack={backToList} />
        </div>
      </Layout>
    );
  }
  
  return (
    <Layout>
      <div className="container max-w-7xl mx-auto px-4 py-12">
        {/* Hero section */}
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-extrabold text-white mb-6">Comprehensive Guides</h1>
          <p className="text-xl text-zinc-400 max-w-3xl mx-auto">
            In-depth resources to help you navigate every aspect of your music career
          </p>
        </div>
        
        {/* Search and filters */}
        <div className="mb-8">
          <div className="flex flex-col sm:flex-row gap-4 mb-4">
            <div className="relative flex-grow">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-zinc-400 h-4 w-4" />
              <Input 
                type="text"
                placeholder="Search guides..." 
                className="pl-10 bg-zinc-900 border-zinc-800 text-white"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <Button 
              variant="outline" 
              className="border-zinc-700 text-white hover:bg-zinc-800"
              onClick={() => setShowFilters(!showFilters)}
            >
              <Filter className="h-4 w-4 mr-2" />
              {showFilters ? "Hide Filters" : "Show Filters"}
            </Button>
          </div>
          
          {/* Category filters */}
          <div className="px-3 py-2 bg-zinc-900 rounded-md mb-4">
            <div className="flex flex-wrap gap-2">
              {categories.map((category) => (
                <button
                  key={category.id}
                  onClick={() => setSelectedCategory(category.id)}
                  className={`px-3 py-1.5 rounded-md text-sm transition-colors ${
                    selectedCategory === category.id
                      ? "bg-blue-600 text-white"
                      : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
                  }`}
                >
                  {category.label}
                </button>
              ))}
            </div>
          </div>
          
          {/* Extended filters */}
          {showFilters && (
            <div className="bg-zinc-900 p-4 rounded-lg mb-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Topics */}
                <div>
                  <h3 className="text-white font-medium mb-3">Topics</h3>
                  <div className="flex flex-wrap gap-2">
                    {topics.map((topic, index) => (
                      <button
                        key={index}
                        onClick={() => toggleTopic(topic)}
                        className={`px-3 py-1 rounded-full text-sm transition-colors ${
                          selectedTopics.includes(topic)
                            ? "bg-blue-600 text-white"
                            : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
                        }`}
                      >
                        <Tag className="h-3 w-3 inline mr-1" />
                        {topic}
                      </button>
                    ))}
                  </div>
                </div>
                
                {/* Difficulty */}
                <div>
                  <h3 className="text-white font-medium mb-3">Difficulty Level</h3>
                  <div className="flex flex-wrap gap-2">
                    {difficultyLevels.map((difficulty, index) => (
                      <button
                        key={index}
                        onClick={() => toggleDifficulty(difficulty)}
                        className={`px-3 py-1 rounded-full text-sm transition-colors ${
                          selectedDifficulty.includes(difficulty)
                            ? "bg-orange-600 text-white"
                            : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
                        }`}
                      >
                        {difficulty === "Beginner" && <Star className="h-3 w-3 inline mr-1" />}
                        {difficulty === "Intermediate" && <Star className="h-3 w-3 inline mr-1" />}
                        {difficulty === "Advanced" && <Star className="h-3 w-3 inline mr-1" />}
                        {difficulty}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              
              <div className="flex justify-between mt-4">
                <div className="text-zinc-400 text-sm">
                  {filteredGuides.length} {filteredGuides.length === 1 ? 'guide' : 'guides'} found
                </div>
                {(selectedCategory !== "all" || selectedTopics.length > 0 || selectedDifficulty.length > 0 || searchQuery) && (
                  <Button 
                    variant="link" 
                    className="text-zinc-400 hover:text-white p-0 h-auto" 
                    onClick={clearFilters}
                  >
                    Clear all filters
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>
        
        {/* Guides grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
          {filteredGuides.map((guide) => (
            <GuideCard key={guide.id} guide={guide} onClick={viewGuide} />
          ))}
        </div>
        
        {filteredGuides.length === 0 && (
          <div className="text-center py-12">
            <h3 className="text-xl font-medium text-white mb-2">No guides match your filters</h3>
            <p className="text-zinc-400 mb-6">Try adjusting your filters or search query</p>
            <Button onClick={clearFilters}>Clear all filters</Button>
          </div>
        )}
        
        {/* CTA section */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-700 rounded-xl p-8 text-center mt-16">
          <h2 className="text-3xl font-bold text-white mb-4">Want Personalized Guidance?</h2>
          <p className="text-white/90 max-w-2xl mx-auto mb-6">
            Get customized advice tailored to your specific situation from our AI music industry advisors.
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <Link href="/ai-advisors" className="inline-block">
              <div className="flex items-center justify-center h-10 px-4 py-2 bg-white text-indigo-700 font-medium rounded-md hover:bg-white/90 transition-colors">
                Talk to an Advisor <ArrowRight className="ml-2 h-4 w-4" />
              </div>
            </Link>
            <Link href="/resources" className="inline-block">
              <div className="flex items-center justify-center h-10 px-4 py-2 border border-white text-white rounded-md hover:bg-white/10 transition-colors">
                Browse All Resources
              </div>
            </Link>
          </div>
        </div>
        
        {/* Footer navigation */}
        <div className="flex items-center justify-between mt-12 text-zinc-400 text-sm">
          <div className="flex items-center">
            <Link href="/resources" className="hover:text-white">
              Resources
            </Link>
            <ChevronRight className="h-4 w-4 mx-1" />
            <span className="text-white">Guides</span>
          </div>
          <Link href="/tips" className="hover:text-white flex items-center">
            View Quick Tips <ArrowRight className="ml-1 h-4 w-4" />
          </Link>
        </div>
      </div>
    </Layout>
  );
}