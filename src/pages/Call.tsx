import { RemoteVideo } from "../components/RemoteVideo";
import { ShareCall } from "../components/ShareCall";
import { UserVideo } from "../components/UserVideo";
import { useCallStore } from "../state/call";

export const Call = () => {
  const endCall = useCallStore((state) => state.endCall);

  const onClickLeave = () => {
    console.log("leaving call");
    endCall();
  };
  return (
    <div className="h-screen w-screen">
      <ShareCall />
      <UserVideo />
      <RemoteVideo />
      <button
        name="Leave"
        className="fixed bottom-[10%] right-[5%] rounded-lg bg-white p-3 text-xl active:bg-gray-500"
        onClick={onClickLeave}
      >
        Leave
      </button>
    </div>
  );
};
