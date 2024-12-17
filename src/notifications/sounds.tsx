import { Howl } from "howler";

const newMessageSound = new Howl({
  src: "/new_message.mp3",
});
const callStartedSound = new Howl({
  src: "/call_started.wav",
});

export const sounds = { newMessageSound, callStartedSound };
