import { SignalSlashSolid, SignalSolid } from "@graywolfai/react-heroicons";
import { useCallStore } from "../state/call";
import { useEffect } from "react";

export const NetworkStatus = () => {
  const checkNetworkQuality = useCallStore(
    (state) => state.checkNetworkQuality,
  );
  const remoteNetworkStatus = useCallStore(
    (state) => state.remoteNetworkStatus,
  );

  useEffect(() => {
    const intervalId = setInterval(checkNetworkQuality, 2000);
    return () => {
      clearInterval(intervalId);
    };
  });

  return (
    <div className="fixed right-[5%] top-[5%] rounded-full bg-gray-300">
      {remoteNetworkStatus === "good" && <SignalSolid className="h-10 w-10" />}
      {remoteNetworkStatus === "poor" && (
        <SignalSlashSolid className="h-10 w-10" />
      )}
    </div>
  );
};
