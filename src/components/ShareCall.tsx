import { ClipboardSolid, XCircleSolid } from "@graywolfai/react-heroicons";
import { useState } from "react";
import { useCallStore } from "../state/call";

export const ShareCall = () => {
  const solo = useCallStore((state) => state.solo);
  const passphrase = useCallStore((state) => state.passphrase);
  const [show, setShow] = useState(true);
  const dismiss = () => {
    setShow(false);
  };

  const [isCopied, setIsCopied] = useState(false);
  const onClickCopy = () => {
    navigator.clipboard.writeText(passphrase);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };
  return (
    <>
      {show && solo && (
        <div className="fixed left-[10%] top-2 z-10 flex w-[80%] items-center justify-between rounded-md bg-gray-300 p-2 transition-all duration-500 ease-in-out">
          <div className="flex flex-col md:flex-row">
            The passphrase to share is:
            <b onClick={onClickCopy} className="ml-1 cursor-pointer">
              {isCopied ? (
                "Copied!"
              ) : (
                <div className="flex items-center">
                  {passphrase}
                  <ClipboardSolid className="h-4" />
                </div>
              )}
            </b>
          </div>
          <div className="h-5 w-5 self-start">
            <XCircleSolid onClick={dismiss} />
          </div>
        </div>
      )}
    </>
  );
};
