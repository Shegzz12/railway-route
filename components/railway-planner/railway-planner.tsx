'use client'

import { useState, useCallback, useEffect, useMemo, useRef } from 'react'
import dynamic from 'next/dynamic'
import { Train, Route, MapPin, RotateCcw, LogOut } from 'lucide-react'
import { DataUploadPanel } from './data-upload-panel'
import { ObstacleSelector } from './obstacle-selector'
import { RouteControls } from './route-controls'
import { RouteStatistics } from './route-statistics'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import type {
  SpatialDataset,
  Coordinates,
  RoutePoint,
  MapMode,
  GeneratedRoute,
  RouteGenerationConfig,
  DEMData,
} from '@/lib/types/spatial-types'
import {
  generateRoute,
  calculateRouteDistance,
  calculateRouteGradients,
  recalculateRouteSegment,
  generateIntervalCoordinates,
  DEFAULT_CONFIG,
} from '@/lib/routing/astar-pathfinder'

// Dynamically import MapView to avoid SSR issues with Leaflet
const MapView = dynamic(
  () => import('./map-view').then((mod) => ({ default: mod.MapView })),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-full min-h-[400px] rounded-lg bg-secondary/30 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">Loading map...</p>
        </div>
      </div>
    ),
  }
)

export function RailwayPlanner() {
  // References
  const mapRef = useRef<HTMLDivElement>(null)

  // State management
  const [datasets, setDatasets] = useState<SpatialDataset[]>([])
  const [startPoint, setStartPoint] = useState<Coordinates | null>(null)
  const [endPoint, setEndPoint] = useState<Coordinates | null>(null)
  const [mapMode, setMapMode] = useState<MapMode>('view')
  const [routeWaypoints, setRouteWaypoints] = useState<RoutePoint[]>([])
  const [selectedWaypointIndex, setSelectedWaypointIndex] = useState<number | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [config, setConfig] = useState<RouteGenerationConfig>(DEFAULT_CONFIG)
  const [generatedRoute, setGeneratedRoute] = useState<GeneratedRoute | null>(null)
  const [showExitDialog, setShowExitDialog] = useState(false)

  // Get DEM data from datasets
  const demData = useMemo(() => {
    const demDataset = datasets.find((d) => d.type === 'dem' && d.data)
    return demDataset?.data as DEMData | null
  }, [datasets])

  // Get obstacle datasets
  const obstacles = useMemo(() => {
    return datasets.filter((d) => d.isObstacle)
  }, [datasets])

  // Dataset management
  const handleDatasetAdd = useCallback((dataset: SpatialDataset) => {
    setDatasets((prev) => [...prev, dataset])
  }, [])

  const handleDatasetRemove = useCallback((id: string) => {
    setDatasets((prev) => prev.filter((d) => d.id !== id))
  }, [])

  const handleToggleObstacle = useCallback((id: string, isObstacle: boolean) => {
    setDatasets((prev) =>
      prev.map((d) => (d.id === id ? { ...d, isObstacle } : d))
    )
  }, [])

  const handleToggleVisibility = useCallback((id: string, visible: boolean) => {
    setDatasets((prev) =>
      prev.map((d) => (d.id === id ? { ...d, visible } : d))
    )
  }, [])

  // Reset project - clear all data
  const handleReset = useCallback(() => {
    setDatasets([])
    setStartPoint(null)
    setEndPoint(null)
    setRouteWaypoints([])
    setGeneratedRoute(null)
    setMapMode('view')
    setConfig(DEFAULT_CONFIG)
  }, [])

  // Exit project with confirmation
  const handleExit = useCallback(() => {
    setShowExitDialog(true)
  }, [])

  const handleConfirmExit = useCallback(() => {
    handleReset()
    setShowExitDialog(false)
    // Page will reload or reset to fresh state
    window.location.reload()
  }, [handleReset])

  // Map click handler
  const handleMapClick = useCallback(
    (coords: Coordinates) => {
      switch (mapMode) {
        case 'set-start':
          setStartPoint(coords)
          setMapMode('view')
          break
        case 'set-end':
          setEndPoint(coords)
          setMapMode('view')
          break
        default:
          break
      }
    },
    [mapMode]
  )

  // Route generation
  const handleGenerateRoute = useCallback(async () => {
    if (!startPoint || !endPoint) return

    setIsGenerating(true)
    setGeneratedRoute(null)

    // Use setTimeout to allow UI to update
    setTimeout(() => {
      try {
        const waypoints = generateRoute(
          startPoint,
          endPoint,
          obstacles,
          demData,
          config
        )

        const distance = calculateRouteDistance(waypoints)
        const { max, avg } = calculateRouteGradients(waypoints)

        // Generate interval coordinates
        const intervalCoordinates = generateIntervalCoordinates(
          waypoints,
          config.coordinateInterval
        )

        setRouteWaypoints(waypoints)

        const route: GeneratedRoute = {
          id: crypto.randomUUID(),
          name: `Route ${new Date().toLocaleTimeString()}`,
          waypoints,
          intervalCoordinates,
          totalDistance: distance,
          maxGradient: max,
          avgGradient: avg,
          isModified: false,
          createdAt: new Date(),
          obstacles: obstacles.map((o) => o.id),
        }

        setGeneratedRoute(route)
        setMapMode('view')
      } catch (error) {
        console.error('Route generation failed:', error)
      } finally {
        setIsGenerating(false)
      }
    }, 100)
  }, [startPoint, endPoint, obstacles, demData, config])

  // Waypoint editing
  const handleWaypointDrag = useCallback(
    (index: number, newPosition: Coordinates) => {
      const updated = recalculateRouteSegment(
        routeWaypoints,
        index,
        newPosition,
        obstacles,
        demData,
        config
      )

      // Only create helper nodes if the dragged node is a YELLOW node (not a helper node)
      const draggedNode = updated[index]
      const withHelperNodes = !draggedNode.isHelperNode ? createHelperNodes(updated, index) : updated
      setRouteWaypoints(withHelperNodes)

      // Update route statistics with new interval coordinates
      if (generatedRoute) {
        // Recalculate interval coordinates after waypoint modification
        const intervalCoordinates = generateIntervalCoordinates(
          withHelperNodes,
          config.coordinateInterval
        )

        const distance = calculateRouteDistance(withHelperNodes)
        const { max, avg } = calculateRouteGradients(withHelperNodes)

        setGeneratedRoute({
          ...generatedRoute,
          waypoints: withHelperNodes,
          intervalCoordinates,
          totalDistance: distance,
          maxGradient: max,
          avgGradient: avg,
          isModified: true,
        })
      }
    },
    [routeWaypoints, obstacles, demData, config, generatedRoute]
  )

  // Create helper nodes for manual curve smoothing (3 before + adjusted + 3 after with exactly 20 helpers)
  const createHelperNodes = (waypoints: RoutePoint[], draggedIndex: number): RoutePoint[] => {
    const result: RoutePoint[] = []
    const allHelpers: RoutePoint[] = []

    // Get 3 nodes before, the adjusted node, and 3 nodes after
    const startIdx = Math.max(0, draggedIndex - 3)
    const endIdx = Math.min(waypoints.length - 1, draggedIndex + 3)

    if (startIdx < draggedIndex && draggedIndex < endIdx) {
      // Collect all waypoints in this range
      const rangeWaypoints = waypoints.slice(startIdx, endIdx + 1)
      
      // Generate exactly 20 helper nodes distributed across this path
      const junctionHelpers = interpolateHelperNodesFixed(rangeWaypoints, draggedIndex - startIdx)
      allHelpers.push(...junctionHelpers)
    }

    // Build result: keep all original waypoints and insert helpers at the right position
    for (let i = 0; i < waypoints.length; i++) {
      result.push(waypoints[i])

      // Insert all helpers after the start of the smoothing range
      if (i === startIdx) {
        result.push(...allHelpers)
      }
    }

    // Re-index all waypoints
    return result.map((wp, idx) => ({ ...wp, index: idx }))
  }

  // Interpolate exactly 20 helper nodes across the waypoint range
  const interpolateHelperNodesFixed = (waypointsInRange: RoutePoint[], draggedRelativeIndex: number): RoutePoint[] => {
    const helpers: RoutePoint[] = []
    const HELPER_COUNT = 20 // Exactly 20 helper nodes

    // Calculate total path length across all waypoints in range
    let totalDistance = 0
    for (let i = 0; i < waypointsInRange.length - 1; i++) {
      const dist = Math.sqrt(
        Math.pow(waypointsInRange[i + 1].lat - waypointsInRange[i].lat, 2) +
        Math.pow(waypointsInRange[i + 1].lng - waypointsInRange[i].lng, 2)
      )
      totalDistance += dist
    }

    // Generate exactly 20 helper nodes
    for (let i = 1; i <= HELPER_COUNT; i++) {
      const t = i / (HELPER_COUNT + 1) // Distribute across 0 to 1

      let lat: number
      let lng: number
      let elevation: number
      let currentDist = t * totalDistance
      let accDist = 0

      // Find which segment this t value falls into
      for (let j = 0; j < waypointsInRange.length - 1; j++) {
        const segmentDist = Math.sqrt(
          Math.pow(waypointsInRange[j + 1].lat - waypointsInRange[j].lat, 2) +
          Math.pow(waypointsInRange[j + 1].lng - waypointsInRange[j].lng, 2)
        )

        if (accDist + segmentDist >= currentDist) {
          // Interpolate within this segment
          const segmentT = (currentDist - accDist) / segmentDist
          lat = waypointsInRange[j].lat + (waypointsInRange[j + 1].lat - waypointsInRange[j].lat) * segmentT
          lng = waypointsInRange[j].lng + (waypointsInRange[j + 1].lng - waypointsInRange[j].lng) * segmentT
          elevation = (waypointsInRange[j].elevation || 0) + ((waypointsInRange[j + 1].elevation || 0) - (waypointsInRange[j].elevation || 0)) * segmentT
          break
        }

        accDist += segmentDist
      }

      helpers.push({
        lat: lat!,
        lng: lng!,
        elevation: elevation!,
        index: i,
        isHelperNode: true,
      })
    }

    return helpers
  }

  const handleWaypointSelect = useCallback((index: number | null) => {
    setSelectedWaypointIndex(index)
  }, [])

  const handleExport = useCallback((format: 'geojson') => {
    // Export handled in RouteStatistics component
  }, [])

  return (
    <div className="flex flex-col h-screen bg-gradient-to-b from-background via-background to-background/95">
      {/* Header with enhanced visual hierarchy */}
      <header className="h-16 border-b border-border/30 px-6 flex items-center justify-between shrink-0 bg-gradient-to-r from-card/60 via-card/40 to-transparent backdrop-blur-md shadow-lg">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center shadow-md">
            <Train className="w-5 h-5 text-primary-foreground" />
          </div>
          <div className="space-y-0.5">
            <h1 className="text-base font-bold text-foreground">Railway Route Planner</h1>
            <p className="text-xs text-muted-foreground">Generate optimal railway routes with spatial analysis</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-3 px-4 py-2 rounded-lg bg-secondary/30 border border-border/30 text-xs">
            <span className="text-foreground/80">{datasets.length} dataset{datasets.length !== 1 ? 's' : ''}</span>
            <span className="text-border/50">•</span>
            <span className="text-foreground/80">{obstacles.length} obstacle{obstacles.length !== 1 ? 's' : ''}</span>
          </div>
          <button 
            onClick={handleReset}
            className="p-2 rounded-lg hover:bg-secondary/50 transition-colors text-muted-foreground hover:text-foreground"
            title="Reset project"
          >
            <RotateCcw className="w-5 h-5" />
          </button>
          <button 
            onClick={handleExit}
            className="p-2 rounded-lg hover:bg-secondary/50 transition-colors text-muted-foreground hover:text-foreground"
            title="Exit project"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden gap-4 p-4">
        {/* Sidebar with improved styling */}
        <aside className="w-96 rounded-xl border border-border/30 flex flex-col shrink-0 overflow-y-auto bg-gradient-to-b from-card/50 via-card/30 to-card/20 backdrop-blur-sm shadow-xl">
          <div className="p-5 space-y-4 divide-y divide-border/20">
            <DataUploadPanel
              datasets={datasets}
              onDatasetAdd={handleDatasetAdd}
              onDatasetRemove={handleDatasetRemove}
            />

            <ObstacleSelector
              datasets={datasets}
              onToggleObstacle={handleToggleObstacle}
              onToggleVisibility={handleToggleVisibility}
            />

            <RouteControls
              startPoint={startPoint}
              endPoint={endPoint}
              mapMode={mapMode}
              isGenerating={isGenerating}
              hasRoute={routeWaypoints.length > 0}
              config={config}
              onSetMode={setMapMode}
              onGenerateRoute={handleGenerateRoute}
              onConfigChange={setConfig}
              onSetStartPoint={setStartPoint}
              onSetEndPoint={setEndPoint}
            />
          </div>
        </aside>

        {/* Map area with improved styling */}
        <main className="flex-1 flex flex-col overflow-hidden rounded-xl border border-border/30 bg-gradient-to-br from-card/20 via-background to-background shadow-xl">
          {generatedRoute ? (
            <>
              <div className="flex-1 overflow-hidden rounded-t-xl" ref={mapRef}>
                <MapView
                  datasets={datasets}
                  startPoint={startPoint}
                  endPoint={endPoint}
                  routeWaypoints={routeWaypoints}
                  intervalCoordinates={generatedRoute?.intervalCoordinates}
                  mapMode={mapMode}
                  selectedWaypointIndex={selectedWaypointIndex}
                  onMapClick={handleMapClick}
                  onWaypointDrag={handleWaypointDrag}
                  onWaypointSelect={handleWaypointSelect}
                />
              </div>

              {/* Route statistics footer with improved styling */}
              <div className="p-4 shrink-0 border-t border-border/30 bg-gradient-to-r from-card/40 to-transparent">
                <RouteStatistics route={generatedRoute} dem={demData} mapRef={mapRef} onExport={handleExport} />
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center p-8">
              <div className="text-center max-w-sm space-y-4">
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary/20 to-primary/10 mx-auto flex items-center justify-center backdrop-blur">
                  <Route className="w-10 h-10 text-primary/60" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-lg font-bold text-foreground">No Route Generated</h3>
                  <p className="text-sm text-muted-foreground">
                    Set your start and end coordinates in the left panel, upload spatial datasets, and click "Generate Route" to visualize the railway path on the map.
                  </p>
                </div>
                <div className="pt-2 text-xs text-muted-foreground space-y-1 bg-secondary/20 rounded-lg p-3 border border-border/30">
                  <p className="font-medium">Quick Start:</p>
                  <ol className="text-left space-y-1">
                    <li>1. Upload GeoTIFF datasets (DEM, slope, etc.)</li>
                    <li>2. Enter start and end coordinates</li>
                    <li>3. Mark obstacles if needed</li>
                    <li>4. Click "Generate Route"</li>
                  </ol>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Exit confirmation dialog */}
      <AlertDialog open={showExitDialog} onOpenChange={setShowExitDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Exit Railway Planner?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to exit? All project data will be cleared and the application will return to its initial state.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex gap-3">
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmExit} className="bg-destructive hover:bg-destructive/90">
              Exit
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
