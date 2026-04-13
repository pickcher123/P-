// src/app/api/payuni/route.ts
import { NextResponse, type NextRequest } from 'next/server';
import crypto from 'crypto';
import { adminDb } from '@/firebase/admin';
import admin from 'firebase-admin';

/**
 * Manually builds a URL-encoded query string from an object,
 * ensuring a fixed, non-alphabetical order of keys.
 */
function createQueryString(data: Record<string, any>): string {
    const params = new URLSearchParams();
    for (const key in data) {
        if (data[key] !== undefined && data[key] !== null) {
            params.append(key, String(data[key]));
        }
    }
    return params.toString();
}

/**
 * AES-256-CBC Encryption
 */
function encrypt(plaintext: string, key: string, iv: string): string {
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return encrypted;
}

/**
 * PAYUNi SHA256 Signature
 */
function sha256(encryptStr: string, key: string, iv: string): string {
  const hashString = `HashKey=${key}&${encryptStr}&HashIV=${iv}`;
  const hash = crypto.createHash("sha256").update(hashString);
  return hash.digest("hex").toUpperCase();
}

export async function POST(req: NextRequest) {
  try {
    // 改用原生 process.env 避免因 env.mjs 遺失導致建置失敗
    const hashKey = (process.env.PAYUNI_HASH_KEY || '').trim();
    const hashIV = (process.env.PAYUNI_HASH_IV || '').trim();
    const merchantId = (process.env.PAYUNI_MERCHANT_ID || '').trim();
    const apiUrl = (process.env.PAYUNI_API_URL || '').trim();
    const appUrl = (process.env.NEXT_PUBLIC_APP_URL || '').trim().replace(/\/$/, '');

    if (!hashKey || !hashIV || !merchantId || !apiUrl) {
        throw new Error('Missing required PAYUNi environment variables.');
    }

    const { userId, orderDetails } = await req.json();

    if (!userId || !orderDetails || !orderDetails.amt || !orderDetails.prodDesc || !orderDetails.email) {
      return NextResponse.json({ error: 'Missing required order details or userId' }, { status: 400 });
    }
    
    const timestamp = String(Math.floor(Date.now() / 1000));
    const merTradeNo = `pcarder_${timestamp}`;

    // Create a pending transaction record
    if (adminDb) {
        const transactionRef = adminDb.collection('transactions').doc(merTradeNo);
        await transactionRef.set({
          userId: userId,
          transactionType: 'Deposit',
          section: 'deposit',
          amount: orderDetails.amt,
          status: 'pending',
          details: `PAYUNi deposit initiated - ${orderDetails.prodDesc}`,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          transactionDate: admin.firestore.FieldValue.serverTimestamp(),
        });
    }

    const tradeInfoPayload: Record<string, any> = {
        MerID: merchantId,
        MerTradeNo: merTradeNo,
        TradeAmt: orderDetails.amt,
        Timestamp: timestamp,
        ReturnURL: process.env.PAYUNI_RETURN_URL || `${appUrl}/payment/result`,
        NotifyURL: process.env.PAYUNI_NOTIFY_URL || `${appUrl}/api/payuni/notify`,
        UsrMail: orderDetails.email,
        ProdDesc: orderDetails.prodDesc,
    };
    
    const plaintext = createQueryString(tradeInfoPayload);

    const encryptInfo = encrypt(plaintext, hashKey, hashIV);
    const hashInfo = sha256(encryptInfo, hashKey, hashIV);
    
    // --- 加入 Debug Log 讓使用者可以提供給客服 ---
    console.log('\n========== PAYUNI DEBUG INFO ==========');
    console.log('1. 原始交易資料 (Plaintext):', plaintext);
    console.log('2. 加密後字串 (EncryptInfo):', encryptInfo);
    console.log('3. 壓碼前字串 (Hash String):', `HashKey=${hashKey}&${encryptInfo}&HashIV=${hashIV}`);
    console.log('4. 壓碼後字串 (HashInfo):', hashInfo);
    console.log('5. 最終 POST 參數:', {
      ApiUrl: apiUrl,
      MerID: merchantId,
      Version: '2.0',
      EncryptInfo: encryptInfo,
      HashInfo: hashInfo,
    });
    console.log('=======================================\n');

    return NextResponse.json({
      ApiUrl: apiUrl,
      MerID: merchantId,
      Version: '2.0',
      EncryptInfo: encryptInfo,
      HashInfo: hashInfo,
    });
    
  } catch (error) {
    console.error('PAYUNi API Error:', error);
    const message = error instanceof Error ? error.message : 'Failed to create payment request';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
