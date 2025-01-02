import { useState, useEffect, useCallback, useRef } from "react";

type ClickOrTouchEvent = MouseEvent | TouchEvent;
type AutoCollapseOptions = {
  initialState?: boolean;
  autoCollapseDelay?: number;
};

export const useAutoCollapse = ({
  initialState = true,
  autoCollapseDelay = 5000,
}: AutoCollapseOptions = {}) => {
  const [isCollapsed, setIsCollapsed] = useState(initialState);
  const timeoutRef = useRef<number | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Cleanup function to clear timeout
  const clearCollapseTimeout = useCallback(() => {
    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  // Toggle collapse state
  const toggle = useCallback((event?: React.MouseEvent | React.TouchEvent) => {
    event?.stopPropagation();
    setIsCollapsed((prev) => !prev);
  }, []);

  // Start auto-collapse timer
  const startCollapseTimer = useCallback(() => {
    clearCollapseTimeout();
    timeoutRef.current = window.setTimeout(() => {
      setIsCollapsed(true);
    }, autoCollapseDelay);
  }, [autoCollapseDelay, clearCollapseTimeout]);

  // Handle outside clicks/touches
  const handleOutsideEvent = useCallback(
    (event: ClickOrTouchEvent) => {
      let targetElement: Element | null;

      if (event instanceof MouseEvent) {
        targetElement = event.target as Element;
      } else {
        // TouchEvent
        targetElement = event.touches[0]?.target as Element;
      }

      if (!targetElement) return;

      // Check if click/touch is outside the container
      const container = containerRef.current;
      const isOutsideClick = container && !container.contains(targetElement);

      if (!isCollapsed && isOutsideClick) {
        setIsCollapsed(true);
        clearCollapseTimeout();
      }
    },
    [isCollapsed, clearCollapseTimeout],
  );

  // Set up event listeners
  useEffect(() => {
    // Only add listeners when expanded
    if (!isCollapsed) {
      // Use passive listeners for better scroll performance
      const eventOptions: AddEventListenerOptions = { passive: true };

      document.addEventListener("mousedown", handleOutsideEvent, eventOptions);
      document.addEventListener("touchstart", handleOutsideEvent, eventOptions);

      // Start auto-collapse timer
      startCollapseTimer();
    }

    // Cleanup
    return () => {
      document.removeEventListener("mousedown", handleOutsideEvent);
      document.removeEventListener("touchstart", handleOutsideEvent);
      clearCollapseTimeout();
    };
  }, [
    isCollapsed,
    handleOutsideEvent,
    startCollapseTimer,
    clearCollapseTimeout,
  ]);

  // Reset on unmount
  useEffect(() => {
    return clearCollapseTimeout;
  }, [clearCollapseTimeout]);

  return {
    isCollapsed,
    toggle,
    containerRef,
  } as const;
};
