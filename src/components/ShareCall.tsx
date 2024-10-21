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
        <div className="z-10 transition-all duration-500 ease-in-out fixed top-2 left-[10%] bg-gray-300 w-[80%] flex justify-between items-center p-2 rounded-md">
          <div className="flex flex-col md:flex-row">
            The passphrase to share is:
            <b onClick={onClickCopy} className="cursor-pointer ml-1">
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
