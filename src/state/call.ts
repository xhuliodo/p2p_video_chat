import { create } from "zustand";
import { v7 } from "uuid";
import { router } from "../routes";
// import { sounds } from "../notifications/sounds";
import { toasts } from "../notifications/toasts";
import { sounds } from "../notifications/sounds";
import {
  newAnswerEvent,
  newIceCandidateEvent,
  newNewParticipantEvent,
  newOfferEvent,
  AnswerResponse,
  IceCandidateResponse,
  NewParticipantResponse,
  OfferResponse,
  ParticipantLeftResponse,
  WSEvent,
} from "./events";
import { toast } from "react-toastify";
import { produce } from "immer";

type CameraPerspective = "environment" | "user";

interface PeerConnection {
  peerConnection: RTCPeerConnection;
  messageChannel: RTCDataChannel | null;
}

export interface Message {
  content: string;
  timestamp: number;
  sentByUser: boolean;
  username?: string;
}

interface Call {
  test: (howMany: number) => void;
  userId: string;
  solo: boolean;
  passphrase: string;
  conn: WebSocket | null;
  userStream: MediaStream | null;
  remoteStreams: Record<string, MediaStream>;
  addRemoteStream: (key: string, stream: MediaStream) => void;
  deleteRemoteStream: (key: string) => void;
  peerConnections: Record<string, PeerConnection>;
  addPeerConnection: (key: string, peerConnection: RTCPeerConnection) => void;
  deletePeerConnection: (key: string) => void;
  startCall: (passphrase: string) => Promise<void>;
  handleOffer: (participantId: string) => Promise<void>;
  waitForIceCandidatesOrTimeout: (
    participantId: string,
    timeout: number,
  ) => Promise<string>;
  handleAnswer: (
    participantId: string,
    offer: RTCSessionDescriptionInit,
  ) => Promise<void>;
  handleAnswerResponse: (
    participantId: string,
    answer: RTCSessionDescriptionInit,
  ) => Promise<void>;
  handleIceCandidates: (
    participantId: string,
    iceCandidate: RTCIceCandidate,
  ) => Promise<void>;
  handleParticipantLeft: (participantId: string) => Promise<void>;
  handleReconnection: (connectionKey: string) => Promise<void>;
  username: string;
  setUsername: (username: string) => void;
  clearUsername: () => void;
  messages: Message[];
  addMessageChannel: (key: string, messageChannel: RTCDataChannel) => void;
  receiveMessage: (event: MessageEvent) => void;
  sendMessage: (content: string) => void;
  canSendMessage: boolean;
  showMessages: boolean;
  newMessage: boolean;
  toggleMessages: () => void;
  subscriptions: (() => void)[];
  endCall: () => Promise<void>;
  isAudioEnabled: boolean;
  switchAudio: () => void;
  isCameraEnabled: boolean;
  cameraPerspective: CameraPerspective;
  switchCamera: () => void;
  shouldFlip: boolean;
  canSwitchCameraPerspective: boolean;
  switchCameraPerspective: () => Promise<void>;
}

export const useCallStore = create<Call>((set, get) => ({
  test: async (howMany: number) => {
    const stream = await getUserStream(false, "", true, "user");
    set({ solo: false, userStream: stream });
    for (let i = 0; i < howMany; i++) {
      get().addRemoteStream(`${i}`, stream);
    }
  },
  userId: v7(),
  solo: true,
  passphrase: "",
  conn: null,
  userStream: null,
  remoteStreams: {},
  addRemoteStream: (key: string, stream: MediaStream) => {
    set((state) =>
      produce(state, (draft) => {
        draft.remoteStreams[key] = stream;
        return draft;
      }),
    );
  },
  deleteRemoteStream: (key: string) => {
    set((state) =>
      produce(state, (draft) => {
        if (draft.remoteStreams[key]) {
          draft.remoteStreams[key].getTracks().forEach((t) => t.stop());
          delete draft.remoteStreams[key];
        }
        return draft;
      }),
    );
  },
  peerConnections: {},
  addPeerConnection: (key: string, peerConnection: RTCPeerConnection) => {
    set((state) =>
      produce(state, (draft) => {
        draft.peerConnections[key] = {
          peerConnection,
          messageChannel: null,
        };
        if (draft.solo) {
          draft.solo = false;
        }
        return draft;
      }),
    );
  },
  deletePeerConnection: (key: string) => {
    set((state) =>
      produce(state, (draft) => {
        if (draft.peerConnections[key]) {
          draft.peerConnections[key].messageChannel?.close();
          draft.peerConnections[key].peerConnection.close();
          delete draft.peerConnections[key];
        }

        if (Object.keys(draft.peerConnections).length === 0) {
          draft.solo = true;
          draft.canSendMessage = false;
          draft.showMessages = false;
        }
        return draft;
      }),
    );
  },
  startCall: async (passphrase) => {
    const {
      isAudioEnabled,
      isCameraEnabled,
      cameraPerspective,
      userId,
      handleAnswer,
      handleOffer,
      handleAnswerResponse,
      handleIceCandidates,
      handleParticipantLeft,
    } = get();
    let stream;
    try {
      stream = await getUserStream(
        isAudioEnabled,
        "",
        isCameraEnabled,
        cameraPerspective,
      );
      stream = await checkForBluetoothAudioDevices(stream);
    } catch {
      router.navigate("/", {
        state: { message: "Permissions of camera and audio are required!" },
      });
      return;
    }

    if (!window["WebSocket"]) {
      router.navigate("/", {
        state: { message: "Your browser does not support websockets!" },
      });
      return;
    }

    const newWebsocketConnection = new WebSocket(
      "wss://" + import.meta.env.VITE_WEBSOCKET_URL + "/calls/" + passphrase,
    );

    newWebsocketConnection.onclose = (e) => {
      if (!e.wasClean) {
        toasts.somethingWentWrong();
      }
    };

    newWebsocketConnection.onerror = (e) => {
      console.log("WebSocket error: ", e);
    };

    newWebsocketConnection.onopen = () => {
      const e = newNewParticipantEvent(userId);
      newWebsocketConnection.send(e);
    };
    newWebsocketConnection.onmessage = async (e) => {
      const event: WSEvent = JSON.parse(e.data);
      switch (event.type) {
        case "new_participant": {
          const eventData = event.payload as NewParticipantResponse;
          handleOffer(eventData.participantId);
          break;
        }
        case "offer": {
          const eventData = event.payload as OfferResponse;
          const offer = JSON.parse(eventData.offer);
          handleAnswer(eventData.from, offer);
          break;
        }
        case "answer": {
          const eventData = event.payload as AnswerResponse;
          const answer = JSON.parse(eventData.answer);
          handleAnswerResponse(eventData.from, answer);
          break;
        }
        case "ice_candidate": {
          const eventData = event.payload as IceCandidateResponse;
          const iceCandidateJson = JSON.parse(eventData.iceCandidate);
          const iceCandidate = new RTCIceCandidate(iceCandidateJson);
          handleIceCandidates(eventData.from, iceCandidate);
          break;
        }
        case "participant_left": {
          const eventData = event.payload as ParticipantLeftResponse;
          handleParticipantLeft(eventData.participantId);
          break;
        }
      }
    };

    set(() => ({
      userStream: stream,
      passphrase,
      conn: newWebsocketConnection,
    }));
  },
  handleOffer: async (participantId: string) => {
    const { userStream, addMessageChannel, conn, userId, handleReconnection } =
      get();
    const connectionKey = getConnectionKey(userId, participantId);

    const newPeerConnection = await getPeerConnection();
    // Add local stream tracks to the peer connection
    userStream?.getTracks().forEach((track) => {
      newPeerConnection.addTrack(track, userStream);
    });

    // try and setup a message channel
    const messageChannel = newPeerConnection.createDataChannel("chat");
    messageChannel.onopen = () => {
      console.log("Message channel is open");
      set(() => ({ canSendMessage: true }));
    };
    messageChannel.onclose = () => {
      console.log("Message channel is closed");
    };
    messageChannel.onerror = (e) => {
      console.log("something went wrong: ", e);
    };
    messageChannel.onmessage = get().receiveMessage;

    // Handle incoming tracks from remote peers
    newPeerConnection.ontrack = (event) => {
      const { addRemoteStream } = get();
      if (event.streams.length) {
        sounds.callStartedSound.play();
        event.streams.map((s) => addRemoteStream(connectionKey, s));
      }
    };
    newPeerConnection.oniceconnectionstatechange = async () => {
      const state = newPeerConnection.iceConnectionState;
      toast(state);
      if (
        state === "failed" ||
        state === "disconnected" ||
        state === "closed" ||
        state === "completed"
      ) {
        handleReconnection(participantId);
      }
    };

    // Create an offer to connect to the remote peer
    const offer = await newPeerConnection.createOffer({ iceRestart: false });
    await newPeerConnection.setLocalDescription(offer);
    const e = newOfferEvent(JSON.stringify(offer), participantId);
    conn?.send(e);

    // Handle ICE candidates
    newPeerConnection.onicecandidate = async (event) => {
      if (event.candidate) {
        const c = JSON.stringify(event.candidate.toJSON());
        const e = newIceCandidateEvent(c, participantId);
        conn?.send(e);
      }
    };

    const { addPeerConnection } = get();
    addPeerConnection(connectionKey, newPeerConnection);
    addMessageChannel(connectionKey, messageChannel);
  },
  waitForIceCandidatesOrTimeout: (to: string, timeout: number) => {
    const { userId } = get();
    const connectionKey = getConnectionKey(userId, to);

    return new Promise((resolve) => {
      const timeoutId = setTimeout(() => {
        console.log("Timeout reached");
        resolve("Timeout reached");
      }, timeout);

      const checkCondition = () => {
        const { peerConnections } = get();
        if (
          peerConnections[connectionKey].peerConnection.iceGatheringState ===
          "complete"
        ) {
          clearTimeout(timeoutId);
          console.log("Ice candidates gathered");
          resolve("Ice candidates gathered");
        } else {
          // Continue checking every 100ms until the condition is met
          setTimeout(checkCondition, 100);
        }
      };

      // Start checking the condition
      checkCondition();
    });
  },
  handleAnswer: async (
    participantId: string,
    offer: RTCSessionDescriptionInit,
  ) => {
    const {
      userStream,
      addMessageChannel,
      userId,
      conn,
      handleReconnection,
      peerConnections,
    } = get();
    const connectionKey = getConnectionKey(userId, participantId);
    // clean up for the reconnections, in case one of the peers has yet to delete their old connection
    if (peerConnections[connectionKey]) {
      handleReconnection(participantId);
    }

    const newPeerConnection = await getPeerConnection();
    // Add local stream tracks to the peer connection
    userStream?.getTracks().forEach((track) => {
      newPeerConnection.addTrack(track, userStream);
    });

    // try and setup a message channel
    newPeerConnection.ondatachannel = (channelEvent) => {
      console.log({ channelEvent });
      const messageChannel = channelEvent.channel;
      messageChannel.onopen = () => {
        console.log("Message channel is open");
        set(() => ({ canSendMessage: true }));
      };
      messageChannel.onclose = () => {
        console.log("Message channel is closed");
        // set(() => ({ canSendMessage: false, showMessages: false }));
      };
      messageChannel.onerror = (e) => {
        console.log("something went wrong: ", e);
      };
      messageChannel.onmessage = get().receiveMessage;

      addMessageChannel(connectionKey, messageChannel);
    };

    // Handle incoming tracks from remote peers
    newPeerConnection.ontrack = (event) => {
      const { addRemoteStream } = get();
      if (event.streams.length) {
        sounds.callStartedSound.play();
        event.streams.map((s) => addRemoteStream(connectionKey, s));
      }
    };

    newPeerConnection.oniceconnectionstatechange = async () => {
      const state = newPeerConnection.iceConnectionState;
      toast(state);
      if (
        state === "failed" ||
        state === "disconnected" ||
        state === "closed" ||
        state === "completed"
      ) {
        handleReconnection(participantId);
      }
    };

    await newPeerConnection.setRemoteDescription(offer);
    const answer = await newPeerConnection.createAnswer();
    await newPeerConnection.setLocalDescription(answer);
    const e = newAnswerEvent(JSON.stringify(answer), participantId);
    conn?.send(e);

    // Handle ICE candidates
    newPeerConnection.onicecandidate = async (event) => {
      if (event.candidate) {
        const c = JSON.stringify(event.candidate.toJSON());
        const e = newIceCandidateEvent(c, participantId);
        conn?.send(e);
      }
    };

    const { addPeerConnection } = get();
    addPeerConnection(connectionKey, newPeerConnection);
  },
  handleAnswerResponse: async (
    participantId: string,
    answer: RTCSessionDescriptionInit,
  ) => {
    const { peerConnections, userId } = get();
    const connectionKey = getConnectionKey(userId, participantId);
    peerConnections[connectionKey].peerConnection.setRemoteDescription(answer);
  },
  handleIceCandidates: async (
    participantId: string,
    iceCandidate: RTCIceCandidate,
  ) => {
    const { userId, peerConnections } = get();
    const connectionKey = getConnectionKey(userId, participantId);
    peerConnections[connectionKey].peerConnection.addIceCandidate(iceCandidate);
  },
  handleParticipantLeft: async (participantId: string) => {
    const { userId, deletePeerConnection, deleteRemoteStream } = get();
    const connectionKey = getConnectionKey(userId, participantId);
    deleteRemoteStream(connectionKey);
    deletePeerConnection(connectionKey);
  },
  handleReconnection: async (participantId: string) => {
    const { handleParticipantLeft, userId, handleOffer } = get();
    handleParticipantLeft(participantId);

    const isOfferer = getIsOfferer(userId, participantId);
    if (isOfferer) {
      console.log("sending offer again");
      handleOffer(participantId);
    }
  },
  username: localStorage.getItem("username") || "",
  setUsername: (username: string) => {
    set(() => ({ username }));
    localStorage.setItem("username", username);
  },
  clearUsername: () => {
    set(() => ({ username: "" }));
    localStorage.removeItem("username");
  },
  messages: [],
  addMessageChannel: (key: string, messageChannel: RTCDataChannel) => {
    set((state) =>
      produce(state, (draft) => {
        draft.peerConnections[key].messageChannel = messageChannel;
        return draft;
      }),
    );
  },
  receiveMessage: (event: MessageEvent) => {
    const { showMessages } = get();
    const message = JSON.parse(event.data) as Message;
    set((state) => ({
      messages: [...state.messages, { ...message, sentByUser: false }],
    }));
    if (!showMessages) {
      set(() => ({ newMessage: true }));
      sounds.newMessageSound.play();
    }
  },
  sendMessage: (content: string) => {
    const { peerConnections, username } = get();
    const now = Date.now();
    const participantsCount = Object.keys(peerConnections).length;
    let failures = 0;
    try {
      Object.keys(peerConnections).map((k) => {
        const currentPeerConnection = peerConnections[k];
        currentPeerConnection.messageChannel?.send(
          JSON.stringify({ content, timestamp: now, username }),
        );
      });
      set((state) => ({
        messages: [
          ...state.messages,
          { content, timestamp: now, sentByUser: true },
        ],
      }));
    } catch (e) {
      failures++;
      console.log("could not send message with err:", e);
    }
    if (failures) {
      toasts.failedMessageDelivery(failures === participantsCount);
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
  subscriptions: [],
  endCall: async () => {
    sounds.callEndedSound.play();

    const {
      deleteRemoteStream,
      peerConnections,
      deletePeerConnection,
      conn,
      subscriptions,
    } = get();

    subscriptions.forEach((s) => s());
    Object.keys(peerConnections).forEach((pcKey) => {
      deleteRemoteStream(pcKey);
      deletePeerConnection(pcKey);
    });

    conn?.close();
    set(() => ({ passphrase: v7(), conn: null }));
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
      peerConnections,
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
      "",
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
    for (const k of Object.keys(peerConnections)) {
      const sender = peerConnections[k].peerConnection
        .getSenders()
        .find((s) => s.track?.kind === "video");
      sender?.replaceTrack(newVideoTrack);
    }

    // modify the perspective
    set(() => ({
      cameraPerspective: newCameraPerspective,
      shouldFlip: newCameraPerspective === "user",
    }));
  },
}));

const getUserStream = async (
  audio: boolean,
  audioDeviceId: string,
  video: boolean,
  perspective: "environment" | "user",
) => {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      ...(audioDeviceId ? { deviceId: audioDeviceId } : {}),
      noiseSuppression: true,
      autoGainControl: true,
      echoCancellation: true,
    },
    video: {
      width: { min: 640, ideal: 1280, max: 1920 },
      height: { min: 360, ideal: 720, max: 1080 },
      facingMode: perspective,
    },
  });

  if (!audio) {
    stream.getAudioTracks().forEach((a) => (a.enabled = false));
  }

  if (!video) {
    stream.getVideoTracks().forEach((v) => (v.enabled = false));
  }

  return stream;
};

const checkForBluetoothAudioDevices = async (
  stream: MediaStream,
): Promise<MediaStream> => {
  const devices = await navigator.mediaDevices.enumerateDevices();
  const audioDevices = devices
    .filter((d) => d.kind === "audioinput")
    .filter((d) => {
      const label = d.label.toLowerCase();
      return label.includes("airpods") || label.includes("bluetooth");
    });
  if (audioDevices.length) {
    stream.getAudioTracks().forEach((t) => {
      t.stop();
      stream.removeTrack(t);
    });

    const bluetoothDeviceStream = await getUserStream(
      true,
      audioDevices[0].deviceId,
      false,
      "user",
    );
    bluetoothDeviceStream.getAudioTracks().forEach((t) => {
      stream.addTrack(t);
    });
  }

  return stream;
};

async function getPeerConnection(): Promise<RTCPeerConnection> {
  const iceServers = [
    // STUN server
    { urls: "stun:turn.xhuliodo.xyz:3478" },
    // TURN server
    {
      urls: "turn:turn.xhuliodo.xyz:3478",
      username: "Thud3578",
      credential: "bbbX7qQuBSX7kUd5AWtLmouCW",
    },
    {
      urls: "turns:turn.xhuliodo.xyz:5349",
      username: "Thud3578",
      credential: "bbbX7qQuBSX7kUd5AWtLmouCW",
    },
  ];
  return new RTCPeerConnection({
    iceServers,
    iceCandidatePoolSize: 5,
  });
}

const getConnectionKey = (id: string, otherId: string): string => {
  let key: string;

  if (id < otherId) {
    // using the "_" character to separate the uuids
    key = id + "_" + otherId;
  } else {
    key = otherId + "_" + id;
  }

  return key;
};

// first id should be the current user's id
const getIsOfferer = (id: string, otherId: string): boolean => {
  // with id being uuidv7, timestamp is included, so the older user will always create offers
  // connection keys will also be created with the older id being first
  // note: "older" means older in time.
  if (id < otherId) {
    return true;
  }

  return false;
};
