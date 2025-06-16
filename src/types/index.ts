export interface SwapRequest {
  amount: string;
  fromToken: string;
  toToken: string;
  fromAddress: string;
  fromChain: string;
  mode?: 'market'; // VeloraDEX trading mode - only market supported
  slippage?: number; // Slippage tolerance as percentage (e.g., 0.5 for 0.5%)
}

export interface Transaction {
  chainId: number;
  to: string;
  value: string | number;
  data?: string;
  gasPrice?: string;
  gasLimit?: string;
}

export interface SwapResponse {
  transactions: Transaction[];
  quote?: any;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface ChainInfo {
  id: number;
  name: string;
  rpcUrl?: string;
}

export interface TokenInfo {
  symbol: string;
  address: string;
  decimals: number;
}

// Chain mappings similar to the original helpers
export const SUPPORTED_CHAINS: Record<string, ChainInfo> = {
  'ETHEREUM': { id: 1, name: 'Ethereum' },
  'ARBITRUM': { id: 42161, name: 'Arbitrum One' },
  'OPTIMISM': { id: 10, name: 'Optimism' },
  'BASE': { id: 8453, name: 'Base' },
  'POLYGON': { id: 137, name: 'Polygon' },
  'AVALANCHE': { id: 43114, name: 'Avalanche' },
  'SEPOLIA': { id: 11155111, name: 'Sepolia' },
  'ARBITRUM_SEPOLIA': { id: 421614, name: 'Arbitrum Sepolia' },
  'BASE_SEPOLIA': { id: 84532, name: 'Base Sepolia' },
  'OPTIMISM_SEPOLIA': { id: 11155420, name: 'Optimism Sepolia' },
};

// Common token addresses for different chains
export const TOKEN_ADDRESSES: Record<string, Record<string, string>> = {
  '1': { // Ethereum
    'USDC': '0xA0b86a33E6441031aAd3f2bEDf49EC5Bc2f42E45',
    'USDT': '0xdAC17F958D2ee523a2206206994597C13D831ec7',
    'DAI': '0x6B175474E89094C44Da98b954EedeAC495271d0F',
  },
  '42161': { // Arbitrum
    'USDC': '0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8',
    'USDT': '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9',
    'DAI': '0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1',
  },
  '10': { // Optimism
    'USDC': '0x7F5c764cBc14f9669B88837ca1490cCa17c31607',
    'USDT': '0x94b008aA00579c1307B0EF2c499aD98a8ce58e58',
    'DAI': '0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1',
  },
  '8453': { // Base
    'USDC': '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
  },
  '137': { // Polygon
    'USDC': '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
    'USDT': '0xc2132D05D31c914a87C6611C10748AEb04B58e8F',
    'DAI': '0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063',
  },
  '43114': { // Avalanche
    'USDC': '0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E',
    'USDT': '0x9702230A8Ea53601f5cD2dc00fDBc13d4dF4A8c7',
    'DAI': '0xd586E7F844cEa2F87f50152665BCbc2C279D8d70',
  }
};
