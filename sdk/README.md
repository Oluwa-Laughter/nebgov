# `@nebgov/sdk`

TypeScript clients for the NebGov governance contracts on Stellar/Soroban.

## API documentation

The complete generated TypeDoc reference is published with every release:

- [Download the latest SDK API documentation](https://github.com/nebgov/nebgov/releases/latest/download/nebgov-sdk-api-docs.tar.gz)

After downloading, extract the archive and open `README.md` to browse the
generated reference.

## Installation

```sh
pnpm add @nebgov/sdk
```

## Basic usage

```ts
import { GovernorClient } from "@nebgov/sdk";

const client = new GovernorClient({
  governorAddress: "C...",
  timelockAddress: "C...",
  votesAddress: "C...",
  network: "testnet",
  retry: {
    maxAttempts: 3,
    baseDelayMs: 1_000,
    maxDelayMs: 30_000,
  },
});
```

The legacy top-level `maxAttempts` and `baseDelayMs` settings remain supported,
but new integrations should use the `retry` object.
