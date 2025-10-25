'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Overlay from "./components/Overlay";
import html2canvas from 'html2canvas';

// ------------------ Helpers ------------------
function shorten(addr: string) {
  if (!addr) return 'User';
  return addr.length > 10 ? addr.slice(0, 4) + '…' + addr.slice(-4) : addr;
}

function runConfetti(canvas: HTMLCanvasElement, parentBox: DOMRect) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  canvas.width = parentBox.width;
  canvas.height = parentBox.height;

  const pieces = Array.from({ length: 120 }).map(() => ({
    x: Math.random() * canvas.width,
    y: -10,
    s: 2 + Math.random() * 4,
    c: Math.random() < 0.5 ? '#a855f7' : '#c084fc',
    v: 1 + Math.random() * 2,
    a: Math.random() * Math.PI * 2,
  }));

  let t = 0;
  const maxT = 900;
  function step() {
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    pieces.forEach((p) => {
      p.y += p.v;
      p.x += Math.sin((p.a += 0.05));
      ctx.fillStyle = p.c;
      ctx.fillRect(p.x, p.y, p.s, p.s);
    });
    t += 16;
    if (t < maxT) requestAnimationFrame(step);
    else ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
  requestAnimationFrame(step);
}

function runParticleBurst(canvas: HTMLCanvasElement) {
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const { innerWidth: W, innerHeight: H } = window;
  canvas.width = W;
  canvas.height = H;
  const cx = W * 0.5,
    cy = H * 0.25;

  const parts = Array.from({ length: 80 }).map(() => ({
    x: cx,
    y: cy,
    vx: (Math.random() - 0.5) * 6,
    vy: (Math.random() - 0.5) * 4 - 2,
    life: 700 + Math.random() * 400,
    size: 2 + Math.random() * 3,
    hue: Math.random() < 0.5 ? 140 : 210,
  }));

  let start = performance.now();
  function frame() {
    if (!ctx) return;
    const dt = 16;
    ctx.clearRect(0, 0, W, H);
    parts.forEach((p) => {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.05;
      p.life -= dt;
      ctx.fillStyle = `hsla(${p.hue}, 80%, 60%, ${Math.max(0, p.life / 1000)})`;
      ctx.fillRect(p.x, p.y, p.size, p.size);
    });
    if (performance.now() - start < 900) requestAnimationFrame(frame);
    else ctx.clearRect(0, 0, W, H);
  }
  requestAnimationFrame(frame);
}

// ------------------ Persistent History ------------------
interface TradeHistory {
  ts: number;
  addr: string;
  name: string;
  amount: number;
  sig: string;
}

function historyKey(mint: string) {
  return 'pf_history_' + mint;
}
function loadHistory(mint: string): TradeHistory[] {
  try {
    return JSON.parse(localStorage.getItem(historyKey(mint)) || '[]');
  } catch {
    return [];
  }
}
function saveHistory(mint: string, arr: TradeHistory[]) {
  try {
    localStorage.setItem(historyKey(mint), JSON.stringify(arr.slice(-500)));
  } catch {}
}
function seenKey(mint: string) {
  return 'pf_seen_' + mint;
}
function loadSeen(mint: string): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(seenKey(mint)) || '[]'));
  } catch {
    return new Set();
  }
}
function saveSeen(mint: string, seen: Set<string>) {
  try {
    localStorage.setItem(seenKey(mint), JSON.stringify(Array.from(seen).slice(-2000)));
  } catch {}
}

// ------------------ Component ------------------
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
  const lastTopRaw = useRef('');
  const lastTopJsonRaw = useRef('');
  const lastCap = useRef('');
  const lastTxHashRef = useRef('');

  const fetchData = useCallback(async (file: string) => {
    try {
      const res = await fetch(`/api/data/${file}?t=${Date.now()}`);
      if (!res.ok) return '';
      return await res.text();
    } catch {
      return '';
    }
  }, []);

  // Initial coin fetch
  useEffect(() => {
    const fetchCoin = async () => {
      const coinTxt = await fetchData('coin.txt');
      const trimmed = (coinTxt || '').trim();
      if (trimmed) setMint(trimmed);
    };
    fetchCoin();
    const i = setInterval(fetchCoin, 5000);
    return () => clearInterval(i);
  }, [fetchData]);

  // Poll cap & tx
  useEffect(() => {
    const poll = async () => {
      try {
        const cap = (await fetchData('marketcap.txt')).trim();
        if (cap) {
          lastCap.current = cap;
          setMarketCap(cap);
        } else if (lastCap.current) setMarketCap(lastCap.current);
        else setMarketCap('Market Cap: N/A');
      } catch {}

      try {
        const tx = (await fetchData('txhash.txt')).trim();
        if (tx && tx !== lastTxHashRef.current) {
          lastTxHashRef.current = tx;
          setLatestTxHash(tx);
        } else if (!tx && !lastTxHashRef.current) setLatestTxHash('—');
      } catch {}
    };
    const i = setInterval(poll, 2000);
    return () => clearInterval(i);
  }, [fetchData]);

  // Airdrop countdown & winners
  useEffect(() => {
    const tick = async () => {
      try {
        const txt = (await fetchData('airdrop_end.txt')).trim();
        const end = Number(txt) || 0;
        if (!(end > 0)) {
          setAirdropCountdown('Airdrop: —');
          setAirdropStatus('Airdrop: —');
          return;
        }
        const rem = end - Date.now();
        if (rem <= 0) {
          setAirdropCountdown('Airdrop: ended');
          setAirdropStatus('Airdrop: ended');
          try {
            const win = (await fetchData('airdrop_winners.json')).trim();
            if (win) {
              const data = JSON.parse(win);
              const list = (data && data.winners) || [];
              if (list.length) {
                setAirdropWinners(
                  'Airdrop Winners:\n' +
                    list
                      .map((w: any, i: number) => `${i + 1}. ${w.address} — ${Number(w.totalSol || 0).toFixed(4)} SOL`)
                      .join('\n')
                );
              }
            }
          } catch {}
          return;
        }
        const s = Math.floor(rem / 1000);
        const h = Math.floor(s / 3600);
        const m = Math.floor((s % 3600) / 60);
        const sec = s % 60;
        const t = `Airdrop: ${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
        setAirdropCountdown(t);
        setAirdropStatus(t);
      } catch {}
    };
    tick();
    const i = setInterval(tick, 1000);
    return () => clearInterval(i);
  }, [fetchData]);

  const handleAirdropNow = async () => {
    try {
      console.log('🎯 Airdrop Now button clicked');
      const res = await fetch('/api/airdrop-now', { method: 'POST' });
      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`Request failed: ${res.status} - ${errorText}`);
      }
      const result = await res.json();
      console.log('✅ Airdrop executed:', result);
      alert('Airdrop executed successfully! Winners have been selected.');
    } catch (e) {
      console.error('❌ Error ending airdrop:', e);
      alert(`Failed to end airdrop: ${e.message}`);
    }
  };

  const showBuyerDetails = useCallback(
    (displayName: string) => {
      if (!mint || mint === '—') {
        alert('Coin mint not yet loaded.');
        return;
      }
      const arr = loadHistory(mint);
      const seenS = new Set<string>();
      const items: TradeHistory[] = [];
      for (let i = arr.length - 1; i >= 0 && items.length < 20; i--) {
        const e = arr[i];
        if (!e || !e.sig) continue;
        if (seenS.has(e.sig)) continue;
        if ((e.name || e.addr) !== displayName) continue;
        seenS.add(e.sig);
        items.push(e);
      }
      const total = items.reduce((s, e) => s + (Number(e.amount) || 0), 0);
      alert(
        `${displayName}\nTrades: ${items.length}\nTotal: ${total.toFixed(4)} SOL\n\nRecent:\n` +
          items.map((e) => `• ${e.amount} SOL`).join('\n')
      );
    },
    [mint]
  );

  const showBuyerDetailsFromLine = useCallback(
    (line: string) => {
      const m = line.match(/^(.*)\s+Bought\s+([0-9.]+)\s+SOL/i);
      if (!m) return;
      const who = m[1].trim();
      showBuyerDetails(who);
    },
    [showBuyerDetails]
  );

  const addRecent = useCallback(
    (line: string, who: string, amount: number, sig: string) => {
      if (!line || seenLines.current.has(line)) return;
      seenLines.current.add(line);
      setRecentBuys((prev) => [line, ...prev.slice(0, 19)]);

      if (mint && mint !== '—') {
        const history = loadHistory(mint);
        const seen = loadSeen(mint);
        if (!seen.has(sig)) {
          history.push({ ts: Date.now(), addr: who, name: who, amount, sig });
          saveHistory(mint, history);
          seen.add(sig);
          saveSeen(mint, seen);
        }
      }
    },
    [mint]
  );

  const confettiCanvasRef = useRef<HTMLCanvasElement>(null);
  const fxCanvasRef = useRef<HTMLCanvasElement>(null);
  const latestSectionRef = useRef<HTMLElement>(null);
  const topBuyersPanelRef = useRef<HTMLDivElement>(null);

  // WebSocket real-time trades
  useEffect(() => {
    if (!mint || mint === '—') return;

    const wsUrl = 'wss://pumpportal.fun/api/data';
    let ws: WebSocket | null = null;
    let currentWsMint = '';

    const connectWs = () => {
      if (ws) {
        try {
          ws.close();
        } catch {}
      }
      ws = new WebSocket(wsUrl);
      currentWsMint = mint;

      ws.onopen = () => {
        const mintNoSuffix = currentWsMint.replace(/pump$/i, '');
        const keys = Array.from(new Set([currentWsMint, mintNoSuffix].filter(Boolean)));
        const payload = { method: 'subscribeTokenTrade', keys };
        ws?.send(JSON.stringify(payload));
      };

      ws.onmessage = (event) => {
        try {
          const raw = JSON.parse(event.data);
          if (raw.message) return;
          const data = raw.trade || raw || {};

          const capSol = Number(data.marketCapSol);
          if (isFinite(capSol) && capSol > 0) {
            const newCap = `$${(capSol * 100).toFixed(1)}K`;
            if (newCap !== lastCap.current) {
              lastCap.current = newCap;
              setMarketCap(newCap);
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

          setTradesCount((prev) => prev + 1);
          const isWhale = amount >= 1;
          const line = `${isWhale ? '🐳 ' : ''}${who} Bought ${amount} SOL`;

          const GIF_MIN_SOL = 0.1;
          if (amount >= GIF_MIN_SOL && latestTradeText !== line) {
            setLatestTradeText(line);
            if (latestSectionRef.current) {
              latestSectionRef.current.classList.remove('animate-pulse');
              void latestSectionRef.current.offsetWidth;
              latestSectionRef.current.classList.add('animate-pulse');
            }
            if (isWhale && confettiCanvasRef.current && latestSectionRef.current) {
              runConfetti(confettiCanvasRef.current, latestSectionRef.current.getBoundingClientRect());
            }
            if (fxCanvasRef.current) runParticleBurst(fxCanvasRef.current);
            setTimeout(() => {
              setLatestTradeText('Waiting for buys…');
            }, 3000);
          }
          addRecent(line, who, amount, sig);
        } catch (e) {
          console.warn('parse/ws error', e);
        }
      };

      ws.onclose = () => {
        setTimeout(connectWs, 3000);
      };

      ws.onerror = (e) => console.error('WS error:', e);
    };

    connectWs();
    return () => {
      ws?.close();
    };
  }, [mint, latestTradeText, addRecent]);

  // Poll Top Buyers & Airdrop (text/json)
  useEffect(() => {
    const poll = async () => {
      try {
        const top = (await fetchData('topbuyers.txt')).trim();
        if (top && top !== lastTopRaw.current) {
          const lines = top.split(/\r?\n/).filter(Boolean);
          let html = '<ul class="list-none pl-2 m-0 font-mono">';
          for (const line of lines) html += `<li class="py-1">${line}</li>`;
          html += '</ul>';
          setTopBuyersText(html);
          lastTopRaw.current = top;
        } else if (!top && !lastTopRaw.current) setTopBuyersText('—');
      } catch {}

      try {
        const topJson = (await fetchData('topbuyers.json')).trim();
        if (topJson && topJson !== lastTopJsonRaw.current) {
          lastTopJsonRaw.current = topJson;
          const arr = JSON.parse(topJson);
          const top = Array.isArray(arr) && arr[0];
          if (top) setTopTraderLine(`Top Trader: ${(top.name || top.address)} — ${Number(top.totalSol || 0).toFixed(4)} SOL (${top.count})`);
        }
      } catch {}
    };
    const i = setInterval(poll, 2000);
    return () => clearInterval(i);
  }, [fetchData]);

  const handleShareTopBuyers = async () => {
    const panel = topBuyersPanelRef.current;
    if (!panel || !panel.textContent?.trim()) return alert('No Top Buyers to export yet.');
    try {
      const wrapper = document.createElement('div');
      wrapper.className = 'p-4 bg-slate-900 text-slate-100 rounded-xl border border-slate-700 w-fit';
      const title = document.createElement('div');
      title.textContent = 'Top Buyers';
      title.className = 'font-bold mb-2 font-mono';
      wrapper.appendChild(title);
      const clone = panel.cloneNode(true) as HTMLElement;
      clone.style.maxWidth = '640px';
      wrapper.appendChild(clone);
      document.body.appendChild(wrapper);
      const canvas = await html2canvas(wrapper, { backgroundColor: null, scale: 2 });
      document.body.removeChild(wrapper);
      const link = document.createElement('a');
      link.download = 'topbuyers.png';
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (e) {
      console.error(e);
      alert('Export failed.');
    }
  };

  // ------------------ UI ------------------
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-slate-100">
      <Overlay />

      {/* App Shell */}
      <div className="mx-auto max-w-7xl px-4 py-6 grid grid-cols-1 lg:grid-cols-[280px,1fr] gap-6">
        {/* Sidebar */}
        <aside className="space-y-6">
          {/* Mint & Brand */}
          <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 backdrop-blur p-4 shadow-lg shadow-purple-900/10">
            <div className="text-xs uppercase tracking-widest text-purple-300/80 font-semibold">Mint</div>
            <div className="mt-2 font-mono break-words text-sm text-slate-200" id="mint">
              {mint}
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 gap-4">
            <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 backdrop-blur p-4">
              <div className="text-xs uppercase tracking-widest text-purple-300/80 font-semibold">Market Cap</div>
              <div className="mt-2 text-2xl font-mono" id="cap">{marketCap}</div>
            </div>
            <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 backdrop-blur p-4">
              <div className="text-xs uppercase tracking-widest text-purple-300/80 font-semibold">Trades</div>
              <div className="mt-2 text-2xl font-mono" id="tradesCount">{tradesCount}</div>
            </div>
            <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 backdrop-blur p-4">
              <div className="text-xs uppercase tracking-widest text-purple-300/80 font-semibold">Airdrop</div>
              <div className="mt-2 text-2xl font-mono" id="airdropCountdown">{airdropCountdown}</div>
            </div>
          </div>

          {/* Notices */}
          <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 backdrop-blur p-4 space-y-2">
            <p className="text-sm text-slate-300/80 font-mono">💡 GIF popup shows only buys ≥ 0.1 SOL. The page may briefly switch views while syncing.</p>
            <p className="text-sm text-slate-300/80 font-mono">🎯 Only buyers with ≥0.1 SOL buys will show your username and GIF.</p>
          </div>
        </aside>

        {/* Main Area */}
        <main className="space-y-6">
          {/* Latest Trade Banner */}
          <section
            ref={latestSectionRef as any}
            className="relative overflow-hidden rounded-3xl border border-slate-800/80 bg-gradient-to-r from-slate-900/70 to-slate-800/40 backdrop-blur p-5 shadow-xl shadow-purple-900/10"
          >
            <div className="flex items-center gap-4">
              <div className="text-4xl">⚡</div>
              <div className="text-2xl font-mono text-emerald-300 drop-shadow" id="latestText">
                {latestTradeText}
              </div>
            </div>
            <canvas ref={confettiCanvasRef} className="pointer-events-none absolute inset-0" />
          </section>

          {/* Two-Column: Leaderboard & Airdrop */}
          <section className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            {/* Leaderboard */}
            <div className="rounded-3xl border border-slate-800/80 bg-slate-900/60 backdrop-blur shadow-xl shadow-purple-900/10">
              <div className="px-6 py-4 border-b border-slate-800/60 flex items-center justify-between">
                <h3 className="text-xs uppercase tracking-widest text-purple-300/80 font-semibold">Leaderboard</h3>
                <button
                  onClick={handleShareTopBuyers}
                  className="text-xs rounded-lg border border-purple-500/30 px-3 py-1.5 font-semibold text-purple-200 hover:bg-purple-500/10"
                >
                  Export PNG
                </button>
              </div>
              <div
                ref={topBuyersPanelRef}
                id="topbuyers"
                className="px-6 py-4 max-h-[420px] overflow-auto font-mono text-sm"
                dangerouslySetInnerHTML={{ __html: topBuyersText }}
              />
              <div className="px-6 py-3 border-t border-slate-800/60 text-xs text-slate-300" id="topTraderLine">
                {topTraderLine}
              </div>
            </div>

            {/* Airdrop */}
            <div className="rounded-3xl border border-slate-800/80 bg-slate-900/60 backdrop-blur shadow-xl shadow-purple-900/10">
              <div className="px-6 py-4 border-b border-slate-800/60 flex items-center justify-between">
                <h3 className="text-xs uppercase tracking-widest text-purple-300/80 font-semibold">Airdrop</h3>
                <button
                  id="airdropNowBtn"
                  onClick={handleAirdropNow}
                  className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-purple-600 to-fuchsia-600 px-4 py-2 text-xs font-bold tracking-wider shadow-md hover:shadow-lg hover:brightness-110"
                >
                  🎯 Airdrop Now
                </button>
              </div>
              <div className="px-6 py-4 space-y-3">
                <div id="airdropStatus" className="text-base font-semibold">
                  {airdropStatus}
                </div>
                <div className="text-xs text-slate-400">Ends when countdown hits 0. You can also end now.</div>
                <div id="winners" className="min-h-[120px] whitespace-pre-wrap text-sm bg-slate-950/40 border border-slate-800 rounded-xl p-4">
                  {airdropWinners}
                </div>
              </div>
            </div>
          </section>

          {/* Two-Column: Recent Buys & Latest Tx */}
          <section className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            {/* Recent Buys */}
            <div className="rounded-3xl border border-slate-800/80 bg-slate-900/60 backdrop-blur shadow-xl shadow-purple-900/10">
              <div className="px-6 py-4 border-b border-slate-800/60">
                <h3 className="text-xs uppercase tracking-widest text-purple-300/80 font-semibold">Recent Buys</h3>
              </div>
              <ul id="recent" className="divide-y divide-slate-800/60">
                {recentBuys.length > 0 ? (
                  recentBuys.map((buy, index) => (
                    <li
                      key={index}
                      onClick={() => showBuyerDetailsFromLine(buy)}
                      className="px-6 py-3 cursor-pointer hover:bg-slate-800/40 transition-colors font-mono text-sm"
                    >
                      {buy}
                    </li>
                  ))
                ) : (
                  <li className="px-6 py-6 text-center italic text-slate-400">No recent buys yet...</li>
                )}
              </ul>
            </div>

            {/* Latest Transaction */}
            <div className="rounded-3xl border border-slate-800/80 bg-slate-900/60 backdrop-blur shadow-xl shadow-purple-900/10">
              <div className="px-6 py-4 border-b border-slate-800/60">
                <h3 className="text-xs uppercase tracking-widest text-purple-300/80 font-semibold">Latest Transaction</h3>
              </div>
              <div className="px-6 py-5 space-y-3">
                <div>
                  <a
                    id="txLink"
                    href={latestTxHash !== '—' ? `https://solscan.io/tx/${encodeURIComponent(latestTxHash)}` : '#'}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="break-words font-mono text-sm text-purple-300 hover:text-purple-200"
                  >
                    {latestTxHash}
                  </a>
                </div>
                <div className="text-xs text-slate-400">Most recent buy signature. Click to view on Solscan.</div>
              </div>
            </div>
          </section>
        </main>
      </div>

      {/* FX Canvas (global) */}
      <canvas ref={fxCanvasRef} className="fixed inset-0 pointer-events-none z-50" />
    </div>
  );
}
