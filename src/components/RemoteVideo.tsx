import { useEffect, useRef } from "react";
import { useCallStore } from "../state/call";
import { NetworkStatus } from "./NetworkStatus";
import { LoadingSpinner } from "./LoadingSpinner";

export const RemoteVideo = () => {
  const remoteStream = useCallStore((state) => state.remoteStream);
  const solo = useCallStore((state) => state.solo);

  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  useEffect(() => {
    const remoteVideo = remoteVideoRef.current;
    if (remoteVideo) {
      remoteVideo.srcObject = remoteStream;
      if (remoteStream) {
        remoteVideo.play();
      }
    }
    return () => {
      if (remoteVideo) {
        remoteStream?.getTracks().forEach((t) => t.stop());
        remoteVideo.srcObject = null; // Clean up media stream
      }
    };
  }, [remoteStream]);
  return (
    <>
      {!solo && (
        <div className="h-full w-full bg-gray-400">
          <div className="flex h-full w-full items-center justify-center">
            {!remoteStream && <LoadingSpinner className="h-20 w-20" />}
            {!!remoteStream && (
              <video
                ref={remoteVideoRef}
                playsInline
                id="caller"
                className="object-fit h-full w-full"
              />
            )}
          </div>
          <NetworkStatus />
        </div>
      )}
    </>
  );
};
