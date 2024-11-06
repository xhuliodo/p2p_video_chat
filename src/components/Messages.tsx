import { FC, useCallback, useEffect, useRef } from "react";
import { useCallStore } from "../state/call";
import { Icon } from "@iconify/react";

export const Messages: FC = () => {
  const showMessages = useCallStore((state) => state.showMessages);
  const toggleMessages = useCallStore((state) => state.toggleMessages);
  const sendMessage = useCallStore((state) => state.sendMessage);
  const messages = useCallStore((state) => state.messages);
  const ref = useRef<HTMLDivElement | null>(null);
  const messageDivRef = useRef<HTMLDivElement | null>(null);
  const inputMessage = useRef<HTMLInputElement | null>(null);
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
      const container = ref.current;
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

  useEffect(() => {
    if (messageDivRef.current) {
      messageDivRef.current.scroll({
        behavior: "smooth",
        top: messageDivRef.current.scrollHeight,
      });
    }
  }, [showMessages, messages]);

  const onClickSendMessage = (
    e: React.MouseEvent<HTMLElement> | React.TouchEvent<HTMLElement>,
  ) => {
    e.preventDefault();
    if (inputMessage.current?.value) {
      sendMessage(inputMessage.current.value);
      inputMessage.current.value = "";
    }
  };

  return (
    <div
      ref={ref}
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
        <div
          ref={messageDivRef}
          className="flex flex-grow transform-gpu flex-col gap-5 overflow-y-scroll px-5 py-2"
        >
          {messages.map((m, i) => {
            return (
              <div
                key={i}
                className={`${
                  m.sentByUser
                    ? "ml-10 self-end rounded-bl-lg rounded-tl-lg rounded-tr-lg border border-[#008B8B]/80 bg-[#008B8B]/70"
                    : "mr-10 rounded-br-lg rounded-tl-lg rounded-tr-lg border border-gray-400 bg-gray-300"
                } ${i === 0 && "mt-auto"} w-fit p-2`}
              >
                <span>{m.content}</span>
                <p className="text-end text-[10px] opacity-50">
                  {new Date(m.timestamp).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </div>
            );
          })}
        </div>
        <div className="flex w-full gap-2 p-2">
          <input
            name="message"
            ref={inputMessage}
            className="h-full grow border border-gray-300 p-2"
            placeholder="..."
          ></input>
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
