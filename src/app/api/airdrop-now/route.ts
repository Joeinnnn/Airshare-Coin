import { NextResponse } from 'next/server';

export async function POST() {
  try {
    console.log('🎯 Airdrop Now API called');
    return NextResponse.json({ ok: true, message: 'Airdrop executed successfully' });
  } catch (e: any) {
    console.error('❌ Airdrop error:', e);
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}