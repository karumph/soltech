// "How the scanner works": a plain explanation of the shared scan, the checks and the numbers behind them.
// Reached from the Scanner page only (#how). Keep the numbers here in step with soltech-api/assess.mjs and safety.mjs.

const back='<a class="back-link" href="#scanner"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 12H5m6-6-6 6 6 6"/></svg> Scanner</a>';
const row=(label,text)=>`<tr><th scope="row">${label}</th><td>${text}</td></tr>`;

export function mountHowItWorks(root){
 document.title='How the scanner works · Soltech';
 root.innerHTML=`<article class="personal-page page-width how-page">${back}
 <div class="page-intro"><h1>How the scanner works<span class="accent">.</span></h1></div>
 <p class="how-lede">One scan runs on Soltech’s server every minute, all day, whether or not anyone has the site open. Everyone sees the same scan. Your own filters then decide which of those coins reach your finds.</p>
 <ol class="how-steps" aria-label="The scan, step by step">
  <li><strong>Find new coins</strong><span>Dexscreener’s newest token profiles and paid boosts, and GeckoTerminal’s newest pools on Solana and Base.</span></li>
  <li><strong>Price them</strong><span>Every pool for each coin, from Dexscreener. GeckoTerminal fills in coins too new for Dexscreener.</span></li>
  <li><strong>Check them</strong><span>Liquidity, market cap, age and the contract, plus patterns that often mean trouble.</span></li>
  <li><strong>Apply your filters</strong><span>In your browser, against the latest scan. What passes is in your finds.</span></li>
 </ol>

 <section><h2>Where coins come from</h2>
  <p>Each scan reads three free sources: Dexscreener’s latest token profiles (projects that set up a page), Dexscreener’s latest boosts (paid promotion, so those coins carry a “Paid boost” note), and GeckoTerminal’s newest pools on Solana and Base. Posts on X are planned as a fourth source and aren’t connected yet.</p>
  <p>A coin stays in the scan for up to a day. The scan keeps at most 150 coins: the newest 60 always stay, and when it’s full, older high-risk coins make room first.</p>
 </section>

 <section><h2>How coins are priced</h2>
  <p>Every minute the scan re-prices the newest 120 coins it’s tracking, plus everything new. Liquidity, volume and trade counts are added up across all of a coin’s pools. Price and market cap come from its deepest pool. A coin’s age is taken from its oldest pool, which is when trading really started, even if it later moved to a new pool (for example after leaving pump.fun).</p>
 </section>

 <section><h2>The four checks</h2>
  <p>These are the four ticks you see under Coin checks on the Scanner.</p>
  <div class="how-table-wrap"><table class="how-table"><tbody>
   ${row('Liquidity','Under $8,000 is <em>thin</em>: a small sell moves the price a lot (serious). Under $20,000 is <em>low</em> (warning).')}
   ${row('Market cap','Under $30,000 with low liquidity is <em>tiny</em> (serious). For a coin under a week old, a cap of $1 million or more that’s at least 200 times its liquidity isn’t realistic (serious); 60 times on a cap over $500,000 is a warning. This catches coins faking a huge value.')}
   ${row('Age','Trading for under 3 hours is a warning. Early trading is the whole history.')}
   ${row('Safety','The token’s contract. Solana coins are read straight from the blockchain; Base coins are checked by GoPlus. See below.')}
  </tbody></table></div>
 </section>

 <section><h2>Contract safety</h2>
  <p>A contract check looks at what the token’s creator can still do and how the supply is held. Serious findings include: the creator can still mint more tokens or freeze holders’ tokens, someone can change balances, selling is blocked (a honeypot) or taxed 10% or more, the owner is hidden, the creator has launched rugged tokens before, or one wallet holds a large share. Warnings include unlocked liquidity, the top 10 wallets holding most of the supply, a changeable tax, paused or blocked transfers, and unverified code.</p>
  <p><strong>Solana:</strong> every coin is read straight from the blockchain each scan: whether anyone can still mint or freeze it, and newer token features that let someone charge transfer fees, run code on every transfer, move or burn holders’ tokens, or pause trading. This needs no outside service, so every coin is covered within a minute and re-read every 30 minutes. Rugcheck then adds what the blockchain can’t tell us quickly (the creator’s history and whether liquidity is locked) for the 10 most promising coins each minute.</p>
  <p><strong>Base:</strong> GoPlus checks up to 8 coins a minute, most promising first, including a simulated sale to catch honeypots.</p>
  <p>A coin can only be rated lower risk once it has had both kinds of check. Until its contract has been read, its safety tick shows a dash.</p>
 </section>

 <section><h2>Patterns that often mean trouble</h2>
  <ul class="how-list">
   <li><strong>Copycat names.</strong> A coin under a week old using the name or ticker of an established coin (Bitcoin, SOL, Bonk and others) is almost always a copy (serious).</li>
   <li><strong>Shared tickers.</strong> When three or more new coins use the same ticker, each gets a warning.</li>
   <li><strong>Selling pressure.</strong> At least 30 trades in the last hour, with three times as many sells as buys (warning).</li>
   <li><strong>Price drops.</strong> Down 35% in the last hour is a warning; down 60% is serious.</li>
   <li><strong>No links.</strong> No website or socials listed (a note, not a warning).</li>
  </ul>
 </section>

 <section><h2>Risk levels</h2>
  <div class="how-table-wrap"><table class="how-table"><tbody>
   ${row('<span class="risk high"><span class="risk-dot" aria-hidden="true"></span>High risk</span>','At least one serious finding.')}
   ${row('<span class="risk caution"><span class="risk-dot" aria-hidden="true"></span>Caution</span>','At least one warning, or the contract hasn’t been checked yet.')}
   ${row('<span class="risk lower"><span class="risk-dot" aria-hidden="true"></span>Lower risk</span>','Checked, with no warnings. It is not a safety guarantee.')}
   ${row('<span class="risk unknown"><span class="risk-dot" aria-hidden="true"></span>Not assessed</span>','No market size or liquidity was reported.')}
  </tbody></table></div>
  <p>Missing information is never treated as a pass.</p>
 </section>

 <section><h2>Momentum</h2>
  <p>A score from 0 to 100 for how much real trading is happening right now. It weighs the number of trades in the last hour (30%), the hour’s volume compared with liquidity (25%), the share of trades that are buys (20%), whether the last five minutes are busier than the hour’s average (15%) and the hour’s price direction (10%). High momentum means activity, not quality.</p>
 </section>

 <section><h2>Your filters</h2>
  <p>Customize sets which risk levels you want, how new a coin must be, its networks, its market cap, liquidity and volume, safety rules (can’t be minted, can’t be frozen, no copycats) and a minimum momentum. Filters run in your browser against the shared scan, so the server never learns what you’re looking for. A coin is in your finds only if it passes every filter. If a filter needs information the scan doesn’t have yet, the coin doesn’t pass.</p>
 </section>

 <section><h2>The Scanner animation</h2>
  <p>The scan itself takes a few seconds, too fast to watch. The Scanner page replays its results, one coin about every eight seconds: where the coin came from, its pool, the four checks, and whether your filters kept it. Coins that arrive while you’re watching go first. The bar at the bottom counts down to the next real scan. Paste an address into <em>Scan a coin</em> to send any Solana or Base coin through the same checks.</p>
 </section>

 <section><h2>Limits</h2>
  <p>Soltech reads public market and contract data from Dexscreener, GeckoTerminal, Rugcheck and GoPlus. That data can be late, incomplete or wrong. The checks look for known warning signs; they can’t prove a coin is safe. Nothing here is financial advice.</p>
 </section>
 <p class="how-back">${back}</p>
 </article>`;
 return ()=>{};
}
