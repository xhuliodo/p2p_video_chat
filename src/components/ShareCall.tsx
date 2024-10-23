import { ClipboardSolid } from "@graywolfai/react-heroicons";
import { useState } from "react";

interface ShareCallProps {
  passphrase: string;
}

export const ShareCall = ({ passphrase }: ShareCallProps) => {
  const [isCopied, setIsCopied] = useState(false);
  const onClickCopy = () => {
    navigator.clipboard.writeText(passphrase);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };
  return (
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
  );
};
