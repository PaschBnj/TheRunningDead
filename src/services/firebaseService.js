import { initializeApp, getApps } from 'firebase/app';
import { getFirestore, collection, doc, setDoc, onSnapshot, runTransaction } from 'firebase/firestore';
import {
  initializeAuth,
  getReactNativePersistence,
  signInAnonymously,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithCredential,
  GoogleAuthProvider,
  OAuthProvider,
  signInWithPhoneNumber
} from 'firebase/auth/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

let app = null;
let db = null;
let auth = null;
let ready = false;

export function init(config) {
  if (!config) return false;
  try {
    if (getApps().length === 0) {
      app = initializeApp(config);
    } else {
      app = getApps()[0];
    }
    db = getFirestore(app);
    if (!auth) {
      auth = initializeAuth(app, { persistence: getReactNativePersistence(AsyncStorage) });
    }
    if (!auth.currentUser) {
      signInAnonymously(auth).catch(() => {});
    }
    ready = true;
    return true;
  } catch (e) {
    console.warn('firebase init error', e);
    return false;
  }
}

export function isReady() {
  return ready && !!db;
}

export function getAuthInstance() {
  return auth;
}

export function onAuthStateChange(callback) {
  if (!auth) return () => {};
  return onAuthStateChanged(auth, callback);
}

export async function signInWithEmail(email, password) {
  if (!auth) throw new Error('Firebase não inicializado');
  return signInWithEmailAndPassword(auth, email, password);
}

export async function createAccountWithEmail(email, password) {
  if (!auth) throw new Error('Firebase não inicializado');
  return createUserWithEmailAndPassword(auth, email, password);
}

export async function signInWithGoogleToken(idToken) {
  if (!auth) throw new Error('Firebase não inicializado');
  const credential = GoogleAuthProvider.credential(idToken);
  return signInWithCredential(auth, credential);
}

export async function signInWithAppleToken(idToken, rawNonce) {
  if (!auth) throw new Error('Firebase não inicializado');
  const provider = new OAuthProvider('apple.com');
  const credential = provider.credential({ idToken, rawNonce });
  return signInWithCredential(auth, credential);
}

export function requestPhoneSignIn(phoneNumber, verifier) {
  if (!auth) throw new Error('Firebase não inicializado');
  return signInWithPhoneNumber(auth, phoneNumber, verifier);
}

export function confirmPhoneSignIn(confirmationResult, code) {
  if (!confirmationResult) throw new Error('Confirmação de telefone inválida');
  return confirmationResult.confirm(code);
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

export function subscribeToZombies(callback) {
  if (!db) return () => {};
  const q = collection(db, 'zombies');
  return onSnapshot(q, snap => {
    const arr = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    callback(arr);
  });
}

export function subscribeToClanMembers(callback) {
  if (!db) return () => {};
  const q = collection(db, 'clanMembers');
  return onSnapshot(q, snap => {
    const map = {};
    snap.docs.forEach(d => {
      const data = d.data();
      if (data.clanId) map[d.id] = data.clanId;
    });
    callback(map);
  });
}

export function subscribeToClans(callback) {
  if (!db) return () => {};
  const q = collection(db, 'clans');
  return onSnapshot(q, snap => {
    const map = {};
    snap.docs.forEach(d => { map[d.id] = { id: d.id, ...d.data() }; });
    callback(map);
  });
}

export async function createChest(chest) {
  if (!db) return;
  try {
    await setDoc(doc(db, 'chests', chest.id), chest, { merge: true });
  } catch (e) { console.warn('createChest error', e); }
}

export async function createZombie(zombie) {
  if (!db) return;
  try {
    await setDoc(doc(db, 'zombies', zombie.id), zombie, { merge: true });
  } catch (e) { console.warn('createZombie error', e); }
}

export async function markChestOpened(chestId, openedBy) {
  if (!db) return;
  try {
    await setDoc(doc(db, 'chests', chestId), { opened: true, openedBy, openedAt: new Date() }, { merge: true });
  } catch (e) { console.warn('markChestOpened error', e); }
}

export async function saveInventory(playerId, items) {
  if (!db) return;
  try {
    await setDoc(doc(db, 'inventories', playerId), { items }, { merge: true });
  } catch (e) { console.warn('saveInventory error', e); }
}

export async function setClanMembership(playerId, clanId, clanName = null, clanPhoto = null) {
  if (!db) return;
  const ops = [];
  try {
    ops.push(setDoc(doc(db, 'clanMembers', playerId), { playerId, clanId }, { merge: true }));
    if (clanId) {
      const clanPayload = { id: clanId };
      if (clanName) clanPayload.name = clanName;
      if (clanPhoto) clanPayload.photo = clanPhoto;
      ops.push(setDoc(doc(db, 'clans', clanId), clanPayload, { merge: true }));
    }
    await Promise.all(ops);
  } catch (e) { console.warn('setClanMembership error', e); throw e; }
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
  getAuthInstance,
  onAuthStateChange,
  signInWithEmail,
  createAccountWithEmail,
  signInWithGoogleToken,
  signInWithAppleToken,
  requestPhoneSignIn,
  confirmPhoneSignIn,
  saveInventory,
  syncPlayerPosition,
  subscribeToPlayers,
  subscribeToChests,
  subscribeToZombies,
  subscribeToClanMembers,
  subscribeToClans,
  createChest,
  createZombie,
  markChestOpened,
  donateItemTransaction,
  setClanMembership
};
