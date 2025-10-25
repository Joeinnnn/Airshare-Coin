# 🚀 Soldrop Coin Tracker - Next.js Edition

A modern, real-time Pump.fun coin tracker built with Next.js, featuring a beautiful dark purple theme and live data integration.

## ✨ Features

- 🎯 **Real-time Data**: Live market cap, trades, and airdrop tracking
- 🎨 **Modern UI**: Dark purple theme with glass-morphism effects
- 📊 **Leaderboard**: Top buyers tracking with export functionality
- 🎁 **Airdrop System**: Automated airdrop management
- 🔄 **WebSocket Integration**: Real-time trade updates
- 📱 **Responsive Design**: Works on all devices

## 🚀 Quick Start

### Option 1: Run Everything Together (Recommended)
```bash
npm run start:all
```

### Option 2: Run Services Separately

**Terminal 1 - Start the data tracker:**
```bash
npm run tracker
```

**Terminal 2 - Start the Next.js server:**
```bash
npm run dev
```

## 🌐 Access the Application

Open your browser and go to: **http://localhost:3000**

## 📁 Project Structure

```
soldrop-next/
├── src/app/
│   ├── api/
│   │   ├── data/[filename]/route.ts    # Data API endpoints
│   │   └── airdrop-now/route.ts        # Airdrop management
│   ├── components/
│   │   └── Overlay.tsx                 # Trade notification popup
│   ├── globals.css                     # Purple theme styles
│   ├── layout.tsx                      # Root layout
│   └── page.tsx                        # Main dashboard
├── data/                               # Generated data files
├── public/                             # Static assets
├── tracker.js                          # Data collection service
└── start.sh                           # Convenience startup script
```

## 🔧 How It Works

1. **Data Collection**: `tracker.js` runs as a background service that:
   - Scrapes market cap data from Pump.fun
   - Connects to WebSocket for real-time trades
   - Generates data files in the `data/` directory

2. **API Layer**: Next.js API routes serve the generated data files

3. **Frontend**: React components fetch data from APIs and display real-time updates

## 📊 Data Files Generated

- `coin.txt` - Current coin mint address
- `marketcap.txt` - Live market cap data
- `trades.txt` - Latest trade information
- `topbuyers.txt` - Leaderboard data
- `topbuyers.json` - Structured leaderboard data
- `airdrop_end.txt` - Airdrop countdown timer
- `airdrop_winners.json` - Airdrop results

## 🎨 Theme Customization

The purple theme can be customized by modifying CSS variables in `src/app/globals.css`:

```css
:root {
  --bg: #0a0a0f;           /* Background */
  --fg: #e8e0ff;           /* Text color */
  --brand: #8b5cf6;        /* Primary purple */
  --accent: #a855f7;       /* Accent purple */
  --accent2: #c084fc;      /* Light purple */
}
```

## 🛠️ Development

### Prerequisites
- Node.js 18+ 
- npm or yarn

### Installation
```bash
npm install
```

### Available Scripts
- `npm run dev` - Start Next.js development server
- `npm run tracker` - Start data tracker service
- `npm run start:all` - Start both services
- `npm run build` - Build for production
- `npm run start` - Start production server

## 🐛 Troubleshooting

### Data Not Loading
1. Ensure the tracker is running: `npm run tracker`
2. Check if data files exist in the `data/` directory
3. Verify API endpoints: `curl http://localhost:3000/api/data/marketcap.txt`

### WebSocket Issues
- The tracker automatically reconnects on connection loss
- Check the tracker logs for WebSocket connection status

### Styling Issues
- Clear browser cache and hard refresh (Ctrl+F5)
- Ensure all CSS files are loading properly

## 📝 Notes

- The application requires both the tracker service and Next.js server to be running
- Data is generated in real-time and stored in the `data/` directory
- The tracker service uses Puppeteer for web scraping and WebSocket for real-time data
- All original functionality from the HTML version has been preserved and enhanced

## 🎉 Enjoy Your New Tracker!

Your Pump.fun tracker is now running with a beautiful dark purple theme and all the original functionality intact!
