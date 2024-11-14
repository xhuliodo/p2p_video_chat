import { FC, useEffect, useRef } from "react";
import { useCallStore } from "../state/call";
// import { NetworkStatus } from "./NetworkStatus";
import { LoadingSpinner } from "./LoadingSpinner";
import { useWindowDimensions } from "../hooks/useWindowDimensions";
import { useShallow } from "zustand/shallow";

export const RemoteVideos = () => {
  const { remoteStreams, solo } = useCallStore(
    useShallow((state) => ({
      remoteStreams: state.remoteStreams,
      solo: state.solo,
    })),
  );
  const { windowDimensions } = useWindowDimensions();
  const styles = () => {
    const count = Object.keys(remoteStreams).length;
    if (count <= 1) return "grid-cols-1 grid-rows-1";
    if (count === 2) {
      return windowDimensions.height > windowDimensions.width
        ? "grid-cols-1 grid-rows-2"
        : "grid-cols-2 grid-rows-1";
    }
    if (count === 3) return "grid-cols-2 grid-rows-2 grid-areas-three";
    if (count <= 4) return "grid-cols-2 grid-rows-2";
    if (count <= 6)
      return windowDimensions.height > windowDimensions.width
        ? "grid-cols-2 grid-rows-3"
        : "grid-cols-3 grid-rows-2";
    return "grid-cols-3 grid-rows-3"; // Fallback for more than 6
  };

  return (
    <>
      {!solo && (
        <div className="h-full w-full bg-gray-400">
          <div
            className={`grid h-full w-full items-center justify-center gap-2 ${styles()}`}
          >
            {Object.entries(remoteStreams).map(([key, stream]) => {
              return stream ? (
                <RemoteVideo key={key} remoteStream={stream} />
              ) : (
                <LoadingSpinner key={key} className="h-20 w-20" />
              );
            })}
          </div>
          {/* <NetworkStatus /> */}
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
          remoteVideo.removeEventListener("loadedmetadata", playVideo);
          remoteVideo.srcObject = null;
        }
      };
    }
  }, [remoteStream]);
  return (
    <video
      ref={remoteVideoRef}
      playsInline
      autoPlay
      className="h-full w-full object-cover"
    />
  );
};
