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
  DocumentSnapshot,
  DocumentReference,
} from "firebase/firestore";
import { v7 } from "uuid";
import { toast } from "react-toastify";
import { router } from "../routes";

const stunServers = [
  "stun:stun.l.google.com:19302",
  // "stun:stun1.l.google.com:19302",
  // "stun:stun2.l.google.com:19302",
  // "stun:stun3.l.google.com:19302",
  // "stun:stun4.l.google.com:19302",
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
  startCall: (passphrase: string, toastToShow: JSX.Element) => void;
  joinCall: (
    callDocRef: DocumentReference,
    callDocSnap: DocumentSnapshot,
    peerConnection: RTCPeerConnection,
  ) => void;
  createCall: (
    callDocRef: DocumentReference,
    peerConnection: RTCPeerConnection,
  ) => void;
  // reconnect: (callDocRef: DocumentReference) => void;
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
  poorNetworkQualityCount: number;
  poorNetworkQualityThreshold: number;
  checkNetworkQuality: () => void;
}

export const useCallStore = create<Call>((set, get) => ({
  ongoing: false,
  solo: true,
  passphrase: "",
  isCreator: true,
  userStream: null,
  remoteStream: null,
  peerConnection: null,
  startCall: async (passphrase, toastToShow) => {
    const stream = await getUserStream(true, true);
    const peerConnection = newPeerConnection(stream);

    set(() => ({
      ongoing: true,
      userStream: stream,
      passphrase,
      peerConnection,
    }));

    // Handle incoming tracks from remote peers
    peerConnection.ontrack = (event) => {
      event.streams.forEach((s) =>
        set(() => ({ solo: false, remoteStream: s })),
      );
    };

    peerConnection.oniceconnectionstatechange = () => {
      const state = peerConnection.iceConnectionState;
      console.log("ICE Connection State:", state);

      // TODO: handle reconnections
      // if (
      //   state === "disconnected" ||
      //   state === "failed" ||
      //   state === "closed"
      // ) {
      //   console.log("Peer disconnected");
      //   set(() => ({
      //     remoteNetworkStatus: "undefined",
      //     solo: true,
      //     remoteStream: null,
      //   }));
      //   // get().reconnect(callDocRef);
      // }
    };

    const { joinCall, createCall } = get();
    const callDocRef = doc(firestore, "calls", passphrase);
    console.log(callDocRef);
    const callDocSnap = await getDoc(callDocRef);
    // If the passphrase already exists in the database (answering a call)
    if (callDocSnap.exists()) {
      joinCall(callDocRef, callDocSnap, peerConnection);
    } else {
      createCall(callDocRef, peerConnection);
      toast(toastToShow, { delay: 2000, autoClose: 10000 });
    }

    const { endCall } = get();
    const sub = onSnapshot(callDocRef, {
      next: async (doc) => {
        if (doc.data()?.left) {
          await endCall();
          deleteDoc(callDocRef);
          router.navigate("/", { state: { leftTheCall: true } });
        }
      },
    });
    set((state) => ({ subscriptions: [...state.subscriptions, sub] }));
  },
  joinCall: async (
    callDocRef: DocumentReference,
    callDocSnap: DocumentSnapshot,
    peerConnection: RTCPeerConnection,
  ) => {
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
        const { peerConnection: currentPeerConnection } = get();
        const updatedCall = doc.data() as CallDb;
        if (updatedCall?.offerCandidate) {
          currentPeerConnection?.addIceCandidate(updatedCall.offerCandidate);
        }
      },
    });

    set((state) => ({ subscriptions: [...state.subscriptions, unsub] }));
  },
  createCall: async (
    callDocRef: DocumentReference,
    peerConnection: RTCPeerConnection,
  ) => {
    // If the passphrase does not exist (creating a call)
    console.log("call does not exist, creating it");

    // Handle ICE candidates
    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        updateDoc(callDocRef, { offerCandidate: event.candidate?.toJSON() });
      }
    };

    // Create an offer to connect to the remote peer
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    await setDoc(callDocRef, { offer });

    const unsub = onSnapshot(callDocRef, {
      next: (doc) => {
        const { peerConnection: currentPeerConnection } = get();
        const updatedCall = doc.data() as CallDb;
        if (!currentPeerConnection?.remoteDescription && updatedCall.answer) {
          currentPeerConnection?.setRemoteDescription(updatedCall.answer);
        }
        if (updatedCall.answerCandidate) {
          currentPeerConnection?.addIceCandidate(updatedCall.answerCandidate);
        }
      },
    });
    set((state) => ({ subscriptions: [...state.subscriptions, unsub] }));
  },
  // reconnect: async (callDocRef: DocumentReference) => {
  //   const {
  //     isCreator,
  //     userStream,
  //     isAudio,
  //     isCamera,
  //     peerConnection: olderPeerConnection,
  //   } = get();
  //   // close older peerconnection and also older subscriptions
  //   olderPeerConnection?.close();
  //   let peerConnection: RTCPeerConnection;
  //   if (userStream) {
  //     peerConnection = newPeerConnection(userStream);
  //   } else {
  //     const newUserStream = await getUserStream(isAudio, isCamera);
  //     peerConnection = newPeerConnection(newUserStream);
  //   }
  //   set(() => ({ peerConnection }));

  //   peerConnection.oniceconnectionstatechange = () => {
  //     const state = peerConnection.iceConnectionState;
  //     console.log("ICE Connection State:", state);

  //     // TODO: handle reconnections
  //     if (
  //       state === "disconnected" ||
  //       state === "failed" ||
  //       state === "closed"
  //     ) {
  //       console.log("Peer disconnected");
  //       set(() => ({
  //         remoteNetworkStatus: "undefined",
  //         solo: true,
  //         remoteStream: null,
  //       }));
  //       get().reconnect(callDocRef);
  //     }
  //   };

  //   if (isCreator) {
  //     // Handle ICE candidates
  //     peerConnection.onicecandidate = (event) => {
  //       if (event.candidate) {
  //         updateDoc(callDocRef, { offerCandidate: event.candidate?.toJSON() });
  //       }
  //     };

  //     // Create an offer to connect to the remote peer
  //     const offer = await peerConnection.createOffer();
  //     await peerConnection.setLocalDescription(offer);
  //     await setDoc(callDocRef, { offer });
  //   } else {
  //     // Handle ICE candidates
  //     peerConnection.onicecandidate = (event) => {
  //       if (event.candidate) {
  //         updateDoc(callDocRef, { answerCandidate: event.candidate?.toJSON() });
  //       }
  //     };

  //     const callDocSnap = await getDoc(callDocRef);
  //     const foundCall = callDocSnap.data() as CallDb;
  //     await peerConnection.setRemoteDescription(foundCall.offer);

  //     const answer = await peerConnection.createAnswer();
  //     await peerConnection.setLocalDescription(answer);
  //     await updateDoc(callDocRef, { answer });
  //     await peerConnection.addIceCandidate(foundCall.offerCandidate);
  //   }
  // },
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
    const { peerConnection, subscriptions, passphrase } = get();
    set(() => ({ solo: true, remoteStream: null }));
    peerConnection?.close();
    subscriptions.forEach((unsub) => unsub());
    const callRef = doc(firestore, "calls", passphrase);
    await updateDoc(callRef, { left: true });

    set(() => ({
      ongoing: false,
      userStream: null,
      peerConnection: null,
      passphrase: v7(),
    }));
  },
  subscriptions: [],
  remoteNetworkStatus: "undefined",
  poorNetworkQualityCount: 0,
  poorNetworkQualityThreshold: 3,
  checkNetworkQuality: async () => {
    const { peerConnection } = get();

    if (!peerConnection || peerConnection.iceConnectionState !== "connected") {
      console.log("Cannot check stats: Peer is disconnected or not connected");
      set(() => ({ remoteNetworkStatus: "undefined" }));
      return;
    }

    try {
      const stats = await peerConnection.getStats();
      let packetLossRate = 0;
      let jitter = 0;
      let roundTripTime = 0;

      stats.forEach((report) => {
        // Analyze inbound-rtp stats for packet loss and jitter
        if (report.type === "inbound-rtp" && report.kind === "video") {
          if (report.packetsReceived > 0) {
            packetLossRate =
              (report.packetsLost / report.packetsReceived) * 100;
            jitter = report.jitter;
          }
        }
        // Analyze candidate-pair stats for RTT (round-trip time)
        if (report.type === "candidate-pair" && report.currentRoundTripTime) {
          roundTripTime = report.currentRoundTripTime;
        }
      });

      // Adjusted thresholds to reduce sensitivity
      const isPoorNetwork =
        packetLossRate > 8 || jitter > 0.05 || roundTripTime > 0.5;

      if (isPoorNetwork) {
        set((state) => ({
          poorNetworkQualityCount: state.poorNetworkQualityCount + 1,
        }));
      } else {
        set(() => ({
          poorNetworkQualityCount: 0,
        })); // Reset counter if the network is good
      }

      // Mark as "poor" only after consistent bad readings
      if (get().poorNetworkQualityCount >= get().poorNetworkQualityThreshold) {
        console.log(`Poor network quality detected: 
          Packet loss: ${packetLossRate.toFixed(2)}%, 
          Jitter: ${jitter.toFixed(3)}s, 
          RTT: ${roundTripTime.toFixed(3)}s`);
        set(() => ({ remoteNetworkStatus: "poor" }));
      } else {
        console.log(`Good network quality: 
          Packet loss: ${packetLossRate.toFixed(2)}%, 
          Jitter: ${jitter.toFixed(3)}s, 
          RTT: ${roundTripTime.toFixed(3)}s`);
        set(() => ({ remoteNetworkStatus: "good" }));
      }
    } catch (error) {
      console.error("Error checking network quality: ", error);
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

const newPeerConnection = (stream: MediaStream): RTCPeerConnection => {
  const peerConnection = new RTCPeerConnection({
    iceServers: [{ urls: stunServers }],
  });

  // Add local stream tracks to the peer connection
  stream.getTracks().forEach((track) => {
    peerConnection.addTrack(track, stream);
  });

  return peerConnection;
};
