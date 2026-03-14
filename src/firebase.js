import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyD8lHK5zVPcBaN6QwrFeuVRcJQVsSUzgiA",
  authDomain: "my-video-archive-ed061.firebaseapp.com",
  projectId: "my-video-archive-ed061",
  storageBucket: "my-video-archive-ed061.firebasestorage.app",
  messagingSenderId: "127834607008",
  appId: "1:127834607008:web:a160bc8792b241d4c1e8c5",
  measurementId: "G-T9VMR5H2JC"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
