// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import {
  arrayUnion,
  collection,
  doc,
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

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface Participant {}

export interface Connection {
  offer: RTCSessionDescriptionInit;
  answer?: RTCSessionDescriptionInit;
  done?: boolean;
}

export interface CallDb {
  participants: Record<string, Connection>;
  connections: Record<string, Connection>;
  offerCandidates: Record<string, RTCIceCandidate>;
  answerCandidates?: Record<string, RTCIceCandidate>;
}

export const createCallByPassphrase = (passphrase: string): Promise<void> => {
  const callDocRef = doc(firestore, "calls", passphrase);
  return setDoc(callDocRef, {});
};

export const addParticipant = (
  passphrase: string,
  userId: string,
): Promise<void> => {
  const callDocRef = doc(
    firestore,
    "calls",
    passphrase,
    "participants",
    userId,
  );
  return setDoc(callDocRef, {});
};

export const updateCallIceCandidates = async (
  passphrase: string,
  connectionKey: string,
  offer: boolean,
  iceCandidate: RTCIceCandidate,
): Promise<void> => {
  const candidatesCollection = offer ? "offerCandidates" : "answerCandidates";
  const callDocRef = doc(
    firestore,
    "calls",
    passphrase,
    candidatesCollection,
    connectionKey,
  );

  // Using arrayUnion to accumulate ICE candidates in an array
  return setDoc(
    callDocRef,
    {
      candidates: arrayUnion(iceCandidate.toJSON()),
    },
    { merge: true },
  );
};

export const updateCallOffer = async (
  passphrase: string,
  connectionKey: string,
  offer: RTCSessionDescriptionInit,
): Promise<void> => {
  const callDocRef = doc(
    firestore,
    "calls",
    passphrase,
    "connections",
    connectionKey,
  );
  return setDoc(callDocRef, { offer });
};

export const updateCallAnswer = async (
  passphrase: string,
  connectionKey: string,
  answer: RTCSessionDescriptionInit,
): Promise<void> => {
  const callDocRef = doc(
    firestore,
    "calls",
    passphrase,
    "connections",
    connectionKey,
  );
  return updateDoc(callDocRef, { answer });
};

export const updateCallConnectionStatus = async (
  passphrase: string,
  connectionKey: string,
) => {
  const callDocRef = doc(
    firestore,
    "calls",
    passphrase,
    "connections",
    connectionKey,
  );
  return updateDoc(callDocRef, { done: true });
};

export const subscribeToParticipantsUpdates = (
  passphrase: string,
  callbackFunc: (participants: Record<string, Participant>) => void,
) => {
  const participantsCollectionRef = collection(
    firestore,
    "calls",
    passphrase,
    "participants",
  );

  return onSnapshot(participantsCollectionRef, {
    next: (snapshot) => {
      const participants: Record<string, Participant> = {};
      snapshot.forEach((doc) => {
        participants[doc.id] = doc.data() as Participant;
      });
      callbackFunc(participants);
    },
  });
};

export const subscribeToConnectionUpdates = (
  passphrase: string,
  callbackFunc: (connections: Record<string, Connection>) => void,
) => {
  const callDocRef = collection(firestore, "calls", passphrase, "connections");
  return onSnapshot(callDocRef, {
    next: (snapshot) => {
      const connections: Record<string, Connection> = {};
      snapshot.forEach((doc) => {
        connections[doc.id] = doc.data() as Connection;
      });
      callbackFunc(connections);
    },
  });
};

export const subscribeToIceCandidatesUpdates = (
  passphrase: string,
  connectionKey: string,
  offer: boolean,
  callbackFunc: (iceCandidate: RTCIceCandidate) => void,
) => {
  const candidatesCollection = offer ? "offerCandidates" : "answerCandidates";
  const callDocRef = doc(
    firestore,
    "calls",
    passphrase,
    candidatesCollection,
    connectionKey,
  );

  const processedCandidates = new Set<string>(); // Track processed candidates

  return onSnapshot(callDocRef, {
    next: (doc) => {
      const data = doc.data();
      if (data?.candidates) {
        (data.candidates as RTCIceCandidateInit[]).forEach((candidateData) => {
          const candidateKey = JSON.stringify(candidateData);
          if (!processedCandidates.has(candidateKey)) {
            processedCandidates.add(candidateKey); // Mark as processed
            const iceCandidate = new RTCIceCandidate(candidateData);
            callbackFunc(iceCandidate); // Trigger callback with new candidate
          }
        });
      }
    },
  });
};

// export const updateCallLeft = async (
//   passphrase: string,
//   left: boolean,
// ): Promise<void> => {
//   const callDocRef = doc(firestore, "calls", passphrase);
//   return await setDoc(callDocRef, { left });
// };
