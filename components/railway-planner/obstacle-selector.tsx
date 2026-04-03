'use client'

import { ShieldAlert, Eye, EyeOff } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Button } from '@/components/ui/button'
import type { SpatialDataset } from '@/lib/types/spatial-types'

interface ObstacleSelectorProps {
  datasets: SpatialDataset[]
  onToggleObstacle: (id: string, isObstacle: boolean) => void
  onToggleVisibility: (id: string, visible: boolean) => void
}

export function ObstacleSelector({
  datasets,
  onToggleObstacle,
  onToggleVisibility,
}: ObstacleSelectorProps) {
  const obstacleCount = datasets.filter((d) => d.isObstacle).length

  return (
    <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center justify-between">
          <span className="flex items-center gap-2">
            <ShieldAlert className="w-4 h-4" />
            Layers & Obstacles
          </span>
          {obstacleCount > 0 && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/20 text-red-400">
              {obstacleCount} obstacle{obstacleCount !== 1 ? 's' : ''}
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {datasets.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-4">
            Upload datasets to mark as obstacles
          </p>
        ) : (
          <ScrollArea className="h-[200px]">
            <div className="space-y-3">
              {datasets.map((dataset) => (
                <div
                  key={dataset.id}
                  className={`
                    p-3 rounded-lg border transition-colors
                    ${dataset.isObstacle 
                      ? 'border-red-500/50 bg-red-500/10' 
                      : 'border-border/50 bg-secondary/30'
                    }
                  `}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className="w-4 h-4 rounded shrink-0 mt-0.5"
                      style={{ 
                        backgroundColor: dataset.isObstacle ? '#ef4444' : dataset.color 
                      }}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{dataset.name}</p>
                      <p className="text-[10px] text-muted-foreground capitalize">
                        {dataset.type === 'dem' ? 'Elevation Data' : dataset.type}
                      </p>
                      {dataset.type === 'dem' && dataset.isObstacle && (
                        <p className="text-[9px] text-amber-400 mt-1">
                          Used as cost layer in routing (slope, drainage, LULC)
                        </p>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 shrink-0"
                      onClick={() => onToggleVisibility(dataset.id, !dataset.visible)}
                    >
                      {dataset.visible ? (
                        <Eye className="w-4 h-4" />
                      ) : (
                        <EyeOff className="w-4 h-4 text-muted-foreground" />
                      )}
                      <span className="sr-only">
                        {dataset.visible ? 'Hide' : 'Show'} layer
                      </span>
                    </Button>
                  </div>
                  
                  <div className="flex items-center justify-between mt-3 pt-3 border-t border-border/30">
                    <Label
                      htmlFor={`obstacle-${dataset.id}`}
                      className="text-xs cursor-pointer"
                    >
                      Mark as obstacle
                    </Label>
                    <Switch
                      id={`obstacle-${dataset.id}`}
                      checked={dataset.isObstacle}
                      onCheckedChange={(checked) => onToggleObstacle(dataset.id, checked)}
                    />
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}

        {datasets.length > 0 && (
          <div className="mt-3 pt-3 border-t border-border/30">
            <p className="text-[10px] text-muted-foreground mb-2">
              <strong>How it works:</strong> Toggle datasets as obstacles to avoid them. 
              For raster data (GeoTIFF):
            </p>
            <ul className="text-[9px] text-muted-foreground space-y-1 ml-2">
              <li>• <strong>DEM</strong>: Used for elevation and gradient calculation</li>
              <li>• <strong>Slope</strong>: Increases cost on steep terrain</li>
              <li>• <strong>Drainage</strong>: Avoids water-prone areas</li>
              <li>• <strong>LULC</strong>: Considers land use costs</li>
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
