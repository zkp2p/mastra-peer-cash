import { createTool } from '@mastra/core/tools';
import type { CashoutInput } from '@zkp2p/cash';
import type { Hash } from 'viem';
import { z } from 'zod';

import { getPeerCashClient, getPeerCashReceiptClient, type PeerCashToolsConfig } from './client.js';
import {
  addressSchema,
  capabilitiesOutputSchema,
  depositIdSchema,
  estimateOutputSchema,
  hashSchema,
  orderOutputSchema,
  positiveIntegerStringSchema,
  preparedPlanSchema,
  preparedTransactionSchema,
  receiveSchema,
} from './schemas.js';
import { jsonSafe, preparedPlanToJson, preparedTransactionToJson } from './serialize.js';

export function createPeerCashCapabilitiesTool(config: PeerCashToolsConfig = {}) {
  const client = getPeerCashClient(config);
  return createTool({
    id: 'peer-cash-capabilities',
    description:
      'Discover the live Peer Cash Base USDC destination, payout platforms, fiat currencies, payee hints, amount bounds, and oracle pricing model.',
    inputSchema: z.object({
      includeRelaySources: z
        .boolean()
        .optional()
        .describe('Also fetch live Relay-supported EVM source chains and tokens.'),
    }),
    outputSchema: capabilitiesOutputSchema,
    execute: async input => {
      const capabilities = input.includeRelaySources
        ? await client.capabilities({ includeRelaySources: true })
        : client.capabilities();
      return jsonSafe(capabilities);
    },
  });
}

export function createPeerCashEstimateTool(config: PeerCashToolsConfig = {}) {
  const client = getPeerCashClient(config);
  return createTool({
    id: 'peer-cash-estimate',
    description:
      'Estimate fiat received from Base USDC at the live Chainlink oracle rate. This is not a locked quote; the binding rate resolves when a buyer fills.',
    inputSchema: z.object({
      amount: positiveIntegerStringSchema.describe('Base USDC amount in 6-decimal base units.'),
      currency: z.string().min(3).describe('Fiat currency from peer-cash-capabilities.'),
      platform: z.string().min(1).optional().describe('Optional platform for corridor-specific fill timing.'),
    }),
    outputSchema: estimateOutputSchema,
    execute: async input =>
      jsonSafe(
        await client.estimate({
          amount: BigInt(input.amount),
          currency: input.currency.toUpperCase(),
          ...(input.platform ? { platform: input.platform } : {}),
        }),
      ),
  });
}

export function createPeerCashPrepareTool(config: PeerCashToolsConfig = {}) {
  const client = getPeerCashClient(config);
  return createTool({
    id: 'peer-cash-prepare',
    description:
      'Prepare an unsigned Base USDC cash-out plan. Returns transactions in required submission order; the Mastra host keeps custody and must get user approval before signing.',
    inputSchema: z.object({
      amount: positiveIntegerStringSchema.describe('Base USDC amount in 6-decimal base units.'),
      receive: receiveSchema,
    }),
    outputSchema: preparedPlanSchema,
    execute: async input =>
      preparedPlanToJson(
        await client.prepare({
          amount: BigInt(input.amount),
          receive: input.receive as CashoutInput['receive'],
        }),
      ),
  });
}

export function createPeerCashFinalizeTool(config: PeerCashToolsConfig = {}) {
  const client = getPeerCashClient(config);
  const receiptClient = getPeerCashReceiptClient(config);
  return createTool({
    id: 'peer-cash-finalize',
    description:
      'Resolve a confirmed createDeposit transaction into the resumable Peer deposit id. Call this after the host confirms the createDeposit transaction from peer-cash-prepare.',
    inputSchema: z.object({ transactionHash: hashSchema }),
    outputSchema: orderOutputSchema,
    execute: async input => {
      const receipt = await receiptClient.getTransactionReceipt({
        hash: input.transactionHash as Hash,
      });
      const result = client.finalizePreparedCashout({
        transactionHash: receipt.transactionHash,
        status: receipt.status,
        logs: receipt.logs,
      });
      return jsonSafe(result);
    },
  });
}

export function createPeerCashAccessPolicyTool(config: PeerCashToolsConfig = {}) {
  const client = getPeerCashClient(config);
  return createTool({
    id: 'peer-cash-prepare-access-policy',
    description:
      'Prepare the required verified-buyer access policy for a restricted Peer Cash order. Use only when peer-cash-prepare returned accessPolicyRequired=true, after finalization.',
    inputSchema: z.object({ depositId: depositIdSchema }),
    outputSchema: preparedTransactionSchema,
    execute: async input => preparedTransactionToJson(client.prepareAccessPolicy(input.depositId)),
  });
}

export function createPeerCashOrderTool(config: PeerCashToolsConfig = {}) {
  const client = getPeerCashClient(config);
  return createTool({
    id: 'peer-cash-order',
    description:
      'Read one Peer Cash order from its deposit id, including state, amounts, fills, and next actions. Retry this read through brief indexer lag; never repeat the deposit transaction.',
    inputSchema: z.object({ depositId: depositIdSchema }),
    outputSchema: orderOutputSchema,
    execute: async input => jsonSafe(await client.order(input.depositId)),
  });
}

export function createPeerCashOrdersTool(config: PeerCashToolsConfig = {}) {
  const client = getPeerCashClient(config);
  return createTool({
    id: 'peer-cash-orders',
    description: 'List Peer Cash orders for a maker wallet, optionally limited to orders still in flight.',
    inputSchema: z.object({
      owner: addressSchema,
      inFlight: z.boolean().optional(),
      limit: z.number().int().min(1).max(1000).optional(),
    }),
    outputSchema: z.array(orderOutputSchema),
    execute: async input =>
      (
        await client.orders(input.owner, {
          ...(input.inFlight !== undefined ? { inFlight: input.inFlight } : {}),
          ...(input.limit !== undefined ? { limit: input.limit } : {}),
        })
      ).map(jsonSafe),
  });
}

export function createPeerCashWithdrawTool(config: PeerCashToolsConfig = {}) {
  const client = getPeerCashClient(config);
  return createTool({
    id: 'peer-cash-prepare-withdraw',
    description:
      'Prepare unsigned transactions to withdraw unmatched funds. Omit amount to close the order; pass an amount in Base USDC base units for a partial withdrawal.',
    inputSchema: z.object({
      depositId: depositIdSchema,
      amount: positiveIntegerStringSchema.optional(),
    }),
    outputSchema: preparedPlanSchema,
    execute: async input =>
      preparedPlanToJson(
        await client.prepareWithdraw(
          input.depositId,
          input.amount ? { amount: BigInt(input.amount) } : undefined,
        ),
      ),
  });
}

export function createPeerCashTopUpTool(config: PeerCashToolsConfig = {}) {
  const client = getPeerCashClient(config);
  return createTool({
    id: 'peer-cash-prepare-top-up',
    description:
      'Prepare unsigned approve and addFunds transactions to add Base USDC to a live Peer Cash order.',
    inputSchema: z.object({
      depositId: depositIdSchema,
      amount: positiveIntegerStringSchema,
    }),
    outputSchema: preparedPlanSchema,
    execute: async input =>
      preparedPlanToJson(await client.prepareTopUp(input.depositId, BigInt(input.amount))),
  });
}

export function createPeerCashTools(config: PeerCashToolsConfig = {}) {
  const client = getPeerCashClient(config);
  const sharedConfig = { ...config, client };
  return {
    capabilities: createPeerCashCapabilitiesTool(sharedConfig),
    estimate: createPeerCashEstimateTool(sharedConfig),
    prepare: createPeerCashPrepareTool(sharedConfig),
    finalize: createPeerCashFinalizeTool(sharedConfig),
    prepareAccessPolicy: createPeerCashAccessPolicyTool(sharedConfig),
    order: createPeerCashOrderTool(sharedConfig),
    orders: createPeerCashOrdersTool(sharedConfig),
    prepareWithdraw: createPeerCashWithdrawTool(sharedConfig),
    prepareTopUp: createPeerCashTopUpTool(sharedConfig),
  };
}
