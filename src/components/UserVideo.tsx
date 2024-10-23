import { useEffect, useRef } from "react";
import { useCallStore } from "../state/call";
import {
  SpeakerWaveSolid,
  SpeakerXMarkSolid,
  VideoCameraOutline,
  VideoCameraSlashOutline,
} from "@graywolfai/react-heroicons";

export const UserVideo = () => {
  const solo = useCallStore((state) => state.solo);
  const userStream = useCallStore((state) => state.userStream);
  const isAudio = useCallStore((state) => state.isAudio);
  const switchAudio = useCallStore((state) => state.switchAudio);
  const isCamera = useCallStore((state) => state.isCamera);
  const switchCamera = useCallStore((state) => state.switchCamera);

  const userVideoRef = useRef<HTMLVideoElement | null>(null);
  useEffect(() => {
    const userVideo = userVideoRef.current;
    if (userVideo) {
      userVideo.srcObject = userStream;
      if (userStream) {
        userVideo.play();
      }
    }

    return () => {
      if (userVideo) {
        userStream?.getTracks().forEach((t) => t.stop());
        userVideo.srcObject = null; // Clean up media stream
      }
    };
  }, [userStream]);
  return (
    <div
      className={`flex flex-col rounded-lg bg-gray-300 transition-all duration-500 ease-in-out ${
        solo
          ? "h-dvh w-full gap-1"
          : "fixed bottom-[5%] left-[5%] z-10 h-64 w-52"
      }`}
    >
      <video
        id="user"
        muted
        playsInline
        ref={userVideoRef}
        className={`object-cover transition-all duration-500 ease-in-out ${solo ? "h-[95%]" : "h-[90%]"}`}
      ></video>
      <div className="flex place-content-evenly items-center">
        <button
          onClick={switchAudio}
          className="flex w-[50%] items-center justify-center"
        >
          <div className="flex items-center gap-1">
            {isAudio ? (
              <SpeakerWaveSolid className="h-5 w-5" />
            ) : (
              <SpeakerXMarkSolid className="h-5 w-5" />
            )}
            <span className="text-xs">{isAudio ? "Mute" : "Unmute"}</span>
          </div>
        </button>
        |
        <button
          onClick={switchCamera}
          className="flex w-[50%] items-center justify-center"
        >
          <div className="flex items-center gap-1">
            {isCamera ? (
              <VideoCameraOutline className="h-5 w-5" />
            ) : (
              <VideoCameraSlashOutline className="h-5 w-5" />
            )}
            <span className="text-xs">
              {isCamera ? "Stop video" : "Share video"}
            </span>
          </div>
        </button>
      </div>
    </div>
  );
};
