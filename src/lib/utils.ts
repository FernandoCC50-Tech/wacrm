import { clsx, type ClassValor } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValor[]) {
  return twMerge(clsx(inputs))
}
