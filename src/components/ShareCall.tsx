import { ClipboardSolid } from "@graywolfai/react-heroicons";
import { useState } from "react";
import { useLocation } from "react-router-dom";

export const ShareCall = () => {
  const location = useLocation();
  const [isCopied, setIsCopied] = useState(false);
  const onClickCopy = () => {
    const link = window.location.origin + location.pathname;
    navigator.clipboard.writeText(link);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };
  return (
    <div className="flex flex-col md:flex-row">
      If you have not, share this with friend:
      <b onClick={onClickCopy} className="ml-1 cursor-pointer">
        {isCopied ? (
          "Copied!"
        ) : (
          <div className="flex items-center">
            Click here to copy
            <ClipboardSolid className="h-4" />
          </div>
        )}
      </b>
    </div>
  );
};
