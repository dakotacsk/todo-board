import { initializeApp } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  onAuthStateChanged,
  signOut,
  connectAuthEmulator,
} from "firebase/auth";
import {
  getFirestore,
  doc,
  onSnapshot,
  runTransaction,
  connectFirestoreEmulator,
} from "firebase/firestore";
import { initial, validate } from "../model.js";
import config from "./firebase-config.json";

export const OWNER_EMAIL = "dakotacsk@gmail.com";
const app = initializeApp(config);
export const auth = getAuth(app);
const db = getFirestore(app);
if (import.meta.env.DEV && import.meta.env.VITE_USE_EMULATORS === "true") {
  connectAuthEmulator(auth, "http://localhost:9099");
  connectFirestoreEmulator(db, "localhost", 8080);
}
export const watchAuth = (callback) => onAuthStateChanged(auth, callback);
export const logout = () => signOut(auth);
export async function login() {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({
    prompt: "select_account",
    login_hint: OWNER_EMAIL,
  });
  const result = await signInWithPopup(auth, provider);
  if (!isOwner(result.user)) {
    await logout();
    throw Error("This workspace is private to " + OWNER_EMAIL + ".");
  }
}
export const isOwner = (user) =>
  user?.emailVerified && user.email?.toLowerCase() === OWNER_EMAIL;
const boardRef = (uid) => doc(db, "users", uid, "boards", "main");
export function watchBoard(uid, onData, onError) {
  return onSnapshot(
    boardRef(uid),
    { includeMetadataChanges: true },
    (snap) => {
      try {
        const stored = snap.exists()
          ? snap.data()
          : { ...initial(), revision: 0 };
        onData({
          data: validate(stored),
          revision: stored.revision || 0,
          fromCache: snap.metadata.fromCache,
        });
      } catch (error) {
        onError(error);
      }
    },
    onError,
  );
}
export async function saveBoard(uid, expectedRevision, change) {
  if (auth.currentUser?.uid !== uid || !isOwner(auth.currentUser))
    throw Error("Please sign in again.");
  return runTransaction(db, async (tx) => {
    const ref = boardRef(uid),
      snap = await tx.get(ref);
    const stored = snap.exists() ? snap.data() : { ...initial(), revision: 0 };
    if ((stored.revision || 0) !== expectedRevision)
      throw Error(
        "Your board changed on another device. Review the latest version and try again.",
      );
    const next = validate(change(validate(stored)));
    const clean = {
      version: 1,
      categories: next.categories,
      tasks: next.tasks,
      revision: expectedRevision + 1,
    };
    if (new TextEncoder().encode(JSON.stringify(clean)).length > 750000)
      throw Error(
        "Your board is getting full. Export a backup and remove older completed tasks before adding more.",
      );
    if (clean.tasks.length > 3000 || clean.categories.length > 100)
      throw Error(
        "This board supports up to 3,000 tasks and 100 categories. Export a backup before removing older items.",
      );
    tx.set(ref, clean);
    return clean;
  });
}
export function friendlyError(error) {
  if (error?.code === "auth/popup-closed-by-user")
    return "Sign-in was cancelled. Try again when you’re ready.";
  if (error?.code === "auth/popup-blocked")
    return "Allow the sign-in popup, or open this site in Chrome or Safari.";
  if (error?.code === "permission-denied")
    return "This Google account does not have access to this board.";
  if (
    error?.code === "unavailable" ||
    error?.code === "auth/network-request-failed"
  )
    return "Could not connect. Check your connection and try again. Your existing data is unchanged.";
  return error?.message || "Something went wrong. Please try again.";
}

// Emulator-only identity for local UI checks; no credential is valid in production.
export async function loginEmulator() {
  if (!import.meta.env.DEV || import.meta.env.VITE_USE_EMULATORS !== "true")
    throw Error("Emulator login is disabled.");
  const { signInWithCredential } = await import("firebase/auth");
  const encode = (value) =>
    btoa(JSON.stringify(value))
      .replace(/=/g, "")
      .replace(/\+/g, "-")
      .replace(/\//g, "_");
  const token =
    encode({ alg: "none", typ: "JWT" }) +
    "." +
    encode({
      sub: "local-owner",
      email: OWNER_EMAIL,
      email_verified: true,
      name: "Local test owner",
      iss: "https://accounts.google.com",
      aud: "demo-daymark",
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600,
    }) +
    ".";
  return signInWithCredential(auth, GoogleAuthProvider.credential(token));
}
