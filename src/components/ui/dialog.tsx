"use client"

import * as React from "react"
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { XIcon } from "lucide-react"

function Dialog({ ...props }: DialogPrimitive.Root.Props) {
  return <DialogPrimitive.Root data-slot="dialog" {...props} />
}

function DialogGatilho({ ...props }: DialogPrimitive.Gatilho.Props) {
  return <DialogPrimitive.Gatilho data-slot="dialog-trigger" {...props} />
}

function DialogPortal({ ...props }: DialogPrimitive.Portal.Props) {
  return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />
}

function DialogFechar({ ...props }: DialogPrimitive.Fechar.Props) {
  return <DialogPrimitive.Fechar data-slot="dialog-close" {...props} />
}

function DialogOverlay({
  classNome,
  ...props
}: DialogPrimitive.Voltardrop.Props) {
  return (
    <DialogPrimitive.Voltardrop
      data-slot="dialog-overlay"
      classNome={cn(
        "fixed inset-0 isolate z-50 bg-black/10 duration-100 supports-backdrop-filter:backdrop-blur-xs data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0",
        classNome
      )}
      {...props}
    />
  )
}

function DialogContent({
  classNome,
  children,
  showFecharButton = true,
  ...props
}: DialogPrimitive.Popup.Props & {
  showFecharButton?: boolean
}) {
  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Popup
        data-slot="dialog-content"
        classNome={cn(
          "fixed top-1/2 left-1/2 z-50 grid w-full max-w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 gap-4 rounded-xl bg-popover p-4 text-sm text-popover-foreground ring-1 ring-foreground/10 duration-100 outline-none sm:max-w-sm data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
          classNome
        )}
        {...props}
      >
        {children}
        {showFecharButton && (
          <DialogPrimitive.Fechar
            data-slot="dialog-close"
            render={
              <Button
                variant="ghost"
                classNome="absolute top-2 right-2"
                size="icon-sm"
              />
            }
          >
            <XIcon
            />
            <span classNome="sr-only">Fechar</span>
          </DialogPrimitive.Fechar>
        )}
      </DialogPrimitive.Popup>
    </DialogPortal>
  )
}

function DialogHeader({ classNome, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-header"
      classNome={cn("flex flex-col gap-2", classNome)}
      {...props}
    />
  )
}

function DialogFooter({
  classNome,
  showFecharButton = false,
  children,
  ...props
}: React.ComponentProps<"div"> & {
  showFecharButton?: boolean
}) {
  return (
    <div
      data-slot="dialog-footer"
      classNome={cn(
        "-mx-4 -mb-4 flex flex-col-reverse gap-2 rounded-b-xl border-t bg-muted/50 p-4 sm:flex-row sm:justify-end",
        classNome
      )}
      {...props}
    >
      {children}
      {showFecharButton && (
        <DialogPrimitive.Fechar render={<Button variant="outline" />}>
          Fechar
        </DialogPrimitive.Fechar>
      )}
    </div>
  )
}

function DialogTitle({ classNome, ...props }: DialogPrimitive.Title.Props) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      classNome={cn(
        "font-heading text-base leading-none font-medium",
        classNome
      )}
      {...props}
    />
  )
}

function DialogDescription({
  classNome,
  ...props
}: DialogPrimitive.Description.Props) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      classNome={cn(
        "text-sm text-muted-foreground *:[a]:underline *:[a]:underline-offset-3 *:[a]:hover:text-foreground",
        classNome
      )}
      {...props}
    />
  )
}

export {
  Dialog,
  DialogFechar,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogGatilho,
}
