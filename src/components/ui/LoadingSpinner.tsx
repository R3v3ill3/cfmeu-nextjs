"use client"

import Image from "next/image"
import { cn } from "@/lib/utils"

type LoadingSpinnerProps = {
  className?: string
  size?: number
  alt?: string
}

export function LoadingSpinner({ className, size = 16, alt = "Loading" }: LoadingSpinnerProps) {
  return (
    <Image
      src="/spinner.gif"
      alt={alt}
      width={size}
      height={size}
      unoptimized
      className={cn(className)}
    />
  )
}

