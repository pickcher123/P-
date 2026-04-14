import admin from 'firebase-admin';

/**
 * 延遲初始化 Firebase Admin
 * 確保在 Next.js 建置期間 (Static Analysis) 不會因為嘗試連線而導致崩潰
 */
function getAdminApp() {
  if (typeof window !== 'undefined') return null;
  
  if (!admin.apps.length) {
    try {
      if (process.env.FIREBASE_PRIVATE_KEY) {
        return admin.initializeApp({
          credential: admin.credential.cert({
            projectId: process.env.FIREBASE_PROJECT_ID,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            // 處理 Vercel 環境變數中的換行字元
            privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
          }),
        });
      }
      return admin.initializeApp();
    } catch (error) {
      console.error('Firebase admin initialization error details:', error);
      // 僅在生產環境且非建置階段記錄錯誤
      if (process.env.NODE_ENV === 'production' && !process.env.NEXT_PHASE) {
        console.error('Firebase admin initialization error', error);
      }
      return null;
    }
  }
  return admin.app();
}

/**
 * 使用 Getter 模式獲取實例，防止建置期崩潰
 */
export const getAdminDb = () => {
  const app = getAdminApp();
  return app ? app.firestore() : null;
};

export const getAdminAuth = () => {
  const app = getAdminApp();
  return app ? app.auth() : null;
};

// 安全導出變數 (由 Getter 保障)
export const adminDb = typeof window === 'undefined' ? getAdminApp()?.firestore() : null;
export const adminAuth = typeof window === 'undefined' ? getAdminApp()?.auth() : null;
