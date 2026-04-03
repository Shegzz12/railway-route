'use client'

import { useState, useCallback } from 'react'
import { Upload, FileIcon, X, AlertCircle, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import type { SpatialDataset, UploadState } from '@/lib/types/spatial-types'
import { parseFile } from '@/lib/parsers'

interface DataUploadPanelProps {
  datasets: SpatialDataset[]
  onDatasetAdd: (dataset: SpatialDataset) => void
  onDatasetRemove: (id: string) => void
}

const FILE_TYPE_LABELS: Record<string, string> = {
  geojson: 'GeoJSON',
  csv: 'CSV',
  dem: 'DEM',
  shapefile: 'Shapefile',
}

const FILE_TYPE_COLORS: Record<string, string> = {
  geojson: 'bg-blue-500/20 text-blue-400',
  csv: 'bg-green-500/20 text-green-400',
  dem: 'bg-amber-500/20 text-amber-400',
  shapefile: 'bg-purple-500/20 text-purple-400',
}

export function DataUploadPanel({
  datasets,
  onDatasetAdd,
  onDatasetRemove,
}: DataUploadPanelProps) {
  const [uploadState, setUploadState] = useState<UploadState>({
    isUploading: false,
    progress: 0,
    error: null,
  })
  const [isDragging, setIsDragging] = useState(false)

  const handleFiles = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0) return

      setUploadState({ isUploading: true, progress: 0, error: null })

      const totalFiles = files.length
      let processedFiles = 0

      for (const file of Array.from(files)) {
        try {
          const dataset = await parseFile(file)
          onDatasetAdd(dataset)
          processedFiles++
          setUploadState((prev) => ({
            ...prev,
            progress: (processedFiles / totalFiles) * 100,
          }))
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Unknown error'
          setUploadState((prev) => ({
            ...prev,
            error: `Failed to parse ${file.name}: ${message}`,
          }))
        }
      }

      setUploadState((prev) => ({ ...prev, isUploading: false }))
    },
    [onDatasetAdd]
  )

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setIsDragging(false)
      handleFiles(e.dataTransfer.files)
    },
    [handleFiles]
  )

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      handleFiles(e.target.files)
      e.target.value = ''
    },
    [handleFiles]
  )

  return (
    <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Upload className="w-4 h-4" />
          Spatial Data
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Drop zone */}
        <div
          className={`
            relative border-2 border-dashed rounded-lg p-4 text-center transition-colors
            ${isDragging 
              ? 'border-primary bg-primary/5' 
              : 'border-border hover:border-primary/50'
            }
          `}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <input
            type="file"
            multiple
            accept=".json,.geojson,.csv,.tif,.tiff,.zip"
            onChange={handleInputChange}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            disabled={uploadState.isUploading}
          />
          
          {uploadState.isUploading ? (
            <div className="py-2">
              <Loader2 className="w-6 h-6 mx-auto animate-spin text-muted-foreground" />
              <p className="text-xs text-muted-foreground mt-2">
                Processing... {uploadState.progress.toFixed(0)}%
              </p>
            </div>
          ) : (
            <>
              <Upload className="w-6 h-6 mx-auto text-muted-foreground mb-2" />
              <p className="text-xs text-muted-foreground">
                Drop files or click to upload
              </p>
              <p className="text-[10px] text-muted-foreground/70 mt-1">
                GeoJSON, CSV, GeoTIFF, Shapefile (ZIP)
              </p>
            </>
          )}
        </div>

        {/* Error message */}
        {uploadState.error && (
          <div className="flex items-start gap-2 p-2 rounded-md bg-destructive/10 text-destructive text-xs">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{uploadState.error}</span>
          </div>
        )}

        {/* Dataset list */}
        {datasets.length > 0 && (
          <ScrollArea className="h-[180px]">
            <div className="space-y-2">
              {datasets.map((dataset) => (
                <div
                  key={dataset.id}
                  className="flex items-center gap-2 p-2 rounded-md bg-secondary/50 group"
                >
                  <div
                    className="w-3 h-3 rounded-full shrink-0"
                    style={{ backgroundColor: dataset.color }}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">{dataset.name}</p>
                    <div className="flex items-center gap-1">
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded ${
                          FILE_TYPE_COLORS[dataset.type] || 'bg-secondary'
                        }`}
                      >
                        {FILE_TYPE_LABELS[dataset.type] || dataset.type}
                      </span>
                      {dataset.isObstacle && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/20 text-red-400">
                          Obstacle
                        </span>
                      )}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => onDatasetRemove(dataset.id)}
                  >
                    <X className="w-3 h-3" />
                    <span className="sr-only">Remove dataset</span>
                  </Button>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}

        {datasets.length === 0 && !uploadState.isUploading && (
          <div className="flex items-center justify-center p-4 text-xs text-muted-foreground">
            <FileIcon className="w-4 h-4 mr-2" />
            No datasets loaded
          </div>
        )}
      </CardContent>
    </Card>
  )
}
