'use client';

import { useState, useEffect } from 'react';
import { collection, query, orderBy, onSnapshot, doc, QueryConstraint } from 'firebase/firestore';
import { db } from './firebase';
import { Settings } from './types';
import { DEFAULT_SETTINGS } from './constants';

export function useCollection<T>(
  collectionName: string,
  constraints: QueryConstraint[] = [],
  sortField: string = 'createdAt',
  sortDir: 'asc' | 'desc' = 'desc'
) {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(
      collection(db, collectionName),
      ...constraints,
      orderBy(sortField, sortDir)
    );
    const unsub = onSnapshot(q, (snapshot) => {
      const items = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as T));
      setData(items);
      setLoading(false);
    }, (error) => {
      console.error(`Error fetching ${collectionName}:`, error);
      setLoading(false);
    });
    return unsub;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collectionName, sortField, sortDir]);

  return { data, loading };
}

export function useSettings() {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'config', 'settings'), (snap) => {
      if (snap.exists()) {
        setSettings({ ...DEFAULT_SETTINGS, ...snap.data() } as Settings);
      }
      setLoading(false);
    });
    return unsub;
  }, []);

  return { settings, loading };
}
