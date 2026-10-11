# R1 Chain research (read-only, 11 Oct 2026)

## 1. Python wheels: B-001 is no longer a blocker
- B-001 said every eth-account version failed with ResolutionImpossible on `bitarray>=2.4`.
  Today `bitarray 3.12.0` has a cp312 macOS arm64 wheel, so the earlier failure was likely
  a missing wheel or index problem at that time. The venv's Python and platform have not changed.
- `pip install --dry-run --only-binary=:all: eth-account` resolves with wheels only. Every
  package is a wheel, so nothing needs a compiler. The pins to add:
  eth-account==0.14.0 eth-keys==0.8.0 eth-keyfile==0.10.0 eth-rlp==3.0.0 rlp==5.0.0
  eth-utils==6.0.0 eth-typing==6.0.0 eth-hash==0.8.0 eth_abi==6.0.0 hexbytes==2.0.0
  bitarray==3.12.0 ckzg==2.1.8 cytoolz==1.2.0 toolz==1.2.0 py-ecc==8.0.0
  pycryptodome==3.24.0 parsimonious==0.10.0 regex==2026.9.29
  (pydantic 2.14 is already present in the venv.)
- Size: about 5.0 MB to download and about 30 MB once installed. I measured 37 MB in a
  scratch venv, and that figure includes pydantic, which the API venv already has.
- Checked in a scratch venv only, never apps/api/.venv: `Account.sign_transaction` with a
  type-2 tx (chainId 80002) and the public EIP-155 test-vector key produces a raw tx that
  starts with `0x02`.
  Watch out: hexbytes 2 `.hex()` returns the hex with no `0x`. Add `"0x"` before sending.
- web3 8.0.0 also resolves from wheels only, but it pulls in another 11 packages (aiohttp,
  websockets, yarl and others). It is not needed.
- **Recommendation: eth-account only.** Make the JSON-RPC calls over httpx, which the API
  already uses (httpx 0.28.1, as in whatsapp.py).

## 2. Node ethers v6 fallback: not needed
- I did not run `npm view ethers@6 version`: the permission classifier denied it. If the
  fallback is ever needed, the lead should pin an exact 6.x version from npm view and call
  a small `node sign.mjs` through subprocess, passing JSON on stdin and the key in env.
  Python wheels work, so drop this path.

## 3. Polygon Amoy
- The sandbox could not resolve DNS for `https://rpc-amoy.polygon.technology`, and a run
  outside the sandbox was denied. **Live eth_chainId, gasPrice and priority-fee values are
  not verified.** These numbers are well known but unconfirmed here:
  - Chain ID 80002 (hex 0x13882). Native token POL.
  - Explorer: tx `https://amoy.polygonscan.com/tx/<0xhash>`, address
    `https://amoy.polygonscan.com/address/<0xaddr>`. EXPLORER_TX in routers/proof.py
    already matches.
  - Polygon PoS enforces a minimum priority fee of 25 gwei. Use
    `tip = max(eth_maxPriorityFeePerGas, 30 gwei)` and
    `maxFee = 2 * baseFee(latest) + tip`.
- Gas for a zero-value self-transfer with 32 bytes of data:
  21000 + 16*nonzero + 4*zero, which is 21512 at most (all 32 bytes nonzero).
  If EIP-7623 (Pectra calldata floor) is active, the floor is 21000 + 10*(zero + 4*nonzero)
  = 22280 at most. Call `eth_estimateGas` and fall back to a 30000 gas limit.
- Cost per write at 30000 gas and about 60 gwei is about 0.0018 POL.
  **Low-balance threshold: 0.01 POL**, which covers about 5 writes. Refuse to send below
  about 0.002 POL and fall back to LocalOnly.
- Faucet: https://faucet.polygon.technology (Amoy, POL). This is the owner's manual step
  in README-dev.md.

## 4. Design (B1)
- Settings: PROOF_RPC_URL, PROOF_PRIVATE_KEY, PROOF_CHAIN_ID (int, empty = disabled).
  `chain_enabled` = all three set and PROOF_CHAIN_ID == 80002.
- Chain guard: before every send, call `eth_chainId` and refuse unless the value is exactly
  0x13882 and the setting is 80002. Raise ChainError, store the bundle as "stored" and log
  only the reason.
- Keep the address only in memory: `Account.from_key(settings.proof_private_key).address`.
  Never log, repr or return the key. Make the Settings `__repr__` mask it, because the
  dataclass prints every field by default.
- Nonce: `eth_getTransactionCount(addr, "pending")`. With one writer and a lock (a
  threading.Lock around write), a retry after "nonce too low" refetches the nonce once.
- Tx: `{type: 2, chainId: 80002, nonce, to: addr, value: 0, data: "0x" + root,
  gas, maxFeePerGas, maxPriorityFeePerGas}`. Sign with eth-account, then call
  `eth_sendRawTransaction("0x" + raw.hex())`.
- Pre-check the balance: if `eth_getBalance` < gas*maxFee, fall back to LocalOnly. GET
  /proof reports the balance in POL for the Settings warning (below 0.01 POL).
- Confirmation: store tx_hash with chain_status "sent" (pending). Poll
  `eth_getTransactionReceipt` (about every 2 s, about 60 s cap, inside the request or as a
  follow-up GET). On `status == 0x1`, store blockNumber and mark "verified". On
  `status == 0x0`, mark "failed". On timeout, stay "sent" and re-check on the next GET.
  The ProofBundle model needs `chain_block`, plus an Alembic migration.
- Key generation without printing: a one-off make target runs
  `python -c` with `Account.create()` and appends `PROOF_PRIVATE_KEY=0x...` to `.env`
  (create it with mode 0600 and refuse if the line already exists). It prints only
  `Account.from_key(...).address`. Check that `.env` stays gitignored (it already is).
- Tests: inject `httpx.Client(transport=httpx.MockTransport(handler))` into the
  ChainWriter, as in tests/test_winback_units.py. The handler dispatches on the JSON-RPC
  `method`. Cover: wrong chain id means refuse, low balance means LocalOnly, the happy path
  stores the hash and block, a receipt with status 0 means failed, RPC down means
  LocalOnly. Test with the public test-vector key `"0x" + "46"*32` and generate no key.
  Never touch the network.
