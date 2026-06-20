import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Terminal, ArrowDown, CheckCircle, XCircle, MessageCircle, User, Shield, Code } from 'lucide-react';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';

/**
 * Smart Contract Visualizer Component
 * 
 * This component provides an interactive visualization of how smart contracts
 * work in the music tokenization process, helping artists understand the technical
 * aspects in a more accessible way.
 */
const SmartContractVisualizer = () => {
  // State to track the animation step
  const [animationStep, setAnimationStep] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);

  // Contract code snippets for different standards
  const contractSnippets = {
    erc721: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract MusicNFT is ERC721, Ownable {
    // Base URI for metadata
    string private _baseTokenURI;
    
    // Royalty percentage (in basis points, 1% = 100)
    uint256 public royaltyBasisPoints = 1000; // 10%
    
    // Address that receives royalties
    address public royaltyReceiver;
    
    constructor(
        string memory name,
        string memory symbol,
        string memory baseURI,
        address initialOwner
    ) ERC721(name, symbol) Ownable(initialOwner) {
        _baseTokenURI = baseURI;
        royaltyReceiver = initialOwner;
    }
    
    // Mint a new music token
    function mintMusic(address to, uint256 tokenId) 
        public 
        onlyOwner 
    {
        _safeMint(to, tokenId);
    }
    
    // Royalty information as per EIP-2981
    function royaltyInfo(uint256 tokenId, uint256 salePrice) 
        external 
        view 
        returns (address, uint256) 
    {
        return (royaltyReceiver, (salePrice * royaltyBasisPoints) / 10000);
    }
    
    // URI for token metadata
    function _baseURI() internal view override returns (string memory) {
        return _baseTokenURI;
    }
}`,
    erc1155: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract MusicCollection is ERC1155, Ownable {
    // Mapping for token URIs
    mapping(uint256 => string) private _tokenURIs;
    
    // Mapping for token types (1 = song, 2 = album, 3 = merchandise)
    mapping(uint256 => uint8) public tokenTypes;
    
    // Royalty percentage (in basis points, 1% = 100)
    uint256 public royaltyBasisPoints = 1000; // 10%
    
    constructor(string memory uri, address initialOwner) 
        ERC1155(uri) 
        Ownable(initialOwner) 
    {}
    
    // Create a new token type
    function createToken(
        uint256 tokenId,
        uint8 tokenType,
        string memory tokenURI,
        uint256 initialSupply
    ) public onlyOwner {
        require(bytes(_tokenURIs[tokenId]).length == 0, "Token already exists");
        
        _tokenURIs[tokenId] = tokenURI;
        tokenTypes[tokenId] = tokenType;
        
        _mint(msg.sender, tokenId, initialSupply, "");
    }
    
    // Royalty information
    function royaltyInfo(uint256 tokenId, uint256 salePrice) 
        external 
        view 
        returns (address, uint256) 
    {
        return (owner(), (salePrice * royaltyBasisPoints) / 10000);
    }
    
    // URI for token metadata
    function uri(uint256 tokenId) public view override returns (string memory) {
        string memory tokenURI = _tokenURIs[tokenId];
        return bytes(tokenURI).length > 0 ? tokenURI : super.uri(tokenId);
    }
}`,
    custom: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract MusicTokenizationPlatform is ERC721, Ownable {
    // Token counter
    uint256 private _tokenIdCounter;
    
    // Song information
    struct SongInfo {
        string title;
        string artist;
        uint256 releaseDate;
        string audioURI;
        uint256 totalShares;
        uint256 price;
        bool isActive;
    }
    
    // Mapping of token ID to song info
    mapping(uint256 => SongInfo) public songs;
    
    // Royalty distribution events
    event RoyaltiesDistributed(uint256 tokenId, uint256 amount);
    
    constructor(string memory name, string memory symbol, address initialOwner) 
        ERC721(name, symbol) 
        Ownable(initialOwner) 
    {}
    
    // Register a new song
    function registerSong(
        string memory title,
        string memory artist,
        string memory audioURI,
        uint256 price
    ) public onlyOwner returns (uint256) {
        uint256 tokenId = _tokenIdCounter;
        _tokenIdCounter++;
        
        songs[tokenId] = SongInfo({
            title: title,
            artist: artist,
            releaseDate: block.timestamp,
            audioURI: audioURI,
            totalShares: 0,
            price: price,
            isActive: true
        });
        
        _safeMint(msg.sender, tokenId);
        
        return tokenId;
    }
    
    // Distribute royalties for a specific song
    function distributeRoyalties(uint256 tokenId, uint256 amount) 
        public 
        onlyOwner 
    {
        require(songs[tokenId].isActive, "Song is not active");
        
        // Implementation of royalty distribution logic would go here
        
        emit RoyaltiesDistributed(tokenId, amount);
    }
    
    // Get song metadata URI
    function tokenURI(uint256 tokenId) 
        public 
        view 
        override 
        returns (string memory) 
    {
        require(_exists(tokenId), "Token does not exist");
        return songs[tokenId].audioURI;
    }
}`
  };

  // Animation timeline steps
  const steps = [
    {
      title: "Create BTF-2300",
      description: "Artist initiates deployment of their BTF-2300 artist token",
      icon: <Code className="h-8 w-8 text-purple-500" />
    },
    {
      title: "Deploy Identity Layer",
      description: "ERC-721 artist identity token is created on Polygon",
      icon: <Shield className="h-8 w-8 text-purple-500" />
    },
    {
      title: "Setup Royalty Splitter",
      description: "80/20 revenue distribution contract is deployed",
      icon: <Terminal className="h-8 w-8 text-purple-500" />
    },
    {
      title: "Mint Asset Tokens",
      description: "ERC-1155 tokens for music, videos, licenses created",
      icon: <CheckCircle className="h-8 w-8 text-green-500" />
    },
    {
      title: "Collector Purchase",
      description: "Fan buys artist token, triggering BTF-2300 contract",
      icon: <User className="h-8 w-8 text-blue-500" />
    },
    {
      title: "Automatic Execution",
      description: "Smart contract executes royalty split automatically",
      icon: <ArrowDown className="h-8 w-8 text-purple-500" />,
      extraSpacing: true
    },
    {
      title: "Revenue Distribution",
      description: "80% to artist, 20% to platform - instant and trustless",
      icon: <CheckCircle className="h-8 w-8 text-green-500" />
    }
  ];

  const runAnimation = () => {
    if (isAnimating) return;
    
    setIsAnimating(true);
    setAnimationStep(0);
    
    // Animation loop
    const interval = setInterval(() => {
      setAnimationStep(prev => {
        if (prev < steps.length - 1) {
          return prev + 1;
        } else {
          clearInterval(interval);
          setIsAnimating(false);
          return prev;
        }
      });
    }, 1000);
  };

  return (
    <section className="py-24 bg-gray-800">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <Badge className="mb-4 bg-purple-500/20 text-purple-400 border-purple-500/30 px-3 py-1">
            BTF-2300 ARCHITECTURE
          </Badge>
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
            Smart Contract <span className="text-purple-500">Visualizer</span>
          </h2>
          <p className="text-xl text-gray-300 max-w-3xl mx-auto">
            See how BTF-2300 deploys your complete artist identity with automated royalties and on-chain licensing
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 max-w-6xl mx-auto">
          {/* Left side: Contract visualization */}
          <div className="bg-gray-900 rounded-xl p-8 shadow-xl">
            <h3 className="text-2xl font-bold text-white mb-6 flex items-center">
              <Terminal className="h-6 w-6 mr-2 text-purple-500" />
              BTF-2300 Deployment Flow
            </h3>
            
            <div className="relative h-[500px] mb-6 overflow-y-auto">
              {/* Vertical timeline line */}
              <div className="absolute left-10 top-4 bottom-4 w-1 bg-gray-700"></div>
              
              {/* Timeline steps */}
              {steps.map((step, index) => (
                <motion.div 
                  key={index}
                  initial={{ opacity: 0.3 }}
                  animate={{ 
                    opacity: animationStep >= index ? 1 : 0.3,
                    scale: animationStep === index ? 1.05 : 1
                  }}
                  className={`flex items-start ${index === steps.length - 1 ? 'mb-2' : (step.extraSpacing ? 'mb-20' : 'mb-10')} relative ${
                    animationStep >= index ? 'text-white' : 'text-gray-500'
                  }`}
                >
                  <div className={`flex-shrink-0 z-10 w-8 h-8 rounded-full flex items-center justify-center mr-4 transition-colors duration-300 ${
                    animationStep >= index ? 'bg-gray-800' : 'bg-gray-700'
                  }`}>
                    {step.icon}
                  </div>
                  <div>
                    <h4 className="font-bold text-lg">{step.title}</h4>
                    <p className={`text-sm ${
                      animationStep >= index ? 'text-gray-300' : 'text-gray-500'
                    }`}>
                      {step.description}
                    </p>
                  </div>
                  
                  {/* Connecting arrow with extra spacing for steps that need it */}
                  {index < steps.length - 1 && animationStep > index && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className={`absolute left-10 top-8 ${step.extraSpacing ? 'h-24' : (index === steps.length - 2 ? 'h-16' : 'h-8')} flex justify-center`}
                    >
                      <ArrowDown className="text-purple-500 h-6 w-6" />
                    </motion.div>
                  )}
                </motion.div>
              ))}
            </div>
            
            <Button 
              onClick={runAnimation} 
              disabled={isAnimating}
              className="w-full bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600"
            >
              {isAnimating ? "Deploying BTF-2300..." : "Run Deployment Simulation"}
            </Button>
          </div>
          
          {/* Right side: Code view */}
          <div className="bg-gray-900 rounded-xl p-8 shadow-xl">
            <h3 className="text-2xl font-bold text-white mb-6 flex items-center">
              <Code className="h-6 w-6 mr-2 text-purple-500" />
              BTF-2300 Contract Code
            </h3>
            
            <Tabs defaultValue="erc721" className="mb-6">
              <TabsList className="bg-gray-800 border border-gray-700">
                <TabsTrigger value="erc721">Identity (ERC-721)</TabsTrigger>
                <TabsTrigger value="erc1155">Assets (ERC-1155)</TabsTrigger>
                <TabsTrigger value="custom">Royalty Splitter</TabsTrigger>
              </TabsList>
              
              {Object.entries(contractSnippets).map(([key, code]) => (
                <TabsContent 
                  key={key} 
                  value={key}
                  className="mt-4 bg-gray-950 rounded-lg p-4 overflow-auto h-80 text-sm font-mono"
                >
                  <pre className="text-gray-300 whitespace-pre-wrap">
                    {code}
                  </pre>
                </TabsContent>
              ))}
            </Tabs>
            
            <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
              <h4 className="font-bold text-white mb-2 flex items-center">
                <MessageCircle className="h-4 w-4 mr-2 text-purple-400" />
                BTF-2300 Insight
              </h4>
              <p className="text-gray-300 text-sm">
                BTF-2300 combines ERC-721 for artist identity, ERC-1155 for multi-asset catalogs, 
                and a dedicated royalty splitter contract. This multi-layer architecture enables 
                one-click deployment of your complete digital presence with automated 80/20 revenue distribution.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default SmartContractVisualizer;