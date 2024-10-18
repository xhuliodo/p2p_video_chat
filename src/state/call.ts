import { create } from "zustand";
import { firestore } from "../firebase";
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  onSnapshot,
  Unsubscribe,
} from "firebase/firestore";

const stunServers = [
  "stun:stun.l.google.com:19302",
  //   "stun:stun1.l.google.com:19302",
  //   "stun:stun2.l.google.com:19302",
  //   "stun:stun3.l.google.com:19302",
  //   "stun:stun4.l.google.com:19302",
];

interface CallDb {
  offer: RTCSessionDescriptionInit;
  offerCandidate: RTCIceCandidate;
  answer?: RTCSessionDescriptionInit;
  answerCandidate?: RTCIceCandidate;
}

interface Call {
  ongoing: boolean;
  solo: boolean;
  passphrase: string;
  startCall: (passphrase: string) => void;
  isAudio: boolean;
  switchAudio: () => void;
  isCamera: boolean;
  switchCamera: () => void;
  userStream: MediaStream | null;
  remoteStream: MediaStream | null;
  peerConnection: RTCPeerConnection | null;
  endCall: () => void;
  subscriptions: Unsubscribe[];
}

export const useCallStore = create<Call>((set, get) => ({
  ongoing: false,
  solo: true,
  passphrase: "Please wait...",
  userStream: null,
  remoteStream: null,
  peerConnection: null,
  startCall: async (passphrase) => {
    const stream = await getUserStream(true, true);
    set(() => ({ ongoing: true, userStream: stream }));

    const peerConnection = new RTCPeerConnection({
      iceServers: [{ urls: stunServers }],
    });

    // Add local stream tracks to the peer connection
    stream.getTracks().forEach((track) => {
      peerConnection.addTrack(track, stream);
    });

    // Handle incoming tracks from remote peers
    peerConnection.ontrack = (event) => {
      event.streams.forEach((s) =>
        set(() => ({ solo: false, remoteStream: s }))
      );
    };

    // check if someone is already using this passphrase
    const callDocRef = doc(firestore, "calls", passphrase);
    const callDocSnap = await getDoc(callDocRef);
    if (callDocSnap.exists()) {
      // Handle ICE candidates
      peerConnection.onicecandidate = (event) => {
        if (event.candidate)
          updateDoc(callDocRef, { answerCandidate: event.candidate?.toJSON() });
      };

      const foundCall = callDocSnap.data() as CallDb;
      peerConnection.setRemoteDescription(foundCall.offer);
      const answer = await peerConnection.createAnswer();
      await updateDoc(callDocRef, { answer });
      await peerConnection.setLocalDescription(answer);
      await peerConnection.addIceCandidate(foundCall.offerCandidate);

      const unsub = onSnapshot(callDocRef, {
        next: (doc) => {
          const updatedCall = doc.data() as CallDb;
          console.log("updated call", updatedCall);
          if (updatedCall?.offerCandidate) {
            peerConnection.addIceCandidate(updatedCall.offerCandidate);
          }
        },
      });

      set((state) => ({ subscriptions: [...state.subscriptions, unsub] }));
    } else {
      console.log("call does not exist, creating it");
      await setDoc(callDocRef, {});
      // Handle ICE candidates
      peerConnection.onicecandidate = (event) => {
        if (event.candidate)
          updateDoc(callDocRef, { offerCandidate: event.candidate?.toJSON() });
      };

      // Create an offer to connect to the remote peer
      const offer = await peerConnection.createOffer();
      await updateDoc(callDocRef, { offer });
      await peerConnection.setLocalDescription(offer);

      onSnapshot(callDocRef, {
        next: (doc) => {
          const updatedCall = doc.data() as CallDb;
          if (!peerConnection.remoteDescription && updatedCall.answer) {
            peerConnection.setRemoteDescription(updatedCall.answer);
          }
          if (updatedCall.answerCandidate) {
            peerConnection.addIceCandidate(updatedCall.answerCandidate);
          }
        },
      });
    }
  },
  isAudio: true,
  switchAudio: async () => {
    const { userStream, isAudio } = get();
    userStream?.getAudioTracks().forEach((track) => {
      track.enabled = !isAudio;
    });

    set(() => ({ isAudio: !isAudio }));
  },
  isCamera: true,
  switchCamera: async () => {
    const { userStream, isCamera } = get();
    userStream?.getVideoTracks().forEach((track) => {
      track.enabled = !isCamera;
    });

    set(() => ({ isCamera: !isCamera }));
  },
  endCall: () => {
    const { userStream, peerConnection, subscriptions } = get();
    userStream?.getTracks().forEach((t) => t.stop());
    peerConnection?.close();
    subscriptions.forEach((unsub) => unsub());

    set(() => ({
      ongoing: false,
      solo: true,
      userStream: null,
      isAudio: true,
      isCamera: true,
    }));
  },
  subscriptions: [],
}));

const getUserStream = (audio: boolean, video: boolean) => {
  return navigator.mediaDevices.getUserMedia({
    audio,
    video: video
      ? {
          width: { min: 1024, ideal: 1280, max: 1920 },
          height: { min: 576, ideal: 720, max: 1080 },
        }
      : video,
  });
};
