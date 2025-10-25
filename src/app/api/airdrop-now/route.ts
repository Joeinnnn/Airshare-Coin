import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

async function handleAirdropLogic() {
  try {
    const endFile = path.join(process.cwd(), 'data', 'airdrop_end.txt');
    
    // End now
    fs.writeFileSync(endFile, String(Date.now()), 'utf8');

    // Also compute winners immediately from topbuyers.json for instant UX
    try {
      const tbPath = path.join(process.cwd(), 'data', 'topbuyers.json');
      const raw = fs.existsSync(tbPath) ? fs.readFileSync(tbPath, 'utf8') : '[]';
      const arr = JSON.parse(raw || '[]');
      const topN = Math.max(1, Number(process.env.AIRDROP_TOP_N || 3));
      const winners = (Array.isArray(arr) ? arr : []).slice(0, topN);
      const winJson = { end: Date.now(), winners };
      fs.writeFileSync(path.join(process.cwd(), 'data', 'airdrop_winners.json'), JSON.stringify(winJson, null, 2), 'utf8');
      fs.writeFileSync(path.join(process.cwd(), 'data', 'airdrop_winners.txt'), winners.map(w => `${w.address} ${Number(w.totalSol||0).toFixed(4)} SOL`).join('\n'), 'utf8');
      
      // Schedule next round for 5 minutes specifically (one-time override)
      try { fs.writeFileSync(path.join(process.cwd(), 'data', 'airdrop_next_override_min.txt'), String(5), 'utf8'); } catch(_) {}
      const nextEnd = Date.now() + 5 * 60_000;
      fs.writeFileSync(endFile, String(nextEnd), 'utf8');
    } catch (_) {}

    return NextResponse.json({ ok: true, message: 'Airdrop executed' });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}

export async function POST() {
  return handleAirdropLogic();
}

export async function GET() {
  return handleAirdropLogic();
}
