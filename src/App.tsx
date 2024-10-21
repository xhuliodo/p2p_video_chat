import { useEffect } from "react";
import { useCallStore } from "./state/call";

import { Home } from "./pages/Home";
import { Call } from "./pages/Call";

function App() {
  const ongoing = useCallStore((state) => state.ongoing);
  const endCall = useCallStore((state) => state.endCall);

  useEffect(() => {
    const handleBeforeUnload = async () => await endCall();
    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  });

  return (
    <>
      <div className="h-screen w-screen">
        {!ongoing && <Home />}
        {ongoing && <Call />}
      </div>
    </>
  );
}

export default App;
