import { initializeApp, getApps } from 'firebase/app';
import { getFirestore, collection, doc, setDoc, onSnapshot, runTransaction } from 'firebase/firestore';
import { getAuth, signInAnonymously } from 'firebase/auth';

let app = null;
let db = null;
let auth = null;
let ready = false;

export function init(config) {
  if (!config) return false;
  try {
    if (getApps().length === 0) {
      app = initializeApp(config);
      db = getFirestore(app);
      auth = getAuth(app);
      signInAnonymously(auth).catch(() => {});
      ready = true;
    }
    return ready;
  } catch (e) {
    console.warn('firebase init error', e);
    return false;
  }
}

export function isReady() {
  return ready && !!db;
}

export async function syncPlayerPosition(playerId, payload) {
  if (!db) return;
  try {
    await setDoc(doc(db, 'players', playerId), { ...payload, updatedAt: new Date() }, { merge: true });
  } catch (e) { console.warn('syncPlayerPosition error', e); }
}

export function subscribeToPlayers(callback) {
  if (!db) return () => {};
  const q = collection(db, 'players');
  return onSnapshot(q, snap => {
    const arr = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    callback(arr);
  });
}

export function subscribeToChests(callback) {
  if (!db) return () => {};
  const q = collection(db, 'chests');
  return onSnapshot(q, snap => {
    const arr = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    callback(arr);
  });
}

export async function createChest(chest) {
  if (!db) return;
  try {
    await setDoc(doc(db, 'chests', chest.id), chest, { merge: true });
  } catch (e) { console.warn('createChest error', e); }
}

export async function markChestOpened(chestId, openedBy) {
  if (!db) return;
  try {
    await setDoc(doc(db, 'chests', chestId), { opened: true, openedBy, openedAt: new Date() }, { merge: true });
  } catch (e) { console.warn('markChestOpened error', e); }
}

export async function donateItemTransaction(fromId, toId, item) {
  if (!db) throw new Error('Firebase não inicializado');
  return runTransaction(db, async (tx) => {
    const fromRef = doc(db, 'inventories', fromId);
    const toRef = doc(db, 'inventories', toId);
    const fromSnap = await tx.get(fromRef);
    const toSnap = await tx.get(toRef);
    let fromInv = fromSnap.exists() ? (fromSnap.data().items || []) : [];
    let toInv = toSnap.exists() ? (toSnap.data().items || []) : [];
    const idx = fromInv.findIndex(i => i.instanceId === item.instanceId);
    if (idx < 0) throw new Error('Item não encontrado');
    const it = fromInv.splice(idx, 1)[0];
    toInv.push(it);
    tx.set(fromRef, { items: fromInv }, { merge: true });
    tx.set(toRef, { items: toInv }, { merge: true });
  });
}

export default {
  init,
  isReady,
  syncPlayerPosition,
  subscribeToPlayers,
  subscribeToChests,
  createChest,
  markChestOpened,
  donateItemTransaction
};