/**
 * Retrieves the user's media stream (both audio and video) with specified audio and video settings.
 */
export const getUserStream = async (
  audio: boolean,
  video: boolean,
  perspective: "environment" | "user",
  lowDataMode: boolean,
) => {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
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
 * Retrieves the user's video stream with specified video settings.
 *
 */
export const getUserStreamVideo = async (
  video: boolean,
  perspective: "environment" | "user",
  lowDataMode: boolean,
) => {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: {
      width: lowDataMode ? { ideal: 480 } : { ideal: 1280 },
      height: lowDataMode ? { ideal: 360 } : { ideal: 720 },
      facingMode: perspective,
    },
  });

  if (!video) {
    stream.getVideoTracks().forEach((v) => (v.enabled = false));
  }

  return stream;
};

/**
 * checkForBluetoothAudioDevices checks if there are any connected and active Bluetooth
 * devices at the start of the call. If there are, it replaces the current audio tracks with
 * those from the Bluetooth device. This function solves an issue encountered on mobile only.
 */
export const checkForBluetoothAudioDevices = async (
  audio: boolean,
  stream: MediaStream,
): Promise<void> => {
  const devices = await navigator.mediaDevices.enumerateDevices();
  const audioDevices = devices
    .filter((d) => d.kind === "audioinput")
    .filter((d) => {
      const label = d.label.toLowerCase();
      return label.includes("airpods") || label.includes("bluetooth");
    });
  if (audioDevices.length) {
    const bluetoothDeviceStream = await getUserStreamAudio(
      audio,
      audioDevices[0].deviceId,
    );

    stream.getAudioTracks().forEach((t) => {
      t.stop();
      stream.removeTrack(t);
    });

    bluetoothDeviceStream.getAudioTracks().forEach((t) => {
      stream.addTrack(t);
    });
  }
};

/**
 * Retrieves the user's audio stream with specified audio settings.
 */
export const getUserStreamAudio = async (
  audio: boolean,
  audioDeviceId: string,
) => {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      ...(audioDeviceId ? { deviceId: audioDeviceId } : {}),
      noiseSuppression: true,
      autoGainControl: true,
      echoCancellation: true,
    },
  });

  if (!audio) {
    stream.getAudioTracks().forEach((a) => (a.enabled = false));
  }

  return stream;
};

/**
 * Calculates the aspect ratio of the provided media stream. If the aspect ratio is not available
 * in the stream's settings, it calculates it using the width and height of the video track.
 * If the width or height is not available, it returns the default aspect ratio of 16:9.
 */
export const getAspectRatio = (stream: MediaStream): number => {
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
