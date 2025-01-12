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
  const { shouldMirrorCamera, userStream, setUserStreamAspectRatio } =
    useCallStore(
      useShallow((state) => ({
        shouldMirrorCamera: state.shouldMirrorCamera,
        userStream: state.userStream,
        setUserStreamAspectRatio: state.setUserStreamAspectRatio,
      })),
    );

  const userVideoRef = useRef<HTMLVideoElement | null>(null);
  useEffect(() => {
    const userVideo = userVideoRef.current;

    if (userVideo) {
      // Set the new stream as the source object
      userVideo.srcObject = userStream.stream;

      // Wait for metadata to load before playing
      const playVideo = () => {
        userVideo
          .play()
          .catch((error) =>
            console.error("Failed to play user video with error:", error),
          );
        setUserStreamAspectRatio(userVideo.videoWidth / userVideo.videoHeight);
      };
      // Listen for loadedmetadata event, then play video
      userVideo.addEventListener("loadedmetadata", playVideo);

      // Clean up by pausing the video and removing the event listener
      return () => {
        userVideo.pause();
        userVideo.removeEventListener("loadedmetadata", playVideo);
        userStream.stream?.getTracks().forEach((track) => track.stop());
        userVideo.srcObject = null;
      };
    }
  }, [setUserStreamAspectRatio, userStream.stream]);

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-auto items-center justify-center overflow-hidden">
        {!userStream.stream && (
          <LoadingSpinner className="h-10 w-10 md:h-20 md:w-20" />
        )}
        {!!userStream.stream && (
          <video
            id="user"
            muted
            playsInline
            ref={userVideoRef}
            className={`h-full w-full ${shouldMirrorCamera && "scale-x-[-1]"} object-cover`}
          ></video>
        )}
      </div>
      <UserVideoButtons />
    </div>
  );
};

const UserVideoButtons: React.FC = () => {
  const { solo, isAudioEnabled, isCameraEnabled, switchAudio, switchCamera } =
    useCallStore(
      useShallow((state) => ({
        solo: state.solo,
        isAudioEnabled: state.isAudioEnabled,
        switchAudio: state.switchAudio,
        isCameraEnabled: state.isCameraEnabled,
        switchCamera: state.switchCamera,
      })),
    );
  return (
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
  );
};

export const DraggableAndResizableUserVideo = () => {
  const { solo, lowDataMode, aspectRatio } = useCallStore(
    useShallow((state) => ({
      solo: state.solo,
      lowDataMode: state.lowDataMode,
      aspectRatio: state.userStream.aspectRatio,
    })),
  );

  const baseSize = 100; // Base size for minimum dimensions
  const addedButtonSize = 24;
  const minWidth = aspectRatio > 1 ? baseSize * aspectRatio : baseSize;
  const minHeight =
    aspectRatio < 1
      ? (baseSize + addedButtonSize) * (1 + aspectRatio)
      : baseSize + addedButtonSize;

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
      const newY = solo ? 0 : windowDimensions.height * 0.95 - minHeight;

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
    minHeight,
    previousDimensions.height,
    previousDimensions.width,
    solo,
    windowDimensions.height,
    windowDimensions.width,
  ]);
  useEffect(() => {
    if (!solo) {
      const fullscreen =
        size.height === windowDimensions.height &&
        size.width === windowDimensions.width;
      if (fullscreen) {
        setSize({ width: minWidth, height: minHeight });
      }
    } else {
      setSize({
        width: windowDimensions.width,
        height: windowDimensions.height,
      });
    }
  }, [
    minHeight,
    minWidth,
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
        className={`${!solo && "absolute z-10 rounded-md"} h-fit w-fit bg-${lowDataMode ? "yellow-500" : "[#008B8B]"} transition-all duration-500 ease-in-out ${(isDragging || isResizing) && "transition-none"}`}
      >
        <Resizable
          bounds="window"
          size={size}
          lockAspectRatio
          minHeight={minHeight}
          minWidth={minWidth}
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
          // You have to specify false for all directions other than the one you want to enable resizing only in the desired direction.
          // This prevents the Resizable component from allowing resizing in unintended directions.
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
                className={`h-10 w-10 -rotate-90 text-[#008B8B] ${lowDataMode && "text-yellow-500"}`}
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
