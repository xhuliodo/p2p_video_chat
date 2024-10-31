import { useEffect, useRef, useState } from "react";
import { useCallStore } from "../state/call";
import {
  SpeakerWaveSolid,
  SpeakerXMarkSolid,
  VideoCameraOutline,
  VideoCameraSlashOutline,
} from "@graywolfai/react-heroicons";
import { LoadingSpinner } from "./LoadingSpinner";
import Draggable, { DraggableEventHandler } from "react-draggable";
import { Resizable } from "re-resizable";
import { Direction } from "re-resizable/lib/resizer";
import { Handle } from "./Handle";
import useWindowDimensions from "../hooks/useWindowDimensions";

const UserVideo: React.FC = () => {
  const userStream = useCallStore((state) => state.userStream);
  const isAudio = useCallStore((state) => state.isAudio);
  const switchAudio = useCallStore((state) => state.switchAudio);
  const isCamera = useCallStore((state) => state.isCamera);
  const switchCamera = useCallStore((state) => state.switchCamera);

  const userVideoRef = useRef<HTMLVideoElement | null>(null);
  useEffect(() => {
    const userVideo = userVideoRef.current;
    if (userVideo) {
      if (userVideo.srcObject !== userStream) {
        userVideo.srcObject = userStream;
        if (userStream)
          userVideo
            .play()
            .catch((error) => console.error("Play error:", error));
      }
    }

    return () => {
      if (userVideo && userVideo.srcObject) {
        userStream?.getTracks().forEach((track) => track.stop());
        userVideo.srcObject = null; // Clean up media stream only if necessary
      }
    };
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
            className={`h-full w-full scale-x-[-1] object-cover`}
          ></video>
        )}
      </div>

      <div className="flex place-content-evenly items-center">
        <button
          onClick={switchAudio}
          className="flex w-[50%] items-center justify-center"
        >
          <div className="flex items-center gap-[2px] text-white md:gap-1">
            {isAudio ? (
              <SpeakerWaveSolid className="h-5 w-5" />
            ) : (
              <SpeakerXMarkSolid className="h-5 w-5" />
            )}
          </div>
        </button>
        <span className="text-white">|</span>
        <button
          onClick={switchCamera}
          className="flex w-[50%] items-center justify-center text-white"
        >
          <div className="flex items-center gap-[2px] md:gap-1">
            {isCamera ? (
              <VideoCameraOutline className="h-5 w-5" />
            ) : (
              <VideoCameraSlashOutline className="h-5 w-5" />
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

  const windowDimensions = useWindowDimensions()

  const deltaHeight = useRef(0);
  const [isResizing, setIsResizing] = useState(false);
  const [size, setSize] = useState({ width: windowDimensions.width, height: windowDimensions.height });

  useEffect(() => {
    if (!solo) {
      setPosition({
        x: windowDimensions.width * 0.05,
        y: windowDimensions.height * 0.95 - 192,
      });
      setSize({ width: 128, height: 192 });
    } else {
      setPosition({ x: 0, y: 0 });
      setSize({ width: windowDimensions.width, height: windowDimensions.height });
    }
  }, [solo, windowDimensions.height, windowDimensions.width]);
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
    >
      <div
        ref={nodeRef}
        className={`absolute h-fit w-fit rounded-md bg-[#008B8B] transition-all duration-500 ease-in-out ${(isDragging || isResizing) && "transition-none"}`}
      >
        <Resizable
          bounds="window"
          size={size}
          lockAspectRatio
          minHeight={192}
          minWidth={128}
          maxHeight={solo ? windowDimensions.height : windowDimensions.height * 0.5}
          maxWidth={solo ? windowDimensions.width : windowDimensions.width * 0.5}
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
            topRight: !isDragging && !solo,
          }}
          handleComponent={{
            topRight: <Handle className="rotate-90" />,
          }}
          handleClasses={{
            topRight: "z-10 rounded-full bg-gray-100 active:bg-gray-300",
          }}
        >
          <UserVideo />
        </Resizable>
      </div>
    </Draggable>
  );
};
