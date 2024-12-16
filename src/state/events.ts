export type EventType =
  | "new_participant"
  | "participant_left"
  | "offer"
  | "answer"
  | "ice_candidate"
  | "data_mode";

export interface WSEvent {
  type: EventType;
  payload: unknown;
}

export interface NewParticipantResponse {
  participantId: string;
}

export const newNewParticipantEvent = (userId: string): string => {
  const e: WSEvent = {
    type: "new_participant",
    payload: {
      userId,
    },
  };

  return JSON.stringify(e);
};

export interface OfferResponse {
  offer: string;
  from: string;
}

export interface ParticipantLeftResponse {
  participantId: string;
}

export const participantLeftEvent = (): string => {
  const e: WSEvent = {
    type: "participant_left",
    payload: {},
  };

  return JSON.stringify(e);
};

export interface OfferResponse {
  offer: string;
  dataMode: boolean;
  from: string;
}

export const newOfferEvent = (
  offer: string,
  dataMode: boolean,
  to: string,
): string => {
  const e: WSEvent = {
    type: "offer",
    payload: {
      offer,
      dataMode,
      to,
    },
  };
  return JSON.stringify(e);
};

export interface IceCandidateResponse {
  iceCandidate: string;
  from: string;
}

export const newIceCandidateEvent = (
  iceCandidate: string,
  to: string,
): string => {
  const e: WSEvent = {
    type: "ice_candidate",
    payload: {
      iceCandidate,
      to,
    },
  };

  return JSON.stringify(e);
};

export interface AnswerResponse {
  answer: string;
  from: string;
}

export const newAnswerEvent = (answer: string, to: string): string => {
  const e: WSEvent = {
    type: "answer",
    payload: {
      answer,
      to,
    },
  };

  return JSON.stringify(e);
};

export interface DataModeResponse {
  isLowDataMode: boolean;
}

export const newDataModeEvent = (dataMode: boolean): string => {
  const e: WSEvent = {
    type: "data_mode",
    payload: {
      isLowDataMode: dataMode,
    },
  };

  return JSON.stringify(e);
};
