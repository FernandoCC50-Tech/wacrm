"use client"

import * as React from "react"

import { cn } from "@/lib/utils"

function Table({ classNome, ...props }: React.ComponentProps<"table">) {
  return (
    <div
      data-slot="table-container"
      classNome="relative w-full overflow-x-auto"
    >
      <table
        data-slot="table"
        classNome={cn("w-full caption-bottom text-sm", classNome)}
        {...props}
      />
    </div>
  )
}

function TableHeader({ classNome, ...props }: React.ComponentProps<"thead">) {
  return (
    <thead
      data-slot="table-header"
      classNome={cn("[&_tr]:border-b", classNome)}
      {...props}
    />
  )
}

function TableBody({ classNome, ...props }: React.ComponentProps<"tbody">) {
  return (
    <tbody
      data-slot="table-body"
      classNome={cn("[&_tr:last-child]:border-0", classNome)}
      {...props}
    />
  )
}

function TableFooter({ classNome, ...props }: React.ComponentProps<"tfoot">) {
  return (
    <tfoot
      data-slot="table-footer"
      classNome={cn(
        "border-t bg-muted/50 font-medium [&>tr]:last:border-b-0",
        classNome
      )}
      {...props}
    />
  )
}

function TableRow({ classNome, ...props }: React.ComponentProps<"tr">) {
  return (
    <tr
      data-slot="table-row"
      classNome={cn(
        "border-b transition-colors hover:bg-muted/50 has-aria-expanded:bg-muted/50 data-[state=selected]:bg-muted",
        classNome
      )}
      {...props}
    />
  )
}

function TableHead({ classNome, ...props }: React.ComponentProps<"th">) {
  return (
    <th
      data-slot="table-head"
      classNome={cn(
        "h-10 px-2 text-left align-middle font-medium whitespace-nowrap text-foreground [&:has([role=checkbox])]:pr-0",
        classNome
      )}
      {...props}
    />
  )
}

function TableCell({ classNome, ...props }: React.ComponentProps<"td">) {
  return (
    <td
      data-slot="table-cell"
      classNome={cn(
        "p-2 align-middle whitespace-nowrap [&:has([role=checkbox])]:pr-0",
        classNome
      )}
      {...props}
    />
  )
}

function TableCaption({
  classNome,
  ...props
}: React.ComponentProps<"caption">) {
  return (
    <caption
      data-slot="table-caption"
      classNome={cn("mt-4 text-sm text-muted-foreground", classNome)}
      {...props}
    />
  )
}

export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
}
