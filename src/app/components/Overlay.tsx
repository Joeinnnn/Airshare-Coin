'use client';

import React, { useState, useEffect, useRef } from 'react';

export default function Overlay() {
  const [tradeText, setTradeText] = useState("");
  const [isVisible, setIsVisible] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    let last = "";
    const poll = async () => {
      try {
        // Fetch from the new API route
        const res = await fetch("/api/data/trades.txt?bust=" + Date.now());
        const txt = await res.text();
        const trade = (txt || "").trim();

        if (trade && trade !== last) {
          last = trade;
          setTradeText(trade);

          setIsVisible(true);
          if (timeoutRef.current) clearTimeout(timeoutRef.current);
          timeoutRef.current = setTimeout(() => {
            setIsVisible(false);
          }, 3000);
        }
      } catch (e) {
        console.error("Error polling trades.txt:", e);
      }
    };

    const interval = setInterval(poll, 1500);
    return () => { clearInterval(interval); if (timeoutRef.current) clearTimeout(timeoutRef.current); };
  }, []);

  return (
    <div className={`popup ${isVisible ? 'show' : 'hide'}`} style={{ display: isVisible ? 'block' : 'none' }}>
      <div id="trade" className="trade-text">{tradeText}</div>
    </div>
  );
}

// Add styles to globals.css or a dedicated CSS module
/*
.popup {
  position: absolute;
  left: 50%; top: 50%;
  transform: translate(-50%, -50%);
  display: none;
  text-align: center;
  color: #fff;
}

.trade-text {
  font-weight: 700;
  font-size: 56px;
  text-shadow: 0 4px 20px rgba(0,0,0,.6);
  margin-top: 8px;
}

.gif {
  display: block;
  margin: 0 auto;
  max-width: 420px;
  max-height: 420px;
}

.show { animation: fadeIn .25s ease-out forwards; }
.hide { animation: fadeOut .25s ease-in forwards; }
@keyframes fadeIn { from {opacity:0; transform: translate(-50%,-50%) scale(.95);} to {opacity:1; transform: translate(-50%,-50%) scale(1);} }
@keyframes fadeOut { from {opacity:1;} to {opacity:0;} }
*/
