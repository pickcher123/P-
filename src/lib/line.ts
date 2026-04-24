import { Client, WebhookEvent, MessageAPIResponseBase } from '@line/bot-sdk';

const config = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN || '',
  channelSecret: process.env.LINE_CHANNEL_SECRET || '',
};

let lineClient: Client | null = null;

export function getLineClient(): Client {
  if (!lineClient) {
    if (!config.channelAccessToken || !config.channelSecret) {
      throw new Error('LINE_CHANNEL_ACCESS_TOKEN and LINE_CHANNEL_SECRET environment variables are required');
    }
    lineClient = new Client(config);
  }
  return lineClient;
}

export async function sendLineMessage(userId: string, message: string): Promise<MessageAPIResponseBase> {
  const client = getLineClient();
  return client.pushMessage(userId, { type: 'text', text: message });
}
