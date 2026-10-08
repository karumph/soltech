// Turns one coin's market reading, contract safety and context into flags, a risk level, the four Scanner checks
// and a momentum score. Every flag says what was seen in plain words. Missing data is never treated as safe.

const HOUR = 60 * 60 * 1000;
const usd = (n) => (n >= 1e9 ? `$${(n / 1e9).toFixed(1)}B` : n >= 1e6 ? `$${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `$${Math.round(n / 1e3)}K` : `$${Math.round(n)}`);
const ageText = (ms) => {
  const m = Math.max(1, Math.round(ms / 60000));
  if (m < 90) return `${m} min`;
  const h = Math.round(m / 60);
  return h < 48 ? `${h} hours` : `${Math.round(h / 24)} days`;
};
const flag = (key, level, text) => ({ key, level, text });
const rank = { danger: 3, warn: 2, info: 1 };

// Names and tickers of large, established coins. A brand-new token using one is almost always a copy.
const majors = new Set([
  "btc", "bitcoin", "wbtc", "eth", "ethereum", "weth", "sol", "solana", "wsol", "usdc", "usdt", "tether", "bnb", "xrp", "ripple",
  "doge", "dogecoin", "ltc", "litecoin", "ada", "cardano", "trx", "tron", "ton", "toncoin", "avax", "dot", "polkadot", "link",
  "chainlink", "shib", "matic", "pol", "dai", "bch", "xlm", "sui", "apt", "hype", "pepe", "bonk", "wif", "jup", "pengu", "trump",
]);
const norm = (value) => String(value || "").toLowerCase().replace(/^\$/, "").replace(/[^a-z0-9]/g, "");

// A coin that has traded for over a month and is valued at $50M or more. Its DEX liquidity can look small because
// much of its trading sits in pools where it's the second token, and it has nothing to prove about its creator.
export const isEstablished = (coin, now = Date.now()) => !!coin.pairCreatedAt && now - coin.pairCreatedAt > 30 * 24 * HOUR && (coin.marketCap || coin.fdv || 0) >= 5e7;

// Market-only risk, before contract checks. Kept separately so the safety queue can skip coins already ruled out.
export function marketRisk(coin) {
  const cap = coin.marketCap ?? coin.fdv;
  const liq = coin.liquidity;
  if (cap == null && liq == null) return "unknown";
  if ((liq != null && liq < 8000) || (cap != null && cap < 30000 && (liq == null || liq < 20000))) return "high";
  return "ok";
}

export function marketFlags(coin, { now = Date.now(), symbolCounts = new Map() } = {}) {
  const flags = [];
  const cap = coin.marketCap ?? coin.fdv;
  const liq = coin.liquidity;
  const age = coin.pairCreatedAt ? now - coin.pairCreatedAt : null;
  if (cap == null && liq == null) flags.push(flag("noMarket", "warn", "Market size and liquidity were not reported"));
  const established = isEstablished(coin, now);
  if (established && liq != null && liq < 20000) flags.push(flag("lowLiquidity", "info", "Most of this coin's trading is in pools this check doesn't count"));
  else if (liq != null && liq < 8000) flags.push(flag("thinLiquidity", "danger", `Liquidity is only about ${usd(liq)}, so a small sell moves the price`));
  else if (liq != null && liq < 20000) flags.push(flag("lowLiquidity", "warn", `Liquidity is about ${usd(liq)}; a larger order would move the price`));
  if (cap != null && cap < 30000 && (liq == null || liq < 20000)) flags.push(flag("tinyCap", "danger", `Market cap is only about ${usd(cap)}`));
  // A big cap on little liquidity usually means an unrealistic price or supply, often a fake of a known coin.
  // New coins only: established coins often trade most of their volume off-DEX, so their DEX liquidity looks small.
  const isNew = age == null || age < 7 * 24 * HOUR;
  if (isNew && cap != null && liq != null && cap >= 1e6 && cap / liq >= 200) flags.push(flag("inflatedCap", "danger", `A ${usd(cap)} market cap on ${usd(liq)} of liquidity isn't realistic`));
  else if (isNew && cap != null && liq != null && cap >= 5e5 && cap / liq >= 60) flags.push(flag("inflatedCap", "warn", `The ${usd(cap)} market cap is high for ${usd(liq)} of liquidity`));
  if (age != null && age < 3 * HOUR) flags.push(flag("young", "warn", `Trading started only ${ageText(age)} ago`));
  const name = norm(coin.name), symbol = norm(coin.symbol);
  // Only new coins: the real Bonk or Jupiter is years old, a copy is days old at most.
  if ((majors.has(symbol) || majors.has(name)) && (age == null || age < 7 * 24 * HOUR)) flags.push(flag("knownName", "danger", `Uses the name of an established coin (${coin.symbol || coin.name}), a common sign of a copy`));
  const twins = symbol ? (symbolCounts.get(symbol) || 1) - 1 : 0;
  if (twins >= 2) flags.push(flag("sameTicker", "warn", `${twins} other new coins use the ticker ${coin.symbol}`));
  else if (twins === 1) flags.push(flag("sameTicker", "info", `Another new coin uses the ticker ${coin.symbol}`));
  const buys = coin.buys1h, sells = coin.sells1h;
  if (buys != null && sells != null && buys + sells >= 30 && sells >= 3 * Math.max(1, buys)) flags.push(flag("selling", "warn", `Mostly selling in the last hour (${sells} sells, ${buys} buys)`));
  if (coin.change1h != null && coin.change1h <= -60) flags.push(flag("crash", "danger", `Price fell ${Math.round(-coin.change1h)}% in the last hour`));
  else if (coin.change1h != null && coin.change1h <= -35) flags.push(flag("drop", "warn", `Price fell ${Math.round(-coin.change1h)}% in the last hour`));
  if (coin.links === 0) flags.push(flag("noLinks", "info", "No website or social links are listed"));
  if (coin.origins?.includes("boost")) flags.push(flag("boosted", "info", "Promoted with a paid Dexscreener boost"));
  return flags;
}

// 0 to 100: how much real trading is happening right now, relative to the coin's size. Not a quality score.
export function momentumScore(coin) {
  const liq = coin.liquidity || 0;
  const v1 = coin.volume1h || 0, v5 = coin.volume5m || 0;
  const trades = (coin.buys1h || 0) + (coin.sells1h || 0);
  if (!liq && !v1 && !trades) return null;
  const turnover = liq ? Math.min(1, v1 / liq / 3) : 0; // an hour's volume of 3x liquidity is the top of the scale
  const activity = Math.min(1, Math.log10(1 + trades) / 3); // about 1,000 trades an hour tops out
  const buyShare = trades ? (coin.buys1h || 0) / trades : 0.5;
  const pressure = Math.max(0, Math.min(1, (buyShare - 0.35) / 0.35)); // 70% buys or more scores fully
  const accel = v1 ? Math.min(1, (v5 * 12) / v1 / 2) : 0; // the last 5 minutes running at twice the hour's pace
  const trend = coin.change1h == null ? 0.5 : Math.max(0, Math.min(1, (coin.change1h + 20) / 120));
  return Math.round(100 * (0.3 * activity + 0.25 * turnover + 0.2 * pressure + 0.15 * accel + 0.1 * trend));
}

const worst = (flags) => flags.reduce((top, item) => (rank[item.level] > rank[top?.level] || !top ? item : top), null);
const stepFrom = (flags, keys, fallback) => {
  const hits = flags.filter((item) => keys.includes(item.key));
  const top = worst(hits);
  if (!top) return fallback;
  return { status: top.level === "danger" ? "fail" : top.level === "warn" ? "warn" : fallback.status, text: top.text };
};

export function assess(coin, { now = Date.now(), symbolCounts } = {}) {
  const market = marketFlags(coin, { now, symbolCounts });
  // Stablecoins, staked SOL and other established tokens keep mint and freeze control on purpose. On a coin that
  // is weeks old with deep liquidity, that's a note; on a new coin, it's the classic way to rug.
  const established = isEstablished(coin, now);
  const issuerNote = { mintable: "The issuer can mint more (normal for stablecoins and staked tokens)", freezable: "The issuer can freeze accounts (normal for stablecoins)" };
  const safety = (coin.safety?.flags || []).map((item) => (established && issuerNote[item.key] ? { ...item, level: "info", text: issuerNote[item.key] } : item));
  const flags = [...market, ...safety].filter((item, i, all) => all.findIndex((other) => other.key === item.key) === i)
    // Most severe first; "only just launched" is true of nearly every new coin, so it goes last within its level.
    .sort((a, b) => rank[b.level] - rank[a.level] || (a.key === "young") - (b.key === "young"));
  const cap = coin.marketCap ?? coin.fdv, liq = coin.liquidity;
  const age = coin.pairCreatedAt ? now - coin.pairCreatedAt : null;
  const s = coin.safety && !coin.safety.failedAt ? coin.safety : null;
  // Read at all (authorities from the chain, or a third-party report), and read fully: on Solana the chain read
  // alone doesn't cover who holds the supply or the creator's history, so "lower risk" also needs one of those.
  const checked = !!s;
  const fully = !!s && (!s.chainAt || !!s.rugcheckAt || !!s.holdersAt || established);
  const steps = [
    stepFrom(flags, ["thinLiquidity", "lowLiquidity"], liq == null ? { status: "unknown", text: "Liquidity not reported" } : { status: "pass", text: `Liquidity about ${usd(liq)}` }),
    stepFrom(flags, ["tinyCap", "inflatedCap"], cap == null ? { status: "unknown", text: "Market cap not reported" } : { status: "pass", text: `Market cap about ${usd(cap)}` }),
    stepFrom(flags, ["young"], age == null ? { status: "unknown", text: "Pair age not reported" } : { status: "pass", text: `Trading for ${ageText(age)}` }),
    stepFrom(safety.concat(flags.filter((item) => ["knownName"].includes(item.key))), safety.map((item) => item.key).concat("knownName"),
      checked ? { status: "pass", text: fully ? (safety.length ? "Contract checks found only minor notes" : "No contract risks found") : "Can't be minted or frozen; holders not checked yet" } : { status: "unknown", text: "Contract not checked yet" }),
  ].map((step, i) => ({ key: ["liquidity", "marketCap", "age", "safety"][i], ...step }));
  const top = worst(flags);
  let risk;
  if (flags.some((item) => item.level === "danger")) risk = "high";
  else if (cap == null && liq == null) risk = "unknown";
  else if (flags.some((item) => item.level === "warn")) risk = "caution";
  else risk = fully ? "lower" : "caution";
  const reason = risk === "lower"
    ? "No major concern showed up in the market and contract checks. That is not a safety guarantee."
    : top && top.level !== "info" ? `${top.text}.` : fully ? "Minor notes only." : checked ? "Contract authorities look clean; holders and creator history aren't checked yet." : "Market looks reasonable, but the contract hasn't been checked yet.";
  return { risk, reason, flags: flags.slice(0, 8), steps, momentum: momentumScore(coin), marketRisk: marketRisk(coin) };
}
