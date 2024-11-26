export type EventType =
  | "new_participant"
  | "participant_left"
  | "offer"
  | "answer"
  | "ice_candidate";

export interface WSEvent {
  type: EventType;
  payload: unknown;
}

export interface OutNewParticipant {
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

export interface OutOffer {
  offer: string;
  from: string;
}

export interface OutParticipantLeft {
  participantId: string;
}

export const participantLeftEvent = (): string => {
  const e: WSEvent = {
    type: "participant_left",
    payload: {},
  };

  return JSON.stringify(e);
};

export interface OutOffer {
  offer: string;
  from: string;
}

export const newOfferEvent = (offer: string, to: string): string => {
  const e: WSEvent = {
    type: "offer",
    payload: {
      offer,
      to,
    },
  };
  return JSON.stringify(e);
};

export interface OutIceCandidate {
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

export interface OutAnswer {
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
