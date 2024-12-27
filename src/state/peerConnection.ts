import { constants } from "../constants";

/**
 * Asynchronously retrieves an RTCPeerConnection instance configured with ICE servers.
 *
 * If the required environment variables for STUN/TURN servers are not set, it returns a default
 * RTCPeerConnection instance with a public free STUN server.
 *
 * Otherwise, it attempts to fetch TURN credentials from the backend service and configures the
 * RTCPeerConnection instance with the provided STUN and TURN servers.
 *
 * @param userId - The unique identifier of the user for whom the TURN credentials are being fetched.
 * @returns A Promise that resolves to an RTCPeerConnection instance.
 */
export const getPeerConnection = async (
  userId: string,
): Promise<RTCPeerConnection> => {
  const defaultPeerConnection = new RTCPeerConnection({
    iceServers: [
      // Public free STUN server
      { urls: "stun:stun.l.google.com:19302" },
    ],
    iceCandidatePoolSize: constants.iceCandidatePoolSize,
  });

  if (
    !import.meta.env.VITE_BACKEND_URL ||
    !import.meta.env.VITE_STUN_SERVER_URL ||
    !import.meta.env.VITE_TURN_SERVER_URL ||
    !import.meta.env.VITE_TURNS_SERVER_URL
  ) {
    console.error(
      "missing required environment variables for stun/turn servers",
    );
    return defaultPeerConnection;
  }

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
    console.error("could not get turn credentials with err: ", { e });
    return defaultPeerConnection;
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
  return new RTCPeerConnection({
    iceServers,
    iceCandidatePoolSize: constants.iceCandidatePoolSize,
  });
};

/**
 *
 * Get the connection key between two users. BE CAREFUL OF THE ORDER OF THE IDS.
 * The first id should be the current user's id.
 *
 * @param id "uuidv7" of the current user
 * @param otherId "uuidv7" of the other user
 * @returns
 */
export const getConnectionKey = (id: string, otherId: string): string => {
  let key: string;

  if (id < otherId) {
    // using the "_" character to separate the uuids
    key = id + "_" + otherId;
  } else {
    key = otherId + "_" + id;
  }

  return key;
};

/**
 *
 * Determine if the current user is the offerer or the answerer in the connection.
 * BE CAREFUL OF THE ORDER OF THE IDS. The first id should be the current user's id.
 *
 * @param id "uuidv7" of the current user
 * @param otherId "uuidv7" of the other user
 * @returns
 */
export const getIsOfferer = (id: string, otherId: string): boolean => {
  // with id being uuidv7, timestamp is included, so the older user will always create offers
  // connection keys will also be created with the older id being first
  // note: "older" means older in time.
  if (id < otherId) {
    return true;
  }

  return false;
};

/**
 * A helper function that sets the max bitrate of the video track in the provided RTCPeerConnection.
 */
export const handleBitrate = async (
  pc: RTCPeerConnection,
  dataMode: boolean,
) => {
  const sender = pc.getSenders().find((s) => s.track?.kind === "video");
  if (sender) {
    const parameters = sender.getParameters();
    if (!parameters.encodings) {
      parameters.encodings = [{}];
    }

    if (dataMode) {
      parameters.encodings[0].maxBitrate = constants.sdMaxBitrate; // Disable bandwidth usage
    } else {
      parameters.encodings[0].maxBitrate = constants.hdMaxBitrate;
    }

    sender
      .setParameters(parameters)
      .then(() => console.log("maxbitrate set"))
      .catch(() => console.error("could not set parameter for bitrate"));
  } else {
    console.error("could not find sender to set bitrate");
  }
};
