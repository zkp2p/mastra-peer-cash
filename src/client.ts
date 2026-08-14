import { createCashClient, type CashClient, type CashClientOptions } from '@zkp2p/cash';
import { createPublicClient, http, type Hash, type TransactionReceipt } from 'viem';
import { base } from 'viem/chains';

export interface PeerCashReceiptClient {
  getTransactionReceipt(parameters: { hash: Hash }): Promise<TransactionReceipt>;
}

export interface PeerCashToolsConfig extends Omit<CashClientOptions, 'environment'> {
  environment?: CashClientOptions['environment'];
  client?: CashClient;
  receiptClient?: PeerCashReceiptClient;
}

export function getPeerCashClient(config: PeerCashToolsConfig = {}): CashClient {
  if (config.client) return config.client;

  const { client: _client, receiptClient: _receiptClient, environment = 'production', ...options } = config;
  return createCashClient({ ...options, environment });
}

export function getPeerCashReceiptClient(config: PeerCashToolsConfig = {}): PeerCashReceiptClient {
  if (config.receiptClient) return config.receiptClient;

  return createPublicClient({
    chain: base,
    transport: config.transport ?? http(config.rpcUrl),
  });
}
