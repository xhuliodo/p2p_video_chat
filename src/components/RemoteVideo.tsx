import { useEffect, useRef } from "react";
import { useCallStore } from "../state/call";
import { NetworkStatus } from "./NetworkStatus";

export const RemoteVideo = () => {
  // state variables
  const remoteStream = useCallStore((state) => state.remoteStream);
  const solo = useCallStore((state) => state.solo);

  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  useEffect(() => {
    const remoteVideo = remoteVideoRef.current;
    if (remoteVideo) {
      console.log("Assigning remote stream to video element", remoteStream);
      remoteVideo.srcObject = remoteStream;
    }
    return () => {
      if (remoteVideo) {
        remoteVideo.srcObject = null; // Clean up media stream
      }
    };
  }, [remoteStream]);
  return (
    <>
      {!solo && (
        <div className="h-full w-full bg-gray-500">
          <video
            ref={remoteVideoRef}
            autoPlay={true}
            id="caller"
            className="h-full w-full object-cover"
          />
          <NetworkStatus />
        </div>
      )}
    </>
  );
};
