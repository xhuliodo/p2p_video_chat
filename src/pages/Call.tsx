import { useCallStore } from "../state/call";
import { useParams } from "react-router-dom";
import { useEffect } from "react";
import { ToastContainer } from "react-toastify";
import { CallButtons } from "../components/CallButtons";
import { Messages } from "../components/Messages";
import { DraggableAndResizableUserVideo } from "../components/UserVideo";
import { RemoteVideos } from "../components/RemoteVideo";
import { router } from "../routes";
import { useShallow } from "zustand/shallow";

export const Call = () => {
  const { startCall, endCall } = useCallStore(
    useShallow((state) => ({
      startCall: state.startCall,
      endCall: state.endCall,
    })),
  );

  const { passphrase } = useParams();
  useEffect(() => {
    const init = async () => {
      if (passphrase) {
        try {
          await startCall(passphrase);
        } catch (e: unknown) {
          // Ensure 'e' is an error object before accessing properties
          if (e instanceof Error) {
            router.navigate("/", {
              state: { message: e.message },
            });
          } else {
            // Handle case where error is not an instance of Error
            router.navigate("/", {
              state: { message: "An unknown error occurred" },
            });
          }
          return;
        }
      }
    };

    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const handleBeforeUnload = async () => endCall();
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
      <Messages />
      <ToastContainer
        position="top-center"
        style={{ width: "80%" }}
        progressStyle={{ background: "gray" }}
      />
    </div>
  );
};
