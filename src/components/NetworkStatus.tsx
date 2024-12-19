import { Icon } from "@iconify/react/dist/iconify.js";
import { useCallStore } from "../state/call";
import { FC, useEffect, useRef, useState } from "react";
import { useShallow } from "zustand/shallow";

interface NetworkStatusProps {
  connectionKey: string;
}
export const NetworkStatus: FC<NetworkStatusProps> = ({ connectionKey }) => {
  const { peerConnection } = useCallStore(
    useShallow((state) => ({
      peerConnection: state.peerConnections[connectionKey]?.peerConnection,
    })),
  );
  const [remoteNetworkStatus, setRemoteNetworkStatus] = useState<number>(0);

  const lastStats = useRef<{ bytes: number; timestamp: number }>({
    bytes: 0,
    timestamp: 0,
  });
  const [bandwidth, setBandwidth] = useState<string>("Calculating...");
  const [showBandwidth, setShowBandwidth] = useState(false);

  const checkNetworkQuality = async () => {
    if (!peerConnection || peerConnection.iceConnectionState !== "connected") {
      // console.log("Cannot check stats: Peer is disconnected or not connected");
      setRemoteNetworkStatus(0);
      return;
    }

    try {
      const stats = await peerConnection.getStats();
      let packetLossRate = 0;
      let jitter = 0;
      let roundTripTime = 0;

      stats.forEach((report) => {
        // calculate the bandwidth of the video connection
        if (report.type === "inbound-rtp" && report.kind === "video") {
          const bytes = report.bytesReceived;
          const now = report.timestamp;

          if (lastStats.current.bytes && lastStats.current.timestamp) {
            const bitrate =
              ((bytes - lastStats.current.bytes) * 8) /
              ((now - lastStats.current.timestamp) / 1000); // bits per second
            const bandwidthInMbps = bitrate / 1_000_000; // Convert to Mbps

            setBandwidth(`${bandwidthInMbps.toFixed(2)} Mbps`);
          }

          lastStats.current = { bytes, timestamp: now };
        }
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

      // Industry standard thresholds for video calling apps
      const isPoorNetwork =
        packetLossRate > 2 || jitter > 0.03 || roundTripTime > 0.3;

      if (isPoorNetwork) {
        setRemoteNetworkStatus((val) => val - 1);
      } else {
        setRemoteNetworkStatus((val) => (val >= 3 ? val : val + 1));
      }
    } catch (error) {
      console.error("Error checking network quality: ", error);
      setRemoteNetworkStatus(0);
    }
  };
  useEffect(() => {
    const intervalId = setInterval(checkNetworkQuality, 1000);
    return () => {
      clearInterval(intervalId);
    };
  });

  const remoteNetworkIcon = (remoteNetworkStatus: number): JSX.Element => {
    let iconName = "";
    switch (remoteNetworkStatus) {
      case 0: {
        iconName = "mdi:signal-cellular-outline";
        break;
      }
      case 1: {
        iconName = "mdi:signal-cellular-1";
        break;
      }
      case 2: {
        iconName = "mdi:signal-cellular-2";
        break;
      }
      default: {
        iconName = "mdi:signal-cellular-3";
      }
    }

    return <Icon icon={iconName} className="h-8 w-8" />;
  };

  return (
    <div className="w-26 absolute right-5 top-5 rounded-md bg-gray-200 p-1">
      <div
        className="flex h-full w-full flex-col items-center justify-center"
        onClick={() => setShowBandwidth((b) => !b)}
      >
        {remoteNetworkIcon(remoteNetworkStatus)}
        <span
          className={`self-center text-nowrap text-[10px] ${!showBandwidth && "hidden"}`}
        >
          {bandwidth}
        </span>
      </div>
    </div>
  );
};
