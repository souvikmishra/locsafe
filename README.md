# locsafe

A production-oriented, **RPC-only** Safe multisig UI and CLI. Anyone can load a Safe, reconstruct a transaction from on-chain state, recompute EIP-712 hashes locally, exchange signatures as files or links, and execute with nothing but one JSON-RPC endpoint and a hardware wallet.

This repository targets the first ETHSecurity Initiatives milestone: *Complete lifecycle without Safe infrastructure*.

## Hard rules

- Ethereum Mainnet only in the product (`chainId` 1). Anvil is for tests.
- The configured JSON-RPC origin is the only HTTP(S) endpoint. No Safe Transaction Service, WalletConnect, RainbowKit, CoinGecko, Pinata, or vendor iframes.
- Ledger talks WebHID. Trezor talks bundled WebUSB (`public/trezor`, never `connect.trezor.io`).
- Calldata the decoder cannot parse is labeled **UNVERIFIED**.

## Quick start

```bash
pnpm install
pnpm dev
```

Open the app, paste a Mainnet JSON-RPC URL and a Safe address, then propose / verify / sign / export / execute.

## CLI

```bash
pnpm locsafe-hash --safe 0x8FA3b4570B4C96f8036C13b64971BA65867eEB48 \
  --chain-id 1 --version 1.3.0 \
  --to 0x8FA3b4570B4C96f8036C13b64971BA65867eEB48 \
  --value 0 --data 0x --operation 0 --nonce 39
```

Prints **domain hash**, **message hash**, **safeTxHash**, and decoded calldata. Compare with [pcaversaccio/safe-tx-hashes-util](https://github.com/pcaversaccio/safe-tx-hashes-util) `--interactive` on the same fields (do not use the Transaction Service). Pass `--rpc <url>` to also check `getTransactionHash` on chain.

The golden CI vector is the Arbitrum `addOwnerWithThreshold` example from that README (`testdata/golden/arbitrum-addOwner.json`).

## Tests

```bash
pnpm test          # unit + Anvil MockSafe tests (requires `anvil` on PATH)
pnpm test:e2e      # Playwright, static preview
```

## Hardware wallets

- **Ledger:** `@ledgerhq/hw-transport-webhid` + `@ledgerhq/hw-app-eth` `signEIP712HashedMessage`. Coin Application Ledger / NFT metadata plugins stay disabled — the app never fetches Ledger cloud hosts.
- **Trezor:** `scripts/vendor-trezor-connect.sh` copies connect assets into `public/trezor`. Init uses `connectSrc: "./trezor/"` and `transports: ["WebUsbTransport"]` only. No Trezor Bridge.

Install optional vendor packages when you are ready to sign on real devices:

```bash
pnpm add @ledgerhq/hw-transport-webhid @ledgerhq/hw-app-eth @trezor/connect
pnpm exec bash scripts/vendor-trezor-connect.sh
```

## Verify a build (IPFS)

Kubo flags are fixed so unaffiliated parties can reproduce the CID:

```bash
SOURCE_DATE_EPOCH=$(git log -1 --format=%ct) pnpm build
./scripts/ipfs-add.sh
```

That runs `ipfs add --cid-version=1 --chunker=size-262144 --raw-leaves -Q -r dist`.

## Runtime dependencies

See `package.json` `dependencies`. At the first tagged release the GitHub Release body must list that set plus the Kubo flags above.

## License

MIT
