import { Howl } from "howler";
const newMessageSound = new Howl({ src: "new_message.mp3" });
const callStartedSound = new Howl({ src: "call_started.wav" });
const callEndedSound = new Howl({ src: "call_ended.wav" });

export const sounds = {
  newMessage: () => {
    newMessageSound.play();
  },
  callStarted: () => {
    callStartedSound.play();
  },
  callEnded: () => {
    callEndedSound.play();
  },
};
