import { useEffect, useRef } from "react";
import { useCallStore } from "../state/call";
import {
  SpeakerWaveSolid,
  SpeakerXMarkSolid,
  VideoCameraOutline,
  VideoCameraSlashOutline,
} from "@graywolfai/react-heroicons";
import { LoadingSpinner } from "./LoadingSpinner";

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
      className={`flex flex-col rounded-lg bg-[#008B8B] transition-all duration-500 ease-in-out ${
        solo
          ? "h-dvh w-full gap-1"
          : "fixed bottom-[5%] left-[5%] z-10 h-44 w-32 md:h-64 md:w-52"
      }`}
    >
      <div
        className={`flex items-center justify-center transition-all duration-500 ease-in-out ${solo ? "h-[95%]" : "h-[85%] md:h-[90%]"}`}
      >
        {!userStream && (
          <LoadingSpinner className="h-10 w-10 md:h-20 md:w-20" />
        )}
        {!!userStream && (
          <video
            id="user"
            muted
            playsInline
            ref={userVideoRef}
            className={`h-full w-full scale-x-[-1] object-cover`}
          ></video>
        )}
      </div>

      <div className="flex place-content-evenly items-center">
        <button
          onClick={switchAudio}
          className="flex w-[50%] items-center justify-center"
        >
          <div className="flex items-center gap-[2px] text-white md:gap-1">
            {isAudio ? (
              <SpeakerWaveSolid className="h-5 w-5" />
            ) : (
              <SpeakerXMarkSolid className="h-5 w-5" />
            )}
          </div>
        </button>
        <span className="text-white">|</span>
        <button
          onClick={switchCamera}
          className="flex w-[50%] items-center justify-center text-white"
        >
          <div className="flex items-center gap-[2px] md:gap-1">
            {isCamera ? (
              <VideoCameraOutline className="h-5 w-5" />
            ) : (
              <VideoCameraSlashOutline className="h-5 w-5" />
            )}
          </div>
        </button>
      </div>
    </div>
  );
};
