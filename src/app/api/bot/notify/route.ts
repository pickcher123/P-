import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { pushLineMessage } from '@/lib/line';

export const dynamic = 'force-dynamic';

export async function GET() {
  const ownerId = process.env.LINE_OWNER_ID;
  if (!ownerId) {
    return NextResponse.json({ error: 'Owner ID not set' }, { status: 500 });
  }

  const poolsSnapshot = await adminDb.collection('cardPools').get();
  let message = '每日卡池狀態更新：\n';
  
  poolsSnapshot.forEach((doc) => {
    const data = doc.data();
    message += `- ${data.name || '未知卡池'}: 剩餘 ${data.remainingPacks || 0} 包\n`;
  });

  await pushLineMessage(ownerId, message);
  return NextResponse.json({ success: true });
}
