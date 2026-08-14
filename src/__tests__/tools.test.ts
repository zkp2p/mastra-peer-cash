import type { CashClient, PreparedTransaction } from '@zkp2p/cash';
import type { TransactionReceipt } from 'viem';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@mastra/core/tools', () => ({
  createTool: vi.fn(config => config),
}));

import { createPeerCashTools } from '../tools.js';

const prepared: PreparedTransaction = {
  to: '0x1111111111111111111111111111111111111111',
  data: '0x1234',
  value: 0n,
  chainId: 8453,
};

function mockOrder() {
  return {
    depositId: '0x1111111111111111111111111111111111111111_1',
    state: 'awaiting-buyer',
    nextActions: ['wait', 'withdraw'],
    totalAmount: 1000000n,
  };
}

function mockClient() {
  return {
    capabilities: vi.fn(() => ({
      chainId: 8453,
      token: {
        address: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913',
        symbol: 'USDC',
        decimals: 6,
      },
      environment: 'production',
      platforms: [],
      currencies: [],
      amount: { min: 10000n, recommendedMin: 1000000n, max: null },
      pricing: { kind: 'oracle-market-rate', spreadBps: 0 },
    })),
    estimate: vi.fn(async () => ({
      kind: 'oracle-estimate',
      currency: 'USD',
      amount: 1000000n,
      rate: 1,
      receiveAmount: 1,
      asOf: 1,
      oracleUpdatedAt: 1,
    })),
    prepare: vi.fn(async () => ({
      txs: [prepared],
      steps: [{ kind: 'createDeposit', description: 'Create order' }],
      register: { hashedOnchainIds: [] },
      accessPolicyRequired: false,
    })),
    finalizePreparedCashout: vi.fn(() => ({
      depositId: '0x1111111111111111111111111111111111111111_1',
      txHash: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      escrowAddress: '0x1111111111111111111111111111111111111111',
      onchainDepositId: 1n,
      order: mockOrder(),
    })),
    prepareAccessPolicy: vi.fn(() => prepared),
    order: vi.fn(async () => mockOrder()),
    orders: vi.fn(async () => [mockOrder()]),
    prepareWithdraw: vi.fn(async () => ({
      txs: [prepared],
      steps: [{ kind: 'withdrawDeposit', description: 'Withdraw order' }],
    })),
    prepareTopUp: vi.fn(async () => ({
      txs: [prepared],
      steps: [{ kind: 'addFunds', description: 'Top up order' }],
    })),
  } as unknown as CashClient;
}

const receipt = {
  transactionHash: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  status: 'success',
  logs: [],
} as unknown as TransactionReceipt;

describe('createPeerCashTools', () => {
  it('returns the complete custody-separated tool set', () => {
    const tools = createPeerCashTools({
      client: mockClient(),
      receiptClient: { getTransactionReceipt: vi.fn(async () => receipt) },
    });

    expect(Object.values(tools).map(tool => tool.id)).toEqual([
      'peer-cash-capabilities',
      'peer-cash-estimate',
      'peer-cash-prepare',
      'peer-cash-finalize',
      'peer-cash-prepare-access-policy',
      'peer-cash-order',
      'peer-cash-orders',
      'peer-cash-prepare-withdraw',
      'peer-cash-prepare-top-up',
    ]);
  });

  it('serializes bigint capability and estimate fields', async () => {
    const client = mockClient();
    const tools = createPeerCashTools({
      client,
      receiptClient: { getTransactionReceipt: vi.fn(async () => receipt) },
    });

    const capabilities = await tools.capabilities.execute({});
    const estimate = await tools.estimate.execute({ amount: '1000000', currency: 'usd' });

    expect(capabilities.amount.min).toBe('10000');
    expect(estimate.amount).toBe('1000000');
    expect(client.estimate).toHaveBeenCalledWith({ amount: 1000000n, currency: 'USD' });
  });

  it('returns unsigned transaction values as decimal strings', async () => {
    const tools = createPeerCashTools({
      client: mockClient(),
      receiptClient: { getTransactionReceipt: vi.fn(async () => receipt) },
    });

    const plan = await tools.prepare.execute({
      amount: '1000000',
      receive: { platform: 'venmo', currency: 'USD', payee: '@maker' },
    });

    expect(plan.txs[0]).toEqual({
      to: prepared.to,
      data: prepared.data,
      value: '0',
      chainId: 8453,
    });
    expect(plan.accessPolicyRequired).toBe(false);
  });

  it('finalizes a confirmed receipt into a resumable deposit id', async () => {
    const client = mockClient();
    const getTransactionReceipt = vi.fn(async () => receipt);
    const tools = createPeerCashTools({
      client,
      receiptClient: { getTransactionReceipt },
    });

    const result = await tools.finalize.execute({ transactionHash: receipt.transactionHash });

    expect(getTransactionReceipt).toHaveBeenCalledWith({ hash: receipt.transactionHash });
    expect(client.finalizePreparedCashout).toHaveBeenCalledWith({
      transactionHash: receipt.transactionHash,
      status: receipt.status,
      logs: receipt.logs,
    });
    expect(result.depositId).toBe('0x1111111111111111111111111111111111111111_1');
  });

  it('passes owner filters and write amounts to the SDK', async () => {
    const client = mockClient();
    const tools = createPeerCashTools({
      client,
      receiptClient: { getTransactionReceipt: vi.fn(async () => receipt) },
    });
    const owner = '0x2222222222222222222222222222222222222222';
    const depositId = '0x1111111111111111111111111111111111111111_1';

    await tools.orders.execute({ owner, inFlight: true, limit: 25 });
    await tools.prepareWithdraw.execute({ depositId, amount: '500000' });
    await tools.prepareTopUp.execute({ depositId, amount: '750000' });

    expect(client.orders).toHaveBeenCalledWith(owner, { inFlight: true, limit: 25 });
    expect(client.prepareWithdraw).toHaveBeenCalledWith(depositId, { amount: 500000n });
    expect(client.prepareTopUp).toHaveBeenCalledWith(depositId, 750000n);
  });
});
