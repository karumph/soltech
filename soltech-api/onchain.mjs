// Solana contract checks read straight from the blockchain, so every new coin is checked every scan with no
// third-party rate limit. One getMultipleAccounts call covers up to 100 tokens.
//
//   Always (free public RPC is enough): mint and freeze authority, and Token-2022 extensions that let someone
//   charge fees, run code on transfers, move or burn holders' tokens, block transfers or pause the token.
//   With SOLANA_RPC_URL set to a provider (for example Helius): top-holder concentration too. The public RPC
//   rate-limits getTokenLargestAccounts, so without a provider that part is skipped.

export const PUBLIC_RPC = "https://api.mainnet-beta.solana.com";
const TOKEN_2022 = "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb";
const flag = (key, level, text) => ({ key, level, text });

// Token accounts owned by these hold a pool's or launchpad's side of the market, not a holder's position.
export const POOL_AUTHORITIES = new Set([
  "5Q544fKrFoe6tsEbD7S8EmxGTJYAKtTVhAW5Q5pge4j1", // Raydium AMM v4 authority
  "GpMZbSM2GgvTKHJirzeGfMFoaZ8UR2X7F4v8vHTvxFbL", // Raydium CPMM authority
  "WLHv2UAZm6z4KyaaELi5pjdbJh6RESMva1Rnn8pJVVh", // Raydium LaunchLab authority
]);

export function rpcClient(postJson, url = PUBLIC_RPC) {
  let id = 0;
  return async (method, params) => {
    const body = await postJson(url, { jsonrpc: "2.0", id: ++id, method, params });
    if (body?.error) throw new Error(`${body.error.code === 429 ? 429 : "rpc"} ${method}: ${body.error.message}`);
    return body?.result;
  };
}

// Reads one parsed mint account into flags. `info` is the jsonParsed mint; `program` is its owner program.
export function fromMintAccount(info, program, now = Date.now()) {
  if (!info) return null;
  const flags = [];
  const mintable = !!info.mintAuthority;
  const freezable = !!info.freezeAuthority;
  if (mintable) flags.push(flag("mintable", "danger", "The creator can still mint more tokens"));
  if (freezable) flags.push(flag("freezable", "danger", "The creator can freeze holders' tokens"));
  const ext = new Map((info.extensions || []).map((item) => [item.extension, item.state || {}]));
  const fee = ext.get("transferFeeConfig");
  if (fee) {
    const bps = Math.max(Number(fee.newerTransferFee?.transferFeeBasisPoints) || 0, Number(fee.olderTransferFee?.transferFeeBasisPoints) || 0);
    if (bps > 0) flags.push(flag("transferFee", bps >= 500 ? "danger" : "warn", `Transfers pay a ${+(bps / 100).toFixed(2)}% fee`));
    else if (fee.transferFeeConfigAuthority) flags.push(flag("transferFee", "warn", "The creator can add a transfer fee later"));
  }
  const hook = ext.get("transferHook");
  if (hook?.programId) flags.push(flag("transferHook", "warn", "Transfers run custom code"));
  if (ext.get("permanentDelegate")?.delegate) flags.push(flag("permanentDelegate", "danger", "Someone can move or burn any holder's tokens"));
  if (ext.has("nonTransferable")) flags.push(flag("nonTransferable", "danger", "The token can't be transferred"));
  if (ext.get("defaultAccountState")?.accountState === "frozen") flags.push(flag("defaultFrozen", "danger", "New holders start frozen"));
  if (ext.get("pausableConfig")?.authority || ext.has("pausable")) flags.push(flag("pausable", "warn", "The creator can pause transfers"));
  const meta = ext.get("tokenMetadata");
  if (meta?.updateAuthority) flags.push(flag("mutableMetadata", "info", "The creator can still change the token's name and image"));
  return {
    checkedAt: new Date(now).toISOString(),
    source: "chain",
    program: program === TOKEN_2022 ? "token-2022" : "token",
    mintable,
    freezable,
    supply: info.supply ? Number(info.supply) / 10 ** (Number(info.decimals) || 0) : null,
    flags,
  };
}

// Authorities and extensions for many mints at once.
export async function readMints(rpc, mints, now = Date.now()) {
  const out = new Map();
  for (let i = 0; i < mints.length; i += 100) {
    const batch = mints.slice(i, i + 100);
    const result = await rpc("getMultipleAccounts", [batch, { encoding: "jsonParsed", commitment: "confirmed" }]);
    (result?.value || []).forEach((account, index) => {
      const parsed = account?.data?.parsed;
      if (parsed?.type === "mint") out.set(batch[index], fromMintAccount(parsed.info, account.owner, now));
    });
  }
  return out;
}

// Share of supply in the ten largest holdings, leaving out pools and launchpad curves. Needs a provider RPC.
export async function holderShare(rpc, mint, { supply, pools = [] } = {}) {
  const largest = await rpc("getTokenLargestAccounts", [mint, { commitment: "confirmed" }]);
  const accounts = (largest?.value || []).slice(0, 20);
  if (!accounts.length || !supply) return null;
  const owners = await rpc("getMultipleAccounts", [accounts.map((a) => a.address), { encoding: "jsonParsed" }]);
  const skip = new Set([...POOL_AUTHORITIES, ...pools]);
  const held = accounts
    .map((account, i) => ({ amount: Number(account.uiAmount) || 0, owner: owners?.value?.[i]?.data?.parsed?.info?.owner }))
    .filter((item) => item.owner && !skip.has(item.owner))
    .slice(0, 10);
  const share = (held.reduce((sum, item) => sum + item.amount, 0) / supply) * 100;
  const largestOne = held.length ? (held[0].amount / supply) * 100 : 0;
  return { top10Pct: Math.round(share), largestPct: Math.round(largestOne) };
}

export function holderFlags({ top10Pct, largestPct }) {
  const flags = [];
  if (largestPct >= 20) flags.push(flag("singleHolder", "danger", `One wallet holds ${largestPct}% of the supply`));
  if (top10Pct >= 60) flags.push(flag("topHolders", "danger", `The top 10 wallets hold ${top10Pct}% of the supply`));
  else if (top10Pct >= 35) flags.push(flag("topHolders", "warn", `The top 10 wallets hold ${top10Pct}% of the supply`));
  return flags;
}

// pump.fun bonding curves: how far each coin is toward graduating to a full exchange pool.
// The curve is constant-product with fixed virtual offsets, so the SOL needed to finish follows from its own
// numbers. That keeps the percentage right even when pump.fun changes its launch settings.
export const PUMP_PROGRAM = "6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P";
export function readCurve(data) {
  const b = Buffer.from(data, "base64");
  if (b.length < 49) return null;
  const vt = b.readBigUInt64LE(8), vs = b.readBigUInt64LE(16), rt = b.readBigUInt64LE(24), rs = b.readBigUInt64LE(32);
  const complete = b[48] === 1;
  const tokenOffset = vt - rt;
  if (tokenOffset <= 0n || vs < rs) return null;
  const solAtEnd = (vt * vs) / tokenOffset - (vs - rs);
  // A target under 5 SOL isn't a normal launch curve; leave its progress unknown rather than guess.
  const progress = complete ? 100 : solAtEnd >= 5_000_000_000n ? Math.max(0, Math.min(100, (Number(rs) / Number(solAtEnd)) * 100)) : null;
  return { progress: progress == null ? null : Math.round(progress * 10) / 10, sol: Number(rs) / 1e9, targetSol: Number(solAtEnd) / 1e9, complete };
}
export async function readCurves(rpc, addresses) {
  const out = new Map();
  for (let i = 0; i < addresses.length; i += 100) {
    const batch = addresses.slice(i, i + 100);
    const result = await rpc("getMultipleAccounts", [batch, { encoding: "base64", commitment: "confirmed" }]);
    (result?.value || []).forEach((account, index) => {
      if (account?.owner === PUMP_PROGRAM && account.data?.[0]) {
        const curve = readCurve(account.data[0]);
        if (curve) out.set(batch[index], curve);
      }
    });
  }
  return out;
}
