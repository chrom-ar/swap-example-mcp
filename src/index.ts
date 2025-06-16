#!/usr/bin/env node

import { McpAgent } from "agents/mcp";
import { ChromaMCP } from '@chrom-ar/mcp-base';
import { z } from 'zod';
import dotenv from 'dotenv';

import { SwapService } from './services/swapService.js';
import type { SwapRequest } from './types/index.js';

// Load environment variables
dotenv.config();

const chromaMcp = new ChromaMCP({
  id: '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045', // This should be your public-key for Staking check
  name: 'mcp-velora-server',
  version: '1.0.0',
  description: 'Velora Swap Server',
  url: process.env.SERVER_URL!
});

// Tool: Build swap transactions (main MCP functionality)
// @ts-ignore  # zod dependency infinite recursion issue
chromaMcp.server.tool(
  'build-swap-transactions',
  'Build swap transactions ready for signing using VeloraDEX market swaps',
  z.object({
    amount: z.string().describe('The amount to swap'),
    fromToken: z.string().describe('Source token symbol or address'),
    toToken: z.string().describe('Target token symbol or address'),
    fromAddress: z.string().describe('Source wallet address'),
    fromChain: z.string().describe('Source blockchain name (e.g., ETHEREUM, ARBITRUM)'),
    mode: z.enum(['market']).optional().describe('Trading mode: market (direct swap)'),
    slippage: z.number().optional().describe('Slippage tolerance as percentage (e.g., 0.5 for 0.5%)')
  }).shape,
  async (args) => {
    try {
      const swapRequest: SwapRequest = args as SwapRequest;

      console.debug('Building swap transactions for:', {
        ...swapRequest,
        fromAddress: swapRequest.fromAddress?.substring(0, 8) + '...'
      });

      // Initialize swap service
      const swapService = new SwapService();
      const result = await swapService.buildSwapTransaction(swapRequest);

      console.debug(`Successfully built ${result.transactions.length} transactions for signing`);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              transactionCount: result.transactions.length,
              transactions: result.transactions,
              quote: result.quote,
              mode: swapRequest.mode || 'market'
            }, null, 2)
          }
        ]
      };
    } catch (error) {
      console.error('Error building swap transaction:', error);
      return {
        content: [
          {
            type: 'text',
            text: `Error building swap transactions: ${error instanceof Error ? error.message : 'Unknown error'}`
          }
        ],
        isError: true
      };
    }
  }
);

export class MyMCP extends McpAgent {
  server = chromaMcp.server;

  async init() {};
}


export default {
  // @ts-ignore
  fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const url = new URL(request.url);

    if (url.pathname === "/sse" || url.pathname === "/sse/message") {
      return MyMCP.serveSSE("/sse").fetch(request, env, ctx);
    }

    if (url.pathname === "/mcp") {
      return MyMCP.serve("/mcp").fetch(request, env, ctx);
    }

    return new Response("Not found", { status: 404 });
  },

  async scheduled(_controller, env, _ctx) {
    await chromaMcp.register(env.SERVER_URL!);
  },
};
