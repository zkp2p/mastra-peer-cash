# @mastra/peer-cash

Peer Cash tools for Mastra agents. The package wraps [`@zkp2p/cash`](https://www.npmjs.com/package/@zkp2p/cash) and lets an agent discover payout rails, estimate fiat received, prepare Base USDC cash-out transactions, finalize confirmed deposits, inspect orders, withdraw unmatched funds, and top up live orders.

Mutating tools return unsigned transactions. Your Mastra host keeps custody and submits them after applying its own approval policy.

## Installation

```bash
npm install @mastra/peer-cash @mastra/core zod
```

## Quick start

```typescript
import { Agent } from '@mastra/core/agent';
import { createPeerCashTools } from '@mastra/peer-cash';

const tools = createPeerCashTools({
  environment: 'production',
  referrer: 'my-mastra-agent',
});

const agent = new Agent({
  id: 'cash-out-agent',
  name: 'Cash-out Agent',
  instructions:
    'Use Peer Cash to estimate and prepare cash-outs. Never describe an estimate as a locked quote. Get explicit user approval before the host submits a transaction.',
  model: 'anthropic/claude-sonnet-4-6',
  tools,
});
```

## Lifecycle

1. Call `peer-cash-capabilities` before naming a platform or currency.
2. Call `peer-cash-estimate`. The binding Chainlink rate resolves when a buyer fills.
3. Call `peer-cash-prepare` and show the unsigned transaction plan to the user.
4. After approval, submit each transaction in order and confirm it on Base.
5. Call `peer-cash-finalize` with the confirmed `createDeposit` transaction hash.
6. If the plan returned `accessPolicyRequired: true`, call `peer-cash-prepare-access-policy` and submit that transaction with the depositor.
7. Persist the returned `depositId`. Use it with the order, withdrawal, and top-up tools.

The package does not accept private keys or submit transactions.

## Amounts

All token amounts are decimal base-unit strings. Base USDC has 6 decimals, so 100 USDC is `"100000000"`.

## Recovery

Peer Cash errors include a code, retryability, remediation, and recovery evidence. Do not retry an unknown transaction outcome. Inspect the named transaction and existing orders first.

An `ORDER_NOT_FOUND` response immediately after finalization is usually indexer lag. Retry only the order read.

## License

Apache-2.0
