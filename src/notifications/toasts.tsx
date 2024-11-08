import { toast } from "react-toastify";

export const toasts = {
  linkCopied: () => {
    toast("Link Copied!");
  },
  shareLink: () => {
    toast("Share link with your buddy!");
  },
  noRearCamera: () => {
    toast("You don't have a rear facing camera to switch to.");
  },
};
