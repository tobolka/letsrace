"use client"

import * as React from "react"
import { Drawer as DrawerPrimitive } from "vaul"
import { Dialog as DialogPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"
import { focusKeyboardItem, visibleKeyboardItems } from "@/lib/keyboard-navigation"

const DrawerModalContext = React.createContext(true)

function Drawer({
  autoFocus = true,
  modal = true,
  open,
  defaultOpen = false,
  onOpenChange,
  dismissible = true,
  children,
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.Root>) {
  const [ownOpen, setOwnOpen] = React.useState(defaultOpen)
  const isOpen = open ?? ownOpen
  function changeOpen(next: boolean) {
    if (!next && !dismissible) return
    setOwnOpen(next)
    onOpenChange?.(next)
  }
  return (
    <DrawerModalContext.Provider value={modal}>
    <DrawerPrimitive.Root data-slot="drawer" autoFocus={autoFocus} modal={modal} open={isOpen} onOpenChange={changeOpen} dismissible={dismissible} {...props}>
      {modal ? children : (
        // Vaul 1.1.2 does not forward `modal` to its Radix Root. Supply the
        // non-modal context to its content so the permanent map list neither
        // traps keyboard focus nor hides the map/navigation from readers.
        <DialogPrimitive.Root open={isOpen} onOpenChange={changeOpen} modal={false}>
          {children}
        </DialogPrimitive.Root>
      )}
    </DrawerPrimitive.Root>
    </DrawerModalContext.Provider>
  )
}

function DrawerTrigger({
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.Trigger>) {
  return <DrawerPrimitive.Trigger data-slot="drawer-trigger" {...props} />
}

function DrawerPortal({
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.Portal>) {
  return <DrawerPrimitive.Portal data-slot="drawer-portal" {...props} />
}

function DrawerClose({
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.Close>) {
  return <DrawerPrimitive.Close data-slot="drawer-close" {...props} />
}

function DrawerOverlay({
  className,
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.Overlay>) {
  return (
    <DrawerPrimitive.Overlay
      data-slot="drawer-overlay"
      className={cn(
        "fixed inset-0 z-50 bg-black/50 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0",
        className
      )}
      {...props}
    />
  )
}

function DrawerHandle({
  className,
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.Handle>) {
  return (
    <DrawerPrimitive.Handle
      data-slot="drawer-handle"
      aria-hidden={false}
      /**
       * The handle is dragged or tapped to open the sheet, so it is a control
       * and needs to say so: `aria-label` is not allowed on a bare div, and
       * without a role a keyboard never reaches it either.
       */
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key !== "Enter" && e.key !== " ") return;
        e.preventDefault();
        e.currentTarget.click();
      }}
      className={cn(
        // Compact grabber; hit area via padding, not a tall empty block.
        "mx-auto mt-1.5 mb-1 flex w-full max-w-none items-center justify-center bg-transparent py-1.5",
        /*
         * vaul wraps whatever is passed in its own hit-area span, and that span
         * is absolutely positioned so the 44px touch target reaches above the
         * sheet's edge. The grabber inherited that origin and was drawn sixteen
         * pixels above the sheet, where the rounded top clips it — present in
         * the DOM, draggable, and invisible. Centring inside the hit area puts
         * it back in the middle of the handle.
         */
        "[&>[data-vaul-handle-hitarea]]:flex [&>[data-vaul-handle-hitarea]]:items-center [&>[data-vaul-handle-hitarea]]:justify-center",
        className
      )}
      style={{ width: "100%", background: "transparent" }}
      {...props}
    >
      <span className="pointer-events-none block h-1 w-10 shrink-0 rounded-full bg-muted-foreground/45" />
    </DrawerPrimitive.Handle>
  )
}

function DrawerContent({
  className,
  children,
  showOverlay = true,
  onOpenAutoFocus,
  onCloseAutoFocus,
  onKeyDownCapture,
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.Content> & {
  showOverlay?: boolean
}) {
  const opener = React.useRef<HTMLElement | null>(null)
  const modal = React.useContext(DrawerModalContext)
  return (
    <DrawerPortal data-slot="drawer-portal">
      {showOverlay ? <DrawerOverlay /> : null}
      <DrawerPrimitive.Content
        data-slot="drawer-content"
        role={modal ? "dialog" : "region"}
        aria-modal={modal || undefined}
        onKeyDownCapture={(event) => {
          onKeyDownCapture?.(event)
          if (modal || event.defaultPrevented || event.key !== "Tab" || event.altKey || event.ctrlKey || event.metaKey) return
          // Radix loops Tab even in a non-modal dialog. At the edges of the
          // map's persistent panel, continue into the rest of the page.
          const all = Array.from(document.querySelectorAll<HTMLElement>("a[href], button, input, select, textarea, [tabindex]"))
            .filter((el) => el.tabIndex >= 0 && !el.matches(":disabled") && el.getClientRects().length > 0 && !el.closest("[inert], [aria-hidden=true]"))
          const inside = all.filter((el) => event.currentTarget.contains(el))
          const edge = event.shiftKey ? inside[0] : inside.at(-1)
          if (event.target !== edge) return
          const index = all.indexOf(edge)
          const next = all[(index + (event.shiftKey ? -1 : 1) + all.length) % all.length]
          if (next && !event.currentTarget.contains(next)) {
            event.preventDefault()
            event.stopPropagation()
            next.focus()
          }
        }}
        onOpenAutoFocus={(event) => {
          opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
          onOpenAutoFocus?.(event)
        }}
        onCloseAutoFocus={(event) => {
          onCloseAutoFocus?.(event)
          if (!event.defaultPrevented && opener.current?.isConnected && opener.current !== document.body) {
            event.preventDefault()
            opener.current.focus()
          } else if (!event.defaultPrevented) {
            const content = event.target instanceof HTMLElement ? event.target : null
            const id = opener.current?.dataset.eventId ?? content?.querySelector<HTMLElement>("[data-event-id]")?.dataset.eventId
            if (id) {
              event.preventDefault()
              requestAnimationFrame(() => {
                const row = visibleKeyboardItems(document).find((el) => el.dataset.eventId === id)
                if (row) focusKeyboardItem(row)
              })
            }
          }
        }}
        className={cn(
          "group/drawer-content fixed z-50 flex h-auto flex-col bg-background",
          "data-[vaul-drawer-direction=top]:inset-x-0 data-[vaul-drawer-direction=top]:top-0 data-[vaul-drawer-direction=top]:mb-24 data-[vaul-drawer-direction=top]:max-h-[80vh] data-[vaul-drawer-direction=top]:rounded-b-lg data-[vaul-drawer-direction=top]:border-b",
          "data-[vaul-drawer-direction=bottom]:inset-x-0 data-[vaul-drawer-direction=bottom]:bottom-0 data-[vaul-drawer-direction=bottom]:mt-24 data-[vaul-drawer-direction=bottom]:max-h-[80vh] data-[vaul-drawer-direction=bottom]:rounded-t-lg data-[vaul-drawer-direction=bottom]:border-t",
          "data-[vaul-drawer-direction=right]:inset-y-0 data-[vaul-drawer-direction=right]:right-0 data-[vaul-drawer-direction=right]:w-3/4 data-[vaul-drawer-direction=right]:border-l data-[vaul-drawer-direction=right]:sm:max-w-sm",
          "data-[vaul-drawer-direction=left]:inset-y-0 data-[vaul-drawer-direction=left]:left-0 data-[vaul-drawer-direction=left]:w-3/4 data-[vaul-drawer-direction=left]:border-r data-[vaul-drawer-direction=left]:sm:max-w-sm",
          className
        )}
        {...props}
      >
        {children}
      </DrawerPrimitive.Content>
    </DrawerPortal>
  )
}

function DrawerHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="drawer-header"
      className={cn(
        "flex flex-col gap-0.5 p-4 group-data-[vaul-drawer-direction=bottom]/drawer-content:text-center group-data-[vaul-drawer-direction=top]/drawer-content:text-center md:gap-1.5 md:text-left",
        className
      )}
      {...props}
    />
  )
}

function DrawerFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="drawer-footer"
      className={cn("mt-auto flex flex-col gap-2 p-4", className)}
      {...props}
    />
  )
}

function DrawerTitle({
  className,
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.Title>) {
  return (
    <DrawerPrimitive.Title
      data-slot="drawer-title"
      className={cn("font-semibold text-foreground", className)}
      {...props}
    />
  )
}

function DrawerDescription({
  className,
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.Description>) {
  return (
    <DrawerPrimitive.Description
      data-slot="drawer-description"
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  )
}

export {
  Drawer,
  DrawerPortal,
  DrawerOverlay,
  DrawerTrigger,
  DrawerClose,
  DrawerContent,
  DrawerHandle,
  DrawerHeader,
  DrawerFooter,
  DrawerTitle,
  DrawerDescription,
}
