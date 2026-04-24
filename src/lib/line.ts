import { messagingApi } from '@line/bot-sdk';

const channelAccessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN || '';

const client = new messagingApi.MessagingApiClient({
  channelAccessToken,
});

export async function pushLineMessage(userId: string, message: string) {
  if (!channelAccessToken) {
    console.warn('LINE_CHANNEL_ACCESS_TOKEN is not set');
    return;
  }
  
  try {
    await client.pushMessage({
      to: userId,
      messages: [
        {
          type: 'text',
          text: message,
        },
      ],
    });
  } catch (error) {
    console.error('Error pushing LINE message:', error);
  }
}
