# @zkp2p/mastra-peer-cash

[![CI](https://github.com/zkp2p/mastra-peer-cash/actions/workflows/ci.yml/badge.svg)](https://github.com/zkp2p/mastra-peer-cash/actions/workflows/ci.yml)

Peer Cash tools for Mastra agents. The package wraps [`@zkp2p/cash`](https://www.npmjs.com/package/@zkp2p/cash) and lets an agent discover payout rails, estimate fiat received, prepare Base USDC cash-out transactions, finalize confirmed deposits, inspect orders, withdraw unmatched funds, and top up live orders.

Mutating tools return unsigned transactions. Your Mastra host keeps custody and submits them after applying its own approval policy.

## Installation

```bash
npm install @zkp2p/mastra-peer-cash @mastra/core zod
```

## Quick start

```typescript
import { Agent } from "@mastra/core/agent";
import { createPeerCashTools } from "@zkp2p/mastra-peer-cash";

const tools = createPeerCashTools({
  environment: "production",
  referrer: "my-mastra-agent",
});

const agent = new Agent({
  id: "cash-out-agent",
  name: "Cash-out Agent",
  instructions:
    "Use Peer Cash to estimate and prepare cash-outs. Never describe an estimate as a locked quote. Get explicit user approval before the host submits a transaction.",
  model: "anthropic/claude-sonnet-4-6",
  tools,
});
```

## Lifecycle

1. Call `peer-cash-capabilities` before naming a platform or currency.
2. Call `peer-cash-estimate`. The binding Chainlink rate resolves when a buyer fills.
3. Call `peer-cash-prepare` and show the unsigned transaction plan to the user.
4. After approval, submit each transaction in order and confirm it on Base.
5. Call `peer-cash-finalize` with the confirmed `createDeposit` transaction hash.
6. For each hash in the plan's `accessPolicyPaymentMethods`, call `peer-cash-prepare-access-policy` with `depositId` and `paymentMethod`, then submit and confirm that transaction with the depositor.
7. Persist the returned `depositId`. Use it with the order, withdrawal, and top-up tools.

The package does not accept private keys or submit transactions.

## Amounts

All token amounts are decimal base-unit strings. Base USDC has 6 decimals, so 100 USDC is `"100000000"`.

## Recovery

Peer Cash errors include a code, retryability, remediation, and recovery evidence. Do not retry an unknown transaction outcome. Inspect the named transaction and existing orders first.

An `ORDER_NOT_FOUND` response immediately after finalization is usually indexer lag. Retry only the order read.

## Publishing

Releases use only [publish.yml](.github/workflows/publish.yml) through npm trusted publishing (GitHub OIDC), with provenance for this public repository. There are no npm publishing tokens. npm is configured to require 2FA and disallow tokens; local `npm publish` is rejected.

One-time human setup after this workflow merges: create the GitHub environment `npm-publish`, restrict its deployment branches to `main`, and register the exact workflow filename and environment:

```bash
npm trust github @zkp2p/mastra-peer-cash --file .github/workflows/publish.yml --repo zkp2p/mastra-peer-cash --env npm-publish --allow-publish
```

1. Bump `package.json`'s version and update `CHANGELOG.md` in a PR; merge it to `main`.
2. Dispatch from `main`, using that exact, unpublished SemVer (no `v` prefix or build metadata):

   ```bash
   gh workflow run publish.yml --ref main -f version=X.Y.Z
   ```

3. Check that the workflow succeeds, then verify the version and selected tag:

   ```bash
   npm view @zkp2p/mastra-peer-cash@X.Y.Z version
   npm view @zkp2p/mastra-peer-cash dist-tags.latest
   ```

An empty `dist_tag` derives `latest` for stable versions and the first prerelease identifier for prereleases (`1.2.3-rc.1` → `rc`). Pass `-f dist_tag=rc` to override it; tags must start with a lowercase letter and contain only lowercase letters, digits, or hyphens. SemVer ranges such as `x` and `v1` are rejected. A prerelease targeting `latest` also requires `-f allow_prerelease_latest=true`. Verify `dist-tags.rc` when releasing on `rc`.

The workflow checks the branch, version, and npm availability before building, runs the existing lint/format/typecheck/tests/build and package checks, then publishes the single verified tarball from a GitHub-hosted runner in `npm-publish`. If publishing succeeds but registry verification fails, check npm before retrying: the workflow refuses already-published versions.

OIDC cannot move dist-tags on existing versions. A human must promote an existing release with passkey 2FA, for example:

```bash
npm dist-tag add @zkp2p/mastra-peer-cash@1.2.3-rc.1 latest
```

## License

Apache-2.0
