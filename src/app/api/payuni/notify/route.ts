// src/app/api/payuni/notify/route.ts
import { NextResponse, type NextRequest } from 'next/server';
import crypto from 'crypto';
import querystring from 'node:querystring';
import { adminDb } from '@/firebase/admin';
import admin from 'firebase-admin';

function decrypt(encryptStr: string, key: string, iv: string): string {
  try {
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
    // PayUni might not use standard padding sometimes, but usually it does.
    // decipher.setAutoPadding(false); // Only if padding issues occur
    let decrypted = decipher.update(encryptStr, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (error) {
    console.error("AES-256-CBC decryption failed:", error);
    throw new Error("Failed to decrypt notification data.");
  }
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const status = formData.get('Status');
    const encryptInfo = formData.get('EncryptInfo') as string;

    if (status !== 'SUCCESS') return NextResponse.json({ status: 'success' });

    const hashKey = (process.env.PAYUNI_HASH_KEY || '').trim();
    const hashIV = (process.env.PAYUNI_HASH_IV || '').trim();

    if (!hashKey || !hashIV || !adminDb) {
        return NextResponse.json({ status: 'success' });
    }

    const decryptedString = decrypt(encryptInfo, hashKey, hashIV);
    
    let result: any;
    try {
        result = JSON.parse(decryptedString);
        if (result.Result) result = result.Result;
    } catch (e) {
        result = querystring.parse(decryptedString);
    }

    const { TradeAmt, MerTradeNo, TradeNo, TradeStatus } = result;
    const amount = Number(TradeAmt);
    const ourTradeId = MerTradeNo as string;
    const payuniTradeId = TradeNo as string;
    
    if (result.TradeStatus !== '1') return NextResponse.json({ status: 'success' });

    await adminDb.runTransaction(async (t) => {
        const transactionRef = adminDb.collection('transactions').doc(ourTradeId);
        const transactionDoc = await t.get(transactionRef);

        if (!transactionDoc.exists || transactionDoc.data()?.status === 'completed') return;

        const userId = transactionDoc.data()?.userId;
        const userRef = adminDb.collection('users').doc(userId);
        
        let bonus = 0;
        if (amount >= 30000) bonus = Math.floor(amount * 0.10);
        else if (amount >= 10000) bonus = Math.floor(amount * 0.08);
        else if (amount >= 5000) bonus = Math.floor(amount * 0.06);

        t.update(userRef, { points: admin.firestore.FieldValue.increment(amount + bonus) });
        t.update(transactionRef, {
            status: 'completed',
            payuniTradeNo: payuniTradeId,
            details: `線上儲值 ${amount} 點${bonus > 0 ? ` (含點數包加贈 ${bonus} 點)` : ''}`,
            transactionDate: admin.firestore.FieldValue.serverTimestamp(),
        });
    });

    return NextResponse.json({ status: 'success' });
  } catch (error) {
    console.error("PAYUNi Notify Error:", error);
    return NextResponse.json({ status: 'success' });
  }
}
