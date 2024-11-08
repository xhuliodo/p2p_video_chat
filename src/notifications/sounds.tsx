import { Howl } from "howler";

export const sounds = {
  newMessageSound: new Howl({
    src: "/new_message.mp3",
  }),
  callStartedSound: new Howl({
    src: "/call_started.wav",
  }),
  callEndedSound: new Howl({
    src: "/call_ended.wav",
  }),
};
