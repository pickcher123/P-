'use client';

import { useState, useEffect } from 'react';
import {
  Query,
  getDocs,
  DocumentData,
  FirestoreError,
  QuerySnapshot,
  CollectionReference,
  getDoc,
  DocumentReference,
  DocumentSnapshot,
} from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

/** Utility type to add an 'id' field to a given type T. */
export type WithId<T> = T & { id: string };

export interface UseRequestResult<T> {
  data: T | null;
  isLoading: boolean;
  error: FirestoreError | Error | null;
  refetch: () => void;
}

/**
 * Hook to perform a one-time fetch (getDoc or getDocs) instead of a real-time listener.
 * This is significantly more cost-effective for static data or dashboards that don't need real-time updates.
 */
export function useRequest<T = any>(
  memoizedTarget: CollectionReference<DocumentData> | Query<DocumentData> | DocumentReference<DocumentData> | null | undefined
): UseRequestResult<T> {
  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<FirestoreError | Error | null>(null);
  const [tick, setTick] = useState(0);

  const refetch = () => setTick((t) => t + 1);

  useEffect(() => {
    if (!memoizedTarget) {
      setData(null);
      setIsLoading(false);
      setError(null);
      return;
    }

    let isMounted = true;
    setIsLoading(true);
    setError(null);

    const fetchData = async () => {
      try {
        let result: any;
        if (memoizedTarget.type === 'collection' || memoizedTarget.type === 'query') {
          const snapshot = await getDocs(memoizedTarget as Query<DocumentData>);
          result = snapshot.docs.map((doc) => ({
            ...(doc.data() as any),
            id: doc.id,
          }));
        } else if (memoizedTarget.type === 'document') {
          const snapshot = await getDoc(memoizedTarget as DocumentReference<DocumentData>);
          if (snapshot.exists()) {
            result = { ...(snapshot.data() as any), id: snapshot.id };
          } else {
            result = null;
          }
        }

        if (isMounted) {
          setData(result);
          setError(null);
        }
      } catch (fError: any) {
        console.error('Firestore useRequest Error:', fError.code, fError.message);
        if (isMounted) {
          if (fError.code === 'permission-denied') {
            const contextualError = new FirestorePermissionError({
              operation: memoizedTarget.type === 'document' ? 'get' : 'list',
              path: (memoizedTarget as any).path || 'query',
            });
            setError(contextualError);
            errorEmitter.emit('permission-error', contextualError);
          } else {
            setError(fError);
          }
          setData(null);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    fetchData();

    return () => {
      isMounted = false;
    };
  }, [memoizedTarget, tick]);

  if (memoizedTarget && !(memoizedTarget as any).__memo) {
    throw new Error(memoizedTarget + ' was not properly memoized using useMemoFirebase');
  }

  return { data, isLoading, error, refetch };
}
