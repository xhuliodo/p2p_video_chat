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
        className="fixed right-[5%] bottom-[10%] bg-white active:bg-gray-500 p-3 rounded-lg text-xl"
        onClick={onClickLeave}
      >
        Leave
      </button>
    </div>
  );
};
