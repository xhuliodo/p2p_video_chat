// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import {
  arrayUnion,
  deleteDoc,
  doc,
  getDoc,
  getFirestore,
  onSnapshot,
  setDoc,
  updateDoc,
} from "firebase/firestore";

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
const app = initializeApp(firebaseConfig);
const firestore = getFirestore(app);

export interface CallDb {
  offer: RTCSessionDescriptionInit;
  offerCandidates?: RTCIceCandidate[];
  answer?: RTCSessionDescriptionInit;
  answerCandidates?: RTCIceCandidate[];
  left?: boolean;
}

export const deleteCallByPassphrase = (passphrase: string): Promise<void> => {
  const callDocRef = doc(firestore, "calls", passphrase);
  return deleteDoc(callDocRef);
};

export const getCallByPassphrase = async (
  passphrase: string,
): Promise<CallDb | null> => {
  const callDocRef = doc(firestore, "calls", passphrase);
  const callDocSnap = await getDoc(callDocRef);
  if (!callDocSnap.exists()) {
    return null;
  }

  const foundCall = callDocSnap.data() as CallDb;
  return foundCall;
};

export const updateCallOfferIceCandidates = async (
  passphrase: string,
  iceCandidate: RTCIceCandidate,
): Promise<void> => {
  const callDocRef = doc(firestore, "calls", passphrase);
  return updateDoc(callDocRef, {
    offerCandidates: arrayUnion(iceCandidate.toJSON()),
  });
};

export const updateCallAnswerIceCandidates = async (
  passphrase: string,
  iceCandidate: RTCIceCandidate,
): Promise<void> => {
  const callDocRef = doc(firestore, "calls", passphrase);
  return updateDoc(callDocRef, {
    answerCandidates: arrayUnion(iceCandidate.toJSON()),
  });
};

export const updateCallOffer = async (
  passphrase: string,
  offer: RTCSessionDescriptionInit,
): Promise<void> => {
  const callDocRef = doc(firestore, "calls", passphrase);
  return await setDoc(callDocRef, { offer });
};

export const updateCallAnswer = async (
  passphrase: string,
  answer: RTCSessionDescriptionInit,
): Promise<void> => {
  const callDocRef = doc(firestore, "calls", passphrase);
  return await setDoc(callDocRef, { answer });
};

export const updateCallLeft = async (
  passphrase: string,
  left: boolean,
): Promise<void> => {
  const callDocRef = doc(firestore, "calls", passphrase);
  return await setDoc(callDocRef, { left });
};

export const subscribeToCallUpdates = (
  passphrase: string,
  callbackFunc: (updatedCall: CallDb) => void,
) => {
  const callDocRef = doc(firestore, "calls", passphrase);
  return onSnapshot(callDocRef, {
    next: (doc) => {
      const updatedCall = doc.data() as CallDb;
      callbackFunc(updatedCall);
    },
  });
};
