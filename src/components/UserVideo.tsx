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
    }
    return () => {
      if (userVideo) {
        userVideo.srcObject = null; // Clean up media stream
      }
    };
  }, [userStream]);
  return (
    <div
      className={`transition-all duration-500 ease-in-out bg-gray-300 rounded-lg flex flex-col ${
        solo
          ? "h-screen w-screen gap-1"
          : "fixed bottom-[5%] left-[5%] h-64 w-52 z-10"
      }`}
    >
      <video
        id="user"
        muted={true}
        autoPlay={true}
        ref={userVideoRef}
        className="h-[96%] object-cover"
      ></video>
      <div className="flex place-content-evenly items-center">
        <button
          onClick={switchAudio}
          className="w-[50%] flex items-center justify-center"
        >
          <div className="flex items-center gap-1">
            {isAudio ? (
              <SpeakerWaveSolid className="w-5 h-5" />
            ) : (
              <SpeakerXMarkSolid className="w-5 h-5" />
            )}
            <span className="text-xs">{isAudio ? "Mute" : "Unmute"}</span>
          </div>
        </button>
        |
        <button
          onClick={switchCamera}
          className="w-[50%] flex items-center justify-center"
        >
          <div className="flex items-center gap-1">
            {isCamera ? (
              <VideoCameraOutline className="w-5 h-5" />
            ) : (
              <VideoCameraSlashOutline className="w-5 h-5" />
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
