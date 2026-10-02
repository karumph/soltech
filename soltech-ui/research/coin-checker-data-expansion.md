# Richer coin-checker data · September 26, 2026

The goal is a clearer, more useful Soltech report, using the supplied Phanes message as a reference rather than reproducing its presentation or historical numbers.

## Connected now

The existing DEX Screener and Rugcheck integration now includes activity by period, project links, supply, reported holder accounts, pool-aware concentration, and independent paid-profile status. See the implementation review for exact meanings.

GeckoTerminal's public API also returned real hourly OHLCV for the supplied CopiumCat pool without an API key. Soltech uses the same pool selected for market statistics and explicitly requests the queried token. The highest candle value is labeled **Highest observed price**, with the returned period shown. It is neither a token-wide all-time high nor a market-cap peak. The line uses hourly closing prices and leaves gaps unconnected. The query is bounded to 1,000 hourly candles; missing, malformed, mismatched or failed data stays unavailable. [GeckoTerminal FAQ](https://apiguide.geckoterminal.com/faq), [OHLCV reference](https://docs.coingecko.com/reference/pool-ohlcv-contract-address).

## Best next candidate: Codex Data

This is the separate crypto data company at codex.io, not the OpenAI app. Its schema includes fresh-wallet swap fields, provider ATH price and market-cap variants. Candidate fields are `swapPct1dOldWallet`, `swapPct7dOldWallet`, `athPrice`, `athPriceTimestamp`, `athFdv`, `athFdvTimestamp`, `athCircMc`, and `athCircMcTimestamp`. [Official schema](https://docs.codex.io/api-reference/types/tokenfilterresult).

Do not ship fresh-wallet percentages until an authenticated response and provider definitions establish percentage scale, denominator, reporting window and wallet-age convention. These values describe activity, not automatically a share of holders. Do not substitute FDV highs for circulating-market-cap highs.

The documented entry plan has a one-time non-refundable $1 activation fee, no monthly charge, 10,000 requests per month, and five requests per second. An account and API key are required. No account was created, payment made or provider contacted. No API key is configured in this project. [Account setup](https://docs.codex.io/get-started), [Pricing](https://www.codex.io/pricing).

Recommended integration after access is supplied: keep the key on a server, query the exact Solana mint, validate identity and nullable metrics, test units/coverage on several assets, and then add the verified fields. Never embed a secret API key in the browser or a distributable source archive. Validate whether entry-plan access includes each requested field before treating pricing as sufficient for production.

## Other sources

Phanes explicitly says it does not offer an API and does not support automated bot queries. Its “Fresh” definition concerns trades by young wallets, so copying that percentage into a holders section would change its meaning. Its FAQ also notes that recorded highs can be distorted. [FAQ](https://phanes.bot/docs/overview/faq), [Commands](https://phanes.bot/docs/phanes/commands).

Birdeye offers authenticated history and first-funding/holder analytics, but assembling an equivalent fresh-wallet metric would require additional work. Its Lite tier is listed at $39/month. It is an alternative to evaluate if Codex Data coverage does not fit, rather than an automatic subscription. [First funding](https://data.birdeye.so/docs/data-api/wallet-networth-pnl/post-wallet-v2-tx-first-funded), [Pricing](https://docs.birdeye.so/docs/pricing).

Remaining access dependency: verified token-wide provider ATH and fresh-wallet percentages. Social-account age, circulating supply and other coverage gaps are not inferred from unrelated dates or totals.


## Multi-network checker and chart controls

The checker now supports Solana, Ethereum, Base, BNB Chain, Polygon, Arbitrum, Avalanche and Optimism. EVM addresses require a network choice: DEX Screener’s broad token discovery can omit matching networks when results are capped. Identity is chain plus contract; token addresses and pool identifiers use separate validation. The selected pool can have a v4 ID or composite Curve identifier. Unsupported pool history stays unavailable without discarding its market data. [DEX Screener API](https://docs.dexscreener.com/api/reference), [GeckoTerminal network list](https://api.geckoterminal.com/api/v2/networks?page=1).

GoPlus supplies EVM contract findings through its public token-security endpoint. Fields missing from its response remain unknown; mintability, proxy and ownership controls are cautions, not proof of fraud. Honeypot findings are shown as high concern. Soltech’s color grouping is a presentation rule, not a GoPlus score. Taxes retain the provider’s fractional units and are displayed without invented cutoffs. [GoPlus request](https://docs.gopluslabs.io/reference/tokensecurityusingget_1), [response definitions](https://docs.gopluslabs.io/reference/response-details), [access limits](https://docs.gopluslabs.io/reference/support).

The chart offers Price and Market cap (est.). The latter multiplies hourly closing prices by current market cap / current price. It is visibly labeled as an estimate, unavailable without both current inputs, and explained in chart details. It is not a recorded historical market-cap series; supply changes can invalidate that approximation. OHLCV does not supply historical market cap. [OHLCV documentation](https://docs.coingecko.com/demo/reference/pool-ohlcv-contract-address).
