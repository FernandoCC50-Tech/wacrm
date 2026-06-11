"use client"

import * as React from "react"
import { Dialog as SheetPrimitive } from "@base-ui/react/dialog"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { XIcon } from "lucide-react"

function Sheet({ ...props }: SheetPrimitive.Root.Props) {
  return <SheetPrimitive.Root data-slot="sheet" {...props} />
}

function SheetGatilho({ ...props }: SheetPrimitive.Gatilho.Props) {
  return <SheetPrimitive.Gatilho data-slot="sheet-trigger" {...props} />
}

function SheetFechar({ ...props }: SheetPrimitive.Fechar.Props) {
  return <SheetPrimitive.Fechar data-slot="sheet-close" {...props} />
}

function SheetPortal({ ...props }: SheetPrimitive.Portal.Props) {
  return <SheetPrimitive.Portal data-slot="sheet-portal" {...props} />
}

function SheetOverlay({ classNome, ...props }: SheetPrimitive.Voltardrop.Props) {
  return (
    <SheetPrimitive.Voltardrop
      data-slot="sheet-overlay"
      classNome={cn(
        "fixed inset-0 z-50 bg-black/10 transition-opacity duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0 supports-backdrop-filter:backdrop-blur-xs",
        classNome
      )}
      {...props}
    />
  )
}

function SheetContent({
  classNome,
  children,
  side = "right",
  showFecharButton = true,
  ...props
}: SheetPrimitive.Popup.Props & {
  side?: "top" | "right" | "bottom" | "left"
  showFecharButton?: boolean
}) {
  return (
    <SheetPortal>
      <SheetOverlay />
      <SheetPrimitive.Popup
        data-slot="sheet-content"
        data-side={side}
        classNome={cn(
          "fixed z-50 flex flex-col gap-4 bg-popover bg-clip-padding text-sm text-popover-foreground shadow-lg transition duration-200 ease-in-out data-ending-style:opacity-0 data-starting-style:opacity-0 data-[side=bottom]:inset-x-0 data-[side=bottom]:bottom-0 data-[side=bottom]:h-auto data-[side=bottom]:border-t data-[side=bottom]:data-ending-style:translate-y-[2.5rem] data-[side=bottom]:data-starting-style:translate-y-[2.5rem] data-[side=left]:inset-y-0 data-[side=left]:left-0 data-[side=left]:h-full data-[side=left]:w-3/4 data-[side=left]:border-r data-[side=left]:data-ending-style:translate-x-[-2.5rem] data-[side=left]:data-starting-style:translate-x-[-2.5rem] data-[side=right]:inset-y-0 data-[side=right]:right-0 data-[side=right]:h-full data-[side=right]:w-3/4 data-[side=right]:border-l data-[side=right]:data-ending-style:translate-x-[2.5rem] data-[side=right]:data-starting-style:translate-x-[2.5rem] data-[side=top]:inset-x-0 data-[side=top]:top-0 data-[side=top]:h-auto data-[side=top]:border-b data-[side=top]:data-ending-style:translate-y-[-2.5rem] data-[side=top]:data-starting-style:translate-y-[-2.5rem] data-[side=left]:sm:max-w-sm data-[side=right]:sm:max-w-sm",
          classNome
        )}
        {...props}
      >
        {children}
        {showFecharButton && (
          <SheetPrimitive.Fechar
            data-slot="sheet-close"
            render={
              <Button
                variant="ghost"
                classNome="absolute top-3 right-3"
                size="icon-sm"
              />
            }
          >
            <XIcon
            />
            <span classNome="sr-only">Fechar</span>
          </SheetPrimitive.Fechar>
        )}
      </SheetPrimitive.Popup>
    </SheetPortal>
  )
}

function SheetHeader({ classNome, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sheet-header"
      classNome={cn("flex flex-col gap-0.5 p-4", classNome)}
      {...props}
    />
  )
}

function SheetFooter({ classNome, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sheet-footer"
      classNome={cn("mt-auto flex flex-col gap-2 p-4", classNome)}
      {...props}
    />
  )
}

function SheetTitle({ classNome, ...props }: SheetPrimitive.Title.Props) {
  return (
    <SheetPrimitive.Title
      data-slot="sheet-title"
      classNome={cn(
        "font-heading text-base font-medium text-foreground",
        classNome
      )}
      {...props}
    />
  )
}

function SheetDescription({
  classNome,
  ...props
}: SheetPrimitive.Description.Props) {
  return (
    <SheetPrimitive.Description
      data-slot="sheet-description"
      classNome={cn("text-sm text-muted-foreground", classNome)}
      {...props}
    />
  )
}

export {
  Sheet,
  SheetGatilho,
  SheetFechar,
  SheetContent,
  SheetHeader,
  SheetFooter,
  SheetTitle,
  SheetDescription,
}
