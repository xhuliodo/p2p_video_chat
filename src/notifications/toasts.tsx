import { toast } from "react-toastify";

export const toasts = {
  linkCopied: () => {
    toast("Link Copied!");
  },
  connecting: () => {
    toast("connecting", { autoClose: 1000 });
  },
  connectionStatus: (status: string) => {
    toast(status, { autoClose: 1000 });
  },
  reconnecting: () => {
    toast("reconnecting...");
  },
  failedMessageDelivery: (all: boolean) => {
    toast(
      "Message could not be sent to " + all
        ? "all "
        : "some " + "of your buddies, please try again.",
    );
  },
  somethingWentWrong: () => {
    toast("Something went wrong, you might want to refresh the page.");
  },
  lowDataMode: (dataMode: boolean) => {
    const state = dataMode ? "on" : "off";
    toast(`Low data mode has been turned ${state}`);
  },
  lowDataModeFailed: () => {
    toast(
      "Low data mode was not turned on for all the participants, please try again.",
    );
  },
};
