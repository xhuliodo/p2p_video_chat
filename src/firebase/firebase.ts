// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import {
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  getFirestore,
  onSnapshot,
  setDoc,
  updateDoc,
  increment,
  getDoc,
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

export interface Participant {
  disconnections: number;
}

export interface Connection {
  offer: RTCSessionDescriptionInit;
  answer?: RTCSessionDescriptionInit;
  done?: boolean;
}

export interface Call {
  participants: Record<string, Connection>;
  connections: Record<string, Connection>;
  offerCandidates: Record<string, RTCIceCandidate>;
  answerCandidates?: Record<string, RTCIceCandidate>;
}

export const getCallByPassphrase = async (
  passphrase: string,
): Promise<Call | null> => {
  const callDocRef = doc(firestore, "calls", passphrase);

  const foundCall = await getDoc(callDocRef);
  if (!foundCall.exists()) {
    console.log("queried call does not exist");
    return null;
  }

  try {
    const call = foundCall.data() as Call;
    return call;
  } catch (e) {
    console.log("failed to convert call with err: ", e);
    return null;
  }
};

export const createCall = async (passphrase: string) => {
  const callDocRef = doc(firestore, "calls", passphrase);
  return setDoc(callDocRef, {});
};

export const deleteCallByPassphrase = (passphrase: string) => {
  const callDocRef = doc(firestore, "calls", passphrase);

  return deleteDoc(callDocRef);
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
  return setDoc(callDocRef, { disconnections: 0 });
};

export const updateParticipantDisconnections = (
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
  return setDoc(callDocRef, { disconnections: increment(1) });
};

export const deleteParticipant = (
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
  return deleteDoc(callDocRef);
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

export const deleteCallConnection = async (
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
  return deleteDoc(callDocRef);
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
