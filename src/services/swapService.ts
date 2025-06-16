import { encodeFunctionData } from 'viem';
import { constructSimpleSDK, type SimpleFetchSDK, DEFAULT_VERSION } from '@velora-dex/sdk';
import { SwapSide } from '@velora-dex/sdk';
import axios, { isAxiosError } from 'axios';
import { getChainId, getTokenAmount, getTokenAddress, validateSwapRequest, getTokenDecimals } from '../utils/helpers.js';
import { APPROVE_ABI } from '../utils/abis.js';
import type { SwapRequest, SwapResponse, Transaction } from '../types/index.js';

export class SwapService {
  private simpleSDK: SimpleFetchSDK;

  constructor() {
    // Initialize VeloraDEX SimpleSDK with default axios
    this.simpleSDK = constructSimpleSDK({ 
      chainId: 1, // Default to Ethereum mainnet
      apiURL: 'https://api.velora.xyz', // Default VeloraDEX API URL
      version: DEFAULT_VERSION, // Use default version from the SDK
      axios: axios
    });
  }

  /**
   * Build swap transaction using VeloraDEX SDK.
   * Supports market swaps only.
   */
  async buildSwapTransaction(request: SwapRequest & { mode?: 'market'; slippage?: number }): Promise<SwapResponse> {
    try {
      // Validate the request
      const validation = validateSwapRequest(request);
      if (!validation.isValid) {
        throw new Error(`Invalid request: ${validation.errors.join(', ')}`);
      }

      const {
        amount,
        fromToken,
        toToken,
        fromAddress,
        fromChain,
        slippage = 0.5, // Default 0.5% slippage
        mode = 'market' // Default to market mode for direct swaps
      } = request;

      const fromChainId = getChainId(fromChain);
      const fromTokenAddress = getTokenAddress(fromChain, fromToken);
      const toTokenAddress = getTokenAddress(fromChain, toToken);
      const fromTokenAmount = getTokenAmount(amount, fromChain, fromToken);
      const fromTokenDecimals = getTokenDecimals(fromChain, fromToken);
      const toTokenDecimals = getTokenDecimals(fromChain, toToken);

      // 1. Get quote from VeloraDEX
      const quote = await this.simpleSDK.quote.getQuote({
        srcToken: fromTokenAddress,
        destToken: toTokenAddress,
        amount: fromTokenAmount,
        userAddress: fromAddress,
        srcDecimals: fromTokenDecimals,
        destDecimals: toTokenDecimals,
        side: SwapSide.SELL, // We are selling the source token
        mode: mode
      });

      if (!quote) {
        throw new Error('Failed to get quote from VeloraDEX');
      }

      const transactions: Transaction[] = [];

      // Market swap mode - user submits transaction themselves
      const priceRoute = 'market' in quote ? quote.market : quote as any; // Handle market quote properly
      
      if (!priceRoute || !priceRoute.destAmount) {
        throw new Error('Invalid market quote received from VeloraDEX');
      }

      // 2. Get spender address for approval
      const spender = await this.simpleSDK.swap.getSpender();
      
      // 3. Build approval transaction (if not native token)
      if (fromTokenAddress.toLowerCase() !== '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee' && 
          fromTokenAddress.toLowerCase() !== '0x0000000000000000000000000000000000000000') {
        const approveTransaction: Transaction = {
          chainId: fromChainId,
          to: fromTokenAddress,
          value: '0',
          data: encodeFunctionData({
            abi: APPROVE_ABI,
            functionName: "approve",
            args: [spender, fromTokenAmount]
          })
        };
        transactions.push(approveTransaction);
      }

      // 4. Build swap transaction
      const txParams = await this.simpleSDK.swap.buildTx({
        srcToken: fromTokenAddress,
        destToken: toTokenAddress,
        srcAmount: fromTokenAmount,
        slippage: slippage * 100, // VeloraDEX expects slippage in basis points (0.5% = 50)
        priceRoute: priceRoute,
        userAddress: fromAddress
      });

      if (!txParams || !txParams.to || !txParams.data) {
        throw new Error('Failed to build swap transaction from VeloraDEX');
      }

      const swapTransaction: Transaction = {
        chainId: fromChainId,
        to: txParams.to,
        data: txParams.data,
        value: txParams.value || '0',
        gasPrice: txParams.gasPrice ? BigInt(txParams.gasPrice).toString() : undefined,
        gasLimit: txParams.gas ? BigInt(txParams.gas).toString() : undefined,
      };
      transactions.push(swapTransaction);

      return {
        transactions,
        quote: priceRoute
      };

    } catch (error) {
      console.error("Error in buildSwapTransaction:", error);
      if (isAxiosError(error) && error.response) {
        console.error("VeloraDEX API Error Data:", error.response.data);
        const apiErrorMessage = error.response.data?.message || error.response.data?.error || 'VeloraDEX API request failed';
        throw new Error(apiErrorMessage);
      }
      throw error;
    }
  }

  /**
   * Get quote without building transactions (for estimation purposes)
   */
  async getSwapQuote(request: SwapRequest & { mode?: 'market' }) {
    try {
      const validation = validateSwapRequest(request);
      if (!validation.isValid) {
        throw new Error(`Invalid request: ${validation.errors.join(', ')}`);
      }

      const {
        amount,
        fromToken,
        toToken,
        fromAddress,
        fromChain,
        mode = 'market'
      } = request;

      const fromChainId = getChainId(fromChain);
      const fromTokenAmount = getTokenAmount(amount, fromChain, fromToken);
      const fromTokenAddress = getTokenAddress(fromChain, fromToken);
      const toTokenAddress = getTokenAddress(fromChain, toToken);
      const fromTokenDecimals = getTokenDecimals(fromChain, fromToken);
      const toTokenDecimals = getTokenDecimals(fromChain, toToken);

      // Get quote from VeloraDEX
      const quote = await this.simpleSDK.quote.getQuote({
        srcToken: fromTokenAddress,
        destToken: toTokenAddress,
        amount: fromTokenAmount,
        userAddress: fromAddress,
        srcDecimals: fromTokenDecimals,
        destDecimals: toTokenDecimals,
        side: SwapSide.SELL, // We are selling the source token
        mode: mode
      });

      if (!quote) {
        throw new Error('Failed to get quote from VeloraDEX');
      }

      return quote;

    } catch (error) {
      console.error("Error in getSwapQuote:", error);
      if (isAxiosError(error) && error.response) {
        console.error("VeloraDEX API Error Data:", error.response.data);
        const apiErrorMessage = error.response.data?.message || error.response.data?.error || 'VeloraDEX API request failed';
        throw new Error(apiErrorMessage);
      }
      throw error;
    }
  }

  /**
   * Validate that tokens exist and are supported
   */
  async validateTokens(fromChain: string, fromToken: string, toToken: string): Promise<boolean> {
    // This would typically call VeloraDEX API to check if tokens are supported
    // For now, we'll do basic validation using our token mappings
    try {
      getTokenAddress(fromChain, fromToken);
      getTokenAddress(fromChain, toToken);
      return true;
    } catch (error) {
      return false;
    }
  }
} 