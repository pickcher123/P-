import { adminDb } from './src/lib/firebase-admin';

async function scanForBadImages() {
  const badUrls = [
    'https://images.unsplash.com/photo-1598471719602-5364861271f8?q=80&w=800&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1549471569-7c858e72750e?q=80&w=800&auto=format&fit=crop'
  ];
  
  const collections = ['cardPools', 'news', 'cards']; // Add relevant collections
  
  for (const col of collections) {
    console.log(`Scanning ${col}...`);
    const snapshot = await adminDb.collection(col).get();
    for (const doc of snapshot.docs) {
      const data = doc.data();
      for (const key in data) {
        if (typeof data[key] === 'string' && badUrls.includes(data[key])) {
          console.log(`Found bad URL in ${col}/${doc.id}: ${key}`);
          // await doc.ref.update({ [key]: 'https://picsum.photos/seed/placeholder/800/600' });
          // console.log('Updated to placeholder.');
        }
      }
    }
  }
}

scanForBadImages().catch(console.error);
