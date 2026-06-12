import { useRef, useState } from "react"
import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

type DropzoneProps = {
  accept?: string
  disabled?: boolean
  onFile: (file: File) => void
  className?: string
  children?: ReactNode
}

export function Dropzone({
  accept,
  disabled,
  onFile,
  className,
  children,
}: DropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const dragDepth = useRef(0)

  const openPicker = () => {
    if (!disabled) inputRef.current?.click()
  }

  const handleFiles = (files: FileList | null) => {
    if (files && files.length > 0) onFile(files[0])
  }

  return (
    <div
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-disabled={disabled}
      onClick={openPicker}
      onKeyDown={(e) => {
        if (!disabled && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault()
          openPicker()
        }
      }}
      onDragEnter={(e) => {
        e.preventDefault()
        if (disabled) return
        dragDepth.current += 1
        setIsDragging(true)
      }}
      onDragOver={(e) => e.preventDefault()}
      onDragLeave={(e) => {
        e.preventDefault()
        dragDepth.current -= 1
        if (dragDepth.current <= 0) {
          dragDepth.current = 0
          setIsDragging(false)
        }
      }}
      onDrop={(e) => {
        e.preventDefault()
        if (disabled) return
        dragDepth.current = 0
        setIsDragging(false)
        handleFiles(e.dataTransfer.files)
      }}
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-6 py-12 text-center transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
        disabled
          ? "cursor-not-allowed opacity-60"
          : "cursor-pointer hover:border-primary/50 hover:bg-accent/50",
        isDragging && !disabled && "border-primary bg-accent",
        className
      )}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        disabled={disabled}
        className="hidden"
        onChange={(e) => {
          handleFiles(e.target.files)
          e.target.value = ""
        }}
      />
      {children}
    </div>
  )
}
