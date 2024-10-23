import { RemoteVideo } from "../components/RemoteVideo";
import { UserVideo } from "../components/UserVideo";
import { useCallStore } from "../state/call";
import { useNavigate, useParams } from "react-router-dom";
import { ShareCall } from "../components/ShareCall";
import { useEffect } from "react";
import { ToastContainer } from "react-toastify";

export const Call = () => {
  const endCall = useCallStore((state) => state.endCall);
  const startCall = useCallStore((state) => state.startCall);
  const navigate = useNavigate();

  const { passphrase } = useParams();
  useEffect(() => {
    if (passphrase) {
      startCall(passphrase, <ShareCall />);
    }
    return () => {
      endCall();
    };
  }, [endCall, passphrase, startCall]);

  const onClickLeave = async () => {
    console.log("leaving call");
    await endCall(); // Wait for endCall to complete
    navigate("/"); // Only navigate after endCall finishes
  };

  useEffect(() => {
    const handleBeforeUnload = async () => await endCall();
    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  });

  return (
    <div className="h-dvh w-screen">
      <UserVideo />
      <RemoteVideo />
      <button
        name="Leave"
        className="fixed bottom-[10%] right-[5%] rounded-lg bg-white p-3 text-xl active:bg-gray-500"
        onClick={onClickLeave}
      >
        Leave
      </button>
      <ToastContainer
        position="top-center"
        style={{ width: "80%" }}
        progressStyle={{ background: "gray" }}
      />
    </div>
  );
};
