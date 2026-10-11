"use client"
import { useCallback, useState, type DragEvent } from "react"

/**
 * Turns an element into a real drag-and-drop target.
 *
 * Every "Drag & drop or click to choose" box on this platform was, until
 * now, just a styled <label> around a hidden <input type="file"> - no
 * onDrop/onDragOver handler existed anywhere, so dropping a file onto one
 * did nothing useful (the browser's default is to navigate away and try to
 * open the file directly, discarding whatever the user was doing on the
 * page). Spread `dropProps` onto the element that should accept the drop;
 * `isDragging` is there to drive a "drop here" highlight if wanted.
 */
export function useFileDrop(
  onFiles: (files: File[]) => void,
  accept?: (file: File) => boolean,
) {
  const [isDragging, setIsDragging] = useState(false)

  const onDragOver = useCallback((e: DragEvent) => {
    e.preventDefault() // the one line that actually enables dropping here
    e.stopPropagation()
    if (!isDragging) setIsDragging(true)
  }, [isDragging])

  const onDragLeave = useCallback((e: DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    // dragleave also fires when the pointer moves over a child node inside
    // the dropzone - only clear the highlight once it has actually left the
    // element itself, or hovering the icon/text inside the box flickers it.
    if (e.currentTarget.contains(e.relatedTarget as Node)) return
    setIsDragging(false)
  }, [])

  const onDrop = useCallback((e: DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
    const dropped = Array.from(e.dataTransfer?.files || [])
    const files = accept ? dropped.filter(accept) : dropped
    if (files.length) onFiles(files)
  }, [onFiles, accept])

  return { isDragging, dropProps: { onDragOver, onDragLeave, onDrop } }
}

export const isPdfFile = (f: File) => f.type === "application/pdf" || /\.pdf$/i.test(f.name)
export const isImageFile = (f: File) => f.type.startsWith("image/")
