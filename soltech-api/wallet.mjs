// Wallet check: every token in a Solana wallet, run through the same checks as the scanner.
// Read-only: the wallet address is all it needs. No connection, keys or signatures.
import { lookupCoins, networkOf } from "./scan.mjs";
import { rpcClient, PUBLIC_RPC } from "./onchain.mjs";

export const WALLET_LIMIT = 150;
const PROGRAMS = ["TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA", "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb"];
const DANGER = ["mintable", "freezable", "permanentDelegate", "balanceMutable", "honeypot", "nonTransferable", "defaultFrozen", "transferFee"];

export async function checkWallet({ fetchJson, postJson, rpcUrl, address, now = Date.now() }) {
  const wallet = String(address || "").trim();
  const chain = networkOf(wallet);
  if (chain !== "solana") return { address: wallet, chain, supported: false };
  const rpc = rpcClient(postJson, rpcUrl || PUBLIC_RPC);
  const [sol, ...lists] = await Promise.all([
    rpc("getBalance", [wallet, { commitment: "confirmed" }]),
    ...PROGRAMS.map((programId) => rpc("getTokenAccountsByOwner", [wallet, { programId }, { encoding: "jsonParsed", commitment: "confirmed" }])),
  ]);
  // One line per token, adding up multiple accounts for the same token.
  const amounts = new Map();
  for (const list of lists) {
    for (const item of list?.value || []) {
      const info = item.account?.data?.parsed?.info;
      const amount = Number(info?.tokenAmount?.uiAmount);
      if (!info?.mint || !(amount > 0)) continue;
      amounts.set(info.mint, (amounts.get(info.mint) || 0) + amount);
    }
  }
  const mints = [...amounts.keys()];
  const looked = mints.length
    ? await lookupCoins({ fetchJson, postJson, rpcUrl, now, coins: mints.slice(0, WALLET_LIMIT).map((mint) => ({ chain: "solana", address: mint })), safetyBudget: { rugcheck: 3, goplus: 0, holders: 0 } })
    : [];
  const holdings = looked.map((coin) => {
    const amount = amounts.get(coin.address) || 0;
    const valueUsd = coin.priceUsd ? amount * coin.priceUsd : null;
    return { ...coin, amount, valueUsd };
  }).sort((a, b) => (b.valueUsd ?? -1) - (a.valueUsd ?? -1) || (b.found === true) - (a.found === true));
  const priced = holdings.filter((h) => h.valueUsd != null);
  const count = (risk) => holdings.filter((h) => h.found && h.risk === risk).length;
  const flagged = Object.fromEntries(DANGER.map((key) => [key, holdings.filter((h) => (h.flags || []).some((f) => f.key === key && f.level === "danger")).length]).filter(([, n]) => n));
  return {
    address: wallet,
    chain,
    supported: true,
    checkedAt: new Date(now).toISOString(),
    sol: Number(sol?.value || 0) / 1e9,
    tokens: mints.length,
    shown: holdings.length,
    noMarket: holdings.filter((h) => !h.found).length,
    totalValue: priced.reduce((sum, h) => sum + h.valueUsd, 0),
    risk: { high: count("high"), caution: count("caution"), lower: count("lower"), unknown: count("unknown") },
    flagged,
    holdings,
  };
}
