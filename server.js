const path = require('path');
const fs = require('fs');
const express = require('express');

try {
  require('./tracker');
  console.log('Tracker booted');
}catch (e) {
  console.error('Failed to boot tracker:', e.message);
}

const app = express();
const publicDir = __dirname;

app.use(express.static(publicDir, {
  etag: false,
  lastModified: false,
  cacheControl: false,
  maxAge: 0
}));

// Airdrop: allow ending immediately
function pickRandomUnique(arr, k) {
  const count = Math.min(k, Array.isArray(arr) ? arr.length : 0);
  const a = Array.isArray(arr) ? arr.slice() : [];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const t = a[i]; a[i] = a[j]; a[j] = t;
  }
  return a.slice(0, count);
}

app.post('/airdrop/now', (req, res) => {
  try {
    const endFile = path.join(__dirname, 'airdrop_end.txt');
    // End now
    fs.writeFileSync(endFile, String(Date.now()), 'utf8');
    // Also compute winners immediately from topbuyers.json for instant UX
    try {
      const tbPath = path.join(__dirname, 'topbuyers.json');
      const raw = fs.existsSync(tbPath) ? fs.readFileSync(tbPath, 'utf8') : '[]';
      const arr = JSON.parse(raw || '[]');
      const pool = (Array.isArray(arr) ? arr : []).slice(0, 10);
      const winners = pickRandomUnique(pool, 3);
      const winJson = { end: Date.now(), winners };
      fs.writeFileSync(path.join(__dirname, 'airdrop_winners.json'), JSON.stringify(winJson, null, 2), 'utf8');
      fs.writeFileSync(path.join(__dirname, 'airdrop_winners.txt'), winners.map(w => `${w.address} ${Number(w.totalSol||0).toFixed(4)} SOL`).join('\n'), 'utf8');
      // Schedule next round for 1 minute specifically (one-time override)
      try { fs.writeFileSync(path.join(__dirname, 'airdrop_next_override_min.txt'), String(1), 'utf8'); } catch(_) {}
      const nextEnd = Date.now() + 1 * 60_000;
      fs.writeFileSync(endFile, String(nextEnd), 'utf8');
    } catch (_) {}
    res.json({ ok: true, message: 'Airdrop executed' });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});
app.get('/airdrop/now', (req, res) => {
  try {
    const endFile = path.join(__dirname, 'airdrop_end.txt');
    fs.writeFileSync(endFile, String(Date.now()), 'utf8');
    // Same immediate compute path for GET
    try {
      const tbPath = path.join(__dirname, 'topbuyers.json');
      const raw = fs.existsSync(tbPath) ? fs.readFileSync(tbPath, 'utf8') : '[]';
      const arr = JSON.parse(raw || '[]');
      const pool = (Array.isArray(arr) ? arr : []).slice(0, 10);
      const winners = pickRandomUnique(pool, 3);
      const winJson = { end: Date.now(), winners };
      fs.writeFileSync(path.join(__dirname, 'airdrop_winners.json'), JSON.stringify(winJson, null, 2), 'utf8');
      fs.writeFileSync(path.join(__dirname, 'airdrop_winners.txt'), winners.map(w => `${w.address} ${Number(w.totalSol||0).toFixed(4)} SOL`).join('\n'), 'utf8');
      try { fs.writeFileSync(path.join(__dirname, 'airdrop_next_override_min.txt'), String(1), 'utf8'); } catch(_) {}
      const nextEnd = Date.now() + 1 * 60_000;
      fs.writeFileSync(endFile, String(nextEnd), 'utf8');
    } catch (_) {}
    res.type('application/json').send(JSON.stringify({ ok: true, message: 'Airdrop executed' }));
  } catch (e) {
    res.status(500).type('application/json').send(JSON.stringify({ ok: false, error: e.message }));
  }
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'site.html'));
});

// Serve data files
app.get('/marketcap.txt', (req, res) => {
  try {
    const data = fs.readFileSync(path.join(__dirname, 'data', 'marketcap.txt'), 'utf8');
    res.type('text/plain').send(data);
  } catch (e) {
    res.type('text/plain').send('Market Cap: N/A');
  }
});

app.get('/trades.txt', (req, res) => {
  try {
    const data = fs.readFileSync(path.join(__dirname, 'data', 'trades.txt'), 'utf8');
    res.type('text/plain').send(data);
  } catch (e) {
    res.type('text/plain').send('Waiting for trades...');
  }
});

app.get('/topbuyers.txt', (req, res) => {
  try {
    const data = fs.readFileSync(path.join(__dirname, 'data', 'topbuyers.txt'), 'utf8');
    res.type('text/plain').send(data);
  } catch (e) {
    res.type('text/plain').send('No buyers yet...');
  }
});

app.get('/topbuyers.json', (req, res) => {
  try {
    const data = fs.readFileSync(path.join(__dirname, 'data', 'topbuyers.json'), 'utf8');
    res.type('application/json').send(data);
  } catch (e) {
    res.type('application/json').send('[]');
  }
});

app.get('/coin.txt', (req, res) => {
  try {
    const data = fs.readFileSync(path.join(__dirname, 'data', 'coin.txt'), 'utf8');
    res.type('text/plain').send(data);
  } catch (e) {
    res.type('text/plain').send('');
  }
});

app.get('/txhash.txt', (req, res) => {
  try {
    const data = fs.readFileSync(path.join(__dirname, 'data', 'txhash.txt'), 'utf8');
    res.type('text/plain').send(data);
  } catch (e) {
    res.type('text/plain').send('No transactions yet...');
  }
});

app.get('/airdrop_end.txt', (req, res) => {
  try {
    const data = fs.readFileSync(path.join(__dirname, 'data', 'airdrop_end.txt'), 'utf8');
    res.type('text/plain').send(data);
  } catch (e) {
    res.type('text/plain').send('0');
  }
});

app.get('/airdrop_winners.json', (req, res) => {
  try {
    const data = fs.readFileSync(path.join(__dirname, 'data', 'airdrop_winners.json'), 'utf8');
    res.type('application/json').send(data);
  } catch (e) {
    res.type('application/json').send('{}');
  }
});

app.get('/airdrop_winners.txt', (req, res) => {
  try {
    const data = fs.readFileSync(path.join(__dirname, 'data', 'airdrop_winners.txt'), 'utf8');
    res.type('text/plain').send(data);
  } catch (e) {
    res.type('text/plain').send('');
  }
});

app.get('/health', (req, res) => {
  res.type('text/plain').send('ok');
});

const port = process.env.PORT || 8080;
app.listen(port, '0.0.0.0', () => {
  console.log(`Web server listening on :${port}`);
});



