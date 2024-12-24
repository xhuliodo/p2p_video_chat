import { create } from "zustand";
import { produce } from "immer";
import { v7 } from "uuid";
import { toasts } from "../notifications/toasts";
import { sounds } from "../notifications/sounds";
import { constants } from "../constants";
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
  newDataModeEvent,
  DataModeResponse,
} from "./events";

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

interface VideoStream {
  stream: MediaStream | null;
  aspectRatio: number;
}

interface Call {
  userId: string;
  solo: boolean;
  passphrase: string;
  conn: WebSocket | null;
  lowDataMode: boolean;
  switchDataMode: () => void;
  handleDataMode: (dataMode: boolean, initiator: boolean) => Promise<void>;
  userStream: VideoStream;
  remoteStreams: Record<string, MediaStream>;
  addRemoteStream: (key: string, stream: MediaStream) => void;
  deleteRemoteStream: (key: string) => void;
  peerConnections: Record<string, PeerConnection>;
  addPeerConnection: (key: string, peerConnection: RTCPeerConnection) => void;
  deletePeerConnection: (key: string) => void;
  startCall: (passphrase: string) => Promise<void>;
  handleOffer: (participantId: string) => Promise<void>;
  handleAnswer: (
    participantId: string,
    offer: string,
    dataMode: boolean,
  ) => Promise<void>;
  handleAnswerResponse: (
    participantId: string,
    answer: string,
  ) => Promise<void>;
  handleIceCandidates: (
    participantId: string,
    iceCandidate: string,
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
  endCall: () => Promise<void>;
  isAudioEnabled: boolean;
  switchAudio: () => void;
  isCameraEnabled: boolean;
  cameraPerspective: CameraPerspective;
  switchCamera: () => void;
  shouldMirrorCamera: boolean;
  canSwitchCameraPerspective: boolean;
  switchCameraPerspective: () => Promise<void>;
}

export const useCallStore = create<Call>((set, get) => ({
  userId: v7(),
  solo: true,
  passphrase: "",
  conn: null,
  lowDataMode: false,
  switchDataMode: async () => {
    const { lowDataMode, handleDataMode } = get();
    handleDataMode(!lowDataMode, true);
    set(() => ({ lowDataMode: !lowDataMode }));
  },
  handleDataMode: async (dataMode: boolean, initiator: boolean) => {
    const {
      isCameraEnabled,
      cameraPerspective,
      userStream,
      peerConnections,
      conn,
    } = get();

    const stream = await getUserStream(
      false,
      "",
      isCameraEnabled,
      cameraPerspective,
      dataMode,
    );

    const videoTrack = userStream.stream?.getVideoTracks()[0];
    const newVideoTrack = stream.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.stop();
      userStream.stream?.removeTrack(videoTrack);
    }
    userStream.stream?.addTrack(newVideoTrack);

    let failures = 0;
    for (const k of Object.keys(peerConnections)) {
      try {
        const sender = peerConnections[k].peerConnection
          .getSenders()
          .find((s) => s.track?.kind === "video");
        if (sender) {
          sender.replaceTrack(newVideoTrack);

          const parameters = sender.getParameters();
          if (!parameters.encodings) {
            parameters.encodings = [{}];
          }

          if (dataMode) {
            parameters.encodings[0].maxBitrate = constants.sdMaxBitrate;
          } else {
            parameters.encodings[0].maxBitrate = constants.hdMaxBitrate;
          }

          await sender.setParameters(parameters);
        }
      } catch (err: unknown) {
        console.log("could not set parameters with err: ", { err });
        failures++;
        break;
      }
    }

    if (initiator) {
      const dataModeEvent = newDataModeEvent(dataMode);
      conn?.send(dataModeEvent);
    } else {
      set(() => ({ lowDataMode: dataMode }));
    }

    if (failures) {
      toasts.lowDataModeFailed();
    } else {
      toasts.lowDataMode(dataMode);
    }
  },
  userStream: { stream: null, aspectRatio: 1 },
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
      lowDataMode,
      handleDataMode,
    } = get();
    const userStream: VideoStream = { stream: null, aspectRatio: 1 };
    try {
      userStream.stream = await getUserStream(
        isAudioEnabled,
        "",
        isCameraEnabled,
        cameraPerspective,
        lowDataMode,
      );
      userStream.stream = await checkForBluetoothAudioDevices(
        userStream.stream,
      );
    } catch {
      throw new Error("Permissions of camera and audio are required!");
    }
    userStream.aspectRatio = getAspectRatio(userStream.stream);

    if (!window["WebSocket"]) {
      throw new Error("Your browser does not support websockets!");
    }

    const newWebsocketConnection = new WebSocket(
      "wss://" + import.meta.env.VITE_BACKEND_URL + "/calls/" + passphrase,
    );
    newWebsocketConnection.onopen = () => {
      const e = newNewParticipantEvent(userId);
      newWebsocketConnection.send(e);
    };
    newWebsocketConnection.onclose = (e) => {
      if (!e.wasClean) {
        toasts.somethingWentWrong();
      }
    };
    newWebsocketConnection.onerror = (e) => {
      console.log("WebSocket error: ", e);
    };
    newWebsocketConnection.onmessage = async (e) => {
      const event: WSEvent = JSON.parse(e.data);
      switch (event.type) {
        case "new_participant": {
          toasts.connecting();
          const eventData = event.payload as NewParticipantResponse;
          handleOffer(eventData.participantId);
          break;
        }
        case "offer": {
          toasts.connecting();
          const eventData = event.payload as OfferResponse;
          handleAnswer(eventData.from, eventData.offer, eventData.dataMode);
          break;
        }
        case "answer": {
          const eventData = event.payload as AnswerResponse;
          handleAnswerResponse(eventData.from, eventData.answer);
          break;
        }
        case "ice_candidate": {
          const eventData = event.payload as IceCandidateResponse;
          handleIceCandidates(eventData.from, eventData.iceCandidate);
          break;
        }
        case "participant_left": {
          const eventData = event.payload as ParticipantLeftResponse;
          handleParticipantLeft(eventData.participantId);
          break;
        }
        case "data_mode": {
          const eventData = event.payload as DataModeResponse;
          handleDataMode(eventData.isLowDataMode, false);
          break;
        }
      }
    };

    set(() => ({
      userStream,
      passphrase,
      conn: newWebsocketConnection,
    }));
  },
  handleOffer: async (participantId: string) => {
    const {
      userStream,
      addMessageChannel,
      conn,
      userId,
      handleReconnection,
      lowDataMode,
      receiveMessage,
      addRemoteStream,
    } = get();
    const connectionKey = getConnectionKey(userId, participantId);

    let newPeerConnection: RTCPeerConnection;
    try {
      newPeerConnection = await getPeerConnection(userId);
    } catch (err: unknown) {
      console.error("could not create new peer connection with err: ", { err });
      toasts.somethingWentWrong();
      return;
    }
    newPeerConnection.onicecandidateerror = (ev) => {
      console.error("could not gather ice candidates with err: ", { ev });
    };
    // Add local stream tracks to the peer connection
    userStream.stream?.getTracks().forEach((track) => {
      if (userStream.stream) {
        newPeerConnection.addTrack(track, userStream.stream);
      }
    });
    // Handle incoming tracks from remote peers
    newPeerConnection.ontrack = (event) => {
      if (event.streams.length) {
        if (!Object.entries(get().remoteStreams))
          sounds.callStartedSound.play();

        event.streams.map((s) => addRemoteStream(connectionKey, s));
      }
    };
    // Handle reconnection or cleanup
    newPeerConnection.oniceconnectionstatechange = async () => {
      const state = newPeerConnection.iceConnectionState;
      toasts.connectionStatus(state);
      if (state === "connected") {
        const sender = newPeerConnection
          .getSenders()
          .find((s) => s.track?.kind === "video");
        if (sender) {
          const parameters = sender.getParameters();
          if (!parameters.encodings) {
            parameters.encodings = [{}];
          }

          if (get().lowDataMode) {
            parameters.encodings[0].maxBitrate = constants.sdMaxBitrate; // Disable bandwidth usage
          } else {
            parameters.encodings[0].maxBitrate = constants.hdMaxBitrate;
          }

          sender
            .setParameters(parameters)
            .then(() => console.log("maxbitrate set"))
            .catch(() => console.log("could not set parameter for bitrate"));
        } else {
          console.log("could not find send to set bitrate");
        }
      }
      if (
        state === "failed" ||
        state === "disconnected" ||
        state === "closed" ||
        state === "completed"
      ) {
        handleReconnection(participantId);
      }
    };
    // Handle ICE candidates
    newPeerConnection.onicecandidate = async (event) => {
      if (event.candidate) {
        const c = JSON.stringify(event.candidate.toJSON());
        const e = newIceCandidateEvent(c, participantId);
        conn?.send(e);
      }
    };

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
    messageChannel.onmessage = receiveMessage;

    // Create an offer to connect to the remote peer
    const offer = await newPeerConnection.createOffer();
    await newPeerConnection.setLocalDescription(offer);
    const e = newOfferEvent(JSON.stringify(offer), lowDataMode, participantId);
    conn?.send(e);

    const { addPeerConnection } = get();
    addPeerConnection(connectionKey, newPeerConnection);
    addMessageChannel(connectionKey, messageChannel);
  },
  handleAnswer: async (
    participantId: string,
    offer: string,
    dataMode: boolean,
  ) => {
    const { userId, handleReconnection } = get();
    const connectionKey = getConnectionKey(userId, participantId);

    let o: RTCSessionDescription;
    try {
      const offerJson = JSON.parse(offer);
      o = new RTCSessionDescription(offerJson);
    } catch (err: unknown) {
      console.error("could not parse offer with err: ", { err });
      handleReconnection(connectionKey);
      return;
    }

    const {
      userStream,
      addMessageChannel,
      conn,
      peerConnections,
      lowDataMode,
      handleDataMode,
    } = get();
    // clean up for the reconnections, in case one of the peers has yet to delete their old connection
    if (peerConnections[connectionKey]) {
      handleReconnection(participantId);
    }

    // handle the data mode as soon as possible in the peerConnection lifecycle
    if (lowDataMode !== dataMode) {
      await handleDataMode(dataMode, false);
    }

    let newPeerConnection: RTCPeerConnection;
    try {
      newPeerConnection = await getPeerConnection(userId);
    } catch (err: unknown) {
      console.error("could not create new peer connection with err: ", { err });
      toasts.somethingWentWrong();
      return;
    }
    newPeerConnection.onicecandidateerror = (ev) => {
      console.error("could not gather ice candidates with err: ", { ev });
    };
    // Add local stream tracks to the peer connection
    userStream.stream?.getTracks().forEach((track) => {
      if (userStream.stream) {
        newPeerConnection.addTrack(track, userStream.stream);
      }
    });
    // Handle incoming tracks from remote peers
    newPeerConnection.ontrack = (event) => {
      const { addRemoteStream } = get();
      if (event.streams.length) {
        if (!Object.entries(get().remoteStreams)) {
          sounds.callStartedSound.play();
        }
        event.streams.map((s) => addRemoteStream(connectionKey, s));
      }
    };
    // Handle reconnection or cleanup
    newPeerConnection.oniceconnectionstatechange = async () => {
      const state = newPeerConnection.iceConnectionState;
      toasts.connectionStatus(state);
      if (state === "connected") {
        const sender = newPeerConnection
          .getSenders()
          .find((s) => s.track?.kind === "video");
        if (sender) {
          const parameters = sender.getParameters();
          if (!parameters.encodings) {
            parameters.encodings = [{}];
          }

          if (get().lowDataMode) {
            parameters.encodings[0].maxBitrate = constants.sdMaxBitrate; // Disable bandwidth usage
          } else {
            parameters.encodings[0].maxBitrate = constants.hdMaxBitrate;
          }

          sender
            .setParameters(parameters)
            .then(() => console.log("maxbitrate set"))
            .catch(() => console.log("could not set parameter for bitrate"));
        } else {
          console.log("could not find send to set bitrate");
        }
      }
      if (
        state === "failed" ||
        state === "disconnected" ||
        state === "closed" ||
        state === "completed"
      ) {
        handleReconnection(participantId);
      }
    };
    // Handle ICE candidates
    newPeerConnection.onicecandidate = async (event) => {
      if (event.candidate) {
        const c = JSON.stringify(event.candidate.toJSON());
        const e = newIceCandidateEvent(c, participantId);
        conn?.send(e);
      }
    };

    // try and setup a message channel
    newPeerConnection.ondatachannel = (channelEvent) => {
      const messageChannel = channelEvent.channel;
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
      messageChannel.onmessage = get().receiveMessage;

      addMessageChannel(connectionKey, messageChannel);
    };

    await newPeerConnection.setRemoteDescription(o);
    const answer = await newPeerConnection.createAnswer();
    await newPeerConnection.setLocalDescription(answer);
    const e = newAnswerEvent(JSON.stringify(answer), participantId);
    conn?.send(e);

    const { addPeerConnection } = get();
    addPeerConnection(connectionKey, newPeerConnection);
  },
  handleAnswerResponse: async (participantId: string, answer: string) => {
    const { userId, handleReconnection } = get();
    const connectionKey = getConnectionKey(userId, participantId);

    let a: RTCSessionDescription;
    try {
      console.log({ answer });
      const answerJson = JSON.parse(answer);
      a = new RTCSessionDescription(answerJson);
    } catch (err: unknown) {
      console.error("could not parse answer with err: ", { err });
      handleReconnection(connectionKey);
      return;
    }

    const { peerConnections } = get();
    if (peerConnections[connectionKey]) {
      peerConnections[connectionKey].peerConnection.setRemoteDescription(a);
    } else {
      console.log("answer came before peer connection was establised");
    }
  },
  handleIceCandidates: async (participantId: string, iceCandidate: string) => {
    let ic: RTCIceCandidate;
    try {
      const iceCandidateJson = JSON.parse(iceCandidate);
      ic = new RTCIceCandidate(iceCandidateJson);
    } catch (err: unknown) {
      console.error("could not parse ice candidate with err: ", { err });
      return;
    }

    const { userId } = get();
    const connectionKey = getConnectionKey(userId, participantId);
    // ice candidates as exhanged as soon as the participants are notified that there
    // is another party. to prevent loss on these candidates, the function below sets
    // them eventually with a timeout and a max of X times
    const waitFor = 100; //in miliseconds
    const tryFor = 3;
    const addIceCandidateEventually = (triesLeft: number) => {
      if (!triesLeft) {
        console.log(`Failed to set ICE candidate after ${tryFor} attempts`);
        return;
      }

      const { peerConnections } = get();
      if (!peerConnections[connectionKey]) {
        console.log(
          `Retrying to add ICE candidate... (${tryFor + 1 - triesLeft}/${tryFor})`,
        );
        setTimeout(() => addIceCandidateEventually(triesLeft - 1), waitFor);
        return;
      }

      peerConnections[connectionKey].peerConnection
        .addIceCandidate(ic)
        .then(() => console.log("ICE candidate added successfully"))
        .catch((err: unknown) =>
          console.error("Failed to add ICE candidate:", { err }),
        );
    };

    addIceCandidateEventually(tryFor);
  },
  handleParticipantLeft: async (participantId: string) => {
    const { userId, deletePeerConnection, deleteRemoteStream } = get();
    const connectionKey = getConnectionKey(userId, participantId);
    deleteRemoteStream(connectionKey);
    deletePeerConnection(connectionKey);
  },
  handleReconnection: async (participantId: string) => {
    toasts.reconnecting();
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
        if (draft.peerConnections[key]) {
          draft.peerConnections[key].messageChannel = messageChannel;
        } else {
          console.log(
            "message channel was opened before the connection was established",
          );
        }
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
    } catch (e: unknown) {
      failures++;
      console.log("could not send message with err:", { e });
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
  endCall: async () => {
    const { deleteRemoteStream, peerConnections, deletePeerConnection, conn } =
      get();

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
    userStream.stream?.getAudioTracks().forEach((track) => {
      track.enabled = !isAudioEnabled;
    });

    set(() => ({ isAudioEnabled: !isAudioEnabled }));
  },
  isCameraEnabled: true,
  cameraPerspective: "user",
  switchCamera: async () => {
    const { userStream, isCameraEnabled, peerConnections, lowDataMode } = get();
    const newIsCameraEnabled = !isCameraEnabled;
    userStream.stream?.getVideoTracks().forEach((track) => {
      track.enabled = newIsCameraEnabled;
    });

    // go through all the peer connections and set the video bitrate to
    // 0, this way no video data is sent at all. By default if disabled
    // webrtc still keeps sending black frames to the peer. More about
    // this at: https://developer.mozilla.org/en-US/docs/Web/API/MediaStreamTrack/enabled
    for (const k of Object.keys(peerConnections)) {
      const sender = peerConnections[k].peerConnection
        .getSenders()
        .find((s) => s.track?.kind === "video");

      if (sender) {
        const parameters = sender.getParameters();
        if (!parameters.encodings) {
          parameters.encodings = [{}];
        }

        if (newIsCameraEnabled) {
          parameters.encodings[0].maxBitrate = lowDataMode
            ? constants.sdMaxBitrate
            : constants.hdMaxBitrate;
        } else {
          parameters.encodings[0].maxBitrate = 0; // Disable bandwidth usage
        }

        sender.setParameters(parameters);
      }
    }

    set(() => ({ isCameraEnabled: !isCameraEnabled }));
  },
  shouldMirrorCamera: true,
  canSwitchCameraPerspective: true,
  switchCameraPerspective: async () => {
    const { peerConnections, cameraPerspective, userStream, lowDataMode } =
      get();
    const newCameraPerspective =
      cameraPerspective === "user" ? "environment" : "user";

    let newUserStream: MediaStream;
    try {
      newUserStream = await getUserStream(
        false,
        "",
        true,
        newCameraPerspective,
        lowDataMode,
      );
    } catch (err: unknown) {
      console.error("could not switch camera with err: ", { err });
      throw new Error("Permissions of camera are required!");
    }

    // check if the user can switch for future uses
    if (newCameraPerspective === "environment") {
      const newTrackSettings = newUserStream.getVideoTracks()[0].getSettings();
      if (
        !newTrackSettings.facingMode &&
        newTrackSettings.facingMode === "user"
      ) {
        set(() => ({ canSwitchCameraPerspective: false }));
        throw new Error("You don't have a rear facing camera to switch to.");
      }
    }

    // stop older video track and remove it and
    // add new video track to the ui and to the webrtc connection
    const videoTrack = userStream.stream?.getVideoTracks()[0];
    const newVideoTrack = newUserStream.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.stop();
      userStream.stream?.removeTrack(videoTrack);
    }
    userStream.stream?.addTrack(newVideoTrack);

    for (const k of Object.keys(peerConnections)) {
      const sender = peerConnections[k].peerConnection
        .getSenders()
        .find((s) => s.track?.kind === "video");
      sender?.replaceTrack(newVideoTrack);
    }

    // modify the perspective
    set(() => ({
      cameraPerspective: newCameraPerspective,
      shouldMirrorCamera: newCameraPerspective === "user",
    }));
  },
}));

const getUserStream = async (
  audio: boolean,
  audioDeviceId: string,
  video: boolean,
  perspective: "environment" | "user",
  lowDataMode: boolean,
) => {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      ...(audioDeviceId ? { deviceId: audioDeviceId } : {}),
      noiseSuppression: true,
      autoGainControl: true,
      echoCancellation: true,
    },
    video: {
      width: lowDataMode ? { ideal: 480 } : { ideal: 1280 },
      height: lowDataMode ? { ideal: 360 } : { ideal: 720 },
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

/**
 * checkForBluetoothAudioDevices check if there are any connected and active bluetooth
 * devices connected at the start of the call. if there are, it replaces it. this function
 * solves this issue encountered on mobile only.
 */
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
      false,
    );
    bluetoothDeviceStream.getAudioTracks().forEach((t) => {
      stream.addTrack(t);
    });
  }

  return stream;
};

async function getPeerConnection(userId: string): Promise<RTCPeerConnection> {
  let turnCredentials = {
    username: "user",
    password: "password",
    expiresAt: 0,
  };
  try {
    // Attempt to fetch TURN credentials from primary service
    const res = await fetch(
      `https://${import.meta.env.VITE_BACKEND_URL}/turn/credentials?userId=${userId}`,
    );
    if (res.ok) {
      turnCredentials = await res.json();
    }
  } catch (e) {
    console.log("could not get turn credentials with err: ", { e });
  }

  const iceServers = [
    // STUN server
    { urls: import.meta.env.VITE_STUN_SERVER_URL },
    // TURN server
    {
      urls: import.meta.env.VITE_TURN_SERVER_URL,
      username: turnCredentials.username,
      credential: turnCredentials.password,
    },
    {
      urls: import.meta.env.VITE_TURNS_SERVER_URL,
      username: turnCredentials.username,
      credential: turnCredentials.password,
    },
  ];
  console.log({ iceServers });
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

const getAspectRatio = (stream: MediaStream): number => {
  const defaultAspectRatio = 16 / 9;
  const videoTracks = stream.getVideoTracks();
  if (!videoTracks.length) {
    console.log("could not get video track to calculate aspect ratio");
    return defaultAspectRatio;
  }
  const settings = videoTracks[0].getSettings();

  if (settings.aspectRatio) return settings.aspectRatio;

  return (settings.width || 1) / (settings.height || 1);
};
