import { useEffect, useRef, useState } from "react";
import { useCallStore } from "../state/call";

import { LoadingSpinner } from "./LoadingSpinner";
import Draggable, { DraggableEventHandler } from "react-draggable";
import { Resizable } from "re-resizable";
import { Direction } from "re-resizable/lib/resizer";
import { useWindowDimensions } from "../hooks/useWindowDimensions";
import { Icon } from "@iconify/react";
import { useShallow } from "zustand/shallow";

const UserVideo: React.FC = () => {
  const {
    solo,
    isAudioEnabled,
    isCameraEnabled,
    shouldFlip,
    switchAudio,
    switchCamera,
    userStream,
  } = useCallStore(
    useShallow((state) => ({
      solo: state.solo,
      userStream: state.userStream,
      isAudioEnabled: state.isAudioEnabled,
      switchAudio: state.switchAudio,
      isCameraEnabled: state.isCameraEnabled,
      switchCamera: state.switchCamera,
      shouldFlip: state.shouldFlip,
    })),
  );

  const userVideoRef = useRef<HTMLVideoElement | null>(null);
  useEffect(() => {
    const userVideo = userVideoRef.current;

    if (userVideo) {
      // Set the new stream as the source object
      userVideo.srcObject = userStream;

      // Wait for metadata to load before playing
      const playVideo = () => {
        userVideo.play().catch((error) => console.error("Play error:", error));
      };
      // Listen for loadedmetadata event, then play video
      userVideo.addEventListener("loadedmetadata", playVideo);

      // Clean up by stopping tracks and removing the event listener
      return () => {
        userVideo.pause();
        userVideo.removeEventListener("loadedmetadata", playVideo);
        userStream?.getTracks().forEach((track) => track.stop());
        userVideo.srcObject = null;
      };
    }
  }, [userStream]);

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-auto items-center justify-center overflow-hidden">
        {!userStream && (
          <LoadingSpinner className="h-10 w-10 md:h-20 md:w-20" />
        )}
        {!!userStream && (
          <video
            id="user"
            muted
            playsInline
            ref={userVideoRef}
            className={`h-full w-full ${shouldFlip && "scale-x-[-1]"} object-cover`}
          ></video>
        )}
      </div>

      <div className="stopDrag flex place-content-evenly items-center">
        <button
          onClick={switchAudio}
          className="flex w-[50%] items-center justify-center"
        >
          <div className="flex items-center gap-[2px] text-white md:gap-1">
            {isAudioEnabled ? (
              <Icon
                icon="material-symbols:mic"
                className={`${solo ? "h-7 w-7" : "h-5 w-5"}`}
              />
            ) : (
              <Icon
                icon="material-symbols:mic-off"
                className={`${solo ? "h-7 w-7" : "h-5 w-5"}`}
              />
            )}
          </div>
        </button>
        <span className="text-white">|</span>
        <button
          onClick={switchCamera}
          className="flex w-[50%] items-center justify-center text-white"
        >
          <div className="flex items-center gap-[2px] md:gap-1">
            {isCameraEnabled ? (
              <Icon
                icon="mdi:video"
                className={`${solo ? "h-7 w-7" : "h-5 w-5"}`}
              />
            ) : (
              <Icon
                icon="mdi:video-off"
                className={`${solo ? "h-7 w-7" : "h-5 w-5"}`}
              />
            )}
          </div>
        </button>
      </div>
    </div>
  );
};

export const DraggableAndResizableUserVideo = () => {
  const solo = useCallStore((state) => state.solo);

  const nodeRef = useRef(null);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);

  const { windowDimensions, previousDimensions } = useWindowDimensions();

  const deltaHeight = useRef(0);
  const [isResizing, setIsResizing] = useState(false);
  const [size, setSize] = useState({
    width: windowDimensions.width,
    height: windowDimensions.height,
  });

  useEffect(() => {
    setPosition((prevPosition) => {
      const newX = solo ? 0 : windowDimensions.width * 0.05;
      const newY = solo ? 0 : windowDimensions.height * 0.95 - 192;

      // When not solo, maintain the relative position proportions if resizing
      const x = solo
        ? 0
        : prevPosition.x * (windowDimensions.width / previousDimensions.width);
      const y = solo
        ? 0
        : prevPosition.y *
          (windowDimensions.height / previousDimensions.height);

      return { x: x || newX, y: y || newY }; // Default to bottom-left if proportions are not set
    });
  }, [
    windowDimensions.height,
    windowDimensions.width,
    previousDimensions.height,
    previousDimensions.width,
    solo,
  ]);
  useEffect(() => {
    if (!solo) {
      const fullscreen =
        size.height === windowDimensions.height &&
        size.width === windowDimensions.width;
      if (fullscreen) {
        setSize({ width: 128, height: 192 });
      }
    } else {
      setSize({
        width: windowDimensions.width,
        height: windowDimensions.height,
      });
    }
  }, [
    size.height,
    size.width,
    solo,
    windowDimensions.height,
    windowDimensions.width,
  ]);
  const handleOnDragStart: DraggableEventHandler = () => {
    setIsDragging(true);
  };
  const handleOnDrag: DraggableEventHandler = (_e, data) => {
    setPosition({ x: data.x, y: data.y });
  };
  const handleOnDragStop: DraggableEventHandler = () => {
    setIsDragging(false);
  };

  const onResizeStart = (
    e: React.MouseEvent<HTMLElement> | React.TouchEvent<HTMLElement>,
  ) => {
    e.stopPropagation();
    setIsResizing(true);
  };
  const onResize = (
    _e: MouseEvent | TouchEvent,
    direction: Direction,
    ref: HTMLElement,
    delta: { width: number; height: number },
  ) => {
    if (direction === "topRight") {
      setPosition((prev) => ({
        ...prev,
        y: prev.y + deltaHeight.current - delta.height,
      }));
      deltaHeight.current = delta.height;
      setSize({
        width: ref.offsetWidth,
        height: ref.offsetHeight,
      });
    }
  };
  const onResizeStop = () => {
    setIsResizing(false);
    deltaHeight.current = 0;
  };

  return (
    <Draggable
      bounds=".callScreen"
      nodeRef={nodeRef}
      position={position}
      onStart={handleOnDragStart}
      onDrag={handleOnDrag}
      onStop={handleOnDragStop}
      disabled={isResizing || solo}
      cancel=".stopDrag"
    >
      <div
        ref={nodeRef}
        className={`${!solo && "absolute z-10 rounded-md"} h-fit w-fit bg-[#008B8B] transition-all duration-500 ease-in-out ${(isDragging || isResizing) && "transition-none"}`}
      >
        <Resizable
          bounds="window"
          size={size}
          lockAspectRatio
          minHeight={192}
          minWidth={128}
          maxHeight={
            solo ? windowDimensions.height : windowDimensions.height * 0.5
          }
          maxWidth={
            solo ? windowDimensions.width : windowDimensions.width * 0.5
          }
          onResizeStart={onResizeStart}
          onResize={onResize}
          onResizeStop={onResizeStop}
          boundsByDirection
          // you have to specify false for all directions other than the one you want.
          enable={{
            bottom: false,
            bottomLeft: false,
            bottomRight: false,
            left: false,
            topLeft: false,
            right: false,
            top: false,
            topRight: !solo,
          }}
          handleComponent={{
            topRight: (
              <Icon
                className="h-10 w-10 -rotate-90 text-[#008B8B]"
                icon="lets-icons:resize-down-right"
              />
            ),
          }}
          handleClasses={{
            topRight: `z-20 !h-fit !w-fit !-right-[15px] !-top-[15px]`,
          }}
        >
          <UserVideo />
        </Resizable>
      </div>
    </Draggable>
  );
};
