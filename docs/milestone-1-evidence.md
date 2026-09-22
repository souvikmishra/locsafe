# locsafe Milestone 1 evidence pack

This file is the recording script for RFP criterion 1–4, 7–8. Do not invent transaction hashes. Fill them in after real Mainnet runs.

Named public JSON-RPC used in every recording:

- RPC URL: `_fill in_`
- Chain: Ethereum Mainnet (chainId 1)

Tagged release:

- Git tag: `_fill in_`
- Commit: `_fill in_`
- IPFS CID (CIDv1, chunker=size-262144, raw-leaves): `_fill in_`
- ENS name + contenthash: `_fill in_`

## Browser setup (every recording)

1. Chromium only (WebHID/WebUSB).
2. Open DevTools → Network. Disable cache. Filter: All.
3. Load the UI from `file://`, `pnpm preview`, or `https://ipfs.io/ipfs/<CID>/`.
4. Confirm the only HTTP(S) host is the named RPC origin. WebHID/WebUSB device traffic is expected.
5. If any request hits `safe-transaction-*.safe.global`, WalletConnect, Trezor/Ledger cloud, analytics, or a font CDN, stop. The recording fails.

## Criterion 1 — full lifecycle, v1.3.0 and v1.4.1

For each Safe version:

1. Connect RPC + Safe address.
2. Propose a tiny, reversible call (0-value call to the Safe itself, or a 1 wei transfer you control).
3. Verify domain hash, message hash, safeTxHash against `pnpm locsafe-hash` and pcaversaccio `safe_hashes.sh --interactive`.
4. Sign on a hardware wallet. Match domain + message hashes on the device.
5. Execute via hardware-wallet ETH tx + `eth_sendRawTransaction`.
6. Publish the Mainnet tx hash.

- v1.3.0 Safe: `_address_` tx: `_hash_`
- v1.4.1 Safe: `_address_` tx: `_hash_`

## Criterion 2 — 2-of-3 across machines

Safe: `_address_` (threshold 2, three EOA owners)

1. Machine A (signer 1): construct, export `.locsafe.json` (do not contact the Transaction Service).
2. Machine B (signer 2): import file or `#/p/` link, verify hashes on **Ledger**, sign, re-export.
3. Machine C (signer 3): import, verify hashes on **Trezor**, sign, re-export.
4. Independent machine: import final package, execute, publish tx hash: `_hash_`

## Criterion 3 — nested EIP-1271

Outer Safe owner is a nested Safe. Nested owners sign the outer `safeTxHash`, packed as `kind: eip1271`. Recording of create → export → import → validate → execute. Tx: `_hash_`

Also demonstrate `approveHash` as the on-chain alternative.

## Criterion 4 — unaffiliated recovery

Operator who is not on the team, given only:

- Safe address
- the named RPC
- the exported `.locsafe.json`

obtains the UI from the tagged source or the IPFS CID and executes. Tx: `_hash_`  
Operator name/handle: `_fill in_`

## Criterion 6 — CLI example (Mainnet)

```
pnpm locsafe-hash --safe 0x8FA3b4570B4C96f8036C13b64971BA65867eEB48 \
  --chain-id 1 --version 1.3.0 \
  --to 0x8FA3b4570B4C96f8036C13b64971BA65867eEB48 \
  --value 0 --data 0x --operation 0 --nonce 39
```

Compare domain / message / safeTxHash with `./safe_hashes.sh --interactive` from pcaversaccio/safe-tx-hashes-util on the same fields. Paste both outputs here.

## Criterion 7 — reproducible CID

```
SOURCE_DATE_EPOCH=$(git log -1 --format=%ct) pnpm build
./scripts/ipfs-add.sh
```

Flags: `--cid-version=1 --chunker=size-262144 --raw-leaves`

Unaffiliated confirmations (name + CID they reproduced):

1. `_`
2. `_`
3. `_`

## Criterion 8 — security review

Reviewer (unaffiliated): `_`  
Report URL: `_`  
Follow-up tag with fixes: `_`

Scope: `src/domain/*`, `src/rpc/*`, `src/hw/*`, package import, exec encoding.
