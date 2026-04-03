'use client'

import dynamic from 'next/dynamic'
import { Suspense } from 'react'
import type {
  Coordinates,
  RoutePoint,
  SpatialDataset,
  MapMode,
  IntervalCoordinate,
  DEMData,
} from '@/lib/types/spatial-types'

interface MapViewProps {
  datasets: SpatialDataset[]
  startPoint: Coordinates | null
  endPoint: Coordinates | null
  routeWaypoints: RoutePoint[]
  intervalCoordinates?: IntervalCoordinate[]
  mapMode: MapMode
  selectedWaypointIndex: number | null
  onMapClick: (coords: Coordinates) => void
  onWaypointDrag: (index: number, newPosition: Coordinates) => void
  onWaypointSelect: (index: number | null) => void
}

// Dynamically import the actual map component
const MapViewContent = dynamic(() => import('./map-view-content'), {
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-secondary/20 rounded-lg">
      <div className="text-sm text-muted-foreground">Loading map...</div>
    </div>
  ),
  ssr: false,
})

export function MapView(props: MapViewProps) {
  return (
    <Suspense
      fallback={
        <div className="w-full h-full flex items-center justify-center bg-secondary/20 rounded-lg">
          <div className="text-sm text-muted-foreground">Loading map...</div>
        </div>
      }
    >
      <MapViewContent {...props} />
    </Suspense>
  )
}
