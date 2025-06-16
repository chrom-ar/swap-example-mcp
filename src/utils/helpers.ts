import { parseUnits } from 'viem';
import { SUPPORTED_CHAINS } from '../types/index.js';
import {
  getChainId as getChainIdFromUtils,
  getTokenAddress as getTokenAddressFromUtils,
  getTokenDecimals as getTokenDecimalsFromUtils
} from '@chrom-ar/utils';

// Chain name mappings for @chrom-ar/utils compatibility
const CHAIN_NAME_MAPPING: Record<string, string> = {
  'ETHEREUM': 'ethereum',
  'ARBITRUM': 'arbitrum',
  'OPTIMISM': 'optimism',
  'BASE': 'base',
  'POLYGON': 'polygon',
  'AVALANCHE': 'avalanche',
  'SEPOLIA': 'sepolia',
  'ARBITRUM_SEPOLIA': 'arbitrum-sepolia',
  'BASE_SEPOLIA': 'base-sepolia',
  'OPTIMISM_SEPOLIA': 'optimism-sepolia',
};

// Fallback token addresses for testnets not fully supported by @chrom-ar/utils
const FALLBACK_TOKEN_ADDRESSES: Record<string, Record<string, string>> = {
  'ethereum': {
    'USDC': '0xA0b86a33E6441031aAd3f2bEDf49EC5Bc2f42E45',
    'DAI': '0x6B175474E89094C44Da98b954EedeAC495271d0F',
    'USDT': '0xdAC17F958D2ee523a2206206994597C13D831ec7',
    'ETH': '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
    'SRC': '0xSRC_TOKEN_ADDRESS', // Test token for tests
    'DEST': '0xDEST_TOKEN_ADDRESS', // Test token for tests
  },
  'arbitrum-sepolia': {
    'USDC': '0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d',
    'USDT': '0x8b6a2D4Db73bA8A9fFD9b7D38A0D4D6A3e0fcAAD',
  },
  'optimism-sepolia': {
    'USDC': '0x5fd84259d66Cd46123540766Be93DFE6D43130D7',
    'USDT': '0x82a9d4A8Ce4B8C0bd8A2C60E8a8b6cD9e4D99e5F',
  },
  'base-sepolia': {
    'USDC': '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
  },
  'sepolia': {
    'USDC': '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238',
    'USDT': '0xaA8E23Fb1079EA71e0a56F48a2aA51851D8433D0',
  }
};

// Fallback token decimals for testnets
const FALLBACK_TOKEN_DECIMALS: Record<string, Record<string, number>> = {
  'ethereum': {
    'USDC': 6,
    'DAI': 18,
    'USDT': 6,
    'ETH': 18,
    'SRC': 18, // Test token for tests
    'DEST': 18, // Test token for tests
  },
  'arbitrum-sepolia': {
    'USDC': 6,
    'USDT': 6,
  },
  'optimism-sepolia': {
    'USDC': 6,
    'USDT': 6,
  },
  'base-sepolia': {
    'USDC': 6,
  },
  'sepolia': {
    'USDC': 6,
    'USDT': 6,
  }
};

/**
 * Get chain ID from chain name using @chrom-ar/utils with fallback to SUPPORTED_CHAINS
 */
export function getChainIdForNetwork(chainName: string): number {
  // Convert chain name to the format expected by @chrom-ar/utils
  const normalizedChainName = CHAIN_NAME_MAPPING[chainName.toUpperCase()] || chainName.toLowerCase();

  try {
    const chainId = getChainIdFromUtils(normalizedChainName);
    return typeof chainId === 'string' ? parseInt(chainId, 10) : chainId;
  } catch (error) {
    // If @chrom-ar/utils doesn't support this chain, try to get it from SUPPORTED_CHAINS
    const supportedChain = SUPPORTED_CHAINS[chainName.toUpperCase()];
    if (supportedChain) {
      return supportedChain.id;
    }

    // Rethrow the error if we can't find it anywhere
    throw new Error(`Unsupported chain: ${chainName}`);
  }
}

/**
 * Get token address for a specific chain and token using @chrom-ar/utils with fallbacks
 */
export function getTokenAddressForChain(chainName: string, tokenSymbol: string): string {
  // Convert chain name to the format expected by @chrom-ar/utils
  const normalizedChainName = CHAIN_NAME_MAPPING[chainName.toUpperCase()] || chainName.toLowerCase();

  // Try @chrom-ar/utils first
  let tokenAddress: string | null = null;
  try {
    tokenAddress = getTokenAddressFromUtils(normalizedChainName, tokenSymbol.toUpperCase());
    // If getTokenAddressFromUtils returns null, we should use fallback
  } catch (error) {
    // @chrom-ar/utils doesn't support this chain/token, use fallback
  }

  // Fallback for unsupported chains/tokens or when @chrom-ar/utils returns null
  if (!tokenAddress && FALLBACK_TOKEN_ADDRESSES[normalizedChainName]) {
    tokenAddress = FALLBACK_TOKEN_ADDRESSES[normalizedChainName][tokenSymbol.toUpperCase()];
  }

  if (!tokenAddress) {
    throw new Error(`Token ${tokenSymbol} not found on chain ${chainName}`);
  }

  return tokenAddress;
}

/**
 * Get token decimals using @chrom-ar/utils with fallbacks
 */
export function getTokenDecimalsForChain(chainName: string, tokenSymbol: string): number {
  // Get decimals from @chrom-ar/utils
  const normalizedChainName = CHAIN_NAME_MAPPING[chainName.toUpperCase()] || chainName.toLowerCase();
  let decimals: number | null = null;

  try {
    decimals = getTokenDecimalsFromUtils(normalizedChainName, tokenSymbol.toUpperCase());
    // If getTokenDecimalsFromUtils returns null, we should use fallback
  } catch (error) {
    // @chrom-ar/utils doesn't support this chain, use fallback
  }

  // Fallback for unsupported chains/tokens or when @chrom-ar/utils returns null
  if ((decimals === null || decimals === undefined) && FALLBACK_TOKEN_DECIMALS[normalizedChainName]) {
    decimals = FALLBACK_TOKEN_DECIMALS[normalizedChainName][tokenSymbol.toUpperCase()];
  }

  if (decimals === null || decimals === undefined) {
    // Default fallback: USDC/USDT = 6 decimals, others = 18
    if (['USDC', 'USDT'].includes(tokenSymbol.toUpperCase())) {
      return 6;
    }
    return 18;
  }

  return decimals;
}

/**
 * Get token amount in proper units (wei equivalent) using viem parseUnits
 */
export function getTokenAmount(amount: string, chainName: string, tokenSymbol: string): string {
  const decimals = getTokenDecimalsForChain(chainName, tokenSymbol);

  try {
    const parsed = parseUnits(amount, decimals);
    return parsed.toString();
  } catch (error) {
    throw new Error(`Failed to parse token amount: ${amount}`);
  }
}

/**
 * Get token decimals (alias for getTokenDecimalsForChain for backward compatibility)
 */
export function getTokenDecimals(chainName: string, tokenSymbol: string): number {
  return getTokenDecimalsForChain(chainName, tokenSymbol);
}

/**
 * Get chain ID from chain name (alias for getChainIdForNetwork for backward compatibility)
 */
export function getChainId(chainName: string): number {
  return getChainIdForNetwork(chainName);
}

/**
 * Get token address for a specific chain and token (alias for getTokenAddressForChain for backward compatibility)
 */
export function getTokenAddress(chainName: string, tokenSymbol: string): string {
  return getTokenAddressForChain(chainName, tokenSymbol);
}

/**
 * Validate Ethereum address format
 */
export function isValidAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

/**
 * Validate swap request parameters
 */
export function validateSwapRequest(params: {
  amount: string;
  fromToken: string;
  toToken: string;
  fromAddress: string;
  fromChain: string;
}): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!params.amount || isNaN(Number(params.amount)) || Number(params.amount) <= 0) {
    errors.push('Invalid amount: must be a positive number');
  }

  if (!params.fromToken || params.fromToken.trim() === '') {
    errors.push('From token is required');
  }

  if (!params.toToken || params.toToken.trim() === '') {
    errors.push('To token is required');
  }

  if (!params.fromAddress || !isValidAddress(params.fromAddress)) {
    errors.push('Invalid from address format');
  }

  if (!params.fromChain || !SUPPORTED_CHAINS[params.fromChain.toUpperCase()]) {
    errors.push(`Unsupported chain: ${params.fromChain}`);
  }

  // Validate token support (if chain is supported)
  if (params.fromChain && params.fromToken && SUPPORTED_CHAINS[params.fromChain.toUpperCase()]) {
    try {
      getTokenAddressForChain(params.fromChain, params.fromToken);
    } catch (error) {
      errors.push(`Token ${params.fromToken} not supported on ${params.fromChain}`);
    }
  }

  if (params.fromChain && params.toToken && SUPPORTED_CHAINS[params.fromChain.toUpperCase()]) {
    try {
      getTokenAddressForChain(params.fromChain, params.toToken);
    } catch (error) {
      errors.push(`Token ${params.toToken} not supported on ${params.fromChain}`);
    }
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}
