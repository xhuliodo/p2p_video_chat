import { useCallStore } from "../state/call";
import { useParams } from "react-router-dom";
import { useEffect } from "react";
import { ToastContainer } from "react-toastify";
import { CallButtons } from "../components/CallButtons";
// import { Messages } from "../components/Messages";
import { toasts } from "../notifications/toasts";
import { DraggableAndResizableUserVideo } from "../components/UserVideo";
import { RemoteVideos } from "../components/RemoteVideo";

export const Call = () => {
  const endCall = useCallStore((state) => state.endCall);
  const startCall = useCallStore((state) => state.startCall);
  const isCreator = useCallStore((state) => state.isCreator);

  const { passphrase } = useParams();
  useEffect(() => {
    if (passphrase) {
      startCall(passphrase);
    }
  }, [passphrase, startCall]);

  useEffect(() => {
    if (isCreator) {
      toasts.shareLink();
    }
  }, [isCreator]);

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
      <RemoteVideos />
      <CallButtons />
      {/* <Messages /> */}
      <ToastContainer
        position="top-center"
        style={{ width: "80%" }}
        progressStyle={{ background: "gray" }}
      />
    </div>
  );
};
