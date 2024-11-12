import { create } from "zustand";
import { v7 } from "uuid";
import { router } from "../routes";
// import { sounds } from "../notifications/sounds";
import { toasts } from "../notifications/toasts";
import {
  addParticipant,
  Connection,
  Participant,
  subscribeToConnectionUpdates,
  subscribeToIceCandidatesUpdates,
  subscribeToParticipantsUpdates,
  updateCallAnswer,
  updateCallConnectionStatus,
  updateCallIceCandidates,
  updateCallOffer,
} from "../firebase/firebase";
import { sounds } from "../notifications/sounds";
import { toast } from "react-toastify";
import { produce } from "immer";

type CameraPerspective = "environment" | "user";

interface Call {
  userId: string;
  solo: boolean;
  passphrase: string;
  isCreator: boolean;
  test: () => Promise<void>;
  startCall: (passphrase: string) => Promise<void>;
  handleOffer: (passphrase: string, connectionKey: string) => Promise<void>;
  handleAnswer: (
    passphrase: string,
    connectionKey: string,
    offer: RTCSessionDescriptionInit,
  ) => Promise<void>;
  handleAnswerResponse: (
    connectionKey: string,
    answer: RTCSessionDescriptionInit,
  ) => void;
  isAudioEnabled: boolean;
  switchAudio: () => void;
  isCameraEnabled: boolean;
  cameraPerspective: CameraPerspective;
  switchCamera: () => void;
  shouldFlip: boolean;
  canSwitchCameraPerspective: boolean;
  switchCameraPerspective: () => Promise<void>;
  userStream: MediaStream | null;
  remoteStreams: Record<string, MediaStream>;
  addRemoteStream: (key: string, stream: MediaStream) => void;
  peerConnections: Record<string, RTCPeerConnection>;
  addPeerConnection: (key: string, peerConnection: RTCPeerConnection) => void;
  subscriptions: (() => void)[];
}

export const useCallStore = create<Call>((set, get) => ({
  userId: localStorage.getItem("userId") || v7(),
  solo: true,
  passphrase: "",
  isCreator: false,
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
  addPeerConnection: (key: string, peerConnection: RTCPeerConnection) => {
    set((state) =>
      produce(state, (draft) => {
        draft.peerConnections[key] = peerConnection;
        return draft;
      }),
    );
  },
  peerConnections: {},
  test: async () => {
    const stream = await getUserStream(false, true, "user");
    set(() => ({ solo: false }));

    for (let i = 0; i < 6; i++) {
      set((s) => ({ remoteStreams: { ...s.remoteStreams, [i]: stream } }));
    }
  },
  startCall: async (passphrase) => {
    const { isAudioEnabled, isCameraEnabled, cameraPerspective, userId } =
      get();
    localStorage.setItem("userId", userId);
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
    set(() => ({ userStream: stream }));

    // add event listener for when a new participant gets on call and see if you are
    // the one supposed to make an offer
    const handleParticipantsUpdates = async (
      participants: Record<string, Participant>,
    ) => {
      const { userId, peerConnections, handleOffer } = get();
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
          handleOffer(passphrase, connectionKey);
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
      const { handleAnswer, userId, handleAnswerResponse } = get();
      for (const connectionKey of Object.keys(connections)) {
        // skip connections you are not a part in
        if (!connectionKey.includes(userId)) {
          console.log("no need to take any action for this connection");
          continue;
        }

        const currentConnection = connections[connectionKey];
        // skip connections you have already handled
        if (currentConnection.done) {
          console.log(
            "connection established, no need to consider further updates",
          );
          continue;
        }

        const isOfferer = getIsOffererFromConnectionKey(userId, connectionKey);
        // handle the response for the answer
        if (isOfferer) {
          if (currentConnection.answer) {
            console.log("got an answer to the offer made");
            handleAnswerResponse(connectionKey, currentConnection.answer);
            await updateCallConnectionStatus(passphrase, connectionKey);
          }
          continue;
        }

        // handle the response for the offer
        if (currentConnection.answer) {
          console.log("already answered this offer!");
          continue;
        }

        console.log("got a new offer");
        handleAnswer(passphrase, connectionKey, currentConnection.offer);
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
    const { userStream } = get();
    const newPeerConnection = await getPeerConnection();
    // Add local stream tracks to the peer connection
    userStream?.getTracks().forEach((track) => {
      newPeerConnection.addTrack(track, userStream);
    });

    // Handle incoming tracks from remote peers
    newPeerConnection.ontrack = (event) => {
      const { solo, addRemoteStream } = get();
      if (event.streams.length) {
        sounds.callStartedSound.play();
        if (solo) {
          set(() => ({ solo: false }));
        }
        addRemoteStream(connectionKey, event.streams[0]);
      }
    };
    newPeerConnection.oniceconnectionstatechange = async () => {
      // TODO: handle disconnections
      const state = newPeerConnection.iceConnectionState;
      toast(state);
    };

    // Create an offer to connect to the remote peer
    const offer = await newPeerConnection.createOffer();
    await newPeerConnection.setLocalDescription(offer);
    await updateCallOffer(passphrase, connectionKey, offer);

    // Handle ICE candidates
    newPeerConnection.onicecandidate = async (event) => {
      if (event.candidate) {
        console.log("offer adding candidate", event.candidate.toJSON());
        updateCallIceCandidates(
          passphrase,
          connectionKey,
          true,
          event.candidate,
        );
      }
    };

    const handleIceCandidatesUpdates = (iceCandidate: RTCIceCandidate) => {
      if (iceCandidate) {
        console.log("offer receiving candidate", iceCandidate.toJSON());
        newPeerConnection.addIceCandidate(iceCandidate);
      }
    };
    const iceCandidatesSub = subscribeToIceCandidatesUpdates(
      passphrase,
      connectionKey,
      false,
      handleIceCandidatesUpdates,
    );

    const { addPeerConnection } = get();
    addPeerConnection(connectionKey, newPeerConnection);
    set((state) => ({
      subscriptions: [...state.subscriptions, iceCandidatesSub],
    }));
  },
  handleAnswer: async (
    passphrase: string,
    connectionKey: string,
    offer: RTCSessionDescriptionInit,
  ) => {
    const { userStream } = get();
    const newPeerConnection = await getPeerConnection();
    // Add local stream tracks to the peer connection
    userStream?.getTracks().forEach((track) => {
      newPeerConnection.addTrack(track, userStream);
    });

    // Handle incoming tracks from remote peers
    newPeerConnection.ontrack = (event) => {
      const { solo, addRemoteStream } = get();
      if (event.streams.length) {
        sounds.callStartedSound.play();
        if (solo) {
          set(() => ({ solo: false }));
        }
        addRemoteStream(connectionKey, event.streams[0]);
      }
    };

    newPeerConnection.oniceconnectionstatechange = async () => {
      // TODO: handle disconnections
      const state = newPeerConnection.iceConnectionState;
      toast(state);
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
    addPeerConnection(connectionKey, newPeerConnection);
    set((state) => ({
      subscriptions: [...state.subscriptions, iceCandidatesSub],
    }));
  },
  handleAnswerResponse: (
    connectionKey: string,
    answer: RTCSessionDescriptionInit,
  ) => {
    const { peerConnections } = get();
    const currentPeerConnection = peerConnections[connectionKey];
    if (currentPeerConnection.signalingState === "stable") {
      return;
    }
    currentPeerConnection.setRemoteDescription(answer);
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
      const sender = peerConnections[k]
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
  subscriptions: [],
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
