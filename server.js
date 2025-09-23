const path = require('path');
const express = require('express');

// Start the tracker (writes coin.txt, marketcap.txt, trades.txt, topbuyers.txt)
try {
  require('./tracker');
  console.log('Tracker booted');
} catch (e) {
  console.error('Failed to boot tracker:', e.message);
}

const app = express();
const publicDir = __dirname; // serve current repo root

app.use(express.static(publicDir, {
  etag: false,
  lastModified: false,
  cacheControl: false,
  maxAge: 0
}));

app.get('/health', (req, res) => {
  res.type('text/plain').send('ok');
});

const port = process.env.PORT || 8080;
app.listen(port, '0.0.0.0', () => {
  console.log(`Web server listening on :${port}`);
});
