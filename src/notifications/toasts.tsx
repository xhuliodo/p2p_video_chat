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
  failedMessageDelivery: (all: boolean) => {
    toast(
      "Message could not be sent to " + all
        ? "all "
        : "some " + "of your buddies, please try again.",
    );
  },
  somethingWentWrong: ()=>{
    toast("Something went wrong, you might want to refresh the page.")
  }
};
