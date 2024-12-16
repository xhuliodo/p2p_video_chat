import { FC, useEffect, useMemo, useRef } from "react";
import { useCallStore } from "../state/call";
import { LoadingSpinner } from "./LoadingSpinner";
import { useWindowDimensions } from "../hooks/useWindowDimensions";
import { useShallow } from "zustand/shallow";
import { NetworkStatus } from "./NetworkStatus";

export const RemoteVideos = () => {
  const { remoteStreams, solo } = useCallStore(
    useShallow((state) => ({
      remoteStreams: state.remoteStreams,
      solo: state.solo,
    })),
  );
  const participants = useMemo(
    () => Object.keys(remoteStreams).length,
    [remoteStreams],
  );
  const { windowDimensions } = useWindowDimensions();
  const styles = () => {
    if (participants <= 1) return "grid-cols-1 grid-rows-1";
    if (participants === 2) {
      return windowDimensions.height > windowDimensions.width
        ? "grid-cols-1 grid-rows-2"
        : "grid-cols-2 grid-rows-1";
    }
    if (participants === 3) return "grid-cols-2 grid-rows-2 grid-areas-three";
    if (participants <= 4) return "grid-cols-2 grid-rows-2";
    if (participants <= 6)
      return windowDimensions.height > windowDimensions.width
        ? "grid-cols-2 grid-rows-3"
        : "grid-cols-3 grid-rows-2";
    return "grid-cols-3 grid-rows-3"; // Fallback for more than 6
  };

  return (
    <>
      {!solo && (
        <div className="h-full w-full bg-[#008b8b] bg-opacity-70">
          <div
            className={`grid h-full w-full ${participants > 1 && "p-2"} gap-2 ${styles()}`}
          >
            {Object.entries(remoteStreams).map(([key, stream]) => {
              return stream && stream.active ? (
                <div className="relative h-full w-full" key={key}>
                  <RemoteVideo remoteStream={stream} />
                  <NetworkStatus connectionKey={key} />
                </div>
              ) : (
                <LoadingSpinner
                  key={key}
                  className="h-20 w-20 place-self-center"
                />
              );
            })}
          </div>
        </div>
      )}
    </>
  );
};

interface RemoteVideoProps {
  remoteStream: MediaStream;
}
const RemoteVideo: FC<RemoteVideoProps> = ({ remoteStream }) => {
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  useEffect(() => {
    const remoteVideo = remoteVideoRef.current;
    if (remoteVideo) {
      remoteVideo.srcObject = remoteStream;

      // Wait for metadata to load before playing
      const playVideo = () => {
        remoteVideo
          .play()
          .catch((error) =>
            console.error("Failed to play remote video with error:", error),
          );
      };

      // Listen for loadedmetadata event, then play video
      remoteVideo.addEventListener("loadedmetadata", playVideo);

      // Clean up by pausing the video and removing the event listener
      return () => {
        if (remoteVideo) {
          remoteVideo.pause();
          remoteVideo.removeEventListener("loadedmetadata", playVideo);
          remoteVideo.srcObject = null;
        }
      };
    }
  }, [remoteStream]);
  return (
    <div className="h-full w-full overflow-hidden rounded-md border-2">
      <video
        ref={remoteVideoRef}
        playsInline
        autoPlay
        className="h-full w-full scale-125 transform-gpu"
      />
    </div>
  );
};
