import { create } from "zustand";
import { v7 } from "uuid";
import { toast } from "react-toastify";
import { router } from "../routes";
// import { sounds } from "../notifications/sounds";
import { toasts } from "../notifications/toasts";
import {
  CallDb,
  deleteCallByPassphrase,
  getCallByPassphrase,
  subscribeToCallUpdates,
  updateCallAnswer,
  updateCallAnswerIceCandidates,
  updateCallLeft,
  updateCallOffer,
  updateCallOfferIceCandidates,
} from "../firebase/firebase";

interface Message {
  content: string;
  timestamp: number;
  sentByUser?: boolean;
}

type NetworkStatus = "undefined" | "good" | "poor";
type CameraPerspective = "environment" | "user";

interface Call {
  ongoing: boolean;
  solo: boolean;
  passphrase: string;
  isCreator: boolean;
  startCall: (passphrase: string) => Promise<void>;
  joinCall: (
    passphrase: string,
    foundCall: CallDb,
    peerConnection: RTCPeerConnection,
  ) => void;
  createCall: (passphrase: string, peerConnection: RTCPeerConnection) => void;
  isAudioEnabled: boolean;
  switchAudio: () => void;
  isCameraEnabled: boolean;
  cameraPerspective: CameraPerspective;
  switchCamera: () => void;
  shouldFlip: boolean;
  canSwitchCameraPerspective: boolean;
  switchCameraPerspective: () => Promise<void>;
  userStream: MediaStream | null;
  remoteStream: MediaStream | null;
  peerConnection: RTCPeerConnection;
  remoteIceCandidates: Set<string>;
  endCall: () => Promise<void>;
  subscriptions: (() => void)[];
  remoteNetworkStatus: NetworkStatus;
  poorNetworkQualityCount: number;
  poorNetworkQualityThreshold: number;
  checkNetworkQuality: () => void;
  messages: Message[];
  messageChannel: RTCDataChannel | null;
  receiveMessage: (event: MessageEvent) => void;
  sendMessage: (content: string) => void;
  canSendMessage: boolean;
  showMessages: boolean;
  newMessage: boolean;
  toggleMessages: () => void;
}

export const useCallStore = create<Call>((set, get) => ({
  ongoing: false,
  solo: true,
  passphrase: "",
  isCreator: false,
  userStream: null,
  remoteStream: null,
  peerConnection: new RTCPeerConnection(),
  remoteIceCandidates: new Set([]),
  startCall: async (passphrase) => {
    const {
      isAudioEnabled,
      isCameraEnabled,
      joinCall,
      createCall,
      endCall,
      cameraPerspective,
      receiveMessage,
    } = get();
    let stream;
    try {
      stream = await getUserStream(
        isAudioEnabled,
        isCameraEnabled,
        cameraPerspective,
      );
    } catch {
      router.navigate("/", {
        state: { message: "Permissions of camera and audio are required!" },
      });
      return;
    }

    const peerConnection = await newPeerConnection();
    // Add local stream tracks to the peer connection
    stream.getTracks().forEach((track) => {
      peerConnection.addTrack(track, stream);
    });

    // Setup message channel
    const messageChannel = peerConnection.createDataChannel("chat", {
      negotiated: true,
      id: 0,
    });
    messageChannel.onopen = () => {
      console.log("Message channel is open");
      set(() => ({ canSendMessage: true }));
    };
    messageChannel.onclose = () => {
      console.log("Message channel is closed");
      set(() => ({ canSendMessage: false, showMessages: false }));
    };
    messageChannel.onerror = (e) => {
      console.log("something went wrong: ", e);
    };
    messageChannel.onmessage = receiveMessage;
    set(() => ({ messageChannel }));

    set(() => ({
      ongoing: true,
      userStream: stream,
      passphrase,
      peerConnection,
    }));

    // Handle incoming tracks from remote peers
    peerConnection.ontrack = (event) => {
      if (event.streams.length) {
        // sounds.callStartedSound.play();
      }
      event.streams.forEach((s) =>
        set(() => ({ solo: false, remoteStream: s })),
      );
    };

    // Show connection status
    peerConnection.oniceconnectionstatechange = async () => {
      const state = peerConnection.iceConnectionState;
      toast(state);
      if (state === "closed" || state === "failed") {
        await endCall();
        deleteCallByPassphrase(passphrase);
        router.navigate("/", {
          state: { message: "Could not connect." },
        });
      }
    };

    const foundCall = await getCallByPassphrase(passphrase);
    // If the passphrase already exists in the database (answering a call)
    if (!foundCall) {
      createCall(passphrase, peerConnection);
    } else {
      joinCall(passphrase, foundCall, peerConnection);
    }

    const handleCallUpdates = async (updatedCall: CallDb) => {
      if (!updatedCall?.left) {
        return;
      }

      await endCall();
      const { passphrase } = get();
      deleteCallByPassphrase(passphrase);
      router.navigate("/", {
        state: { message: "Your buddy left the call." },
      });
    };
    const sub = subscribeToCallUpdates(passphrase, handleCallUpdates);
    set((state) => ({ subscriptions: [...state.subscriptions, sub] }));
  },
  joinCall: async (
    passphrase: string,
    foundCall: CallDb,
    peerConnection: RTCPeerConnection,
  ) => {
    console.log("room exists, joining it");
    if (foundCall.answer) {
      router.navigate("/", {
        state: { message: "Room is full!" },
      });
      return;
    }

    // Handle ICE candidates
    peerConnection.onicecandidate = async (event) => {
      if (event.candidate) {
        updateCallAnswerIceCandidates(passphrase, event.candidate);
      }
    };

    await peerConnection.setRemoteDescription(foundCall.offer);
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);
    await updateCallAnswer(passphrase, answer);

    foundCall.offerCandidates?.forEach((c) => {
      peerConnection.addIceCandidate(c);
    });

    const handleCallUpdates = (updatedCall: CallDb) => {
      const { peerConnection: currentPeerConnection, remoteIceCandidates } =
        get();
      updatedCall.offerCandidates?.forEach((c) => {
        if (!remoteIceCandidates.has(c.candidate)) {
          currentPeerConnection.addIceCandidate(c);
          set((state) => ({
            remoteIceCandidates: new Set([
              ...state.remoteIceCandidates,
              c.candidate,
            ]),
          }));
        }
      });
    };
    const unsub = subscribeToCallUpdates(passphrase, handleCallUpdates);

    set((state) => ({ subscriptions: [...state.subscriptions, unsub] }));
  },
  createCall: async (passphrase: string, peerConnection: RTCPeerConnection) => {
    // If the passphrase does not exist (creating a call)
    console.log("call does not exist, creating it");
    set(() => ({ isCreator: true }));

    // Handle ICE candidates
    peerConnection.onicecandidate = async (event) => {
      if (event.candidate) {
        updateCallOfferIceCandidates(passphrase, event.candidate);
      }
    };

    // Create an offer to connect to the remote peer
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    await updateCallOffer(passphrase, offer);

    const handleCallUpdates = (updatedCall: CallDb) => {
      const { peerConnection: currentPeerConnection, remoteIceCandidates } =
        get();
      if (!currentPeerConnection.remoteDescription && updatedCall.answer) {
        currentPeerConnection.setRemoteDescription(updatedCall.answer);
      }
      if (updatedCall.answerCandidates) {
        updatedCall.answerCandidates.forEach((c) => {
          if (!remoteIceCandidates.has(c.candidate)) {
            currentPeerConnection.addIceCandidate(c);
            set((state) => ({
              remoteIceCandidates: new Set([
                ...state.remoteIceCandidates,
                c.candidate,
              ]),
            }));
          }
        });
      }
    };
    const unsub = subscribeToCallUpdates(passphrase, handleCallUpdates);
    set((state) => ({ subscriptions: [...state.subscriptions, unsub] }));
  },
  isAudioEnabled: true,
  switchAudio: async () => {
    const { userStream, isAudioEnabled } = get();
    userStream?.getAudioTracks().forEach((track) => {
      track.enabled = !isAudioEnabled;
    });

    set(() => ({ isAudioEnabled: !isAudioEnabled }));
  },
  isCameraEnabled: true,
  cameraPerspective: "user",
  switchCamera: async () => {
    const { userStream, isCameraEnabled } = get();
    userStream?.getVideoTracks().forEach((track) => {
      track.enabled = !isCameraEnabled;
    });

    set(() => ({ isCameraEnabled: !isCameraEnabled }));
  },
  shouldFlip: true,
  canSwitchCameraPerspective: true,
  switchCameraPerspective: async () => {
    const {
      peerConnection,
      cameraPerspective,
      userStream,
      canSwitchCameraPerspective,
    } = get();
    if (!canSwitchCameraPerspective) {
      toasts.noRearCamera();
      return;
    }
    const newCameraPerspective =
      cameraPerspective === "user" ? "environment" : "user";

    const newUserStream = await getUserStream(
      false,
      true,
      newCameraPerspective,
    );

    // check if the user can switch for future uses
    if (cameraPerspective === "user") {
      const newTrackSettings = newUserStream.getVideoTracks()[0].getSettings();
      if (
        !newTrackSettings.facingMode ||
        newTrackSettings.facingMode === "user"
      ) {
        toasts.noRearCamera();
        set(() => ({ canSwitchCameraPerspective: false }));
        return;
      }
    }

    // stop older video track and remove it
    const videoTrack = userStream?.getVideoTracks()[0];
    videoTrack?.stop();
    if (videoTrack) {
      userStream?.removeTrack(videoTrack);
    }

    // add new video track to the ui and to the webrtc connection
    const newVideoTrack = newUserStream.getVideoTracks()[0];
    userStream?.addTrack(newVideoTrack);
    const sender = peerConnection
      .getSenders()
      .find((s) => s.track?.kind === "video");
    sender?.replaceTrack(newVideoTrack);

    // modify the perspective
    set(() => ({
      cameraPerspective: newCameraPerspective,
      shouldFlip: newCameraPerspective === "user",
    }));
  },
  endCall: async () => {
    // sounds.callEndedSound.play();
    const { peerConnection, subscriptions, passphrase, messageChannel } = get();
    set(() => ({ solo: true, remoteStream: null }));
    messageChannel?.close();
    peerConnection?.close();
    subscriptions.forEach((unsub) => unsub());
    updateCallLeft(passphrase, true);

    set(() => ({
      ongoing: false,
      userStream: null,
      peerConnection: new RTCPeerConnection(),
      remoteIceCandidates: new Set([]),
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
      // console.log("Cannot check stats: Peer is disconnected or not connected");
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
        // console.log(`Poor network quality detected:
        //   Packet loss: ${packetLossRate.toFixed(2)}%,
        //   Jitter: ${jitter.toFixed(3)}s,
        //   RTT: ${roundTripTime.toFixed(3)}s`);
        set(() => ({ remoteNetworkStatus: "poor" }));
      } else {
        // console.log(`Good network quality:
        //   Packet loss: ${packetLossRate.toFixed(2)}%,
        //   Jitter: ${jitter.toFixed(3)}s,
        //   RTT: ${roundTripTime.toFixed(3)}s`);
        set(() => ({ remoteNetworkStatus: "good" }));
      }
    } catch (error) {
      console.error("Error checking network quality: ", error);
      set(() => ({ remoteNetworkStatus: "undefined" }));
    }
  },
  messages: [],
  messageChannel: null,
  receiveMessage: (event: MessageEvent) => {
    const { showMessages } = get();
    const message = JSON.parse(event.data) as Message;
    set((state) => ({
      messages: [...state.messages, { ...message, sentByUser: false }],
    }));
    if (!showMessages) {
      set(() => ({ newMessage: true }));
      // sounds.newMessageSound.play();
    }
  },
  sendMessage: (content: string) => {
    const { messageChannel } = get();
    const now = Date.now();
    try {
      messageChannel?.send(JSON.stringify({ content, timestamp: now }));
      set((state) => ({
        messages: [
          ...state.messages,
          { content, timestamp: now, sentByUser: true },
        ],
      }));
    } catch (e) {
      console.log("could not send message with err:", e);
    }
  },
  canSendMessage: false,
  showMessages: false,
  newMessage: false,
  toggleMessages: () => {
    const { showMessages, newMessage } = get();
    if (!showMessages && newMessage) {
      set(() => ({ newMessage: false }));
    }
    set(() => ({ showMessages: !showMessages }));
  },
}));

const getUserStream = (
  audio: boolean,
  video: boolean,
  perspective: "environment" | "user",
) => {
  return navigator.mediaDevices.getUserMedia({
    audio,
    video: video
      ? {
          width: { min: 1024, ideal: 1280, max: 1920 },
          height: { min: 576, ideal: 720, max: 1080 },
          facingMode: perspective,
        }
      : video,
  });
};

async function newPeerConnection(): Promise<RTCPeerConnection> {
  let iceServers = [];

  try {
    // Attempt to fetch TURN credentials from primary service
    const response = await fetch(
      "https://xd-p2p-video-chat.metered.live/api/v1/turn/credentials?apiKey=cd45057e409fef9a935947fcbb9a58fd736b",
    );

    // Check if the response is successful and parse as JSON
    if (response.ok) {
      iceServers = await response.json();
    } else {
      throw new Error("Failed to fetch TURN credentials from primary service");
    }
  } catch (error) {
    console.warn("Using fallback ICE servers due to:", error);

    // Fallback to public STUN and TURN servers
    iceServers = [
      // Public STUN servers
      { urls: "stun:stun.l.google.com:19302" },
      { urls: "stun:stun1.l.google.com:19302" },
      { urls: "stun:stun2.l.google.com:19302" },

      // Public TURN servers
      {
        urls: "turn:relay.metered.ca:80",
        username: "public-user",
        credential: "public-pass",
      },
      {
        urls: "turn:relay.metered.ca:443",
        username: "public-user",
        credential: "public-pass",
      },
      {
        urls: "turn:relay.metered.ca:443?transport=tcp",
        username: "public-user",
        credential: "public-pass",
      },
    ];
  }

  return new RTCPeerConnection({
    iceServers,
  });
}
