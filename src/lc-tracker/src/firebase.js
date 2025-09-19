import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const apiKey = process.env.REACT_APP_FIREBASE_API_KEY;

let app = null;
let auth = null;
let db = null;

if (apiKey) {
  const firebaseConfig = {
    apiKey: apiKey,
    authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
    storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.REACT_APP_FIREBASE_APP_ID,
    measurementId: process.env.REACT_APP_FIREBASE_MEASUREMENT_ID || undefined,
  };
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
} else {
  // No API key -> Firebase not initialized (use localStorage fallback)
  console.warn('Firebase not initialized: REACT_APP_FIREBASE_API_KEY is not set');
}

export { auth, db };
