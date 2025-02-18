// src/firebaseConfig.ts
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAnalytics } from "firebase/analytics";

const firebaseConfig = {
  apiKey: "AIzaSyAiiy7v4QC6Wrd7esE0lfiP9lVCJ5gryzI",
  authDomain: "grades-c7fc5.firebaseapp.com",
  projectId: "grades-c7fc5",
  storageBucket: "grades-c7fc5.firebasestorage.app",
  messagingSenderId: "247528708147",
  appId: "1:247528708147:web:1db3994ef169dbcc3deb46",
  measurementId: "G-6D0F3HSP4C",
};

const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const db = getFirestore(app);

export { db, analytics };
