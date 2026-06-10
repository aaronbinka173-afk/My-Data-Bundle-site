import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyDN3381rPnEo_HqyXSHoTzQ29HmYVwhQ",
  authDomain: "gen-lang-client-0077711356.firebaseapp.com",
  projectId: "gen-lang-client-0077711356",
  appId: "1:842430067706:web:e7290f6bbd0c1fdb806a43",
  firestoreDatabaseId: "ai-studio-c466a535-32d1-4edb-9b61-4e4d1ad0cf4c"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
