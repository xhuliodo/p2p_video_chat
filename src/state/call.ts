import { create } from "zustand";
import { v7 } from "uuid";
import { router } from "../routes";
// import { sounds } from "../notifications/sounds";
import { toasts } from "../notifications/toasts";
import {
  addParticipant,
  Connection,
  createCall,
  deleteCallByPassphrase,
  deleteCallConnection,
  deleteParticipant,
  getCallByPassphrase,
  getCallParticipantsByPassphrase,
  Participant,
  subscribeToConnectionUpdates,
  subscribeToIceCandidatesUpdates,
  subscribeToParticipantsUpdates,
  updateCallAnswer,
  updateCallConnectionStatus,
  updateCallIceCandidates,
  updateCallOffer,
  updateParticipantDisconnections,
} from "../firebase/firebase";
import { sounds } from "../notifications/sounds";
import { toast } from "react-toastify";
import { produce } from "immer";

type CameraPerspective = "environment" | "user";

interface PeerConnection {
  peerConnection: RTCPeerConnection;
  subscription: () => void;
}

interface Call {
  test: (howMany: number) => void;
  userId: string;
  solo: boolean;
  passphrase: string;
  isCreator: boolean;
  userStream: MediaStream | null;
  remoteStreams: Record<string, MediaStream>;
  addRemoteStream: (key: string, stream: MediaStream) => void;
  deleteRemoteStream: (key: string) => void;
  peerConnections: Record<string, PeerConnection>;
  addPeerConnection: (
    key: string,
    peerConnection: RTCPeerConnection,
    subscriptions: () => void,
  ) => void;
  deletePeerConnection: (key: string) => void;
  startCall: (passphrase: string) => Promise<void>;
  handleOffer: (passphrase: string, connectionKey: string) => Promise<void>;
  waitForIceCandidatesOrTimeout: (
    connectionKey: string,
    timeout: number,
  ) => Promise<string>;
  handleAnswer: (
    passphrase: string,
    connectionKey: string,
    offer: RTCSessionDescriptionInit,
  ) => Promise<void>;
  handleAnswerResponse: (
    connectionKey: string,
    answer: RTCSessionDescriptionInit,
  ) => void;
  handleReconnection: (connectionKey: string) => Promise<void>;
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
  isCreator: false,
  userStream: null,
  remoteStreams: {},
  addRemoteStream: (key: string, stream: MediaStream) => {
    set((state) =>
      produce(state, (draft) => {
        draft.remoteStreams[key] = stream;
        if (draft.solo) {
          draft.solo = false;
        }
        return draft;
      }),
    );
  },
  deleteRemoteStream: (key: string) => {
    set((state) =>
      produce(state, (draft) => {
        draft.remoteStreams[key].getTracks().forEach((t) => t.stop());
        delete draft.remoteStreams[key];
        if (Object.keys(draft.remoteStreams).length === 0) {
          draft.solo = true;
        }
        return draft;
      }),
    );
  },
  peerConnections: {},
  addPeerConnection: (
    key: string,
    peerConnection: RTCPeerConnection,
    subscription: () => void,
  ) => {
    set((state) =>
      produce(state, (draft) => {
        draft.peerConnections[key] = {
          peerConnection,
          subscription,
        };
        return draft;
      }),
    );
  },
  deletePeerConnection: (key: string) => {
    set((state) =>
      produce(state, (draft) => {
        draft.peerConnections[key].peerConnection.close();
        draft.peerConnections[key].subscription();
        delete draft.peerConnections[key];
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
      waitForIceCandidatesOrTimeout,
      handleAnswer,
      handleOffer,
      handleAnswerResponse,
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
    set(() => ({ userStream: stream, passphrase }));

    const foundCall = await getCallByPassphrase(passphrase);
    if (!foundCall) {
      await createCall(passphrase);
    }

    if (
      foundCall?.participants &&
      Object.keys(foundCall.participants).length > 5
    ) {
      router.navigate("/", {
        state: { message: "Room is full!" },
      });
      return;
    }

    // add event listener for when a new participant gets on call and see if you are
    // the one supposed to make an offer
    const handleParticipantsUpdates = async (
      participants: Record<string, Participant>,
    ) => {
      const { userId, peerConnections } = get();
      for (const participantId of Object.keys(participants)) {
        // skip yoself
        if (participantId === userId) {
          continue;
        }

        const connectionKey = getConnectionKey(userId, participantId);
        // you have already established a connection with this participant
        if (peerConnections[connectionKey]) {
          continue;
        }
        console.log("a new participant has joined the call");

        const isOfferer = getIsOfferer(userId, participantId);
        if (isOfferer) {
          console.log("you are making them an offer");
          await handleOffer(passphrase, connectionKey);
          const res = await waitForIceCandidatesOrTimeout(connectionKey, 10000);
          console.log(res);
          continue;
        }

        console.log("you are waiting for their offer");
      }
    };
    const participantsSub = subscribeToParticipantsUpdates(
      passphrase,
      handleParticipantsUpdates,
    );

    // add yourself in the participants list, and at the same time create the call if it does not exists
    await addParticipant(passphrase, userId);

    // add event listener for when an offer has been made to you
    // this functions handles the cases:
    // when an offer has been made
    // when an answer has been made
    const handleConnectionUpdates = async (
      connections: Record<string, Connection>,
    ) => {
      const {
        userId,
        peerConnections,
        deletePeerConnection,
        deleteRemoteStream,
      } = get();
      for (const connectionKey of Object.keys(connections)) {
        // skip connections you are not a part in
        if (!connectionKey.includes(userId)) {
          console.log("no need to take any action for this connection");
          continue;
        }

        const currentConnection = connections[connectionKey];
        // clean up deleted connections if not already
        if (currentConnection.deleted && peerConnections[connectionKey]) {
          console.log("cleaning up deleted connections");
          deletePeerConnection(connectionKey);
          deleteRemoteStream(connectionKey);
          continue;
        }

        // skip connections you have already handled
        if (currentConnection.done) {
          console.log(
            "connection established, no need to consider further updates",
          );
          continue;
        }

        const isOfferer = getIsOffererFromConnectionKey(userId, connectionKey);
        // handle the update as the offerer
        if (isOfferer) {
          if (!currentConnection.answer) {
            console.log("no answer for the offer yet");
            continue;
          }
          if (
            peerConnections[connectionKey] &&
            peerConnections[connectionKey].peerConnection.remoteDescription
          ) {
            console.log("already handled this response");
            continue;
          }

          console.log("got an answer to the offer made");
          handleAnswerResponse(connectionKey, currentConnection.answer);
          const res = await waitForIceCandidatesOrTimeout(connectionKey, 10000);
          console.log(res);
          await updateCallConnectionStatus(passphrase, connectionKey);

          continue;
          // handle the update as the answerer
        } else {
          if (currentConnection.answer) {
            console.log("already answered this offer");
            continue;
          }

          console.log("got a new offer");
          await handleAnswer(
            passphrase,
            connectionKey,
            currentConnection.offer,
          );
          const res = await waitForIceCandidatesOrTimeout(connectionKey, 10000);
          console.log(res);
        }
      }
    };
    const connectionSub = subscribeToConnectionUpdates(
      passphrase,
      handleConnectionUpdates,
    );

    set((state) => ({
      subscriptions: [...state.subscriptions, participantsSub, connectionSub],
    }));
  },
  handleOffer: async (passphrase: string, connectionKey: string) => {
    const { userStream, handleReconnection } = get();
    const newPeerConnection = await getPeerConnection();
    // Add local stream tracks to the peer connection
    userStream?.getTracks().forEach((track) => {
      newPeerConnection.addTrack(track, userStream);
    });

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
      if (state === "failed" || state === "disconnected") {
        handleReconnection(connectionKey);
      }
    };

    // Create an offer to connect to the remote peer
    const offer = await newPeerConnection.createOffer({ iceRestart: false });
    await newPeerConnection.setLocalDescription(offer);
    await updateCallOffer(passphrase, connectionKey, offer);

    // Handle ICE candidates
    newPeerConnection.onicecandidate = async (event) => {
      if (event.candidate) {
        updateCallIceCandidates(
          passphrase,
          connectionKey,
          true,
          event.candidate,
        );
      }
    };

    const handleIceCandidatesUpdates = (iceCandidate: RTCIceCandidate) => {
      if (iceCandidate) newPeerConnection.addIceCandidate(iceCandidate);
    };
    const iceCandidatesSub = subscribeToIceCandidatesUpdates(
      passphrase,
      connectionKey,
      false,
      handleIceCandidatesUpdates,
    );

    const { addPeerConnection } = get();
    addPeerConnection(connectionKey, newPeerConnection, iceCandidatesSub);
  },
  waitForIceCandidatesOrTimeout: (connectionKey: string, timeout: number) => {
    return new Promise((resolve) => {
      const timeoutId = setTimeout(() => {
        resolve("Timeout reached");
      }, timeout);

      const checkCondition = () => {
        const { peerConnections } = get();
        if (
          peerConnections[connectionKey].peerConnection.iceGatheringState ===
          "complete"
        ) {
          clearTimeout(timeoutId);
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
    passphrase: string,
    connectionKey: string,
    offer: RTCSessionDescriptionInit,
  ) => {
    const { userStream, handleReconnection } = get();
    const newPeerConnection = await getPeerConnection();
    // Add local stream tracks to the peer connection
    userStream?.getTracks().forEach((track) => {
      newPeerConnection.addTrack(track, userStream);
    });

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
        handleReconnection(connectionKey);
      }
    };

    await newPeerConnection.setRemoteDescription(offer);
    const answer = await newPeerConnection.createAnswer();
    await newPeerConnection.setLocalDescription(answer);
    await updateCallAnswer(passphrase, connectionKey, answer);

    // Handle ICE candidates
    newPeerConnection.onicecandidate = async (event) => {
      if (event.candidate) {
        console.log("answer adding candidate", event.candidate.toJSON());
        updateCallIceCandidates(
          passphrase,
          connectionKey,
          false,
          event.candidate,
        );
      }
    };

    const handleIceCandidatesUpdates = (iceCandidate: RTCIceCandidate) => {
      if (iceCandidate) {
        console.log("answer receiving candidate", iceCandidate.toJSON());
        newPeerConnection.addIceCandidate(iceCandidate);
      }
    };
    const iceCandidatesSub = subscribeToIceCandidatesUpdates(
      passphrase,
      connectionKey,
      true,
      handleIceCandidatesUpdates,
    );

    const { addPeerConnection } = get();
    addPeerConnection(connectionKey, newPeerConnection, iceCandidatesSub);
  },
  handleAnswerResponse: (
    connectionKey: string,
    answer: RTCSessionDescriptionInit,
  ) => {
    const { peerConnections } = get();
    peerConnections[connectionKey].peerConnection.setRemoteDescription(answer);
  },
  handleReconnection: async (connectionKey: string) => {
    const { deleteRemoteStream, deletePeerConnection, passphrase, userId } =
      get();
    deletePeerConnection(connectionKey);
    deleteRemoteStream(connectionKey);
    // reset answer
    // since the answer in dependent on the connections, we just delete the connection
    try {
      await deleteCallConnection(passphrase, connectionKey);
    } catch (e) {
      console.log("could not delete call connection with err: ", e);
    }
    // reset offer
    // since the offer is dependent on the participants, we just have to update the user with just an empty object
    await updateParticipantDisconnections(passphrase, userId);
  },
  subscriptions: [],
  endCall: async () => {
    sounds.callEndedSound.play();

    const {
      remoteStreams,
      deleteRemoteStream,
      peerConnections,
      deletePeerConnection,
      passphrase,
      userId,
      subscriptions,
    } = get();

    subscriptions.forEach((s) => s());
    Object.keys(remoteStreams).forEach((rsKey) => deleteRemoteStream(rsKey));
    Object.keys(peerConnections).forEach((pcKey) =>
      deletePeerConnection(pcKey),
    );

    const participants = await getCallParticipantsByPassphrase(passphrase);
    if (Object.keys(participants).length <= 1) {
      console.log("deleted call as last participant");
      await deleteCallByPassphrase(passphrase);
    } else {
      console.log("removing myself as a participant");
      await deleteParticipant(passphrase, userId);
    }

    set(() => ({ passphrase: v7() }));
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
  return navigator.mediaDevices.getUserMedia({
    audio: audio
      ? {
          ...(audioDeviceId ? { deviceId: audioDeviceId } : {}),
          noiseSuppression: true,
          autoGainControl: true,
          echoCancellation: true,
        }
      : audio,
    video: video
      ? {
          width: { min: 640, ideal: 1280, max: 1920 },
          height: { min: 360, ideal: 720, max: 1080 },
          facingMode: perspective,
        }
      : video,
  });
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

const getIsOffererFromConnectionKey = (
  id: string,
  connectionKey: string,
): boolean => {
  const ids = connectionKey.split("_");
  if (!ids.length) {
    console.log("bad connection key");
    return false;
  }

  if (ids[0] === id) {
    return true;
  }

  return false;
};
