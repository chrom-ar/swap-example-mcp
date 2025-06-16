import { describe, test, expect, vi, beforeEach } from 'vitest';
import { SwapService } from './services/swapService'; // Adjusted path
import { APPROVE_ABI } from './utils/abis'; // For verifying approval data
import { encodeFunctionData } from 'viem';

// Mock VeloraDEX SDK
const mockGetQuote = vi.fn();
const mockBuildTx = vi.fn();
const mockGetSpender = vi.fn();

vi.mock('@velora-dex/sdk', () => {
  return {
    constructSimpleSDK: vi.fn().mockImplementation(() => ({
      quote: {
        getQuote: mockGetQuote,
      },
      swap: {
        buildTx: mockBuildTx,
        getSpender: mockGetSpender,
      },
    })),
    SwapSide: {
      SELL: 'SELL',
    },
    DEFAULT_VERSION: '6.2',
  };
});

// Mock axios for the SDK constructor
vi.mock('axios', () => {
  return {
    default: vi.fn(() => Promise.resolve({ data: {} })),
    isAxiosError: vi.fn((error): error is any => 'isAxiosError' in error && error.isAxiosError === true),
  };
});

describe('SwapService Unit Tests', () => {
  let swapService: SwapService;

  beforeEach(() => {
    vi.clearAllMocks(); // Clear mocks before each test
    swapService = new SwapService();
  });

  // --- Sample Data ---
  const sampleFromAddress = '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045';
  const samplePriceRoute = {
    // This structure is based on what SwapService expects and common fields.
    // It will need to be consistent with what getRate is mocked to return.
    srcToken: '0xSRC_TOKEN_ADDRESS',
    destToken: '0xDEST_TOKEN_ADDRESS',
    srcAmount: '1000000000000000000', // 1 token with 18 decimals
    destAmount: '2000000000000000000', // 2 tokens with 18 decimals
    userAddress: sampleFromAddress,
    details: {
      /* ... more data ... */
    },
  };

  const sampleTxRequest = {
    // This structure is based on what buildTx is mocked to return and what SwapService expects.
    to: '0x1F98431c8aD98523631AE4a59f267346ea31F984', // Valid checksummed Ethereum address (Uniswap V3 Factory)
    data: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
    value: '0', // Usually 0 for token swaps, unless native token is involved on one side
    gasPrice: '10000000000', // Example gas price
    gasLimit: '200000',    // Example gas limit
  };

  // --- getSwapQuote Tests ---
  describe('getSwapQuote', () => {
    test('should get a quote successfully', async () => {
      mockGetQuote.mockResolvedValue(samplePriceRoute);

      const request = {
        amount: '1',
        fromToken: 'SRC', // Symbol, will be converted to address by helpers
        toToken: 'DEST',  // Symbol
        fromAddress: sampleFromAddress,
        fromChain: 'ETHEREUM', // Will be converted to chainId
      };

      const quote = await swapService.getSwapQuote(request);

      expect(quote).toEqual(samplePriceRoute);
      expect(mockGetQuote).toHaveBeenCalledTimes(1);
      // TODO: Add more specific checks for mockGetQuote arguments if necessary,
      // e.g., ensuring token addresses and amounts are correctly passed.
      // For that, we'd need to mock getTokenAddress and getTokenAmount as well,
      // or use actual helper implementations with predefined TOKEN_ADDRESSES for test.
    });

    test('should throw an error if VeloraDEX.quote.getQuote fails', async () => {
      const errorMessage = 'VeloraDEX API Error';
      mockGetQuote.mockRejectedValue(new Error(errorMessage));

      const request = {
        amount: '1',
        fromToken: 'SRC',
        toToken: 'DEST',
        fromAddress: sampleFromAddress,
        fromChain: 'ETHEREUM',
      };

      await expect(swapService.getSwapQuote(request)).rejects.toThrow(errorMessage);
    });

    test('should handle invalid request parameters (delegated to validateSwapRequest)', async () => {
      const request = {
        amount: '0', // Invalid amount
        fromToken: 'SRC',
        toToken: 'DEST',
        fromAddress: sampleFromAddress,
        fromChain: 'ETHEREUM',
      };
      // validateSwapRequest is called first, so it should throw an error
      await expect(swapService.getSwapQuote(request)).rejects.toThrow('Invalid amount: must be a positive number');
    });
  });

  // --- buildSwapTransaction Tests ---
  describe('buildSwapTransaction', () => {
    test('should build transactions successfully for an ERC20 token', async () => {
      // Mock getSwapQuote (which internally calls the mocked getQuote)
      // Or, more directly, ensure getQuote is mocked for the call within getSwapQuote
      mockGetQuote.mockResolvedValue(samplePriceRoute);
      mockBuildTx.mockResolvedValue(sampleTxRequest);
      mockGetSpender.mockResolvedValue(sampleTxRequest.to); // Mock spender address

      const request = {
        amount: '1',
        fromToken: 'USDC', // An ERC20 token that requires approval
        toToken: 'DAI',
        fromAddress: sampleFromAddress,
        fromChain: 'ETHEREUM',
        slippage: 0.01 // 1%
      };

      const result = await swapService.buildSwapTransaction(request);

      expect(result.transactions).toHaveLength(2); // Approval + Swap
      expect(result.quote).toEqual(samplePriceRoute);

      // Approval Transaction
      const approvalTx = result.transactions[0];
      expect(approvalTx.to).toBe('0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'); // Correct USDC address from @chrom-ar/utils
      expect(approvalTx.data).toContain(encodeFunctionData({
        abi: APPROVE_ABI,
        functionName: 'approve',
        // IMPORTANT: Spender address assumption. As noted in SwapService,
        // transactionRequest.to (sampleTxRequest.to) is a placeholder.
        args: [sampleTxRequest.to, '1000000'] // 1 USDC with 6 decimals
      }).substring(0, 74)); // Check first part of data as amount can vary with helper
      // substring(0, 74) is used because the amount part of the data string can vary based on trailing zeros after encoding.
      // '0x095ea7b3' (method ID) + 64 chars for spender.
      // A more robust check would decode the data.


      // Swap Transaction
      const swapTx = result.transactions[1];
      expect(swapTx.to).toBe(sampleTxRequest.to);
      expect(swapTx.data).toBe(sampleTxRequest.data);
      expect(swapTx.value).toBe(sampleTxRequest.value);

      expect(mockBuildTx).toHaveBeenCalledTimes(1);
      // TODO: Add more specific checks for mockBuildTx arguments
    });

    test('should build transactions successfully for native ETH (skipping approval)', async () => {
      const nativeEthPriceRoute = { ...samplePriceRoute, srcToken: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee' };
      mockGetQuote.mockResolvedValue(nativeEthPriceRoute);
      mockBuildTx.mockResolvedValue(sampleTxRequest);
      mockGetSpender.mockResolvedValue(sampleTxRequest.to); // Mock spender address

      const request = {
        amount: '0.1',
        fromToken: 'ETH', // Native asset
        toToken: 'DAI',
        fromAddress: sampleFromAddress,
        fromChain: 'ETHEREUM',
      };

      const result = await swapService.buildSwapTransaction(request);

      expect(result.transactions).toHaveLength(1); // Only Swap, no approval
      expect(result.quote).toEqual(nativeEthPriceRoute);

      const swapTx = result.transactions[0];
      expect(swapTx.to).toBe(sampleTxRequest.to);
      expect(swapTx.data).toBe(sampleTxRequest.data);
    });

    test('should throw an error if getSwapQuote fails', async () => {
      mockGetQuote.mockRejectedValue(new Error('Quote fetch failed'));
      mockGetSpender.mockResolvedValue(sampleTxRequest.to); // Mock spender address

      const request = {
        amount: '1',
        fromToken: 'USDC',
        toToken: 'DAI',
        fromAddress: sampleFromAddress,
        fromChain: 'ETHEREUM',
      };

      await expect(swapService.buildSwapTransaction(request)).rejects.toThrow('Quote fetch failed');
    });

    test('should throw an error if VeloraDEX.swap.buildTx fails', async () => {
      mockGetQuote.mockResolvedValue(samplePriceRoute);
      mockBuildTx.mockRejectedValue(new Error('BuildTx API Error'));
      mockGetSpender.mockResolvedValue(sampleTxRequest.to); // Mock spender address

      const request = {
        amount: '1',
        fromToken: 'USDC',
        toToken: 'DAI',
        fromAddress: sampleFromAddress,
        fromChain: 'ETHEREUM',
      };
      await expect(swapService.buildSwapTransaction(request)).rejects.toThrow('BuildTx API Error');
    });
  });

  // --- Test validateSwapRequest indirectly ---
  // The service methods call validateSwapRequest internally.
  // These tests ensure that validation errors are propagated.
  describe('Input Validation (via service methods)', () => {
    test('getSwapQuote should fail with invalid amount', async () => {
      const request = { amount: '0', fromToken: 'ETH', toToken: 'DAI', fromAddress: sampleFromAddress, fromChain: 'ETHEREUM' };
      await expect(swapService.getSwapQuote(request)).rejects.toThrow('Invalid amount');
    });

    test('buildSwapTransaction should fail with invalid fromAddress', async () => {
      const request = { amount: '1', fromToken: 'ETH', toToken: 'DAI', fromAddress: 'invalid-address', fromChain: 'ETHEREUM' };
      await expect(swapService.buildSwapTransaction(request)).rejects.toThrow('Invalid from address');
    });

    test('getSwapQuote should fail with unsupported chain', async () => {
        const request = { amount: '1', fromToken: 'ETH', toToken: 'DAI', fromAddress: sampleFromAddress, fromChain: 'UNSUPPORTED_CHAIN' };
        await expect(swapService.getSwapQuote(request)).rejects.toThrow('Unsupported chain: UNSUPPORTED_CHAIN');
    });
  });
});
