// Contract safety for new coins: who can still mint or freeze, honeypots, taxes, holder spread and locked liquidity.
// Solana is read from the blockchain for every coin (onchain.mjs). The free third-party services fill in what the
// chain can't tell us cheaply, within a small budget each scan, and every result stays on the coin while it's tracked.

import { rpcClient, readMints, holderShare, holderFlags, PUBLIC_RPC } from "./onchain.mjs";

export const SAFETY_BUDGET = { rugcheck: 10, goplus: 8, holders: 20 };
const RECHECK_MS = 2 * 60 * 60 * 1000; // liquidity locks and authorities can change after launch
const RETRY_MS = 5 * 60 * 1000; // a failed check is tried again a few scans later

const flag = (key, level, text) => ({ key, level, text });
const pct = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

// Rugcheck risk names map onto Soltech's wording; anything unrecognised keeps Rugcheck's own name.
const rugNames = {
  "mint authority still enabled": ["mintable", "danger", "The creator can still mint more tokens"],
  "freeze authority still enabled": ["freezable", "danger", "The creator can freeze holders' tokens"],
  "top 10 holders high ownership": ["topHolders", "warn", "The top 10 wallets hold most of the supply"],
  "single holder ownership": ["singleHolder", "danger", "One wallet holds a large share of the supply"],
  "high holder concentration": ["topHolders", "warn", "A few wallets hold most of the supply"],
  "large amount of lp unlocked": ["lpUnlocked", "warn", "Most of the liquidity isn't locked"],
  "low liquidity": ["lowLiquidity", "warn", "Liquidity is low"],
  "mutable metadata": ["mutableMetadata", "info", "The creator can still change the token's name and image"],
  "copycat token": ["copycat", "danger", "Rugcheck flags this as a copy of another token"],
  "creator history of rugged tokens": ["creatorRugs", "danger", "The creator has launched tokens that were rugged"],
  "low amount of lp providers": ["fewLp", "info", "Only a few wallets provide liquidity"],
};

export function fromRugcheck(body, now = Date.now()) {
  const flags = [];
  for (const risk of Array.isArray(body?.risks) ? body.risks : []) {
    const name = String(risk?.name || "").trim();
    if (!name) continue;
    const known = rugNames[name.toLowerCase()];
    const level = known?.[1] || (risk.level === "danger" ? "danger" : risk.level === "warn" ? "warn" : "info");
    flags.push(flag(known?.[0] || `rug:${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`, level, known?.[2] || name));
  }
  return {
    checkedAt: new Date(now).toISOString(),
    source: "rugcheck",
    score: pct(body?.score_normalised ?? body?.score),
    lpLockedPct: pct(body?.lpLockedPct),
    mintable: flags.some((item) => item.key === "mintable"),
    freezable: flags.some((item) => item.key === "freezable"),
    flags,
  };
}

const active = (value) => String(value?.status ?? value ?? "0") === "1";
export function fromGoplusSolana(result, now = Date.now()) {
  if (!result) return null;
  const flags = [];
  if (active(result.mintable)) flags.push(flag("mintable", "danger", "The creator can still mint more tokens"));
  if (active(result.freezable)) flags.push(flag("freezable", "danger", "The creator can freeze holders' tokens"));
  if (active(result.balance_mutable_authority)) flags.push(flag("balanceMutable", "danger", "Someone can change holders' balances"));
  if (active(result.closable)) flags.push(flag("closable", "warn", "The token account can be closed by its authority"));
  if (String(result.non_transferable) === "1") flags.push(flag("nonTransferable", "danger", "The token can't be transferred"));
  if (Array.isArray(result.transfer_hook) && result.transfer_hook.length) flags.push(flag("transferHook", "warn", "Transfers run custom code"));
  const fee = Number(result.transfer_fee?.fee_rate ?? result.transfer_fee?.current_fee_rate);
  if (Number.isFinite(fee) && fee > 0) flags.push(flag("transferFee", fee >= 0.05 ? "danger" : "warn", `Transfers pay a ${+(fee * 100).toFixed(1)}% fee`));
  if (active(result.metadata_mutable)) flags.push(flag("mutableMetadata", "info", "The creator can still change the token's name and image"));
  return {
    checkedAt: new Date(now).toISOString(),
    source: "goplus",
    mintable: active(result.mintable),
    freezable: active(result.freezable),
    flags,
  };
}

export function fromGoplusEvm(result, now = Date.now()) {
  if (!result) return null;
  const flags = [];
  const yes = (key) => String(result[key] ?? "") === "1";
  const tax = (key) => { const n = Number(result[key]); return Number.isFinite(n) && result[key] !== "" ? n : null; };
  if (yes("is_honeypot") || yes("cannot_sell_all")) flags.push(flag("honeypot", "danger", "Looks like a honeypot: selling may be blocked"));
  if (yes("cannot_buy")) flags.push(flag("cannotBuy", "danger", "Buying is blocked"));
  const sell = tax("sell_tax"), buy = tax("buy_tax");
  if (sell != null && sell >= 0.1) flags.push(flag("sellTax", "danger", `Selling costs ${Math.round(sell * 100)}% in tax`));
  else if (sell != null && sell > 0.03) flags.push(flag("sellTax", "warn", `Selling costs ${Math.round(sell * 100)}% in tax`));
  if (buy != null && buy >= 0.1) flags.push(flag("buyTax", "warn", `Buying costs ${Math.round(buy * 100)}% in tax`));
  if (yes("is_mintable")) flags.push(flag("mintable", "danger", "The owner can mint more tokens"));
  if (yes("owner_change_balance")) flags.push(flag("balanceMutable", "danger", "The owner can change holders' balances"));
  if (yes("hidden_owner") || yes("can_take_back_ownership")) flags.push(flag("hiddenOwner", "danger", "The contract has a hidden or recoverable owner"));
  if (yes("transfer_pausable")) flags.push(flag("pausable", "warn", "The owner can pause transfers"));
  if (yes("is_blacklisted")) flags.push(flag("blacklist", "warn", "The owner can block wallets from trading"));
  if (yes("slippage_modifiable") || yes("personal_slippage_modifiable")) flags.push(flag("taxModifiable", "warn", "The owner can change the trading tax"));
  if (yes("is_proxy")) flags.push(flag("proxy", "info", "The contract can be upgraded"));
  if (result.is_open_source === "0") flags.push(flag("closedSource", "warn", "The contract code isn't verified"));
  if (Number(result.honeypot_with_same_creator) > 0) flags.push(flag("creatorRugs", "danger", "The creator has made honeypots before"));
  const holders = (Array.isArray(result.holders) ? result.holders : []).filter((h) => String(h.is_locked) !== "1" && !/pair|pool|lp|dead|burn/i.test(String(h.tag || "")));
  const top10 = holders.slice(0, 10).reduce((sum, h) => sum + (Number(h.percent) || 0), 0) * 100;
  if (holders.length && top10 >= 80) flags.push(flag("topHolders", "danger", `The top 10 wallets hold ${Math.round(top10)}% of the supply`));
  else if (holders.length && top10 >= 50) flags.push(flag("topHolders", "warn", `The top 10 wallets hold ${Math.round(top10)}% of the supply`));
  const creator = Number(result.creator_percent);
  if (Number.isFinite(creator) && creator >= 0.2) flags.push(flag("creatorHolds", "warn", `The creator still holds ${Math.round(creator * 100)}% of the supply`));
  return {
    checkedAt: new Date(now).toISOString(),
    source: "goplus",
    holders: Number(result.holder_count) || null,
    top10Pct: holders.length ? Math.round(top10) : null,
    mintable: yes("is_mintable"),
    honeypot: yes("is_honeypot") || yes("cannot_sell_all"),
    sellTax: sell,
    buyTax: buy,
    flags,
  };
}

// Which coins are due a check: never checked, failed a while ago, or checked long enough ago to look again.
export function safetyQueue(coins, now = Date.now()) {
  const due = (coin) => {
    const s = coin.safety;
    if (!s) return true;
    if (s.failedAt) return now - Date.parse(s.failedAt) > RETRY_MS;
    return now - Date.parse(s.checkedAt) > RECHECK_MS;
  };
  return coins.filter(due).sort((a, b) => promise(b) - promise(a) || Date.parse(b.firstSeenAt) - Date.parse(a.firstSeenAt));
}

// Coins the market reading already rules out (thin liquidity, tiny cap) gain little from the scarce checks.
const promise = (coin) => (coin.marketRisk === "high" ? 0 : 1) * 1e12 + (coin.liquidity || 0) + (coin.volume1h || 0) * 2;
const CHAIN_RECHECK_MS = 30 * 60 * 1000;
// Flags the blockchain read decides. When it has run, older third-party readings of these are ignored.
const CHAIN_KEYS = new Set(["mintable", "freezable", "transferFee", "transferHook", "permanentDelegate", "nonTransferable", "defaultFrozen", "pausable", "mutableMetadata", "balanceMutable", "closable"]);
const levels = { danger: 3, warn: 2, info: 1 };
const mergeFlags = (...lists) => {
  const byKey = new Map();
  for (const item of lists.flat()) {
    const prev = byKey.get(item.key);
    if (!prev || levels[item.level] > levels[prev.level]) byKey.set(item.key, item);
  }
  return [...byKey.values()];
};
const uniq = (list) => [...new Set(list.filter(Boolean))];
async function pool(items, size, task) {
  const queue = items.slice();
  await Promise.all(Array.from({ length: Math.min(size, queue.length) }, async () => { while (queue.length) await task(queue.shift()); }));
}

// One safety pass per scan.
//   Solana: every coin's authorities and Token-2022 extensions from the blockchain (one call per 100 coins);
//           with a provider RPC, top-holder concentration for the most promising; Rugcheck only for what the
//           chain can't tell us cheaply (creator history, locked liquidity), most promising first.
//   Base:   GoPlus, most promising first.
export async function checkSafety({ fetchJson, postJson, rpcUrl, coins, now = Date.now(), budget = SAFETY_BUDGET }) {
  const iso = new Date(now).toISOString();
  const results = new Map();
  const stats = { chain: 0, holders: 0, rugcheck: 0, goplus: 0, failed: 0 };
  const current = (coin) => results.get(coin.id) || coin.safety || null;
  const solana = coins.filter((coin) => coin.chain === "solana");

  // 1. The blockchain read.
  let chainRan = false;
  if (postJson) {
    const due = solana.filter((coin) => !coin.safety?.chainAt || now - Date.parse(coin.safety.chainAt) > CHAIN_RECHECK_MS).slice(0, 300);
    try {
      const rpc = rpcClient(postJson, rpcUrl || PUBLIC_RPC);
      const read = due.length ? await readMints(rpc, due.map((coin) => coin.address), now) : new Map();
      stats.chain = read.size;
      chainRan = true;
      for (const coin of due) {
        const found = read.get(coin.address);
        if (!found) continue;
        const prev = coin.safety || {};
        results.set(coin.id, {
          ...prev, ...found, failedAt: undefined, chainAt: iso, checkedAt: iso,
          sources: uniq([...(prev.sources || []), "chain"]),
          flags: mergeFlags(found.flags, (prev.flags || []).filter((item) => !CHAIN_KEYS.has(item.key))),
        });
      }
    } catch {
      stats.failed += 1;
    }

    // 2. Holder concentration, only with a provider RPC (the public one rate-limits this call).
    if (rpcUrl && rpcUrl !== PUBLIC_RPC && budget.holders > 0) {
      const rpc = rpcClient(postJson, rpcUrl);
      const queue = solana
        .filter((coin) => current(coin)?.chainAt && current(coin)?.supply && coin.marketRisk !== "high" && (!current(coin).holdersAt || now - Date.parse(current(coin).holdersAt) > RECHECK_MS))
        .sort((a, b) => promise(b) - promise(a))
        .slice(0, budget.holders);
      let stop = false;
      await pool(queue, 4, async (coin) => {
        if (stop) return;
        try {
          const s = current(coin);
          const share = await holderShare(rpc, coin.address, { supply: s.supply, pools: coin.pools || [] });
          stats.holders += 1;
          if (share) results.set(coin.id, { ...s, ...share, holdersAt: iso, sources: uniq([...(s.sources || []), "holders"]), flags: mergeFlags((s.flags || []).filter((item) => !["topHolders", "singleHolder"].includes(item.key)), holderFlags(share)) });
        } catch (error) {
          stats.failed += 1;
          if (/^429/.test(String(error?.message))) stop = true;
        }
      });
    }
  }

  // 3. Rugcheck for creator history and locked liquidity (and everything, if the chain read failed).
  const rugQueue = solana
    .filter((coin) => coin.marketRisk !== "high" && (!current(coin)?.rugcheckAt || now - Date.parse(current(coin).rugcheckAt) > RECHECK_MS))
    .filter((coin) => !current(coin)?.rugFailedAt || now - Date.parse(current(coin).rugFailedAt) > RETRY_MS)
    .sort((a, b) => promise(b) - promise(a))
    .slice(0, budget.rugcheck || 0);
  let rugBlocked = false;
  await pool(rugQueue, 4, async (coin) => {
    if (rugBlocked) return;
    stats.rugcheck += 1;
    let body;
    try {
      body = await fetchJson(`https://api.rugcheck.xyz/v1/tokens/${coin.address}/report/summary`);
    } catch (error) {
      stats.failed += 1;
      if (/^429|^403/.test(String(error?.message))) rugBlocked = true;
      const s = current(coin);
      results.set(coin.id, s ? { ...s, rugFailedAt: iso } : { failedAt: iso, rugFailedAt: iso, flags: [] });
      return;
    }
    const rug = fromRugcheck(body, now);
    const s = current(coin);
    const fromChain = !!s?.chainAt;
    results.set(coin.id, {
      ...(s || {}), failedAt: undefined, rugFailedAt: undefined,
      checkedAt: s?.checkedAt && !s.failedAt ? s.checkedAt : iso, rugcheckAt: iso,
      score: rug.score, lpLockedPct: rug.lpLockedPct,
      mintable: fromChain ? s.mintable : rug.mintable, freezable: fromChain ? s.freezable : rug.freezable,
      sources: uniq([...(s?.sources || []), "rugcheck"]),
      flags: mergeFlags(s?.flags || [], fromChain ? rug.flags.filter((item) => !CHAIN_KEYS.has(item.key)) : rug.flags),
    });
  });

  // 4. Base contracts through GoPlus (one token per call on the free tier).
  const goplusQueue = coins
    .filter((coin) => coin.chain === "base" || (coin.chain === "solana" && !chainRan && !current(coin)?.checkedAt))
    .filter((coin) => safetyQueue([{ ...coin, safety: current(coin) }], now).length)
    .sort((a, b) => promise(b) - promise(a))
    .slice(0, budget.goplus || 0);
  let goplusBlocked = false;
  await pool(goplusQueue, 4, async (coin) => {
    if (goplusBlocked) return;
    stats.goplus += 1;
    try {
      const url = coin.chain === "base"
        ? `https://api.gopluslabs.io/api/v1/token_security/8453?contract_addresses=${coin.address}`
        : `https://api.gopluslabs.io/api/v1/solana/token_security?contract_addresses=${coin.address}`;
      const body = await fetchJson(url);
      const read = coin.chain === "base"
        ? fromGoplusEvm(body.result?.[coin.address.toLowerCase()] || body.result?.[coin.address], now)
        : fromGoplusSolana(body.result?.[coin.address], now);
      results.set(coin.id, read ? { ...read, sources: ["goplus"] } : { failedAt: iso, flags: [] });
    } catch (error) {
      stats.failed += 1;
      if (/^429|^403/.test(String(error?.message))) goplusBlocked = true;
      results.set(coin.id, { failedAt: iso, flags: [] });
    }
  });
  return { results, stats };
}
