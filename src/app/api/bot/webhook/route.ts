import { NextRequest, NextResponse } from 'next/server';
import { messagingApi, WebhookEvent, validateSignature } from '@line/bot-sdk';
import { adminDb } from '@/lib/firebase-admin';

const channelSecret = process.env.LINE_CHANNEL_SECRET || '';
const channelAccessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN || '';

const client = new messagingApi.MessagingApiClient({
  channelAccessToken,
});

export async function POST(req: NextRequest) {
  const body = await req.text();
  const signature = req.headers.get('x-line-signature') || '';

  if (!validateSignature(body, channelSecret, signature)) {
    return new NextResponse('Invalid signature', { status: 401 });
  }

  const events: WebhookEvent[] = JSON.parse(body).events;
  
  for (const event of events) {
    if (event.type === 'message' && event.message?.type === 'text') {
      const text = event.message.text;
      
      if (text.includes('卡池')) {
        await handlePoolQuery(event);
      }
    }
  }

  return NextResponse.json({ success: true });
}

async function handlePoolQuery(event: WebhookEvent) {
  if (event.type !== 'message' || event.message?.type !== 'text') return;
  
  const poolsSnapshot = await adminDb.collection('cardPools').get();
  let message = '目前卡池狀態：\n';
  
  poolsSnapshot.forEach((doc) => {
    const data = doc.data();
    message += `- ${data.name || '未知卡池'}: 剩餘 ${data.remainingPacks || 0} 包\n`;
  });

  await client.replyMessage({
    replyToken: event.replyToken,
    messages: [
      {
        type: 'text',
        text: message,
      },
    ],
  });
}
