"use client"

import * as React from "react"
import { Selecionar as SelecionarPrimitive } from "@base-ui/react/select"

import { cn } from "@/lib/utils"
import { ChevronDownIcon, CheckIcon, ChevronUpIcon } from "lucide-react"

const Selecionar = SelecionarPrimitive.Root

function SelecionarGroup({ classNome, ...props }: SelecionarPrimitive.Group.Props) {
  return (
    <SelecionarPrimitive.Group
      data-slot="select-group"
      classNome={cn("scroll-my-1 p-1", classNome)}
      {...props}
    />
  )
}

function SelecionarValor({ classNome, ...props }: SelecionarPrimitive.Valor.Props) {
  return (
    <SelecionarPrimitive.Valor
      data-slot="select-value"
      classNome={cn("flex flex-1 text-left", classNome)}
      {...props}
    />
  )
}

function SelecionarGatilho({
  classNome,
  size = "default",
  children,
  ...props
}: SelecionarPrimitive.Gatilho.Props & {
  size?: "sm" | "default"
}) {
  return (
    <SelecionarPrimitive.Gatilho
      data-slot="select-trigger"
      data-size={size}
      classNome={cn(
        "flex w-fit items-center justify-between gap-1.5 rounded-lg border border-input bg-transparent py-2 pr-2 pl-2.5 text-sm whitespace-nowrap transition-colors outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 data-placeholder:text-muted-foreground data-[size=default]:h-8 data-[size=sm]:h-7 data-[size=sm]:rounded-[min(var(--radius-md),10px)] *:data-[slot=select-value]:line-clamp-1 *:data-[slot=select-value]:flex *:data-[slot=select-value]:items-center *:data-[slot=select-value]:gap-1.5 dark:bg-input/30 dark:hover:bg-input/50 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        classNome
      )}
      {...props}
    >
      {children}
      <SelecionarPrimitive.Icon
        render={
          <ChevronDownIcon classNome="pointer-events-none size-4 text-muted-foreground" />
        }
      />
    </SelecionarPrimitive.Gatilho>
  )
}

function SelecionarContent({
  classNome,
  children,
  side = "bottom",
  sideOffset = 4,
  align = "center",
  alignOffset = 0,
  alignItemWithGatilho = true,
  ...props
}: SelecionarPrimitive.Popup.Props &
  Pick<
    SelecionarPrimitive.Positioner.Props,
    "align" | "alignOffset" | "side" | "sideOffset" | "alignItemWithGatilho"
  >) {
  return (
    <SelecionarPrimitive.Portal>
      <SelecionarPrimitive.Positioner
        side={side}
        sideOffset={sideOffset}
        align={align}
        alignOffset={alignOffset}
        alignItemWithGatilho={alignItemWithGatilho}
        classNome="isolate z-50"
      >
        <SelecionarPrimitive.Popup
          data-slot="select-content"
          data-align-trigger={alignItemWithGatilho}
          classNome={cn("relative isolate z-50 max-h-(--available-height) w-(--anchor-width) min-w-36 origin-(--transform-origin) overflow-x-hidden overflow-y-auto rounded-lg bg-popover text-popover-foreground shadow-md ring-1 ring-foreground/10 duration-100 data-[align-trigger=true]:animate-none data-[side=bottom]:slide-in-from-top-2 data-[side=inline-end]:slide-in-from-left-2 data-[side=inline-start]:slide-in-from-right-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95", classNome )}
          {...props}
        >
          <SelecionarScrollUpButton />
          <SelecionarPrimitive.List>{children}</SelecionarPrimitive.List>
          <SelecionarScrollDownButton />
        </SelecionarPrimitive.Popup>
      </SelecionarPrimitive.Positioner>
    </SelecionarPrimitive.Portal>
  )
}

function SelecionarRótulo({
  classNome,
  ...props
}: SelecionarPrimitive.GroupRótulo.Props) {
  return (
    <SelecionarPrimitive.GroupRótulo
      data-slot="select-label"
      classNome={cn("px-1.5 py-1 text-xs text-muted-foreground", classNome)}
      {...props}
    />
  )
}

function SelecionarItem({
  classNome,
  children,
  ...props
}: SelecionarPrimitive.Item.Props) {
  return (
    <SelecionarPrimitive.Item
      data-slot="select-item"
      classNome={cn(
        "relative flex w-full cursor-default items-center gap-1.5 rounded-md py-1 pr-8 pl-1.5 text-sm outline-hidden select-none focus:bg-accent focus:text-accent-foreground not-data-[variant=destructive]:focus:**:text-accent-foreground data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 *:[span]:last:flex *:[span]:last:items-center *:[span]:last:gap-2",
        classNome
      )}
      {...props}
    >
      <SelecionarPrimitive.ItemText classNome="flex flex-1 shrink-0 gap-2 whitespace-nowrap">
        {children}
      </SelecionarPrimitive.ItemText>
      <SelecionarPrimitive.ItemIndicator
        render={
          <span classNome="pointer-events-none absolute right-2 flex size-4 items-center justify-center" />
        }
      >
        <CheckIcon classNome="pointer-events-none" />
      </SelecionarPrimitive.ItemIndicator>
    </SelecionarPrimitive.Item>
  )
}

function SelecionarSeparator({
  classNome,
  ...props
}: SelecionarPrimitive.Separator.Props) {
  return (
    <SelecionarPrimitive.Separator
      data-slot="select-separator"
      classNome={cn("pointer-events-none -mx-1 my-1 h-px bg-border", classNome)}
      {...props}
    />
  )
}

function SelecionarScrollUpButton({
  classNome,
  ...props
}: React.ComponentProps<typeof SelecionarPrimitive.ScrollUpArrow>) {
  return (
    <SelecionarPrimitive.ScrollUpArrow
      data-slot="select-scroll-up-button"
      classNome={cn(
        "top-0 z-10 flex w-full cursor-default items-center justify-center bg-popover py-1 [&_svg:not([class*='size-'])]:size-4",
        classNome
      )}
      {...props}
    >
      <ChevronUpIcon
      />
    </SelecionarPrimitive.ScrollUpArrow>
  )
}

function SelecionarScrollDownButton({
  classNome,
  ...props
}: React.ComponentProps<typeof SelecionarPrimitive.ScrollDownArrow>) {
  return (
    <SelecionarPrimitive.ScrollDownArrow
      data-slot="select-scroll-down-button"
      classNome={cn(
        "bottom-0 z-10 flex w-full cursor-default items-center justify-center bg-popover py-1 [&_svg:not([class*='size-'])]:size-4",
        classNome
      )}
      {...props}
    >
      <ChevronDownIcon
      />
    </SelecionarPrimitive.ScrollDownArrow>
  )
}

export {
  Selecionar,
  SelecionarContent,
  SelecionarGroup,
  SelecionarItem,
  SelecionarRótulo,
  SelecionarScrollDownButton,
  SelecionarScrollUpButton,
  SelecionarSeparator,
  SelecionarGatilho,
  SelecionarValor,
}
