"use client"

import { useState, useRef, useCallback, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Camera, Upload, X, Image as ImageIcon } from 'lucide-react'
import { useHapticFeedback } from '@/components/mobile/shared/HapticFeedback'

interface PhotoData {
  url: string
  description?: string
  timestamp: string
}

interface MobileCameraCaptureProps {
  onPhotoCaptured: (photo: PhotoData) => void
  className?: string
  maxSizeMB?: number
  acceptedFormats?: string[]
}

export function MobileCameraCapture({
  onPhotoCaptured,
  className = "",
  maxSizeMB = 10,
  acceptedFormats = ['image/jpeg', 'image/png', 'image/webp']
}: MobileCameraCaptureProps) {
  const [capturing, setCapturing] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [description, setDescription] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { trigger, success } = useHapticFeedback()

  const handleFileSelect = useCallback(async (file: File) => {
    setProcessing(true)

    try {
      // Validate file size
      if (file.size > maxSizeMB * 1024 * 1024) {
        throw new Error(`File size must be less than ${maxSizeMB}MB`)
      }

      // Validate file type
      if (!acceptedFormats.includes(file.type)) {
        throw new Error('Invalid file format')
      }

      // Create object URL for preview
      const url = URL.createObjectURL(file)

      // Compress image if needed
      const compressedUrl = await compressImage(file, maxSizeMB)

      const photoData: PhotoData = {
        url: compressedUrl,
        description: description.trim() || undefined,
        timestamp: new Date().toISOString()
      }

      onPhotoCaptured(photoData)
      success()
      setDescription('')

      // Clean up object URLs
      if (url !== compressedUrl) {
        URL.revokeObjectURL(url)
      }
    } catch (error) {
      console.error('Error processing photo:', error)
      // You might want to show a toast error here
    } finally {
      setProcessing(false)
      setCapturing(false)
    }
  }, [description, maxSizeMB, acceptedFormats, onPhotoCaptured, success])

  const handleCameraCapture = useCallback(async () => {
    // Prefer camera, fallback to file picker
    try {
      // Try to access camera directly
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment',
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        }
      })

      // Create video element for capture
      const video = document.createElement('video')
      video.srcObject = stream
      video.play()

      // Wait for video to be ready
      await new Promise((resolve) => {
        video.onloadedmetadata = resolve
      })

      // Create canvas for capture
      const canvas = document.createElement('canvas')
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight

      const context = canvas.getContext('2d')!
      context.drawImage(video, 0, 0)

      // Convert to blob
      canvas.toBlob(async (blob) => {
        if (blob) {
          const file = new File([blob], `capture-${Date.now()}.jpg`, { type: 'image/jpeg' })
          await handleFileSelect(file)
        }

        // Stop camera stream
        stream.getTracks().forEach(track => track.stop())
      }, 'image/jpeg', 0.8)

    } catch (error) {
      // Fallback to file picker if camera access fails
      console.log('Camera access failed, falling back to file picker')
      fileInputRef.current?.click()
    }
  }, [handleFileSelect])

  const handleFileInputChange = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      await handleFileSelect(file)
    }

    // Reset input value to allow selecting the same file again
    if (event.target) {
      event.target.value = ''
    }
  }, [handleFileSelect])

  const compressImage = useCallback(async (file: File, maxSizeMB: number): Promise<string> => {
    return new Promise((resolve) => {
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')!
      const img = new Image()

      img.onload = () => {
        // Calculate new dimensions if needed
        let { width, height } = img
        const maxDimension = 1920

        if (width > maxDimension || height > maxDimension) {
          const ratio = Math.min(maxDimension / width, maxDimension / height)
          width *= ratio
          height *= ratio
        }

        canvas.width = width
        canvas.height = height

        // Draw and compress
        ctx.drawImage(img, 0, 0, width, height)

        // Try different quality levels until file size is acceptable
        let quality = 0.8
        const tryCompress = () => {
          canvas.toBlob((blob) => {
            if (!blob) {
              resolve(URL.createObjectURL(file))
              return
            }

            if (blob.size <= maxSizeMB * 1024 * 1024 || quality <= 0.1) {
              resolve(URL.createObjectURL(blob))
            } else {
              quality -= 0.1
              tryCompress()
            }
          }, 'image/jpeg', quality)
        }

        tryCompress()
      }

      img.src = URL.createObjectURL(file)
    })
  }, [maxSizeMB])

  // Use useMemo to generate stable ID to prevent hydration mismatch
  const inputId = useMemo(() => `photo-desc-${Date.now()}`, [])

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Description input */}
      <div>
        <Label htmlFor={inputId} className="text-sm font-medium">
          Photo Description (optional)
        </Label>
        <Input
          id={inputId}
          placeholder="Describe what this photo shows..."
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="mt-1 h-10"
        />
      </div>

      {/* Capture buttons */}
      <div className="flex gap-2">
        <Button
          type="button"
          onClick={() => {
            trigger()
            setCapturing(true)
            handleCameraCapture()
          }}
          disabled={processing}
          className="flex-1 h-12"
        >
          {processing ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
              Processing...
            </>
          ) : (
            <>
              <Camera className="h-4 w-4 mr-2" />
              Take Photo
            </>
          )}
        </Button>

        <Button
          type="button"
          variant="outline"
          onClick={() => {
            trigger()
            fileInputRef.current?.click()
          }}
          disabled={processing}
          className="h-12"
        >
          <Upload className="h-4 w-4" />
        </Button>
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept={acceptedFormats.join(',')}
        capture="environment"
        onChange={handleFileInputChange}
        className="hidden"
      />

      {/* Instructions */}
      <div className="text-xs text-muted-foreground space-y-1">
        <p>• Tap "Take Photo" to use your camera</p>
        <p>• Tap the upload icon to choose from gallery</p>
        <p>• Maximum file size: {maxSizeMB}MB</p>
        <p>• Supported formats: JPEG, PNG, WebP</p>
      </div>
    </div>
  )
}

// Helper component for displaying captured photos
interface PhotoThumbnailProps {
  photo: PhotoData
  onRemove?: () => void
  className?: string
}

export function PhotoThumbnail({ photo, onRemove, className = "" }: PhotoThumbnailProps) {
  const [imageError, setImageError] = useState(false)

  return (
    <div className={`relative group ${className}`}>
      {!imageError ? (
        <img
          src={photo.url}
          alt={photo.description || 'Site photo'}
          className="w-full h-32 object-cover rounded-lg border"
          onError={() => setImageError(true)}
        />
      ) : (
        <div className="w-full h-32 bg-gray-100 rounded-lg border flex items-center justify-center">
          <ImageIcon className="h-8 w-8 text-gray-400" />
        </div>
      )}

      {photo.description && (
        <p className="text-xs text-muted-foreground mt-1 truncate px-1">
          {photo.description}
        </p>
      )}

      {onRemove && (
        <Button
          type="button"
          variant="destructive"
          size="icon"
          onClick={onRemove}
          className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <X className="h-3 w-3" />
        </Button>
      )}

      <div className="absolute bottom-1 left-1 bg-black/50 text-white text-xs px-1.5 py-0.5 rounded">
        {new Date(photo.timestamp).toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit'
        })}
      </div>
    </div>
  )
}