// The shared scheduled scan. Pure apart from the injected fetchJson, so it runs the same in Lambda and in tests.
//
// Each run:
//   1. collects candidate tokens from Dexscreener profiles and boosts and from GeckoTerminal new pools,
//   2. prices every candidate, and every coin still in the feed, from all of its Dexscreener pairs,
//   3. spends a small budget on contract safety checks for the most promising unchecked coins,
//   4. assesses every coin (flags, risk, the four Scanner checks, momentum) and keeps a rolling day-long feed.

import { assess, marketRisk } from "./assess.mjs";
import { checkSafety } from "./safety.mjs";
import { rpcClient, readCurves, PUBLIC_RPC } from "./onchain.mjs";

export const CHAINS = ["solana", "base"];
export const FEED_MAX_AGE_MS = 24 * 60 * 60 * 1000;
export const FEED_MAX_COINS = 150;
export const ASSESSMENT_VERSION = 2;
const REFRESH_LIMIT = 120;
const DEX_BATCH = 30;
const geckoNetwork = { solana: "solana", base: "base" };
// Pools whose "base" token is really a quote asset say nothing about a new project.
const quoteTokens = new Set([
  "solana:So11111111111111111111111111111111111111112",
  "solana:EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
  "solana:Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB",
  "base:0x4200000000000000000000000000000000000006",
  "base:0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
]);

const money = (value) => {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
};
const signed = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};
const count = (value) => {
  const n = Number(value);
  return Number.isInteger(n) && n >= 0 ? n : null;
};
const https = (value) => {
  try {
    const url = new URL(String(value || ""));
    return url.protocol === "https:" && !/missing\.png$/i.test(url.pathname) ? url.href : null;
  } catch {
    return null;
  }
};
const text = (value, max = 60) => String(value ?? "").replace(/[\u0000-\u001f\u007f�]/g, "").trim().slice(0, max);
const keyOf = (chain, address) => `${chain}:${chain === "base" ? String(address).toLowerCase() : address}`;
const sum = (values) => {
  const real = values.filter((v) => v != null);
  return real.length ? real.reduce((a, b) => a + b, 0) : null;
};

// Address shape decides the network the scanner supports: base58 is Solana, 0x hex is Base.
export function networkOf(address) {
  const value = String(address || "").trim();
  if (/^0x[0-9a-fA-F]{40}$/.test(value)) return "base";
  if (/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(value)) return "solana";
  return null;
}

// One token's market reading from all of its Dexscreener pairs: identity, price and cap from the deepest pair,
// liquidity, volume and trades added up across pairs, and age from the oldest pair (when trading really began).
export function fromDexPairs(pairs) {
  const list = (pairs || []).filter((pair) => pair?.baseToken?.address);
  if (!list.length) return null;
  const best = list.reduce((top, pair) => ((money(pair.liquidity?.usd) || 0) > (money(top.liquidity?.usd) || 0) ? pair : top), list[0]);
  const created = list.map((pair) => Number(pair.pairCreatedAt)).filter((n) => Number.isFinite(n) && n > 0);
  const info = list.find((pair) => pair.info)?.info;
  return {
    id: keyOf(best.chainId, best.baseToken.address),
    chain: best.chainId,
    address: best.baseToken.address,
    name: text(best.baseToken?.name || best.baseToken?.symbol || "Unknown"),
    symbol: text(best.baseToken?.symbol, 24),
    logo: https(list.map((pair) => pair.info?.imageUrl).find(Boolean)),
    dex: text(best.dexId, 24) || null,
    pool: best.pairAddress || null,
    pools: list.map((pair) => pair.pairAddress).filter(Boolean).slice(0, 6),
    pairs: list.length,
    liquidity: sum(list.map((pair) => money(pair.liquidity?.usd))),
    marketCap: money(best.marketCap),
    fdv: money(best.fdv),
    priceUsd: money(best.priceUsd),
    volume5m: sum(list.map((pair) => money(pair.volume?.m5))),
    volume1h: sum(list.map((pair) => money(pair.volume?.h1))),
    volume24h: sum(list.map((pair) => money(pair.volume?.h24))),
    change5m: signed(best.priceChange?.m5),
    change1h: signed(best.priceChange?.h1),
    change24h: signed(best.priceChange?.h24),
    buys1h: sum(list.map((pair) => count(pair.txns?.h1?.buys))),
    sells1h: sum(list.map((pair) => count(pair.txns?.h1?.sells))),
    pairCreatedAt: created.length ? Math.min(...created) : null,
    links: info ? (info.websites?.length || 0) + (info.socials?.length || 0) : null,
  };
}
// Kept for callers that have a single pair.
export const fromDexPair = (pair) => fromDexPairs([pair]);

// Metrics from a GeckoTerminal new pool, used when Dexscreener has not indexed the token yet.
export function fromGeckoPool(pool, token, chain) {
  const a = pool.attributes || {};
  const address = token?.attributes?.address || String(pool.relationships?.base_token?.data?.id || "").replace(/^[^_]+_/, "");
  return {
    id: keyOf(chain, address),
    chain,
    address,
    name: text(token?.attributes?.name || String(a.name || "").split(" / ")[0] || "Unknown"),
    symbol: text(token?.attributes?.symbol, 24),
    logo: https(token?.attributes?.image_url),
    dex: text(pool.relationships?.dex?.data?.id, 24) || null,
    pool: a.address || null,
    pairs: 1,
    liquidity: money(a.reserve_in_usd),
    marketCap: money(a.market_cap_usd),
    fdv: money(a.fdv_usd),
    priceUsd: money(a.base_token_price_usd),
    volume5m: money(a.volume_usd?.m5),
    volume1h: money(a.volume_usd?.h1),
    volume24h: money(a.volume_usd?.h24),
    change5m: signed(a.price_change_percentage?.m5),
    change1h: signed(a.price_change_percentage?.h1),
    change24h: signed(a.price_change_percentage?.h24),
    buys1h: count(a.transactions?.h1?.buys),
    sells1h: count(a.transactions?.h1?.sells),
    buyers1h: count(a.transactions?.h1?.buyers),
    pairCreatedAt: Date.parse(a.pool_created_at || "") || null,
    links: null,
  };
}

// Fill gaps in the Dexscreener reading from the GeckoTerminal one, never the other way round.
function combine(primary, fallback) {
  if (!fallback) return primary;
  if (!primary) return fallback;
  const out = { ...primary };
  for (const [key, value] of Object.entries(fallback)) if (out[key] == null || out[key] === "") out[key] = value;
  // The older of the two sightings is when trading began.
  if (primary.pairCreatedAt && fallback.pairCreatedAt) out.pairCreatedAt = Math.min(primary.pairCreatedAt, fallback.pairCreatedAt);
  return out;
}

const stageOf = (dex) => (/^pump-?fun$|^moonshot$|^launchlab$|^bonk|^believe/i.test(dex || "") ? "curve" : "dex");

function base(metrics, origins, previous, now) {
  return {
    ...metrics,
    stage: stageOf(metrics.dex),
    url: `https://dexscreener.com/${metrics.chain}/${metrics.address}`,
    origins: [...new Set([...(previous?.origins || []), ...origins])].slice(0, 4),
    safety: previous?.safety || null,
    firstSeenAt: previous?.firstSeenAt || new Date(now).toISOString(),
    updatedAt: new Date(now).toISOString(),
  };
}

// Adds flags, risk, reason, steps and momentum to every coin. Ticker clashes are counted across the whole feed.
export function assessAll(coins, now = Date.now()) {
  const symbolCounts = new Map();
  for (const coin of coins) {
    const symbol = String(coin.symbol || "").toLowerCase().replace(/^\$/, "").replace(/[^a-z0-9]/g, "");
    if (symbol) symbolCounts.set(symbol, (symbolCounts.get(symbol) || 0) + 1);
  }
  // The last scan's momentum is kept so a sudden jump can be spotted.
  return coins.map((coin) => ({ ...coin, momentumPrev: coin.momentum ?? null, ...assess(coin, { now, symbolCounts }) }));
}

// Newest first, nothing older than a day, and a hard cap so the stored item stays well under DynamoDB's 400 KB.
// New pools arrive far faster than the cap allows for a whole day, so once the newest ones are in,
// the remaining room goes to coins that aren't high risk. Those are the ones most scanners keep.
const FEED_ALWAYS_NEWEST = 60;
export function mergeFeed(coins, now = Date.now()) {
  const sorted = coins
    .filter((coin) => now - Date.parse(coin.firstSeenAt) <= FEED_MAX_AGE_MS)
    .sort((a, b) => Date.parse(b.firstSeenAt) - Date.parse(a.firstSeenAt) || (b.pairCreatedAt || 0) - (a.pairCreatedAt || 0));
  if (sorted.length <= FEED_MAX_COINS) return sorted;
  const newest = sorted.slice(0, FEED_ALWAYS_NEWEST);
  const rest = sorted.slice(FEED_ALWAYS_NEWEST);
  const room = FEED_MAX_COINS - newest.length;
  const keep = new Set([...rest.filter((coin) => coin.risk !== "high"), ...rest.filter((coin) => coin.risk === "high")].slice(0, room));
  return [...newest, ...rest.filter((coin) => keep.has(coin))];
}

async function settle(label, task, sources) {
  try {
    const value = await task;
    sources[label] = "ok";
    return value;
  } catch {
    sources[label] = "error";
    return null;
  }
}

// All Dexscreener pairs for the given token ids, grouped per token.
async function dexPairs(fetchJson, entries, sources, label = "pairs") {
  const grouped = new Map();
  for (const chain of CHAINS) {
    const addresses = entries.filter((entry) => entry.chain === chain).map((entry) => entry.address);
    const batches = [];
    for (let i = 0; i < addresses.length; i += DEX_BATCH) batches.push(addresses.slice(i, i + DEX_BATCH));
    const results = await Promise.all(batches.map((batch, i) => settle(`${label}-${chain}-${i}`, fetchJson(`https://api.dexscreener.com/tokens/v1/${chain}/${batch.join(",")}`), sources)));
    for (const pairs of results) {
      for (const pair of Array.isArray(pairs) ? pairs : []) {
        if (pair?.chainId !== chain || !pair.baseToken?.address) continue;
        const id = keyOf(chain, pair.baseToken.address);
        if (!grouped.has(id)) grouped.set(id, []);
        grouped.get(id).push(pair);
      }
    }
  }
  return grouped;
}

// Prices specific coins on demand (Scan a coin, and the Watching list) with the same reading the scan uses.
// Returns one entry per request, with `found: false` when no market has the token yet.
export async function lookupCoins({ fetchJson, postJson, rpcUrl, coins, now = Date.now(), safetyBudget = { rugcheck: 3, goplus: 3, holders: 3 } }) {
  const wanted = [];
  for (const item of coins || []) {
    const address = String(item?.address || "").trim();
    const chain = CHAINS.includes(item?.chain) ? item.chain : networkOf(address);
    if (!chain || networkOf(address) !== chain) continue;
    const id = keyOf(chain, address);
    if (!wanted.some((entry) => entry.id === id)) wanted.push({ id, chain, address });
  }
  const grouped = await dexPairs(fetchJson, wanted, {}, "lookup");
  // Brand-new tokens Dexscreener hasn't indexed yet: one GeckoTerminal call each, for a handful at most.
  const missing = wanted.filter((entry) => !grouped.has(entry.id)).slice(0, 5);
  const gecko = new Map();
  await Promise.all(missing.map(async (entry) => {
    const body = await fetchJson(`https://api.geckoterminal.com/api/v2/networks/${geckoNetwork[entry.chain]}/tokens/${entry.address}/pools?page=1&include=base_token`).catch(() => null);
    const tokens = new Map((body?.included || []).filter((item) => item.type === "token").map((item) => [item.id, item]));
    const pool = (body?.data || []).find((item) => String(item.relationships?.base_token?.data?.id || "").toLowerCase().endsWith(entry.address.toLowerCase()));
    if (pool) gecko.set(entry.id, fromGeckoPool(pool, tokens.get(pool.relationships.base_token.data.id), entry.chain));
  }));
  const found = [];
  const out = wanted.map((entry) => {
    const metrics = combine(fromDexPairs(grouped.get(entry.id)), gecko.get(entry.id));
    if (!metrics) return { id: entry.id, chain: entry.chain, address: entry.address, found: false };
    const coin = { ...base(metrics, ["lookup"], null, now), marketRisk: marketRisk(metrics) };
    found.push(coin);
    return coin;
  });
  // A coin someone asked about gets its contract checked straight away, within a small budget.
  const { results } = await checkSafety({ fetchJson, postJson, rpcUrl, coins: found, now, budget: safetyBudget });
  return assessAll(out.map((coin) => (results.has(coin.id) ? { ...coin, safety: results.get(coin.id) } : coin)), now)
    .map((coin) => (coin.found === false ? coin : { ...coin, found: true }));
}

export async function runScan({ fetchJson, postJson, rpcUrl, previous = null, now = Date.now(), safetyBudget }) {
  const startedAt = now;
  const sources = {};
  const before = new Map((previous?.coins || []).map((coin) => [coin.id, coin]));
  const candidates = new Map();
  const add = (chain, address, origin, gecko = null) => {
    if (!CHAINS.includes(chain) || !address) return;
    const id = keyOf(chain, address);
    if (quoteTokens.has(id)) return;
    const entry = candidates.get(id) || { id, chain, address, origins: new Set(), gecko: null };
    entry.origins.add(origin);
    if (gecko) entry.gecko = gecko;
    candidates.set(id, entry);
  };

  const [profiles, boosts, ...pools] = await Promise.all([
    settle("profiles", fetchJson("https://api.dexscreener.com/token-profiles/latest/v1"), sources),
    settle("boosts", fetchJson("https://api.dexscreener.com/token-boosts/latest/v1"), sources),
    ...CHAINS.map((chain) => settle(`pools-${chain}`, fetchJson(`https://api.geckoterminal.com/api/v2/networks/${geckoNetwork[chain]}/new_pools?page=1&include=base_token`), sources)),
  ]);
  const icons = new Map();
  for (const item of Array.isArray(profiles) ? profiles : []) {
    add(item.chainId, item.tokenAddress, "profile");
    if (item.icon) icons.set(keyOf(item.chainId, item.tokenAddress), https(item.icon));
  }
  for (const item of Array.isArray(boosts) ? boosts : []) {
    add(item.chainId, item.tokenAddress, "boost");
    if (item.icon && !icons.has(keyOf(item.chainId, item.tokenAddress))) icons.set(keyOf(item.chainId, item.tokenAddress), https(item.icon));
  }
  CHAINS.forEach((chain, index) => {
    const body = pools[index];
    const tokens = new Map((body?.included || []).filter((item) => item.type === "token").map((item) => [item.id, item]));
    for (const pool of body?.data || []) {
      const metrics = fromGeckoPool(pool, tokens.get(pool.relationships?.base_token?.data?.id), chain);
      add(chain, metrics.address, "new-pool", metrics);
    }
  });

  // Keep prices current for coins already in the feed, newest first.
  const refresh = mergeFeed([...before.values()], now).slice(0, REFRESH_LIMIT);
  for (const coin of refresh) if (!candidates.has(coin.id)) add(coin.chain, coin.address, "refresh");

  const grouped = await dexPairs(fetchJson, [...candidates.values()], sources);
  const fresh = [];
  for (const [id, entry] of candidates) {
    let metrics = combine(fromDexPairs(grouped.get(id)), entry.gecko);
    const prev = before.get(id);
    if (!metrics && prev) metrics = prev; // a coin that could not be re-priced keeps its last reading
    if (!metrics?.address) continue;
    if (!metrics.logo) metrics.logo = icons.get(id) || prev?.logo || null;
    const origins = [...entry.origins].filter((origin) => origin !== "refresh");
    fresh.push({ ...base(metrics, origins, prev, now), marketRisk: marketRisk(metrics) });
  }
  const freshIds = new Set(fresh.map((coin) => coin.id));
  let coins = mergeFeed([...fresh, ...[...before.values()].filter((coin) => !freshIds.has(coin.id))], now);

  // Contract safety for the most promising coins that haven't been checked (or whose check is stale).
  const safety = await checkSafety({ fetchJson, postJson, rpcUrl, coins, now, budget: safetyBudget });
  coins = coins.map((coin) => (safety.results.has(coin.id) ? { ...coin, safety: safety.results.get(coin.id) } : coin));

  // Launchpad progress for coins still on a pump.fun curve, read from the chain every scan.
  const onCurve = coins.filter((coin) => coin.chain === "solana" && coin.stage === "curve" && /^pump-?fun$/i.test(coin.dex || "") && coin.pool);
  if (postJson && onCurve.length) {
    try {
      const curves = await readCurves(rpcClient(postJson, rpcUrl || PUBLIC_RPC), onCurve.map((coin) => coin.pool));
      coins = coins.map((coin) => (curves.has(coin.pool) ? { ...coin, curve: { ...curves.get(coin.pool), at: new Date(now).toISOString() } } : coin));
      sources.curves = "ok";
    } catch {
      sources.curves = "error";
    }
  }
  coins = mergeFeed(assessAll(coins, now), now);

  const newIds = previous ? coins.filter((coin) => !before.has(coin.id)).map((coin) => coin.id) : [];
  const scanned = fresh.filter((coin) => [...(candidates.get(coin.id)?.origins || [])].some((origin) => origin !== "refresh")).length;
  const checkedCoins = coins.filter((coin) => coin.safety && !coin.safety.failedAt).length;
  const onChain = coins.filter((coin) => coin.safety?.chainAt).length;
  return {
    id: "latest",
    version: ASSESSMENT_VERSION,
    updatedAt: new Date(now).toISOString(),
    coins,
    run: {
      startedAt: new Date(startedAt).toISOString(),
      durationMs: Math.max(0, Date.now() - startedAt),
      every: 60,
      scanned,
      refreshed: fresh.length - scanned,
      checked: fresh.length,
      newCount: newIds.length,
      newIds: newIds.slice(0, 40),
      safety: { ...safety.stats, covered: checkedCoins, onChain, total: coins.length, holders: rpcUrl ? "provider" : "off" },
      sources: {
        projects: Object.entries(sources).some(([key, value]) => key !== "boosts" && value === "ok") ? "ok" : "error",
        posts: "not-connected",
        detail: sources,
      },
    },
  };
}
