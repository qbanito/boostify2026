/**
 * BTF-2300 Contract Configuration
 * 
 * Este archivo contiene las direcciones de contratos y ABIs para el sistema BTF-2300.
 * ACTUALIZA las direcciones después del despliegue.
 */

// ============================================
// CONTRACT ADDRESSES - DEPLOYED ON POLYGON MAINNET
// ============================================

export const BTF2300_ADDRESSES = {
  // Polygon Mainnet (chainId: 137) - V2 contracts with ERC1155Receiver fix
  137: {
    artistToken: '0x16ba188e438b4ebc7edc6acb49bdc1256de2f027', // BTF-2300 ArtistToken v2 - FIXED
    dex: '0xe6577a7e81cd4bf6cf2d074e28fd5a6970fe2647', // BTF-2300 DEX v2
    royalties: '0x09ebf2b96741222bbc6d48035c9bf5a66f6aec91', // BTF-2300 Royalties v2
  },
  // Polygon Amoy Testnet (chainId: 80002)
  80002: {
    artistToken: '0x0000000000000000000000000000000000000000',
    dex: '0x0000000000000000000000000000000000000000',
    royalties: '0x0000000000000000000000000000000000000000',
  },
  // Local/Hardhat (chainId: 31337)
  31337: {
    artistToken: '0x0000000000000000000000000000000000000000',
    dex: '0x0000000000000000000000000000000000000000',
    royalties: '0x0000000000000000000000000000000000000000',
  },
} as const;

// Token type prefixes (matching contract)
export const TOKEN_PREFIXES = {
  ARTIST: 1_000_000_000,
  SONG: 2_000_000_000,
  CATALOG: 3_000_000_000,
  LICENSE: 4_000_000_000,
} as const;

// ============================================
// BTF2300 ARTIST TOKEN ABI
// ============================================

export const BTF2300_ARTIST_TOKEN_ABI = [
  // ==================== ARTIST REGISTRATION ====================
  {
    inputs: [
      { internalType: 'address', name: 'wallet', type: 'address' },
      { internalType: 'string', name: 'artistName', type: 'string' },
      { internalType: 'string', name: 'profileURI', type: 'string' },
    ],
    name: 'registerArtist',
    outputs: [
      { internalType: 'uint256', name: 'artistId', type: 'uint256' },
      { internalType: 'uint256', name: 'identityTokenId', type: 'uint256' },
    ],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'uint256', name: 'artistId', type: 'uint256' },
      { internalType: 'bool', name: 'verified', type: 'bool' },
    ],
    name: 'verifyArtist',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'uint256', name: 'artistId', type: 'uint256' },
      { internalType: 'string', name: 'newName', type: 'string' },
      { internalType: 'string', name: 'newProfileURI', type: 'string' },
    ],
    name: 'updateArtistProfile',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },

  // ==================== SONG TOKENIZATION ====================
  {
    inputs: [
      { internalType: 'uint256', name: 'artistId', type: 'uint256' },
      { internalType: 'string', name: 'title', type: 'string' },
      { internalType: 'string', name: 'metadataURI', type: 'string' },
      { internalType: 'uint256', name: 'totalSupply', type: 'uint256' },
      { internalType: 'uint256', name: 'pricePerToken', type: 'uint256' },
    ],
    name: 'tokenizeSong',
    outputs: [{ internalType: 'uint256', name: 'tokenId', type: 'uint256' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },

  // ==================== TOKEN PURCHASE ====================
  {
    inputs: [
      { internalType: 'uint256', name: 'tokenId', type: 'uint256' },
      { internalType: 'uint256', name: 'amount', type: 'uint256' },
      { internalType: 'uint256', name: 'maxPricePerToken', type: 'uint256' },
      { internalType: 'uint256', name: 'deadline', type: 'uint256' },
    ],
    name: 'buyTokens',
    outputs: [{ internalType: 'bool', name: '', type: 'bool' }],
    stateMutability: 'payable',
    type: 'function',
  },

  // ==================== CATALOG ====================
  {
    inputs: [
      { internalType: 'uint256', name: 'artistId', type: 'uint256' },
      { internalType: 'string', name: 'catalogName', type: 'string' },
      { internalType: 'uint256[]', name: 'songTokenIds', type: 'uint256[]' },
      { internalType: 'uint256', name: 'totalSupply', type: 'uint256' },
      { internalType: 'uint256', name: 'pricePerToken', type: 'uint256' },
    ],
    name: 'createCatalog',
    outputs: [{ internalType: 'uint256', name: 'catalogTokenId', type: 'uint256' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },

  // ==================== LICENSING ====================
  {
    inputs: [
      { internalType: 'uint256', name: 'songTokenId', type: 'uint256' },
      { internalType: 'address', name: 'licensee', type: 'address' },
      { internalType: 'string', name: 'licenseType', type: 'string' },
      { internalType: 'uint256', name: 'priceNegotiated', type: 'uint256' },
      { internalType: 'uint256', name: 'duration', type: 'uint256' },
      { internalType: 'bool', name: 'isExclusive', type: 'bool' },
    ],
    name: 'createLicense',
    outputs: [{ internalType: 'uint256', name: 'licenseTokenId', type: 'uint256' }],
    stateMutability: 'payable',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'uint256', name: 'licenseTokenId', type: 'uint256' }],
    name: 'isLicenseValid',
    outputs: [{ internalType: 'bool', name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },

  // ==================== VIEW FUNCTIONS ====================
  {
    inputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    name: 'artists',
    outputs: [
      { internalType: 'uint256', name: 'artistId', type: 'uint256' },
      { internalType: 'address', name: 'walletAddress', type: 'address' },
      { internalType: 'string', name: 'artistName', type: 'string' },
      { internalType: 'string', name: 'profileURI', type: 'string' },
      { internalType: 'uint256', name: 'totalEarnings', type: 'uint256' },
      { internalType: 'uint256', name: 'totalSongs', type: 'uint256' },
      { internalType: 'bool', name: 'isVerified', type: 'bool' },
      { internalType: 'bool', name: 'isActive', type: 'bool' },
      { internalType: 'uint256', name: 'registeredAt', type: 'uint256' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    name: 'songs',
    outputs: [
      { internalType: 'uint256', name: 'tokenId', type: 'uint256' },
      { internalType: 'uint256', name: 'artistId', type: 'uint256' },
      { internalType: 'string', name: 'title', type: 'string' },
      { internalType: 'string', name: 'metadataURI', type: 'string' },
      { internalType: 'uint256', name: 'totalSupply', type: 'uint256' },
      { internalType: 'uint256', name: 'availableSupply', type: 'uint256' },
      { internalType: 'uint256', name: 'pricePerToken', type: 'uint256' },
      { internalType: 'bool', name: 'isActive', type: 'bool' },
      { internalType: 'uint256', name: 'totalEarnings', type: 'uint256' },
      { internalType: 'uint256', name: 'createdAt', type: 'uint256' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'address', name: '', type: 'address' }],
    name: 'artistIdByWallet',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'uint256', name: 'artistId', type: 'uint256' }],
    name: 'getArtistSongs',
    outputs: [{ internalType: 'uint256[]', name: '', type: 'uint256[]' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'uint256', name: 'artistId', type: 'uint256' }],
    name: 'getArtistCatalogs',
    outputs: [{ internalType: 'uint256[]', name: '', type: 'uint256[]' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'uint256', name: 'songTokenId', type: 'uint256' }],
    name: 'getSongLicenses',
    outputs: [{ internalType: 'uint256[]', name: '', type: 'uint256[]' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'address', name: 'user', type: 'address' }],
    name: 'getNonce',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'getCurrentTokenCounts',
    outputs: [
      { internalType: 'uint256', name: 'totalArtists', type: 'uint256' },
      { internalType: 'uint256', name: 'totalSongs', type: 'uint256' },
      { internalType: 'uint256', name: 'totalCatalogs', type: 'uint256' },
      { internalType: 'uint256', name: 'totalLicenses', type: 'uint256' },
    ],
    stateMutability: 'view',
    type: 'function',
  },

  // ==================== ERC1155 FUNCTIONS ====================
  {
    inputs: [
      { internalType: 'address', name: 'account', type: 'address' },
      { internalType: 'uint256', name: 'id', type: 'uint256' },
    ],
    name: 'balanceOf',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'uint256', name: 'tokenId', type: 'uint256' }],
    name: 'uri',
    outputs: [{ internalType: 'string', name: '', type: 'string' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'address', name: 'from', type: 'address' },
      { internalType: 'address', name: 'to', type: 'address' },
      { internalType: 'uint256', name: 'id', type: 'uint256' },
      { internalType: 'uint256', name: 'amount', type: 'uint256' },
      { internalType: 'bytes', name: 'data', type: 'bytes' },
    ],
    name: 'safeTransferFrom',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },

  // ==================== ADMIN FUNCTIONS ====================
  {
    inputs: [
      { internalType: 'uint256', name: 'tokenId', type: 'uint256' },
      { internalType: 'uint256', name: 'newPrice', type: 'uint256' },
    ],
    name: 'updateTokenPrice',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'uint256', name: 'tokenId', type: 'uint256' },
      { internalType: 'bool', name: 'active', type: 'bool' },
    ],
    name: 'toggleTokenActive',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [],
    name: 'pause',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [],
    name: 'unpause',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },

  // ==================== EVENTS ====================
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: 'uint256', name: 'artistId', type: 'uint256' },
      { indexed: true, internalType: 'address', name: 'wallet', type: 'address' },
      { indexed: false, internalType: 'string', name: 'artistName', type: 'string' },
      { indexed: false, internalType: 'uint256', name: 'identityTokenId', type: 'uint256' },
    ],
    name: 'ArtistRegistered',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: 'uint256', name: 'tokenId', type: 'uint256' },
      { indexed: true, internalType: 'uint256', name: 'artistId', type: 'uint256' },
      { indexed: false, internalType: 'string', name: 'title', type: 'string' },
      { indexed: false, internalType: 'uint256', name: 'totalSupply', type: 'uint256' },
      { indexed: false, internalType: 'uint256', name: 'pricePerToken', type: 'uint256' },
    ],
    name: 'SongTokenized',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: 'uint256', name: 'tokenId', type: 'uint256' },
      { indexed: true, internalType: 'address', name: 'buyer', type: 'address' },
      { indexed: false, internalType: 'uint256', name: 'amount', type: 'uint256' },
      { indexed: false, internalType: 'uint256', name: 'totalPaid', type: 'uint256' },
      { indexed: false, internalType: 'uint256', name: 'artistEarnings', type: 'uint256' },
      { indexed: false, internalType: 'uint256', name: 'platformEarnings', type: 'uint256' },
    ],
    name: 'TokensPurchased',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: 'uint256', name: 'licenseTokenId', type: 'uint256' },
      { indexed: true, internalType: 'uint256', name: 'songTokenId', type: 'uint256' },
      { indexed: true, internalType: 'address', name: 'licensee', type: 'address' },
      { indexed: false, internalType: 'string', name: 'licenseType', type: 'string' },
      { indexed: false, internalType: 'uint256', name: 'price', type: 'uint256' },
    ],
    name: 'LicenseCreated',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: 'uint256', name: 'artistId', type: 'uint256' },
      { indexed: false, internalType: 'string', name: 'artistName', type: 'string' },
      { indexed: false, internalType: 'string', name: 'profileURI', type: 'string' },
    ],
    name: 'ArtistProfileUpdated',
    type: 'event',
  },
] as const;

// ============================================
// BTF2300 DEX ABI
// ============================================

export const BTF2300_DEX_ABI = [
  // Pool creation
  {
    inputs: [
      { internalType: 'uint256', name: 'tokenId', type: 'uint256' },
      { internalType: 'uint256', name: 'tokenAmount', type: 'uint256' },
    ],
    name: 'createPool',
    outputs: [],
    stateMutability: 'payable',
    type: 'function',
  },
  // Add liquidity
  {
    inputs: [
      { internalType: 'uint256', name: 'tokenId', type: 'uint256' },
      { internalType: 'uint256', name: 'tokenAmount', type: 'uint256' },
      { internalType: 'uint256', name: 'minLPTokens', type: 'uint256' },
      { internalType: 'uint256', name: 'deadline', type: 'uint256' },
    ],
    name: 'addLiquidity',
    outputs: [{ internalType: 'uint256', name: 'lpTokens', type: 'uint256' }],
    stateMutability: 'payable',
    type: 'function',
  },
  // Remove liquidity
  {
    inputs: [
      { internalType: 'uint256', name: 'tokenId', type: 'uint256' },
      { internalType: 'uint256', name: 'lpTokenAmount', type: 'uint256' },
      { internalType: 'uint256', name: 'minTokens', type: 'uint256' },
      { internalType: 'uint256', name: 'minEth', type: 'uint256' },
      { internalType: 'uint256', name: 'deadline', type: 'uint256' },
    ],
    name: 'removeLiquidity',
    outputs: [
      { internalType: 'uint256', name: 'tokenAmount', type: 'uint256' },
      { internalType: 'uint256', name: 'ethAmount', type: 'uint256' },
    ],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  // Buy tokens
  {
    inputs: [
      { internalType: 'uint256', name: 'tokenId', type: 'uint256' },
      { internalType: 'uint256', name: 'minTokensOut', type: 'uint256' },
      { internalType: 'uint256', name: 'deadline', type: 'uint256' },
    ],
    name: 'buyTokens',
    outputs: [{ internalType: 'uint256', name: 'tokensOut', type: 'uint256' }],
    stateMutability: 'payable',
    type: 'function',
  },
  // Sell tokens
  {
    inputs: [
      { internalType: 'uint256', name: 'tokenId', type: 'uint256' },
      { internalType: 'uint256', name: 'tokenAmount', type: 'uint256' },
      { internalType: 'uint256', name: 'minEthOut', type: 'uint256' },
      { internalType: 'uint256', name: 'deadline', type: 'uint256' },
    ],
    name: 'sellTokens',
    outputs: [{ internalType: 'uint256', name: 'ethOut', type: 'uint256' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  // View functions
  {
    inputs: [{ internalType: 'uint256', name: 'tokenId', type: 'uint256' }],
    name: 'getPoolInfo',
    outputs: [
      { internalType: 'uint256', name: 'tokenReserve', type: 'uint256' },
      { internalType: 'uint256', name: 'ethReserve', type: 'uint256' },
      { internalType: 'uint256', name: 'totalLPTokens', type: 'uint256' },
      { internalType: 'uint256', name: 'feeAccumulated', type: 'uint256' },
      { internalType: 'bool', name: 'isActive', type: 'bool' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'uint256', name: 'tokenId', type: 'uint256' },
      { internalType: 'uint256', name: 'ethIn', type: 'uint256' },
    ],
    name: 'getExpectedTokensOut',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'uint256', name: 'tokenId', type: 'uint256' },
      { internalType: 'uint256', name: 'tokenIn', type: 'uint256' },
    ],
    name: 'getExpectedEthOut',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'uint256', name: 'tokenId', type: 'uint256' },
      { internalType: 'address', name: 'provider', type: 'address' },
    ],
    name: 'getLPBalance',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  // Events
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: 'uint256', name: 'tokenId', type: 'uint256' },
      { indexed: true, internalType: 'address', name: 'trader', type: 'address' },
      { indexed: false, internalType: 'bool', name: 'isBuy', type: 'bool' },
      { indexed: false, internalType: 'uint256', name: 'tokenAmount', type: 'uint256' },
      { indexed: false, internalType: 'uint256', name: 'ethAmount', type: 'uint256' },
      { indexed: false, internalType: 'uint256', name: 'fee', type: 'uint256' },
    ],
    name: 'TokenSwap',
    type: 'event',
  },
] as const;

// ============================================
// BTF2300 ROYALTIES ABI
// ============================================

export const BTF2300_ROYALTIES_ABI = [
  // Deposit royalty
  {
    inputs: [
      { internalType: 'uint256', name: 'tokenId', type: 'uint256' },
      { internalType: 'string', name: 'source', type: 'string' },
    ],
    name: 'depositRoyalty',
    outputs: [],
    stateMutability: 'payable',
    type: 'function',
  },
  // Distribute royalties
  {
    inputs: [{ internalType: 'uint256', name: 'tokenId', type: 'uint256' }],
    name: 'distributeRoyalties',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  // Claim holder royalties
  {
    inputs: [{ internalType: 'uint256', name: 'tokenId', type: 'uint256' }],
    name: 'claimHolderRoyalties',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  // View functions
  {
    inputs: [
      { internalType: 'uint256', name: 'tokenId', type: 'uint256' },
      { internalType: 'address', name: 'holder', type: 'address' },
    ],
    name: 'getClaimableAmount',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'uint256', name: 'tokenId', type: 'uint256' }],
    name: 'getRoyaltyPoolInfo',
    outputs: [
      { internalType: 'uint256', name: 'totalReceived', type: 'uint256' },
      { internalType: 'uint256', name: 'artistClaimed', type: 'uint256' },
      { internalType: 'uint256', name: 'holdersClaimed', type: 'uint256' },
      { internalType: 'uint256', name: 'platformClaimed', type: 'uint256' },
      { internalType: 'uint256', name: 'undistributed', type: 'uint256' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'uint256', name: 'tokenId', type: 'uint256' }],
    name: 'getStreamCount',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'uint256', name: 'tokenId', type: 'uint256' }],
    name: 'getTotalRounds',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  // Events
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: 'uint256', name: 'tokenId', type: 'uint256' },
      { indexed: false, internalType: 'uint256', name: 'amount', type: 'uint256' },
      { indexed: false, internalType: 'string', name: 'source', type: 'string' },
    ],
    name: 'RoyaltyReceived',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: 'uint256', name: 'tokenId', type: 'uint256' },
      { indexed: true, internalType: 'address', name: 'holder', type: 'address' },
      { indexed: false, internalType: 'uint256', name: 'amount', type: 'uint256' },
    ],
    name: 'RoyaltyClaimed',
    type: 'event',
  },
] as const;

// ============================================
// HELPER FUNCTIONS
// ============================================

export function getBTF2300Addresses(chainId: number) {
  return BTF2300_ADDRESSES[chainId as keyof typeof BTF2300_ADDRESSES] || BTF2300_ADDRESSES[137];
}

export function isTokenIdType(tokenId: number): 'artist' | 'song' | 'catalog' | 'license' | 'unknown' {
  if (tokenId >= TOKEN_PREFIXES.LICENSE) return 'license';
  if (tokenId >= TOKEN_PREFIXES.CATALOG) return 'catalog';
  if (tokenId >= TOKEN_PREFIXES.SONG) return 'song';
  if (tokenId >= TOKEN_PREFIXES.ARTIST) return 'artist';
  return 'unknown';
}

export function getArtistIdFromToken(tokenId: number): number {
  return tokenId - TOKEN_PREFIXES.ARTIST;
}

export function getSongIdFromToken(tokenId: number): number {
  return tokenId - TOKEN_PREFIXES.SONG;
}

// Default export for convenience
export default {
  addresses: BTF2300_ADDRESSES,
  artistTokenABI: BTF2300_ARTIST_TOKEN_ABI,
  dexABI: BTF2300_DEX_ABI,
  royaltiesABI: BTF2300_ROYALTIES_ABI,
  getAddresses: getBTF2300Addresses,
  tokenPrefixes: TOKEN_PREFIXES,
};
