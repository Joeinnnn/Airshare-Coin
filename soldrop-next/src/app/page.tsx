'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Overlay from "./components/Overlay";
import html2canvas from 'html2canvas';

// Helper functions from original site.html
function shorten(addr: string) {
  if (!addr) return 'User';
  return addr.length > 10 ? addr.slice(0, 4) + '…' + addr.slice(-4) : addr;
}

// Confetti effect logic
function runConfetti(canvas: HTMLCanvasElement, parentBox: DOMRect) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  canvas.width = parentBox.width;
  canvas.height = parentBox.height;

  const pieces = Array.from({length: 120}).map(()=> ({
    x: Math.random() * canvas.width,
    y: -10,
    s: 2 + Math.random() * 4,
    c: Math.random() < 0.5 ? getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() : getComputedStyle(document.documentElement).getPropertyValue('--accent2').trim(),
    v: 1 + Math.random() * 2,
    a: Math.random() * Math.PI * 2
  }));

  let t = 0; const maxT = 900; // ~1.2s
  function step(){
    if (!ctx) return;
    ctx.clearRect(0,0,canvas.width,canvas.height);
    pieces.forEach(p=>{ p.y += p.v; p.x += Math.sin(p.a+=0.05); ctx.fillStyle=p.c; ctx.fillRect(p.x,p.y,p.s,p.s); });
    t+=16; if (t<maxT) requestAnimationFrame(step); else ctx.clearRect(0,0,canvas.width,canvas.height);
  }
  requestAnimationFrame(step);
}

// Particle burst effect logic
function runParticleBurst(canvas: HTMLCanvasElement) {
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const { innerWidth: W, innerHeight: H } = window;
  canvas.width = W; canvas.height = H;
  const cx = W * 0.5, cy = H * 0.25;

  const parts = Array.from({length: 80}).map(()=> ({
    x: cx, y: cy,
    vx: (Math.random() - 0.5) * 6,
    vy: (Math.random() - 0.5) * 4 - 2,
    life: 700 + Math.random() * 400,
    size: 2 + Math.random() * 3,
    hue: Math.random() < 0.5 ? 140 : 210
  }));

  let start = performance.now();
  function frame(t){
    if (!ctx) return;
    const dt = 16; // approx
    ctx.clearRect(0,0,W,H);
    parts.forEach(p=>{
      p.x += p.vx; p.y += p.vy; p.vy += 0.05; p.life -= dt;
      ctx.fillStyle = `hsla(${p.hue}, 80%, 60%, ${Math.max(0, p.life/1000)})`;
      ctx.fillRect(p.x, p.y, p.size, p.size);
    });
    if (performance.now() - start < 900) requestAnimationFrame(frame); else ctx.clearRect(0,0,W,H);
  }
  requestAnimationFrame(frame);
}

// --- Persistent history (per mint) using localStorage --- (will be moved to a custom hook later)
interface TradeHistory {
  ts: number;
  addr: string;
  name: string;
  amount: number;
  sig: string;
}

function historyKey(mint: string){ return 'pf_history_' + mint; }
function loadHistory(mint: string): TradeHistory[]{
  try { return JSON.parse(localStorage.getItem(historyKey(mint)) || '[]'); } catch { return []; }
}
function saveHistory(mint: string, arr: TradeHistory[]){
  try { localStorage.setItem(historyKey(mint), JSON.stringify(arr.slice(-500))); } catch {}
}
function seenKey(mint: string){ return 'pf_seen_' + mint; }
function loadSeen(mint: string): Set<string>{
  try { return new Set(JSON.parse(localStorage.getItem(seenKey(mint)) || '[]')); } catch { return new Set(); }
}
function saveSeen(mint: string, seen: Set<string>){
  try { localStorage.setItem(seenKey(mint), JSON.stringify(Array.from(seen).slice(-2000))); } catch {}
}

export default function Home() {
  const [mint, setMint] = useState('—');
  const [marketCap, setMarketCap] = useState('Market Cap: N/A');
  const [tradesCount, setTradesCount] = useState(0);
  const [airdropCountdown, setAirdropCountdown] = useState('—');
  const [airdropStatus, setAirdropStatus] = useState('Airdrop: —');
  const [airdropWinners, setAirdropWinners] = useState('');
  const [latestTradeText, setLatestTradeText] = useState('Waiting for buys…');
  const [latestTxHash, setLatestTxHash] = useState('—');
  const [topBuyersText, setTopBuyersText] = useState('—');
  const [topTraderLine, setTopTraderLine] = useState('Top Trader: —');
  const [recentBuys, setRecentBuys] = useState<string[]>([]);

  const seenLines = useRef(new Set<string>());
  const lastPolledTrade = useRef('');
  const lastTopRaw = useRef('');
  const lastTopJsonRaw = useRef('');
  const lastCap = useRef('');
  const lastTxHashRef = useRef('');
  const lastSeenEndMs = useRef(0);
  const processedEndMs = useRef(0);

  const fetchData = useCallback(async (file: string) => {
    try {
      const res = await fetch(`/api/data/${file}?t=${Date.now()}`);
      if (!res.ok) return '';
      return await res.text();
    } catch { return ''; }
  }, []);

  // Initial coin.txt fetch and polling
  useEffect(() => {
    const fetchCoin = async () => {
      const coinTxt = await fetchData('coin.txt');
      const trimmedCoin = (coinTxt || '').trim();
      if (trimmedCoin) {
        setMint(trimmedCoin);
      }
    };
    fetchCoin();
    const interval = setInterval(fetchCoin, 5000);
    return () => clearInterval(interval);
  }, [fetchData]);

  // Polling for marketcap.txt and txhash.txt
  useEffect(() => {
    const pollData = async () => {
      try {
        const cap = (await fetchData('marketcap.txt')).trim();
        if (cap) {
          lastCap.current = cap;
          setMarketCap(cap);
          // Animation logic for cap would go here if needed
        } else if (lastCap.current) {
          setMarketCap(lastCap.current);
        } else {
          setMarketCap('Market Cap: N/A');
        }
      } catch(_) {
        if (!lastCap.current) setMarketCap('Market Cap: N/A');
      }

      try {
        const tx = (await fetchData('txhash.txt')).trim();
        if (tx && tx !== lastTxHashRef.current) {
          lastTxHashRef.current = tx;
          setLatestTxHash(tx);
        } else if (!tx && !lastTxHashRef.current) {
          setLatestTxHash('—');
        }
      } catch(_) {}
    };

    const interval = setInterval(pollData, 2000);
    return () => clearInterval(interval);
  }, [fetchData]);

  // Airdrop countdown and winners panel
  useEffect(() => {
    const tick = async () => {
      try {
        const txt = (await fetchData('airdrop_end.txt')).trim();
        const end = Number(txt) || 0;
        if (!(end > 0)) { setAirdropCountdown('Airdrop: —'); setAirdropStatus('Airdrop: —'); return; }
        const rem = end - Date.now();
        if (rem <= 0) {
          setAirdropCountdown('Airdrop: ended');
          setAirdropStatus('Airdrop: ended');
          // try show winners if available
          try {
            const win = (await fetchData('airdrop_winners.json')).trim();
            if (win) {
              const data = JSON.parse(win);
              const list = (data && data.winners) || [];
              if (list.length) {
                setAirdropWinners(
                  'Airdrop Winners:\n' + list.map((w: any,i: number)=>`${i+1}. ${w.address} — ${Number(w.totalSol||0).toFixed(4)} SOL`).join('\n')
                );
                // winners effect: would add class to panel here if it was a ref
              }
            }
          } catch(_) {}
          return;
        }
        const s = Math.floor(rem/1000);
        const h = Math.floor(s/3600);
        const m = Math.floor((s%3600)/60);
        const sec = s%60;
        const countdownText = `Airdrop: ${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
        setAirdropCountdown(countdownText);
        setAirdropStatus(countdownText);
      } catch(_) {}
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const handleAirdropNow = async () => {
    const originalText = "Airdrop Now"; // Access button text from state or prop
    // Assume a ref to the button for disabling/enabling and text change
    // For now, we'll just log and call the API
    console.log('Airdrop Now button clicked');
    try {
      const res = await fetch('/api/airdrop-now', { method: 'POST' });
      if (!res.ok) throw new Error('Request failed');
      // Trigger flash effect
      // airdropPanel.classList.remove('airdrop-flash'); void airdropPanel.offsetWidth; airdropPanel.classList.add('airdrop-flash');
    } catch (e) {
      console.error('Error ending airdrop:', e);
      alert('Failed to end airdrop.');
    } finally {
      // Re-enable button and reset text after a delay
      // setTimeout(()=>{ btn.disabled = false; btn.textContent = original; }, 800);
    }
  };

  const showBuyerDetails = useCallback((displayName: string) => {
    if (!mint || mint === '—') { alert("Coin mint not yet loaded."); return; }
    const arr = loadHistory(mint);
    const seenS = new Set<string>();
    const items: TradeHistory[] = [];
    for (let i = arr.length - 1; i >= 0 && items.length < 20; i--) {
      const e = arr[i];
      if (!e || !e.sig) continue;
      if (seenS.has(e.sig)) continue;
      if ((e.name || e.addr) !== displayName) continue;
      seenS.add(e.sig); items.push(e);
    }
    const total = items.reduce((s,e)=> s + (Number(e.amount)||0), 0);
    alert(`${displayName}\nTrades: ${items.length}\nTotal: ${total.toFixed(4)} SOL\n\nRecent:\n` + items.map(e=>`• ${e.amount} SOL`).join('\n'));
  }, [mint]);

  const showBuyerDetailsFromLine = useCallback((line: string) => {
    // extract display name from "<who> Bought <amt> SOL"
    const m = line.match(/^(.*)\s+Bought\s+([0-9.]+)\s+SOL/i);
    if (!m) return;
    const who = m[1].trim();
    showBuyerDetails(who);
  }, [showBuyerDetails]);

  const addRecent = useCallback((line: string, who: string, amount: number, sig: string) => {
    if (!line || seenLines.current.has(line)) return;
    seenLines.current.add(line);
    setRecentBuys(prev => [line, ...prev.slice(0, 19)]); // Keep up to 20 items

    // Persist history if mint is available and trade is new
    if (mint && mint !== '—') {
      const history = loadHistory(mint);
      const seen = loadSeen(mint);
      if (!seen.has(sig)) {
        history.push({ ts: Date.now(), addr: who, name: who, amount, sig }); // Simplified 'who' for 'addr'
        saveHistory(mint, history);
        seen.add(sig);
        saveSeen(mint, seen);
      }
    }
  }, [mint]);

  const confettiCanvasRef = useRef<HTMLCanvasElement>(null);
  const fxCanvasRef = useRef<HTMLCanvasElement>(null);
  const latestSectionRef = useRef<HTMLElement>(null);

  // WebSocket connection for real-time trades
  useEffect(() => {
    if (!mint || mint === '—') return;

    const wsUrl = 'wss://pumpportal.fun/api/data';
    let ws: WebSocket | null = null;
    let currentWsMint = '';

    const connectWs = () => {
      if (ws) { try { ws.close(); } catch(_) {} }
      ws = new WebSocket(wsUrl);
      currentWsMint = mint;

      ws.onopen = () => {
        console.log('WebSocket connected');
        const mintNoSuffix = currentWsMint.replace(/pump$/i, '');
        const keys = Array.from(new Set([currentWsMint, mintNoSuffix].filter(Boolean)));
        const payload = { method: 'subscribeTokenTrade', keys };
        ws?.send(JSON.stringify(payload));
      };

      ws.onmessage = (event) => {
        try {
          const raw = JSON.parse(event.data);
          if (raw.message) return; // subscription ack
          const data = raw.trade || raw || {};

          // Update market cap from WS if available
          const capSol = Number(data.marketCapSol);
          if (isFinite(capSol) && capSol > 0) {
            const newCap = `$${(capSol * 100).toFixed(1)}K`;
            if (newCap !== lastCap.current) {
              lastCap.current = newCap;
              setMarketCap(newCap);
              // Trigger cap animation here if needed
            }
          }

          const tx = String(data.txType || data.type || data.side || '').toLowerCase();
          const isBuy = data.isBuy === true || tx === 'buy';
          if (!isBuy) return;
          const mm = String(data.mint || data.token || data.ca || '');
          if (!(mm === currentWsMint || mm === currentWsMint.replace(/pump$/i, ''))) return;

          const username = (data.user && (data.user.name || data.user.username)) || data.username || data.name;
          const addr = String(data.traderPublicKey || data.buyer || data.account || '');
          const who = username || shorten(addr);
          const amount = Number(data.solAmount ?? data.sol ?? data.amount ?? data.size ?? 0);

          const sig = String(raw.signature || data.signature || data.sig || `${mm}:${addr}:${amount}`);
          const seen = loadSeen(currentWsMint);
          if (seen.has(sig)) return;

          setTradesCount(prev => prev + 1);
          const isWhale = amount >= 1;
          const line = `${isWhale ? '🐳 ' : ''}${who} Bought ${amount} SOL`;

          const GIF_MIN_SOL = 0.1;
          if (amount >= GIF_MIN_SOL && latestTradeText !== line) {
            setLatestTradeText(line);
            // Trigger pulse animation for latest section
            if (latestSectionRef.current) {
              latestSectionRef.current.classList.remove('pulse');
              void latestSectionRef.current.offsetWidth; // Trigger reflow to restart animation
              latestSectionRef.current.classList.add('pulse');
            }
            if (isWhale && confettiCanvasRef.current && latestSectionRef.current) {
              runConfetti(confettiCanvasRef.current, latestSectionRef.current.getBoundingClientRect());
            }
            if (fxCanvasRef.current) {
              runParticleBurst(fxCanvasRef.current);
            }
            setTimeout(() => { setLatestTradeText('Waiting for buys…'); }, 3000);
          }
          addRecent(line, who, amount, sig);

          // Update top buyers state here (from buyerStats/addressStats in tracker.js)
          // For now, we'll just re-fetch topbuyers.json/txt periodically
          
        } catch(e) { console.warn('parse/ws error', e); }
      };

      ws.onclose = () => {
        console.warn('WebSocket closed. Reconnecting in 3s...');
        setTimeout(connectWs, 3000);
      };

      ws.onerror = (e) => console.error('WS error:', e);
    };

    connectWs();

    return () => { ws?.close(); };
  }, [mint, latestTradeText, addRecent]);

  // Polling for Top Buyers and Airdrop Winners from API routes
  useEffect(() => {
    const pollTopBuyersAndAirdrop = async () => {
      try {
        const top = (await fetchData('topbuyers.txt')).trim();
        if (top && top !== lastTopRaw.current) {
          const lines = top.split(/\r?\n/).filter(Boolean);
          let html = '<ul style=\"list-style:none; padding-left:10px; margin:0; font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;\">';
          for (const line of lines) html += `<li style=\"padding:2px 0\">${line}</li>`;
          html += '</ul>';
          setTopBuyersText(html);
          lastTopRaw.current = top;
        } else if (!top && !lastTopRaw.current) {
          setTopBuyersText('—');
        }
      } catch(_) {
        if (!lastTopRaw.current) setTopBuyersText('—');
      }

      try {
        const topJson = (await fetchData('topbuyers.json')).trim();
        if (topJson && topJson !== lastTopJsonRaw.current) {
          lastTopJsonRaw.current = topJson;
          const arr = JSON.parse(topJson);
          const top = Array.isArray(arr) && arr[0];
          if (top) setTopTraderLine(`Top Trader: ${(top.name || top.address)} — ${Number(top.totalSol||0).toFixed(4)} SOL (${top.count})`);
        }
      } catch(_) {}

      // Airdrop winners (already handled in separate effect, but ensure re-render)
      // This might be redundant if the airdrop effect already updates state correctly
      // For now, keep it separated for clarity
    };

    const interval = setInterval(pollTopBuyersAndAirdrop, 2000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const topBuyersPanelRef = useRef<HTMLDivElement>(null);

  const handleShareTopBuyers = async () => {
    if (!(window as any).html2canvas) {
      return alert('Preparing export library... try again in a second.');
    }
    const panel = topBuyersPanelRef.current;
    if (!panel || !panel.textContent?.trim()) {
      return alert('No Top Buyers to export yet.');
    }
    try {
      const wrapper = document.createElement('div');
      wrapper.style.background = getComputedStyle(document.body).getPropertyValue('--panel') || '#0e1621';
      wrapper.style.color = getComputedStyle(document.body).getPropertyValue('--fg') || '#e8f0f8';
      wrapper.style.padding = '12px';
      wrapper.style.border = '1px solid ' + (getComputedStyle(document.body).getPropertyValue('--border') || '#1f2a3a');
      const title = document.createElement('div');
      title.textContent = 'Top Buyers';
      title.style.fontWeight = '700';
      title.style.marginBottom = '6px';
      title.style.fontFamily = 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
      wrapper.appendChild(title);
      const clone = panel.cloneNode(true) as HTMLElement;
      clone.style.maxWidth = '640px';
      clone.style.fontFamily = 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
      wrapper.appendChild(clone);
      document.body.appendChild(wrapper);
      const canvas = await html2canvas(wrapper, {backgroundColor: null, scale: 2});
      document.body.removeChild(wrapper);
      const link = document.createElement('a');
      link.download = 'topbuyers.png';
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch(e) {
      console.error(e);
      alert('Export failed.');
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <Overlay />
      <div className="wrap">
        {/* Header Section */}
        <header>
          <div className="mint" id="mint" style={{ marginLeft: 'auto' }}>
            <span style={{ color: 'var(--muted)', marginRight: '8px' }}>Mint:</span>
            {mint}
          </div>
        </header>

        {/* Hero Stats Section */}
        <section className="hero">
          <div className="hud">
            <div className="hud-card">
              <div className="label">💰 Market Cap</div>
              <div className="value" id="cap">{marketCap}</div>
            </div>
            <div className="hud-card">
              <div className="label">📈 Trades</div>
              <div className="value" id="tradesCount">{tradesCount}</div>
            </div>
            <div className="hud-card">
              <div className="label">🎁 Airdrop</div>
              <div className="value" id="airdropCountdown">{airdropCountdown}</div>
            </div>
          </div>
        </section>

        {/* Latest Trade Section */}
        <section className="latest" id="latest" style={{ position: 'relative' }} ref={latestSectionRef}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ fontSize: '32px' }}>⚡</div>
            <div className="text" id="latestText">{latestTradeText}</div>
          </div>
          <canvas id="confetti" style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }} ref={confettiCanvasRef}></canvas>
        </section>
        
        {/* Effects Canvas */}
        <canvas id="fxCanvas" style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 5 }} ref={fxCanvasRef}></canvas>
        
        {/* Notices */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', margin: '16px 0' }}>
          <div className="notice">💡 GIF popup shows only buys ≥ 0.1 SOL. The page may briefly switch views while syncing.</div>
          <div className="notice">🎯 Only buyers with ≥0.1 SOL buys will show your username and GIF.</div>
        </div>

        {/* Main Content Grid */}
        <section className="cols">
          <div className="panel">
            <h3>🏆 Leaderboard</h3>
            <div className="body scroll" id="topbuyers" dangerouslySetInnerHTML={{ __html: topBuyersText }} ref={topBuyersPanelRef}></div>
            <div className="small" id="topTraderLine" style={{ padding: '12px 20px', borderTop: '1px solid var(--border)' }}>
              {topTraderLine}
            </div>
          </div>
          <div className="panel">
            <h3>🎁 Airdrop</h3>
            <div className="body">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', marginBottom: '12px' }}>
                <div id="airdropStatus" style={{ fontSize: '16px', fontWeight: '600' }}>{airdropStatus}</div>
                <div className="airdrop-actions">
                  <button id="airdropNowBtn" className="btn" type="button" onClick={handleAirdropNow}>
                    🎯 Airdrop Now
                  </button>
                </div>
              </div>
              <div className="small" style={{ margin: '8px 0 16px 0' }}>
                Ends when countdown hits 0. You can also end now.
              </div>
              <div id="winners" className="scroll" style={{ marginTop: '12px', whiteSpace: 'pre-wrap', minHeight: '100px' }}>
                {airdropWinners}
              </div>
            </div>
          </div>
        </section>

        {/* Secondary Content Grid */}
        <section className="cols" style={{ marginTop: '24px' }}>
          <div className="panel">
            <h3>📊 Recent Buys</h3>
            <ul className="list" id="recent">
              {recentBuys.length > 0 ? (
                recentBuys.map((buy, index) => (
                  <li key={index} style={{ cursor: 'pointer' }} onClick={() => showBuyerDetailsFromLine(buy)}>
                    {buy}
                  </li>
                ))
              ) : (
                <li style={{ textAlign: 'center', color: 'var(--muted)', fontStyle: 'italic' }}>
                  No recent buys yet...
                </li>
              )}
            </ul>
          </div>
          <div className="panel">
            <h3>🔗 Latest Transaction</h3>
            <div className="body">
              <div style={{ marginBottom: '12px' }}>
                <a 
                  id="txLink" 
                  href={latestTxHash !== '—' ? `https://solscan.io/tx/${encodeURIComponent(latestTxHash)}` : "#"} 
                  target="_blank" 
                  rel="noopener" 
                  style={{ 
                    wordBreak: 'break-all', 
                    color: 'var(--brand)', 
                    textDecoration: 'none',
                    fontSize: '14px',
                    fontFamily: 'Share Tech Mono, monospace'
                  }}
                >
                  {latestTxHash}
                </a>
              </div>
              <div className="small">
                Most recent buy signature. Click to view on Solscan.
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

