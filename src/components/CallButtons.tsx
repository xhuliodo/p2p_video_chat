import { FC, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { useCallStore } from "../state/call";
import { Icon } from "@iconify/react";
import { useAutoCollapse } from "../hooks/useAutoCollapse";

export const CallButtons: FC = () => {
  const solo = useCallStore((state) => state.solo);
  const endCall = useCallStore((state) => state.endCall);
  const switchCameraPerspective = useCallStore(
    (state) => state.switchCameraPerspective,
  );
  const canSwitchCameraPerspective = useCallStore(
    (state) => state.canSwitchCameraPerspective,
  );

  const onClickShare = () => {
    const shareData = {
      title: "Video Call",
      text: "Join me on this call using this link!\n",
      url: window.location.href, // or pass the passphrase here
    };

    if (navigator.canShare(shareData)) {
      navigator
        .share(shareData)
        .then(() => console.log("Share successful"))
        .catch((error) => console.log("Error sharing:", error));
    } else {
      navigator.clipboard.writeText(window.location.href);
      toast("Link copied");
    }
  };

  const navigate = useNavigate();
  const onClickLeave = async () => {
    console.log("leaving call");
    try {
      await endCall(); // Wait for endCall to complete
    } catch (e) {
      console.log("while leaving call caught error:", e);
    }
    navigate("/"); // Only navigate after endCall finishes
  };

  const [isSwitchDisabled, setIsSwitchDisabled] = useState(false);

  const {
    isCollapsed,
    toggle: toggleCollapse,
    containerRef: toggleContainer,
  } = useAutoCollapse({
    autoCollapseDelay: 5000,
  });

  return (
    <div ref={toggleContainer} className="fixed bottom-[5%] right-[5%]">
      <div
        className={`flex flex-col overflow-hidden rounded-full bg-gray-200 p-2 md:p-1`}
      >
        {solo && (
          <button
            name="Share"
            className="mb-5 mt-1 flex h-14 w-14 items-center justify-center rounded-full bg-blue-500 p-3 text-white active:bg-blue-700"
            onClick={onClickShare}
          >
            <Icon icon="material-symbols:share" className="h-full w-full" />
          </button>
        )}
        <div
          className={`${isCollapsed ? "max-h-0 opacity-0" : "mb-5 max-h-96"} flex flex-col items-center justify-center overflow-hidden transition-all duration-300 ease-in-out`}
        >
          <button
            name="Switch"
            className="mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-gray-500 p-3 text-white active:bg-gray-700 disabled:bg-gray-300"
            onClick={async () => {
              setIsSwitchDisabled(true);
              await switchCameraPerspective();
              setIsSwitchDisabled(false);
            }}
            disabled={!canSwitchCameraPerspective || isSwitchDisabled}
          >
            <Icon
              icon="material-symbols:flip-camera-ios"
              className="h-full w-full"
            />
          </button>
          <button
            name="Message"
            className="flex h-14 w-14 items-center justify-center rounded-full bg-green-500 p-3 text-white active:bg-green-700 disabled:bg-gray-300"
          >
            <Icon icon="mdi:message" className="h-full w-full" />
          </button>
        </div>
        <div
          className={`flex w-fit items-center justify-center ${!isCollapsed ? "max-h-0 opacity-0" : "mb-5 max-h-96"} overflow-hidden transition-all duration-300 ease-in-out`}
          onClick={(e) => {
            e.stopPropagation();
            toggleCollapse();
          }}
        >
          <button
            name="More"
            className="flex h-14 w-14 items-center justify-center rounded-full bg-gray-300 p-3"
          >
            <Icon
              icon="material-symbols:more-horiz"
              className="h-full w-full"
            />
          </button>
        </div>
        <button
          name="Leave"
          className="mb-1 flex h-14 w-14 items-center justify-center rounded-full bg-red-500 p-3 text-white active:bg-red-700"
          onClick={onClickLeave}
        >
          <Icon icon="material-symbols:call-end" className="h-full w-full" />
        </button>
      </div>
    </div>
  );
};
