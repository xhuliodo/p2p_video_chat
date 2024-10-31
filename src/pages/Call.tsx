import { RemoteVideo } from "../components/RemoteVideo";
import { DraggableAndResizableUserVideo } from "../components/UserVideo";
import { useCallStore } from "../state/call";
import { useNavigate, useParams } from "react-router-dom";
import { useEffect } from "react";
import { toast, ToastContainer } from "react-toastify";
import { PhoneXMarkSolid, ShareSolid } from "@graywolfai/react-heroicons";

export const Call = () => {
  const endCall = useCallStore((state) => state.endCall);
  const startCall = useCallStore((state) => state.startCall);
  const isCreator = useCallStore((state) => state.isCreator);
  const solo = useCallStore((state) => state.solo);
  const navigate = useNavigate();

  const { passphrase } = useParams();
  useEffect(() => {
    if (passphrase) {
      startCall(passphrase);
    }

  }, [passphrase, startCall]);

  useEffect(() => {
    if (isCreator) {
      toast("Share link with your buddy!");
    }
  }, [isCreator]);

  const onClickLeave = async () => {
    console.log("leaving call");
    try {
      await endCall(); // Wait for endCall to complete
    } catch (e) {
      console.log("while leaving call caught error:", e);
    }
    navigate("/"); // Only navigate after endCall finishes
  };

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

  useEffect(() => {
    const handleBeforeUnload = async () => await endCall();
    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  });

  return (
    <div className="callScreen h-dvh w-screen">
      <DraggableAndResizableUserVideo />
      <RemoteVideo />
      <div
        className={`fixed bottom-[10%] right-[5%] ${!solo && "bottom-[5%]"} h-[20%]`}
      >
        <div className="flex h-full flex-col justify-end gap-10 align-bottom">
          <button
            name="Share"
            className="rounded-full bg-blue-500 p-3 text-white"
            onClick={onClickShare}
          >
            <ShareSolid className="h-7 w-7" />
          </button>
          <button
            name="Leave"
            className="rounded-full bg-red-500 p-3 text-white"
            onClick={onClickLeave}
          >
            <PhoneXMarkSolid className="h-7 w-7" />
          </button>
        </div>
      </div>
      <ToastContainer
        position="top-center"
        style={{ width: "80%" }}
        progressStyle={{ background: "gray" }}
      />
    </div>
  );
};
