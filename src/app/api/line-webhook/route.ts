import { NextRequest, NextResponse } from 'next/server';
import { validateSignature } from '@line/bot-sdk';

const channelSecret = process.env.LINE_CHANNEL_SECRET || '';

export async function POST(req: NextRequest) {
  const body = await req.text();
  const signature = req.headers.get('x-line-signature') || '';

  if (!validateSignature(body, channelSecret, signature)) {
    return new NextResponse('Invalid signature', { status: 401 });
  }

  const events = JSON.parse(body).events;
  
  // Handle events
  // Examples:
  // for (const event of events) {
  //   if (event.type === 'message' && event.message.type === 'text') {
  //     // Process chatbot logic here (Requirement C)
  //   }
  // }

  return NextResponse.json({ success: true });
}
