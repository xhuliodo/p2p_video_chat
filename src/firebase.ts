// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBty7Ge_BUbn7d-9Kqneltkfzu6hMibcps",
  authDomain: "p2p-video-chat-a9e7a.firebaseapp.com",
  projectId: "p2p-video-chat-a9e7a",
  storageBucket: "p2p-video-chat-a9e7a.appspot.com",
  messagingSenderId: "347000379302",
  appId: "1:347000379302:web:a05d2fae4549f15a3fa167",
  measurementId: "G-GMM08CP55N",
};

// Initialize Firebase
export const app = initializeApp(firebaseConfig);
export const analytics = getAnalytics(app);
export const firestore = getFirestore(app);
