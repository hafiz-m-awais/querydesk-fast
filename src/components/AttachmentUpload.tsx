'use client'

import { useState, useCallback } from 'react'
import { Upload, X, FileText, Image } from 'lucide-react'
import { ALLOWED_ATTACHMENT_MIMES, MAX_ATTACHMENT_MB } from '@/lib/constants'
import { cn } from '@/lib/utils'
import type { AttachmentPayload } from '@/types'

interface AttachmentUploadProps {
  value: AttachmentPayload | null
  onChange: (value: AttachmentPayload | null) => void
  className?: string
}

export default function AttachmentUpload({ value, onChange, className }: AttachmentUploadProps) {
  const [error, setError] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)

  const processFile = useCallback((file: File) => {
    setError(null)
    if (!ALLOWED_ATTACHMENT_MIMES.includes(file.type)) {
      setError('File type not allowed. Use PDF, image, Word, or plain text.')
      return
    }
    if (file.size > MAX_ATTACHMENT_MB * 1024 * 1024) {
      setError(`File must be under ${MAX_ATTACHMENT_MB} MB.`)
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      const base64 = (reader.result as string).split(',')[1]
      onChange({ name: file.name, mime: file.type, data: base64, size: file.size })
    }
    reader.readAsDataURL(file)
  }, [onChange])

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) processFile(file)
  }, [processFile])

  const isImage = value?.mime.startsWith('image/')

  return (
    <div className={cn('space-y-2', className)}>
      {value ? (
        <div className="flex items-center gap-3 rounded-md border bg-muted/30 p-3">
          {isImage ? <Image className="h-5 w-5 text-blue-500 shrink-0" /> : <FileText className="h-5 w-5 text-primary shrink-0" />}
          <span className="flex-1 truncate text-sm">{value.name}</span>
          <span className="text-xs text-muted-foreground">{(value.size / 1024).toFixed(1)} KB</span>
          <button type="button" onClick={() => onChange(null)} className="text-muted-foreground hover:text-destructive">
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <label
          className={cn(
            'flex cursor-pointer flex-col items-center gap-2 rounded-md border-2 border-dashed p-6 text-center transition-colors',
            dragging ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-primary/50',
          )}
          onDragOver={e => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
        >
          <Upload className="h-8 w-8 text-muted-foreground" />
          <div>
            <p className="text-sm font-medium">Drop file here or click to browse</p>
            <p className="text-xs text-muted-foreground">PDF, image, Word, TXT · Max {MAX_ATTACHMENT_MB} MB</p>
          </div>
          <input
            type="file"
            className="sr-only"
            accept={ALLOWED_ATTACHMENT_MIMES.join(',')}
            onChange={e => { const f = e.target.files?.[0]; if (f) processFile(f) }}
          />
        </label>
      )}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}
