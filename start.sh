#!/bin/bash

# Start both the tracker and Next.js development server
echo "🚀 Starting Soldrop Coin Tracker..."

# Start tracker in background
echo "📊 Starting data tracker..."
nohup node tracker.js > tracker.log 2>&1 &
TRACKER_PID=$!

# Wait a moment for tracker to initialize
sleep 2

# Start Next.js development server
echo "🌐 Starting Next.js development server..."
npm run dev &
NEXT_PID=$!

echo "✅ Both services started!"
echo "📊 Tracker PID: $TRACKER_PID"
echo "🌐 Next.js PID: $NEXT_PID"
echo "🔗 Open http://localhost:3000 in your browser"
echo ""
echo "To stop both services, run:"
echo "kill $TRACKER_PID $NEXT_PID"

# Wait for user to stop
wait
