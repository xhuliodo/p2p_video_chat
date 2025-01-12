import { FC } from "react";
import { useNavigate } from "react-router-dom";
import { useCallStore } from "../state/call";
import { Icon } from "@iconify/react";
import { useAutoCollapse } from "../hooks/useAutoCollapse";
import { toasts } from "../notifications/toasts";
import { useShallow } from "zustand/shallow";
import { toast } from "react-toastify";

export const CallButtons: FC = () => {
  const {
    solo,
    switchCameraPerspective,
    canSwitchCameraPerspective,
    lowDataMode,
    switchDataMode,
    toggleMessages,
    canSendMessage,
    newMessage,
    endCall,
  } = useCallStore(
    useShallow((state) => ({
      solo: state.solo,
      switchCameraPerspective: state.switchCameraPerspective,
      canSwitchCameraPerspective: state.canSwitchCameraPerspective,
      lowDataMode: state.lowDataMode,
      switchDataMode: state.switchDataMode,
      toggleMessages: state.toggleMessages,
      canSendMessage: state.canSendMessage,
      newMessage: state.newMessage,
      endCall: state.endCall,
    })),
  );

  const onClickShare = () => {
    const shareData = {
      title: "Video Call",
      text: "Join me on this call using this link!\n",
      url: window.location.href, // or pass the passphrase here
    };

    if (!navigator.canShare) {
      navigator.clipboard.writeText(window.location.href);
      toasts.linkCopied();
    } else {
      navigator
        .share(shareData)
        .then(() => console.log("Share successful"))
        .catch((error) => console.log("Error sharing:", error));
    }
  };

  const navigate = useNavigate();
  const onClickLeave = async () => {
    console.log("Leaving the call...");
    try {
      await endCall(); // Wait for endCall to complete
      console.log("Call ended successfully");
    } catch (e) {
      console.error("could not leave call with error:", { e });
      toasts.somethingWentWrong();
    }

    navigate("/"); // Only navigate after endCall finishes
  };

  const onClickSwitchCamera = async () => {
    try {
      await switchCameraPerspective();
    } catch (err: unknown) {
      // Ensure 'e' is an error object before accessing properties
      if (err instanceof Error) {
        toast(err.message);
      } else {
        // Handle case where error is not an instance of Error
        toast("An unknown error occurred");
      }
    }
  };

  const {
    isCollapsed,
    toggle: toggleCollapse,
    containerRef: toggleContainer,
  } = useAutoCollapse({
    autoCollapseDelay: 5000,
  });

  return (
    <div
      ref={toggleContainer}
      className={`fixed bottom-[5%] right-[5%] ${solo && "bottom-[10%]"}`}
    >
      <div
        className={`flex flex-col overflow-hidden rounded-full bg-gray-200 p-2 md:p-1`}
      >
        {solo && (
          <button
            name="Share"
            className="mb-5 mt-1 flex h-14 w-14 transform-gpu items-center justify-center rounded-full bg-blue-500 p-3 text-white active:bg-blue-700"
            onClick={onClickShare}
          >
            <Icon icon="material-symbols:share" className="h-full w-full" />
          </button>
        )}
        <div
          className={`origin-top transform-gpu ${
            isCollapsed
              ? "h-0 scale-y-0 opacity-0"
              : "mb-5 h-auto scale-y-100 opacity-100"
          } ${!solo && "mt-1"} flex flex-col items-center justify-center overflow-hidden transition-all duration-300 ease-in-out`}
        >
          <button
            name="SwitchCamera"
            className="mb-5 flex h-14 w-14 transform-gpu items-center justify-center rounded-full bg-gray-500 p-3 text-white active:bg-gray-700 disabled:bg-gray-300"
            onClick={onClickSwitchCamera}
            disabled={!canSwitchCameraPerspective}
          >
            <Icon
              icon="material-symbols:flip-camera-ios"
              className="h-full w-full"
            />
          </button>
          <button
            name="DataMode"
            className={`mb-5 flex h-14 w-14 transform-gpu items-center justify-center rounded-full bg-gray-500 p-3 text-white ${lowDataMode && "bg-yellow-500"}`}
            onClick={switchDataMode}
          >
            <Icon icon="ph:wifi-low-fill" className={`h-full w-full`} />
          </button>
          <button
            name="Message"
            className="flex h-14 w-14 transform-gpu items-center justify-center rounded-full bg-[#008B8B] p-3 text-white active:bg-[#008B8B]/80 disabled:bg-gray-300"
            onClick={toggleMessages}
            disabled={!canSendMessage}
          >
            <Icon icon="mdi:message" className="h-full w-full" />
            {newMessage && (
              <div className="fixed right-0 top-0 h-3 w-3 rounded-full border border-white bg-[#008B8B]"></div>
            )}
          </button>
        </div>
        <div
          className={`flex w-fit transform-gpu items-center justify-center ${
            isCollapsed
              ? "mb-5 h-auto translate-y-0 scale-y-100 opacity-100"
              : "h-0 translate-y-[-100%] scale-y-0 opacity-0"
          } overflow-hidden transition-all duration-300 ease-in-out`}
          onClick={(e) => {
            e.stopPropagation();
            toggleCollapse();
          }}
        >
          <button
            name="More"
            className="flex h-14 w-14 transform-gpu items-center justify-center rounded-full bg-gray-300 p-3"
          >
            <Icon
              icon="material-symbols:more-horiz"
              className="h-full w-full"
            />
            {newMessage && (
              <div className="fixed right-0 top-0 h-3 w-3 rounded-full border border-white bg-[#008B8B]"></div>
            )}
          </button>
        </div>
        <button
          name="Leave"
          className="mb-1 flex h-14 w-14 transform-gpu items-center justify-center rounded-full bg-red-500 p-3 text-white active:bg-red-700"
          onClick={onClickLeave}
        >
          <Icon icon="material-symbols:call-end" className="h-full w-full" />
        </button>
      </div>
    </div>
  );
};
