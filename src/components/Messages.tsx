import { FC, useCallback, useEffect, useRef } from "react";
import { useCallStore } from "../state/call";
import { Icon } from "@iconify/react";
import { useShallow } from "zustand/shallow";

export const Messages: FC = () => {
  const {
    showMessages,
    toggleMessages,
    sendMessage,
    messages,
    username,
    setUsername,
    clearUsername,
  } = useCallStore(
    useShallow((state) => ({
      showMessages: state.showMessages,
      toggleMessages: state.toggleMessages,
      sendMessage: state.sendMessage,
      messages: state.messages,
      username: state.username,
      setUsername: state.setUsername,
      clearUsername: state.clearUsername,
    })),
  );
  const wholeDivRef = useRef<HTMLDivElement | null>(null);
  // Handle outside clicks/touches
  const handleOutsideEvent = useCallback(
    (event: MouseEvent | TouchEvent) => {
      let targetElement: Element | null;

      if (event instanceof MouseEvent) {
        targetElement = event.target as Element;
      } else {
        // TouchEvent
        targetElement = event.touches[0]?.target as Element;
      }

      if (!targetElement) return;

      // Check if click/touch is outside the container
      const container = wholeDivRef.current;
      const isOutsideClick = container && !container.contains(targetElement);

      if (showMessages && isOutsideClick) {
        toggleMessages();
      }
    },
    [showMessages, toggleMessages],
  );

  // Set up event listeners
  useEffect(() => {
    // Only add listeners when expanded
    if (showMessages) {
      // Use passive listeners for better scroll performance
      const eventOptions: AddEventListenerOptions = { passive: true };

      document.addEventListener("mousedown", handleOutsideEvent, eventOptions);
      document.addEventListener("touchstart", handleOutsideEvent, eventOptions);
    }

    // Cleanup
    return () => {
      document.removeEventListener("mousedown", handleOutsideEvent);
      document.removeEventListener("touchstart", handleOutsideEvent);
    };
  }, [handleOutsideEvent, showMessages]);

  const messageDivRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (messageDivRef.current) {
      messageDivRef.current.scroll({
        behavior: "smooth",
        top: messageDivRef.current.scrollHeight,
      });
    }
  }, [showMessages, messages]);

  const inputMessageRef = useRef<HTMLTextAreaElement | null>(null);
  const onClickSendMessage = () => {
    if (inputMessageRef.current?.value) {
      sendMessage(inputMessageRef.current.value);
      inputMessageRef.current.value = "";
    }
  };

  const inputUsernameRef = useRef<HTMLInputElement | null>(null);
  const onClickSaveUsername = () => {
    if (inputUsernameRef.current?.value) {
      setUsername(inputUsernameRef.current.value);
      inputUsernameRef.current.value = "";
    }
  };
  const onClickClearUsername = () => {
    clearUsername();
  };

  return (
    <div
      ref={wholeDivRef}
      className={`fixed left-1/2 top-1/2 z-20 w-[90dvw] -translate-x-1/2 -translate-y-1/2 transform rounded-lg bg-white md:w-[70dvw] lg:w-[50dvw] ${
        !showMessages
          ? "h-0 scale-y-0 opacity-0"
          : "h-[80svh] scale-y-100 opacity-100 md:h-[80svh]"
      } origin-center transform-gpu transition-all duration-300 ease-out`}
    >
      <div className="flex h-full flex-col justify-evenly">
        <div className="flex justify-end bg-[#008B8B] p-1">
          <button
            className="transform-gpu items-center justify-center p-1"
            onClick={toggleMessages}
          >
            <Icon icon={"mdi:remove"} className="h-5 w-5" />
          </button>
        </div>
        <div className="flex w-[90%] items-center justify-center gap-2 self-center rounded-bl-lg rounded-br-lg bg-gray-400 p-2">
          <span className="text-sm"> Username: </span>
          {username ? (
            <>
              <span className="text-sm font-semibold">{username}</span>
              <span
                className="cursor-pointer text-sm text-gray-100 underline"
                onClick={onClickClearUsername}
              >
                Clear
              </span>
            </>
          ) : (
            <>
              <input
                ref={inputUsernameRef}
                name="username"
                id="username"
                autoComplete="username"
                className="min-w-10 flex-1 px-1"
              ></input>
              <button
                className="rounded-md bg-[#008B8B]"
                onClick={onClickSaveUsername}
              >
                <span className="p-1 text-sm text-white">Save</span>
              </button>
            </>
          )}
        </div>
        <div
          ref={messageDivRef}
          className="flex flex-grow transform-gpu flex-col gap-5 overflow-y-scroll px-5 py-2"
        >
          {messages.map((m, i) => (
            <Message
              key={i}
              content={m.content}
              sentByUser={m.sentByUser}
              timestamp={m.timestamp}
              username={m.username}
              first={i === 0}
            />
          ))}
        </div>
        <div className="flex w-full gap-2 p-2">
          <textarea
            name="message"
            ref={inputMessageRef}
            rows={1}
            className="h-full min-w-10 flex-1 border border-gray-300 p-2"
            placeholder="..."
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                onClickSendMessage();
              }
            }}
          ></textarea>
          <button
            onClick={onClickSendMessage}
            className="rounded-md bg-[#008B8B] px-6 py-2 font-semibold text-white active:bg-[#008B8B]/90"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
};

interface MessageProps {
  username?: string;
  content: string;
  timestamp: number;
  sentByUser: boolean;
  first: boolean;
  key?: React.Key;
}
const Message: FC<MessageProps> = ({
  username,
  content,
  sentByUser,
  timestamp,
  first,
}) => {
  return (
    <div
      className={`${
        sentByUser
          ? "ml-10 self-end rounded-bl-lg rounded-tl-lg rounded-tr-lg border border-[#008B8B]/80 bg-[#008B8B]/70"
          : "mr-10 rounded-br-lg rounded-tl-lg rounded-tr-lg border border-gray-400 bg-gray-300"
      } ${first && "mt-auto"} w-fit`}
    >
      <div className="py-1 pl-2 pr-4">
        {username && <p className="font-semibold leading-none">{username}</p>}
        <span className="text-balance leading-tight">{content}</span>
      </div>
      <p className="mb-1 mr-1 text-end text-[10px] leading-tight opacity-50">
        {new Date(timestamp).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        })}
      </p>
    </div>
  );
};
