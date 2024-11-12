// import { Icon } from "@iconify/react/dist/iconify.js";
// import { useCallStore } from "../state/call";
// import { useEffect } from "react";
// import { useShallow } from "zustand/shallow";

// export const NetworkStatus = () => {
//   const { checkNetworkQuality, remoteNetworkStatus } = useCallStore(
//     useShallow((state) => ({
//       checkNetworkQuality: state.checkNetworkQuality,
//       remoteNetworkStatus: state.remoteNetworkStatus,
//     })),
//   );

//   useEffect(() => {
//     const intervalId = setInterval(checkNetworkQuality, 2000);
//     return () => {
//       clearInterval(intervalId);
//     };
//   });

//   return (
//     <div className="fixed right-[5%] top-[5%] h-10 w-10 rounded-md bg-gray-200 p-1">
//       {remoteNetworkStatus === "good" ? (
//         <Icon icon="mdi:signal" className="h-full w-full" />
//       ) : (
//         <Icon icon="mdi:signal-off" className="h-full w-full" />
//       )}
//     </div>
//   );
// };
