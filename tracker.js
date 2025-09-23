// tracker.js
const fs = require("fs");
const path = require("path");
const puppeteer = require("puppeteer");

// --------- CONFIG ---------
const COIN_URL = "https://pump.fun/coin/9o2sXBXrcMKwxTAq4EKh1vgsgWBZLvcaDriNS3kpump";
const REFRESH_MS = 2000; // poll every 2s
// --------------------------

const OUT_CAP = path.join(__dirname, "marketcap.txt");
const OUT_TRADE = path.join(__dirname, "trades.txt");
const OUT_TOP_BUYERS = path.join(__dirname, "topbuyers.txt");
const OUT_COIN = path.join(__dirname, "coin.txt");

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
  if (!fs.existsSync(OUT_TRADE)) fs.writeFileSync(OUT_TRADE, "");
  if (!fs.existsSync(OUT_TOP_BUYERS)) fs.writeFileSync(OUT_TOP_BUYERS, "");
  // Derive mint/CA from URL (Pump.fun mints typically end with 'pump')
  const coinPathPart = (COIN_URL.split("/coin/")[1] || "").split(/[?#]/)[0];
  const coinMintWithSuffix = coinPathPart;
  const coinMintWithoutSuffix = coinMintWithSuffix.replace(/pump$/i, "");
  // We'll subscribe with the exact value from the URL, but match either form
  const coinAddress = coinMintWithSuffix;
  fs.writeFileSync(OUT_COIN, coinAddress, "utf8");

  let lastTradeLine = ""; // dedupe trades
  const buyerStats = new Map(); // name -> { count, totalSol }

  // ----- Real-time trades via PumpPortal WebSocket (exact API example) -----
  const { WebSocket } = require("ws");
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
        // Light debug
        if (msg.txType || msg.message) console.log("📡 WS:", msg.txType || msg.message, msg.mint || "");
        
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
          const amount = parseFloat(msg.solAmount ?? msg.sol ?? msg.amount ?? msg.size ?? 0) || 0;
          // Filter out very small buys to avoid overheating
          if (amount < 0.05) {
            return;
          }
          const username = (msg.user && (msg.user.name || msg.user.username)) || msg.username || msg.name;
          const traderAddr = msg.traderPublicKey || msg.buyer || msg.account || "User";
          const display = asciiOnly(username || shortenAddress(traderAddr));
          const line = `${display} Bought ${amount} SOL`;
          
          console.log("✅ BUY:", line);
          
          if (line !== lastTradeLine) {
            lastTradeLine = line;
            fs.writeFileSync(OUT_TRADE, line, "utf8");
            
            // Update top buyers
            const stats = buyerStats.get(display) || { count: 0, totalSol: 0 };
            stats.count += 1;
            stats.totalSol += amount;
            buyerStats.set(display, stats);
            
            const top = Array.from(buyerStats.entries())
              .sort((a, b) => b[1].totalSol - a[1].totalSol)
              .slice(0, 50)
              .map(([n, s], i) => `${i + 1}. ${n} - ${s.totalSol.toFixed(4)} SOL (${s.count})`)
              .join("\n");
            fs.writeFileSync(OUT_TOP_BUYERS, top, "utf8");
            
            console.log("🎉 Buy Trade:", line);
          }
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
