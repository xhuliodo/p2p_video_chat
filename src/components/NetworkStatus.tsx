import { Icon } from "@iconify/react/dist/iconify.js";
import { useCallStore } from "../state/call";
import { FC, useEffect, useState } from "react";
import { useShallow } from "zustand/shallow";

type NetworkStatus = "undefined" | "good" | "poor";

interface NetworkStatusProps {
  connectionKey: string;
}
export const NetworkStatus: FC<NetworkStatusProps> = ({ connectionKey }) => {
  const { peerConnection } = useCallStore(
    useShallow((state) => ({
      peerConnection: state.peerConnections[connectionKey]?.peerConnection,
    })),
  );
  const [remoteNetworkStatus, setRemoteNetworkStatus] =
    useState<NetworkStatus>("undefined");
  const [poorNetworkQualityCount, setPoorNetworkQualityCount] = useState(0);
  const poorNetworkQualityThreshold = 3;

  const checkNetworkQuality = async () => {
    if (!peerConnection || peerConnection.iceConnectionState !== "connected") {
      // console.log("Cannot check stats: Peer is disconnected or not connected");
      setRemoteNetworkStatus("undefined");
      return;
    }

    try {
      const stats = await peerConnection.getStats();
      let packetLossRate = 0;
      let jitter = 0;
      let roundTripTime = 0;

      stats.forEach((report) => {
        // Analyze inbound-rtp stats for packet loss and jitter
        if (report.type === "inbound-rtp") {
          if (report.packetsReceived > 0) {
            packetLossRate =
              (report.packetsLost / report.packetsReceived) * 100;
            jitter = report.jitter;
          }
        }
        // Analyze candidate-pair stats for RTT (round-trip time)
        if (report.type === "candidate-pair" && report.currentRoundTripTime) {
          roundTripTime = report.currentRoundTripTime;
        }
      });

      // Adjusted thresholds to reduce sensitivity
      const isPoorNetwork =
        packetLossRate > 8 || jitter > 0.05 || roundTripTime > 0.5;

      if (isPoorNetwork) {
        setPoorNetworkQualityCount((val) => val + 1);
      } else {
        setPoorNetworkQualityCount(0); // Reset counter if the network is good
      }

      // Mark as "poor" only after consistent bad readings
      if (poorNetworkQualityCount >= poorNetworkQualityThreshold) {
        // console.log(`Poor network quality detected:
        //   Packet loss: ${packetLossRate.toFixed(2)}%,
        //   Jitter: ${jitter.toFixed(3)}s,
        //   RTT: ${roundTripTime.toFixed(3)}s`);
        setRemoteNetworkStatus("poor");
      } else {
        // console.log(`Good network quality:
        //   Packet loss: ${packetLossRate.toFixed(2)}%,
        //   Jitter: ${jitter.toFixed(3)}s,
        //   RTT: ${roundTripTime.toFixed(3)}s`);
        setRemoteNetworkStatus("good");
      }
    } catch (error) {
      console.error("Error checking network quality: ", error);
      setRemoteNetworkStatus("undefined");
    }
  };
  useEffect(() => {
    const intervalId = setInterval(checkNetworkQuality, 1000);
    return () => {
      clearInterval(intervalId);
    };
  });

  return (
    <div className="absolute right-5 top-5 h-10 w-10 rounded-md bg-gray-200 p-1">
      {remoteNetworkStatus === "good" ? (
        <Icon icon="mdi:signal" className="h-full w-full" />
      ) : (
        <Icon icon="mdi:signal-off" className="h-full w-full" />
      )}
    </div>
  );
};
