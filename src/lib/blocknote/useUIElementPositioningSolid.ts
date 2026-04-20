import {
  useDismiss,
  useFloating,
  type UseFloatingOptions,
  useInteractions,
  useTransitionStyles,
} from "@floating-ui/react";
import { useEffect, useMemo } from "react";
import type { CSSProperties } from "react";

/**
 * Fork of BlockNote's useUIElementPositioning (see node_modules/@blocknote/react).
 * The upstream hook uses useTransitionStyles() with default `initial: { opacity: 0 }`,
 * so the slash / suggestion menu wrapper stays effectively invisible in many apps.
 *
 * We keep opacity at 1 for all transition states and skip fade duration.
 * @see https://floating-ui.com/docs/useTransitionStyles
 */
export function useUIElementPositioningSolid(
  show: boolean,
  referencePos: DOMRect | null,
  zIndex: number,
  options?: Partial<UseFloatingOptions>
) {
  const { refs, update, context, floatingStyles } = useFloating({
    open: show,
    // Use fixed positioning to avoid ancestor overflow/stacking context clipping
    // which can make floating UI elements appear behind editor content.
    strategy: "fixed",
    ...options,
  });

  const { isMounted, styles } = useTransitionStyles(context, {
    initial: { opacity: 1 },
    open: { opacity: 1 },
    close: { opacity: 1 },
    duration: 0,
  });

  const dismiss = useDismiss(context);

  const { getFloatingProps, getReferenceProps } = useInteractions([dismiss]);

  useEffect(() => {
    update();
  }, [referencePos, update]);

  useEffect(() => {
    if (referencePos === null) {
      return;
    }

    refs.setReference({
      getBoundingClientRect: () => referencePos,
    });
  }, [referencePos, refs]);

  return useMemo(
    () => ({
      isMounted,
      ref: refs.setFloating,
      style: {
        display: "flex",
        ...styles,
        ...floatingStyles,
        zIndex,
      } as CSSProperties,
      getFloatingProps,
      getReferenceProps,
    }),
    [
      floatingStyles,
      isMounted,
      refs.setFloating,
      styles,
      zIndex,
      getFloatingProps,
      getReferenceProps,
    ]
  );
}
