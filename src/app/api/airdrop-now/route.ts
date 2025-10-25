import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

async function handleAirdropLogic() {
  try {
    console.log('🎯 Airdrop Now API called');
    const endFile = path.join(process.cwd(), 'data', 'airdrop_end.txt');
    
    // End now
    fs.writeFileSync(endFile, String(Date.now()), 'utf8');
    console.log('✅ Airdrop end time set to now');

    // Also compute winners immediately from topbuyers.json for instant UX
    try {
      const tbPath = path.join(process.cwd(), 'data', 'topbuyers.json');
      console.log('📊 Reading topbuyers from:', tbPath);
      const raw = fs.existsSync(tbPath) ? fs.readFileSync(tbPath, 'utf8') : '[]';
      console.log('📊 Raw topbuyers data:', raw);
      const arr = JSON.parse(raw || '[]');
      console.log('📊 Parsed topbuyers array:', arr);
      
      // Get top 3 traders and randomly select 3 from them
      const top3 = (Array.isArray(arr) ? arr : []).slice(0, 3);
      const numWinners = Math.min(3, top3.length);
      console.log('🎲 Top 3 traders:', top3);
      console.log('🎲 Number of winners:', numWinners);
      
      // Shuffle the top 3 and select winners
      const shuffled = [...top3].sort(() => Math.random() - 0.5);
      const winners = shuffled.slice(0, numWinners);
      console.log('🏆 Selected winners:', winners);
      
      const winJson = { end: Date.now(), winners, selectionMethod: 'random_from_top3' };
      fs.writeFileSync(path.join(process.cwd(), 'data', 'airdrop_winners.json'), JSON.stringify(winJson, null, 2), 'utf8');
      fs.writeFileSync(path.join(process.cwd(), 'data', 'airdrop_winners.txt'), winners.map(w => `${w.address} ${Number(w.totalSol||0).toFixed(4)} SOL`).join('\n'), 'utf8');
      console.log('✅ Winners written to files');
      
      // Schedule next round for 5 minutes specifically (one-time override)
      try { fs.writeFileSync(path.join(process.cwd(), 'data', 'airdrop_next_override_min.txt'), String(5), 'utf8'); } catch(_) {}
      const nextEnd = Date.now() + 5 * 60_000;
      fs.writeFileSync(endFile, String(nextEnd), 'utf8');
    } catch (e) {
      console.error('❌ Error processing winners:', e);
    }

    return NextResponse.json({ ok: true, message: 'Airdrop executed' });
  } catch (e: any) {
    console.error('❌ Airdrop error:', e);
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}

export async function POST() {
  return handleAirdropLogic();
}

export async function GET() {
  return handleAirdropLogic();
}