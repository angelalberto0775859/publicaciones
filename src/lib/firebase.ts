import { FirebaseApp, getApps, initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyC1yHEgMHgbFoBBxZsZaWvQQ0dMeZim7CA",
  authDomain: "publicaciones-36823.firebaseapp.com",
  projectId: "publicaciones-36823",
  storageBucket: "publicaciones-36823.firebasestorage.app",
  messagingSenderId: "1049162777328",
  appId: "1:1049162777328:web:ff02a69e52a493aa1eb835"
};

const app: FirebaseApp = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);

export const db = getFirestore(app);
export const firebaseApp = app;
