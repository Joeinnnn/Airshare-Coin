const fs = require("fs");
const path = require("path");
const puppeteer = require("puppeteer");
const { WebSocket } = require("ws");

// --------- CONFIG ---------
const COIN_URL = process.env.COIN_URL || "https://pump.fun/coin/3URG3KGWCf6TgqKFkQoGDVfLjkoNLdN4LEnZH7gqpump";
const REFRESH_MS = 2000; // poll every 2s
// --------------------------

const DATA_DIR = path.join(__dirname, "data");
const OUT_CAP = path.join(DATA_DIR, "marketcap.txt");
const OUT_TRADE = path.join(DATA_DIR, "trades.txt");
const OUT_TOP_BUYERS = path.join(DATA_DIR, "topbuyers.txt");
const OUT_COIN = path.join(DATA_DIR, "coin.txt");
const OUT_TXHASH = path.join(DATA_DIR, "txhash.txt");
const OUT_TOP_BUYERS_JSON = path.join(DATA_DIR, "topbuyers.json");
const OUT_AIRDROP_END = path.join(DATA_DIR, "airdrop_end.txt");
const OUT_AIRDROP_WIN_JSON = path.join(DATA_DIR, "airdrop_winners.json");
const OUT_AIRDROP_WIN_TXT = path.join(DATA_DIR, "airdrop_winners.txt");
const OUT_AIRDROP_NEXT_OVERRIDE = path.join(DATA_DIR, "airdrop_next_override_min.txt");

function asciiOnly(s) {
	return (s || "").normalize("NFKD").replace(/[^\x20-\x7E]/g, "").trim();
}

function shortenAddress(addr) {
	const s = String(addr || "");
	if (s.length <= 10) return s || "User";
	return `${s.slice(0, 4)}…${s.slice(-4)}`;
}

function sleep(ms) {
	return new Promise(resolve => setTimeout(resolve, ms));
}

(async () => {
	const browser = await puppeteer.launch({
		headless: true,
		args: ["--no-sandbox", "--disable-setuid-sandbox"]
	});
	const page = await browser.newPage();
	await page.setUserAgent(
		"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
	);

	try {
		await page.goto(COIN_URL, { waitUntil: "networkidle2", timeout: 60000 });
	} catch (e) {
		console.error("⚠️ First load warning:", e.message);
	}
	await sleep(4000);

	async function ensureTradesTab() {
		try {
			const [byText] = await page.$x("//*[contains(normalize-space(text()), 'Trades')]");
			if (byText) await byText.click();

			await page.evaluate(() => {
				const clickEl = (el) => { try { el.click(); } catch(_) {} };
				const candidates = Array.from(document.querySelectorAll("a,button,div,span"));
				const el = candidates.find(n => /\bTrades\b/i.test((n.textContent || "").trim()));
				if (el) clickEl(el);
			});

			await sleep(50);
			await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
			await sleep(300);
			await page.evaluate(() => window.scrollTo(0, 0));
		} catch (_) {}
	}
	await ensureTradesTab();

	if (!fs.existsSync(OUT_CAP)) fs.writeFileSync(OUT_CAP, "Market Cap: N/A");
	if (!fs.existsSync(OUT_TRADE)) fs.writeFileSync(OUT_TRADE, "Waiting for trades...");
	if (!fs.existsSync(OUT_TOP_BUYERS)) fs.writeFileSync(OUT_TOP_BUYERS, "No buyers yet...");
	if (!fs.existsSync(OUT_TXHASH)) fs.writeFileSync(OUT_TXHASH, "No transactions yet...");
  if (!fs.existsSync(OUT_TOP_BUYERS_JSON)) fs.writeFileSync(OUT_TOP_BUYERS_JSON, "[]");


  if (!fs.existsSync(OUT_AIRDROP_END)) {
    const envEnd = Number(process.env.AIRDROP_END_EPOCH_MS || 0);
    const durationMin = Number(process.env.AIRDROP_DURATION_MIN || 0);
    // Default 5 minutes if not configured
    const defaultDurationMs = 5 * 60_000;
    const chosenDurationMs = durationMin > 0 ? durationMin * 60_000 : defaultDurationMs;
    const endMs = envEnd > Date.now() ? envEnd : (Date.now() + chosenDurationMs);
    fs.writeFileSync(OUT_AIRDROP_END, String(endMs), "utf8");
  }
	// Derive mint/CA from URL (Pump.fun mints typically end with 'pump')
	const coinPathPart = (COIN_URL.split("/coin/")[1] || "").split(/[?#]/)[0];
	let coinMintWithSuffix = coinPathPart;
	let coinMintWithoutSuffix = coinMintWithSuffix.replace(/pump$/i, "");
	// We'll subscribe with the exact value from the URL, but match either form
	let coinAddress = coinMintWithSuffix;
	fs.writeFileSync(OUT_COIN, coinAddress, "utf8");

	let lastTradeLine = ""; // dedupe trades
  let lastTxHash = ""; // dedupe tx hash writes
  const buyerStats = new Map(); // displayName -> { count, totalSol }
  const addressStats = new Map(); // addr -> { name, count, totalSol }
  let winnersWritten = false;
  let lastSeenEndMs = 0; // track changes in end file
  let processedEndMs = 0; // which end timestamp we already processed

  function writeTopBuyersFiles() {
    const topArray = Array.from(addressStats.entries())
      .map(([addr, s]) => ({ address: addr, name: s.name, count: s.count, totalSol: s.totalSol }))
      .sort((a, b) => b.totalSol - a.totalSol)
      .slice(0, 50);
    try { fs.writeFileSync(OUT_TOP_BUYERS_JSON, JSON.stringify(topArray, null, 2), "utf8"); } catch (_) {}

    const topTxt = topArray
      .map((o, i) => `${i + 1}. ${o.name || shortenAddress(o.address)} - ${o.totalSol.toFixed(4)} SOL (${o.count})`)
      .join("\n");
    try { fs.writeFileSync(OUT_TOP_BUYERS, topTxt, "utf8"); } catch (_) {}
  }

  function maybeSelectWinners() {
    // Reset per round if end timestamp changes
    try {
      const endStrNow = fs.readFileSync(OUT_AIRDROP_END, "utf8").trim();
      const endMsNow = Number(endStrNow) || 0;
      if (endMsNow !== lastSeenEndMs) {
        winnersWritten = false;
        lastSeenEndMs = endMsNow;
      }
    } catch (_) {}

    const endStr = fs.readFileSync(OUT_AIRDROP_END, "utf8").trim();
    const endMs = Number(endStr) || 0;
    if (!(endMs > 0 && Date.now() >= endMs)) return;
    if (processedEndMs === endMs) return;
    const topN = Math.max(1, Number(process.env.AIRDROP_TOP_N || 3));
    const ranked = Array.from(addressStats.entries())
      .map(([addr, s]) => ({ address: addr, name: s.name, count: s.count, totalSol: s.totalSol }))
      .sort((a, b) => b.totalSol - a.totalSol);
    const winners = ranked.slice(0, topN);
    try { fs.writeFileSync(OUT_AIRDROP_WIN_JSON, JSON.stringify({ end: endMs, winners }, null, 2), "utf8"); } catch (_) {}
    try { fs.writeFileSync(OUT_AIRDROP_WIN_TXT, winners.map(w => `${w.address} ${w.totalSol.toFixed(4)} SOL`).join("\n"), "utf8"); } catch (_) {}
    winnersWritten = true;
    processedEndMs = endMs;

    // Immediately schedule the next round end (manual override > env > default)
    let nextDurationMin = Number(process.env.AIRDROP_DURATION_MIN || 5);
    try {
      if (fs.existsSync(OUT_AIRDROP_NEXT_OVERRIDE)) {
        const ov = parseInt((fs.readFileSync(OUT_AIRDROP_NEXT_OVERRIDE, "utf8").trim() || ""), 10);
        if (isFinite(ov) && ov >= 1) nextDurationMin = ov;
      }
    } catch (_) {}
    const nextEnd = Date.now() + Math.max(1, nextDurationMin) * 60_000;
    try {
      fs.writeFileSync(OUT_AIRDROP_END, String(nextEnd), "utf8");
      // clear one-time override if any
      try { if (fs.existsSync(OUT_AIRDROP_NEXT_OVERRIDE)) fs.unlinkSync(OUT_AIRDROP_NEXT_OVERRIDE); } catch(_) {}
      lastSeenEndMs = nextEnd; winnersWritten = false;
    } catch (_) {}
  }

  // Periodic check so winners are selected even if no new trades arrive
  setInterval(() => {
    try { maybeSelectWinners(); } catch (_) {}
  }, 2000);

	// ----- Real-time trades via PumpPortal WebSocket (exact API example) -----
	if (coinAddress) {
		function connectWs() {
			const ws = new WebSocket("wss://pumpportal.fun/api/data");
			
			ws.on("open", () => {
				try {
					// Subscribe using BOTH key variants (with and without 'pump' suffix)
					const keys = Array.from(new Set([
						coinMintWithSuffix,
						coinMintWithoutSuffix
					].filter(Boolean)));
					let payload = { method: "subscribeTokenTrade", keys };
					ws.send(JSON.stringify(payload));
					// Also listen for migration of this coin
					try {
						payload = { method: "subscribeMigration", keys };
						ws.send(JSON.stringify(payload));
					} catch (_) {}
					console.log("🔌 WS subscribed for keys:", keys);
				} catch (e) {
					console.error("WS subscribe error:", e.message);
				}
			});
			
			ws.on("message", (data) => {
				const msg = JSON.parse(data);
				// Enhanced debug
				if (msg.txType || msg.message) {
					console.log("📡 WS:", msg.txType || msg.message, msg.mint || "");
					console.log("📡 Full message:", JSON.stringify(msg, null, 2));
				}
				
				// Handle possible migration event to auto-switch mint
				try {
					const newMint = msg.newMint || msg.migratedMint || msg.targetMint || (msg.migration && (msg.migration.newMint || msg.migration.targetMint));
					const oldMint = msg.oldMint || msg.sourceMint || msg.mint || (msg.migration && (msg.migration.oldMint || msg.migration.sourceMint));
					if (newMint && oldMint) {
						const matchOld = [coinMintWithSuffix, coinMintWithoutSuffix].includes(String(oldMint));
						if (matchOld && String(newMint) !== coinAddress) {
							console.log("🧭 Migration detected → switching mint:", oldMint, "→", newMint);
							// Update current mint and file
							coinMintWithSuffix = String(newMint);
							coinMintWithoutSuffix = coinMintWithSuffix.replace(/pump$/i, "");
							coinAddress = coinMintWithSuffix;
							try { fs.writeFileSync(OUT_COIN, coinAddress, "utf8"); } catch (_) {}
							// Reset in-memory state
							lastTradeLine = "";
							buyerStats.clear();
							addressStats.clear(); // Clear addressStats as well
							// Reconnect to WS with new mint
							try { ws.close(); } catch (_) {}
							setTimeout(connectWs, 500);
							return; // stop processing this message
						}
					}
				} catch (_) {}
				
				// Normalize potential mint fields
				const eventMint = String(msg.mint || msg.token || msg.ca || "");
				const isOurMint = eventMint === coinMintWithSuffix || eventMint === coinMintWithoutSuffix || !eventMint; // some ws payloads omit mint
				const isBuy = String(msg.txType || "").toLowerCase() === "buy" || msg.isBuy === true;
				if (!(isOurMint && isBuy)) return;
				
				// Check if it's a buy trade for our coin
				if (isBuy && isOurMint) {
					const txHash = asciiOnly(String(
						msg.signature || msg.sig || msg.transactionHash || msg.hash ||
						msg.txSignature || msg.txid || msg.txId || msg.tx || ""
					));
					const amount = parseFloat(msg.solAmount ?? msg.sol ?? msg.amount ?? msg.size ?? 0) || 0;
					// Filter out very small buys to avoid overheating
					if (amount < 0.05) {
						return;
					}
          const username = (msg.user && (msg.user.name || msg.user.username)) || msg.username || msg.name;
          const traderAddr = String(msg.traderPublicKey || msg.buyer || msg.account || "");
					const display = asciiOnly(username || shortenAddress(traderAddr));
					const line = `${display} Bought ${amount} SOL`;
					
					console.log("✅ BUY:", line);
					
					if (line !== lastTradeLine) {
						lastTradeLine = line;
						fs.writeFileSync(OUT_TRADE, line, "utf8");
						
            // Update top buyers (display and address based)
            const stats = buyerStats.get(display) || { count: 0, totalSol: 0 };
            stats.count += 1;
            stats.totalSol += amount;
            buyerStats.set(display, stats);

            const a = addressStats.get(traderAddr) || { name: display || shortenAddress(traderAddr), count: 0, totalSol: 0 };
            a.name = a.name || display || shortenAddress(traderAddr);
            a.count += 1;
            a.totalSol += amount;
            addressStats.set(traderAddr, a);

            writeTopBuyersFiles();
						
						console.log("🎉 Buy Trade:", line);
					}

					if (txHash && txHash !== lastTxHash) {
						lastTxHash = txHash;
						try { fs.writeFileSync(OUT_TXHASH, txHash, "utf8"); } catch (_) {}
					}

          // Airdrop end check after processing a trade
          maybeSelectWinners();
				} else if (msg.txType) {
					console.log("❌ Trade not for our coin:", msg.txType, msg.mint);
				}
			});
			
			ws.on("close", () => {
				console.warn("WS closed. Reconnecting in 3s...");
				setTimeout(connectWs, 3000);
			});
			
			ws.on("error", (e) => console.error("WS error:", e.message));
		}
		connectWs();
	}

	// Market cap scraping (still needed since PumpPortal doesn't provide this)
	setInterval(async () => {
		try {
			const cap = await page.evaluate(() => {
				const nodes = Array.from(document.querySelectorAll("div,span,p"));
				const el = nodes.find(n => /Market Cap\s*\$/.test(n.textContent || ""));
				if (el) {
					const m = el.textContent.match(/\$\s*[0-9.,]+\s*[KMB]?/);
					return m ? m[0].replace(/\s+/g, "") : null;
				}
				const any = nodes.find(n => /\$\s*[0-9.,]+\s*[KMB]?/.test(n.textContent || ""));
				return any ? (any.textContent.match(/\$\s*[0-9.,]+\s*[KMB]?/) || [null])[0] : null;
			});

			const capValue = cap ? asciiOnly(cap) : "N/A";
			fs.writeFileSync(OUT_CAP, `Market Cap: ${capValue}`, "utf8");
			console.log("✅ Market Cap:", capValue);
		} catch (err) {
			console.error("❌ Market cap error:", err.message);
		}
	}, REFRESH_MS);
})();
