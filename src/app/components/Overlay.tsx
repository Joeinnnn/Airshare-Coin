'use client';

import React, { useState, useEffect, useRef } from 'react';

const gifs = ["GIF1.gif", "GIF2.gif", "GIF3.gif", "GIF4.gif"];

export default function Overlay() {
  const [tradeText, setTradeText] = useState("");
  const [gifSrc, setGifSrc] = useState("");
  const [isVisible, setIsVisible] = useState(false);
  const sfxRef = useRef<HTMLAudioElement>(null);
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
          const randomGif = gifs[Math.floor(Math.random() * gifs.length)];
          setGifSrc(`/gifs/${randomGif}?t=${Date.now()}`);

          if (sfxRef.current) {
            sfxRef.current.currentTime = 0;
            sfxRef.current.play().catch(e => console.error("Error playing audio:", e));
          }

          setIsVisible(true);
          if (timeoutRef.current) clearTimeout(timeoutRef.current);
          timeoutRef.current = setTimeout(() => {
            setIsVisible(false);
            setTimeout(() => { setGifSrc(""); }, 250); // Hide gif after fade out
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
      <img id="gif" className="gif" src={gifSrc} alt="celebration" style={{ display: gifSrc ? 'block' : 'none' }} />
      <div id="trade" className="trade-text">{tradeText}</div>
      <audio id="sfx" preload="auto" ref={sfxRef}>
        <source src="/kaching.mp3" type="audio/mpeg" />
      </audio>
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
