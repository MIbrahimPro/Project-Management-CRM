import {
  type BlockSchema,
  type InlineContentSchema,
  type StyleSchema,
  type SuggestionMenuState,
  filterSuggestionItems,
} from "@blocknote/core";
import { getDefaultReactSlashMenuItems, useBlockNoteEditor } from "@blocknote/react";
import { flip, offset, shift, size } from "@floating-ui/react";
import { type FC, useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useUIElementPositioningSolid } from "@/lib/blocknote/useUIElementPositioningSolid";
import type { DefaultReactSuggestionItem, SuggestionMenuProps } from "@blocknote/react";

type ArrayElement<A> = A extends readonly (infer T)[] ? T : never;

type ItemType<GetItemsType extends (query: string) => Promise<any[]>> =
  ArrayElement<Awaited<ReturnType<GetItemsType>>>;

const MENU_BG = "var(--fallback-b2,oklch(var(--b2)/1))";
const MENU_FG = "var(--fallback-bc,oklch(var(--bc)/1))";
const MENU_BORDER = "var(--fallback-bc,oklch(var(--bc)/0.18))";

export function SuggestionMenuControllerSolid<
  GetItemsType extends (query: string) => Promise<any[]> = (
    query: string
  ) => Promise<DefaultReactSuggestionItem[]>,
>(
  props: {
    triggerCharacter: string;
    getItems?: GetItemsType;
    minQueryLength?: number;
  } & (ItemType<GetItemsType> extends DefaultReactSuggestionItem
    ? {
        suggestionMenuComponent?: FC<
          SuggestionMenuProps<ItemType<GetItemsType>>
        >;
        onItemClick?: (item: ItemType<GetItemsType>) => void;
      }
    : {
        suggestionMenuComponent: FC<
          SuggestionMenuProps<ItemType<GetItemsType>>
        >;
        onItemClick: (item: ItemType<GetItemsType>) => void;
      })
) {
  const editor = useBlockNoteEditor<
    BlockSchema,
    InlineContentSchema,
    StyleSchema
  >();

  const {
    triggerCharacter,
    suggestionMenuComponent,
    minQueryLength,
    onItemClick,
    getItems,
  } = props;

  const [state, setState] = useState<SuggestionMenuState | null>(null);
  const [items, setItems] = useState<ItemType<GetItemsType>[]>([]);
  const [loadingState, setLoadingState] = useState<
    "loading-initial" | "loading" | "loaded"
  >("loading-initial");
  const [selectedIndex, setSelectedIndex] = useState<number | undefined>(0);

  const onItemClickOrDefault = useMemo(() => {
    return (
      onItemClick ||
      ((item: ItemType<GetItemsType>) => {
        (item as DefaultReactSuggestionItem).onItemClick();
      })
    );
  }, [onItemClick]);

  const getItemsOrDefault = useMemo(() => {
    return (
      getItems ||
      ((async (query: string) =>
        filterSuggestionItems(
          getDefaultReactSlashMenuItems(editor),
          query
        )) as any as typeof getItems)
    );
  }, [editor, getItems])!;

  const closeMenu = editor.suggestionMenus.closeMenu;
  const clearQuery = editor.suggestionMenus.clearQuery;

  const runItemAction = useCallback(
    (item: ItemType<GetItemsType>) => {
      // Run item command first while editor selection is still intact.
      // Closing first can blur/reset selection and make slash actions no-op.
      onItemClickOrDefault(item);
      queueMicrotask(() => {
        clearQuery();
        closeMenu();
      });
    },
    [onItemClickOrDefault, clearQuery, closeMenu]
  );

  useEffect(() => {
    return editor.suggestionMenus.onUpdate(triggerCharacter, setState);
  }, [editor.suggestionMenus, triggerCharacter]);

  useEffect(() => {
    if (!state?.show) return;
    const blockedByQueryLength =
      !state.ignoreQueryLength &&
      !!minQueryLength &&
      (state.query.startsWith(" ") || state.query.length < minQueryLength);
    if (blockedByQueryLength) return;

    let cancelled = false;
    setLoadingState((prev) => (prev === "loading-initial" ? prev : "loading"));

    void getItemsOrDefault(state.query).then((nextItems) => {
      if (cancelled) return;
      const resolved = (nextItems ?? []) as ItemType<GetItemsType>[];
      setItems(resolved);
      setSelectedIndex(resolved.length > 0 ? 0 : undefined);
      setLoadingState("loaded");
      if (resolved.length === 0) closeMenu();
    });

    return () => {
      cancelled = true;
    };
  }, [
    state?.show,
    state?.query,
    state?.ignoreQueryLength,
    minQueryLength,
    getItemsOrDefault,
    closeMenu,
  ]);

  useEffect(() => {
    if (!state?.show || items.length === 0) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setSelectedIndex((prev) => {
          const current = prev ?? 0;
          return (current + 1) % items.length;
        });
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        setSelectedIndex((prev) => {
          const current = prev ?? 0;
          return (current - 1 + items.length) % items.length;
        });
      } else if (event.key === "Enter") {
        if (selectedIndex === undefined) return;
        event.preventDefault();
        const item = items[selectedIndex];
        if (!item) return;
        runItemAction(item);
      } else if (event.key === "Escape") {
        closeMenu();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [
    state?.show,
    items,
    selectedIndex,
    closeMenu,
    runItemAction,
  ]);

  const { isMounted, ref: setFloatingRef, style, getFloatingProps } =
    useUIElementPositioningSolid(
      state?.show || false,
      state?.referencePos || null,
      2000,
      {
        placement: "bottom-start",
        middleware: [
          offset(10),
          flip({
            mainAxis: true,
            crossAxis: false,
          }),
          shift(),
          size({
            apply({ availableHeight, elements }) {
              Object.assign(elements.floating.style, {
                maxHeight: `${availableHeight - 10}px`,
              });
            },
          }),
        ],
        onOpenChange(open) {
          if (!open) {
            editor.suggestionMenus.closeMenu();
          }
        },
      }
    );

  const floatingElementRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isMounted || !state?.show) return;
    const el = floatingElementRef.current;
    if (!el) return;

    // Keep styles on the floating shell and this menu instance only.
    el.style.setProperty("background-color", MENU_BG, "important");
    el.style.setProperty("color", MENU_FG, "important");
    el.style.setProperty("border", `1px solid ${MENU_BORDER}`, "important");
    el.style.setProperty("box-shadow", `0 8px 28px ${MENU_BORDER}`, "important");
    el.style.setProperty("border-radius", "0.75rem", "important");
    el.style.setProperty("opacity", "1", "important");
    el.style.setProperty("mix-blend-mode", "normal", "important");
    el.style.setProperty("backdrop-filter", "none", "important");
    el.style.setProperty("isolation", "isolate", "important");
    el.style.setProperty("transition", "transform 250ms ease", "important");

    const inner = el.querySelector("#bn-suggestion-menu");
    if (inner instanceof HTMLElement) {
      inner.style.setProperty("background-color", MENU_BG, "important");
      inner.style.setProperty("color", MENU_FG, "important");
      inner.style.setProperty("border-radius", "0.5rem", "important");
      inner.style.setProperty("z-index", "2147483600", "important");
      inner.style.setProperty("opacity", "1", "important");
    }
  }, [isMounted, state?.show]);

    if (
      !isMounted ||
      !state ||
      (!state?.ignoreQueryLength &&
        minQueryLength &&
        (state.query.startsWith(" ") || state.query.length < minQueryLength))
    ) {
      return null;
    }

  const Menu = (suggestionMenuComponent ??
    DefaultSuggestionMenu) as FC<SuggestionMenuProps<ItemType<GetItemsType>>>;

  return (
    <div
      ref={(el) => {
        setFloatingRef(el as any);
        floatingElementRef.current = el as HTMLDivElement | null;
      }}
      style={{
        ...style,
        backgroundColor: MENU_BG,
        color: MENU_FG,
        border: `1px solid ${MENU_BORDER}`,
        boxShadow: `0 8px 28px ${MENU_BORDER}`,
        borderRadius: "0.75rem",
        opacity: 1,
        // Prevent blending/filters from making the background appear transparent
        mixBlendMode: "normal",
        backdropFilter: "none",
        isolation: "isolate",
        transition: "transform 250ms ease",
      }}
      className="bn-suggestion-menu-floating-root"
      data-floating-ui-focusable=""
      {...getFloatingProps()}
    >
      <Menu
        items={items}
        loadingState={loadingState}
        selectedIndex={selectedIndex}
        onItemClick={(item) => {
          runItemAction(item as ItemType<GetItemsType>);
        }}
      />
    </div>
  );

}

function DefaultSuggestionMenu<T extends DefaultReactSuggestionItem>(
  props: SuggestionMenuProps<T>
) {
  const { items, selectedIndex, onItemClick, loadingState } = props;

  return (
    <div
      id="bn-suggestion-menu"
      className="bn-suggestion-menu"
      style={{
        backgroundColor: MENU_BG,
        color: MENU_FG,
        borderRadius: "0.5rem",
      }}
    >
      {items.map((item, index) => {
        const isSelected = index === selectedIndex;
        return (
          <button
            key={`${item.title}-${index}`}
            id={`bn-suggestion-menu-item-${index}`}
            type="button"
            className={`bn-suggestion-menu-item${isSelected ? " selected" : ""}`}
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: "0.625rem",
              width: "100%",
              textAlign: "left",
              padding: "0.55rem 0.7rem",
              borderRadius: "0.5rem",
              background: isSelected
                ? "var(--fallback-b3,oklch(var(--b3)/1))"
                : "transparent",
            }}
            onMouseDown={(event) => {
              // Prevent editor blur before command runs.
              event.preventDefault();
              onItemClick?.(item);
            }}
          >
            <span
              className="bn-suggestion-menu-item-icon"
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                width: "1.25rem",
                minWidth: "1.25rem",
                marginTop: "0.1rem",
              }}
            >
              {item.icon ?? null}
            </span>
            <span
              className="bn-suggestion-menu-item-text"
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "flex-start",
                gap: "0.15rem",
                minWidth: 0,
                flex: 1,
                lineHeight: 1.2,
              }}
            >
              <span
                className="bn-suggestion-menu-item-title"
                style={{
                  fontWeight: 600,
                  whiteSpace: "nowrap",
                }}
              >
                {item.title}
              </span>
              {item.subtext ? (
                <span
                  className="bn-suggestion-menu-item-subtext"
                  style={{
                    opacity: 0.65,
                    fontSize: "0.78rem",
                    whiteSpace: "normal",
                  }}
                >
                  {item.subtext}
                </span>
              ) : null}
            </span>
          </button>
        );
      })}

      {loadingState !== "loaded" ? (
        <div className="bn-suggestion-menu-loader">Loading...</div>
      ) : null}
    </div>
  );
}
