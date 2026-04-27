'use server'

import { adminDb } from '@/lib/firebase-admin';
import * as admin from 'firebase-admin';

export async function resetLuckyBagParticipants(userId: string, luckyBagId: string) {
  try {
    // 1. 驗證權限 (超級管理員)
    const userSnap = await adminDb.collection('users').doc(userId).get();
    if (!userSnap.exists) throw new Error('使用者不存在');
    const userData = userSnap.data();
    if (userData?.email !== 'pickcher123@gmail.com') {
      throw new Error('只有超級管理員可以執行此操作');
    }

    // 2. 獲取所有購買紀錄並進行退款統計
    const purchasesRef = adminDb.collection('luckBags').doc(luckyBagId).collection('luckBagPurchases');
    const purchasesSnap = await purchasesRef.get();
    
    if (purchasesSnap.empty) {
      // 如果沒有參與者，直接重置並返回
      await adminDb.collection('luckBags').doc(luckyBagId).update({
        status: 'draft',
        revealLottery: false,
        winners: {}
      });
      return { success: true, message: '無參與者，福袋已直接重置為草稿狀態' };
    }

    // 按用戶統計退款金額
    const userRefunds: { [uid: string]: { amount: number, slots: number[] } } = {};
    purchasesSnap.docs.forEach(doc => {
      const data = doc.data();
      const uid = data.userId;
      const price = data.price || 0;
      const slotNum = data.number;

      if (!userRefunds[uid]) {
        userRefunds[uid] = { amount: 0, slots: [] };
      }
      userRefunds[uid].amount += price;
      if (slotNum !== undefined) userRefunds[uid].slots.push(slotNum);
    });

    // 使用 Transaction 確保退款與狀態重置的一致性
    await adminDb.runTransaction(async (transaction) => {
      // 1. 先執行所有讀取操作 (Reads must come before writes)
      const uids = Object.keys(userRefunds);
      const userRefs = uids.map(uid => adminDb.collection('users').doc(uid));
      const userSnaps = await Promise.all(userRefs.map(ref => transaction.get(ref)));
      
      const userDocsMap: { [uid: string]: boolean } = {};
      userSnaps.forEach((snap, index) => {
        userDocsMap[uids[index]] = snap.exists;
      });

      // 2. 執行所有寫入操作
      for (const uid of uids) {
        if (userDocsMap[uid]) {
          const refund = userRefunds[uid];
          const userRef = adminDb.collection('users').doc(uid);
          
          // 退款
          transaction.update(userRef, {
            points: admin.firestore.FieldValue.increment(refund.amount)
          });

          // 建立交易紀錄
          const txRef = adminDb.collection('transactions').doc();
          transaction.set(txRef, {
            userId: uid,
            amount: refund.amount,
            transactionType: 'Refund',
            section: 'lucky-bag',
            source: 'lucky-bag',
            metadata: {
              luckBagId: luckyBagId,
              message: `福袋活動重置退款 (共 ${refund.slots.length} 格)`,
              slots: refund.slots
            },
            transactionDate: admin.firestore.FieldValue.serverTimestamp(),
            createdAt: admin.firestore.FieldValue.serverTimestamp()
          });
        }
      }

      // 刪除所有購買紀錄
      purchasesSnap.docs.forEach(pDoc => {
        transaction.delete(pDoc.ref);
      });

      // 重置福袋狀態
      const bagRef = adminDb.collection('luckBags').doc(luckyBagId);
      transaction.update(bagRef, {
        status: 'draft',
        revealLottery: false,
        winners: {},
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
    });
    
    return { success: true };
  } catch (error: any) {
    console.error('Reset Lucky Bag Error:', error);
    return { success: false, error: error.message };
  }
}
