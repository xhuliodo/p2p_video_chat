import { create } from "zustand";
import { firestore } from "../firebase";
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  onSnapshot,
  Unsubscribe,
  deleteDoc,
} from "firebase/firestore";

const stunServers = [
  "stun:stun.l.google.com:19302",
  "stun:stun1.l.google.com:19302",
  "stun:stun2.l.google.com:19302",
  "stun:stun3.l.google.com:19302",
  "stun:stun4.l.google.com:19302",
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
  isCreator: boolean;
  startCall: (passphrase: string) => void;
  isAudio: boolean;
  switchAudio: () => void;
  isCamera: boolean;
  switchCamera: () => void;
  userStream: MediaStream | null;
  remoteStream: MediaStream | null;
  peerConnection: RTCPeerConnection | null;
  endCall: () => Promise<void>;
  subscriptions: Unsubscribe[];
  remoteNetworkStatus: "good" | "poor" | "undefined";
  checkNetworkQuality: () => void;
}

export const useCallStore = create<Call>((set, get) => ({
  ongoing: false,
  solo: true,
  passphrase: "",
  userStream: null,
  remoteStream: null,
  peerConnection: null,
  isCreator: true,
  startCall: async (passphrase) => {
    const stream = await getUserStream(true, true);
    const peerConnection = new RTCPeerConnection({
      iceServers: [{ urls: stunServers }],
    });

    set(() => ({
      ongoing: true,
      userStream: stream,
      passphrase,
      peerConnection,
    }));

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

    peerConnection.oniceconnectionstatechange = () => {
      const state = peerConnection.iceConnectionState;
      console.log("ICE Connection State:", state);

      if (
        state === "disconnected" ||
        state === "failed" ||
        state === "closed"
      ) {
        console.log("Peer disconnected");
        set(() => ({
          remoteNetworkStatus: "undefined",
          solo: true,
          remoteStream: null,
        }));
      }
    };

    const callDocRef = doc(firestore, "calls", passphrase);
    const callDocSnap = await getDoc(callDocRef);
    // If the passphrase already exists in the database (answering a call)
    if (callDocSnap.exists()) {
      console.log("room exists, joining it");
      set(() => ({ isCreator: false }));
      // Handle ICE candidates
      peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
          updateDoc(callDocRef, { answerCandidate: event.candidate?.toJSON() });
        }
      };

      const foundCall = callDocSnap.data() as CallDb;
      await peerConnection.setRemoteDescription(foundCall.offer);

      const answer = await peerConnection.createAnswer();
      await peerConnection.setLocalDescription(answer);
      await updateDoc(callDocRef, { answer });
      await peerConnection.addIceCandidate(foundCall.offerCandidate);

      const unsub = onSnapshot(callDocRef, {
        next: (doc) => {
          const updatedCall = doc.data() as CallDb;
          if (updatedCall?.offerCandidate) {
            peerConnection.addIceCandidate(updatedCall.offerCandidate);
          }
        },
      });

      set((state) => ({ subscriptions: [...state.subscriptions, unsub] }));
    } else {
      // If the passphrase does not exist (creating a call)
      console.log("call does not exist, creating it");
      await setDoc(callDocRef, {});

      // Handle ICE candidates
      peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
          updateDoc(callDocRef, { offerCandidate: event.candidate?.toJSON() });
        }
      };

      // Create an offer to connect to the remote peer
      const offer = await peerConnection.createOffer();
      await peerConnection.setLocalDescription(offer);
      await updateDoc(callDocRef, { offer });

      const unsub = onSnapshot(callDocRef, {
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
      set((state) => ({ subscriptions: [...state.subscriptions, unsub] }));
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
  endCall: async () => {
    const { userStream, peerConnection, subscriptions, isCreator, passphrase } =
      get();
    userStream?.getTracks().forEach((t) => t.stop());
    peerConnection?.close();
    subscriptions.forEach((unsub) => unsub());
    if (isCreator) {
      const callRef = doc(firestore, "calls", passphrase);
      await deleteDoc(callRef);
    }

    set(() => ({
      ongoing: false,
      solo: true,
      userStream: null,
      isAudio: true,
      isCamera: true,
    }));
  },
  subscriptions: [],
  remoteNetworkStatus: "undefined",
  checkNetworkQuality: async () => {
    const { peerConnection } = get();
    if (!peerConnection || peerConnection.iceConnectionState !== "connected") {
      console.log("Cannot check stats: Peer is disconnected");
      return;
    }
    const stats = await peerConnection?.getStats();
    if (stats) {
      stats.forEach((report) => {
        if (report.type === "inbound-rtp") {
          const packetLossRate =
            (report.packetsLost / report.packetsReceived) * 100;
          const jitter = report.jitter;
          // Assuming more than 5% packet loss or jitter > 0.03 indicates bad network
          if (packetLossRate > 5 || jitter > 0.03) {
            console.log("Poor network quality detected");
            set(() => ({ remoteNetworkStatus: "poor" }));
          } else {
            console.log("Network quality is good");
            set(() => ({ remoteNetworkStatus: "good" }));
          }
        }
      });
    } else {
      set(() => ({ remoteNetworkStatus: "undefined" }));
    }
  },
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
