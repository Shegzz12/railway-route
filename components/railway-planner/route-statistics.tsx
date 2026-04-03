'use client'

import { useState, useEffect } from 'react'
import { Download, BarChart3, TrendingUp, Ruler, MapPin, Image as ImageIcon, Database, ChevronDown, GripVertical } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import type { GeneratedRoute } from '@/lib/types/spatial-types'
import { exportRouteAsGeoJSON } from '@/lib/parsers'

interface RouteStatisticsProps {
  route: GeneratedRoute | null
  dem?: any
  mapRef?: React.RefObject<HTMLDivElement>
  onExport?: (format: string) => void
}

export function RouteStatistics({ route, dem, mapRef, onExport }: RouteStatisticsProps) {
  const [showCoordinates, setShowCoordinates] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [isDragging, setIsDragging] = useState(false)

  // Ensure component is mounted before rendering to avoid hydration mismatch
  useEffect(() => {
    setMounted(true)
  }, [])

  const handleDragStart = () => {
    setIsDragging(true)
  }

  const handleDragEnd = () => {
    setIsDragging(false)
  }

  const handleMouseMove = (e: MouseEvent) => {
    if (isDragging && e.clientY > window.innerHeight - 200) {
      setIsCollapsed(true)
      setIsDragging(false)
    }
  }

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove)
      window.addEventListener('mouseup', handleDragEnd)
      return () => {
        window.removeEventListener('mousemove', handleMouseMove)
        window.removeEventListener('mouseup', handleDragEnd)
      }
    }
  }, [isDragging])

  const handleExportGeoJSON = () => {
    try {
      console.log('[v0] Exporting GeoJSON for route:', route.name)
      const geojson = exportRouteAsGeoJSON(route.waypoints, route.name, {
        totalDistance: route.totalDistance,
        maxGradient: route.maxGradient,
        avgGradient: route.avgGradient,
        waypointCount: route.waypoints.length,
        intervalCoordinates: route.intervalCoordinates,
        createdAt: route.createdAt.toISOString(),
      })

      const blob = new Blob([JSON.stringify(geojson, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const filename = `${route.name.replace(/\s+/g, '-').toLowerCase()}.geojson`
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      console.log('[v0] Downloading file:', filename)
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      console.log('[v0] GeoJSON export completed')
      onExport?.('geojson')
    } catch (error) {
      console.error('[v0] Failed to export GeoJSON:', error)
    }
  }

  const handleExportCSV = () => {
    try {
      console.log('[v0] Exporting CSV with', route.intervalCoordinates?.length || 0, 'coordinates')
      if (!route.intervalCoordinates || route.intervalCoordinates.length === 0) {
        console.warn('[v0] No interval coordinates to export')
        return
      }

      const headers = ['Index', 'Latitude', 'Longitude', 'Distance from Start (km)', 'Elevation (m)']
      const rows = route.intervalCoordinates.map((coord) => [
        coord.index.toString(),
        coord.lat.toFixed(6),
        coord.lng.toFixed(6),
        coord.distanceFromStart.toFixed(2),
        coord.elevation ? coord.elevation.toFixed(2) : 'N/A',
      ])

      const csv = [headers, ...rows].map((row) => row.join(',')).join('\n')
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const filename = `${route.name.replace(/\s+/g, '-').toLowerCase()}-coordinates.csv`
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      console.log('[v0] Downloading CSV:', filename)
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      console.log('[v0] CSV export completed')
      onExport?.('csv')
    } catch (error) {
      console.error('[v0] Failed to export CSV:', error)
    }
  }

  const handleExportPNG = async () => {
    if (!mapRef?.current) return
    
    try {
      setIsExporting(true)
      
      // Create a canvas to draw the map
      const mapElement = mapRef.current
      const rect = mapElement.getBoundingClientRect()
      const canvas = document.createElement('canvas')
      canvas.width = rect.width * 2
      canvas.height = rect.height * 2
      const ctx = canvas.getContext('2d')
      
      if (!ctx) throw new Error('Canvas context not available')
      
      // Fill background
      ctx.fillStyle = '#1a1a2e'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      
      // Try to capture any canvas elements (Leaflet tiles)
      const canvases = mapElement.querySelectorAll('canvas')
      canvases.forEach((c: HTMLCanvasElement) => {
        try {
          const cRect = c.getBoundingClientRect()
          const x = (cRect.left - rect.left) * 2
          const y = (cRect.top - rect.top) * 2
          ctx.drawImage(c, x, y, c.width * 2, c.height * 2)
        } catch (e) {
          // CORS issue with tile, skip
        }
      })
      
      // Draw route info on canvas
      ctx.fillStyle = '#ffffff'
      ctx.font = '24px sans-serif'
      ctx.fillText(`Route: ${route.name}`, 20, 40)
      ctx.font = '18px sans-serif'
      ctx.fillText(`Distance: ${route.totalDistance.toFixed(2)} km`, 20, 70)
      ctx.fillText(`Waypoints: ${route.intervalCoordinates?.length || 0}`, 20, 95)
      
      // Download
      const link = document.createElement('a')
      link.href = canvas.toDataURL('image/png')
      link.download = `${route.name.replace(/\s+/g, '-').toLowerCase()}-map.png`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      onExport?.('png')
    } catch (error) {
      console.error('PNG export failed:', error)
      alert('PNG export failed. Please try again or use GeoJSON/CSV export.')
    } finally {
      setIsExporting(false)
    }
  }

  const handleExportGeoTIFF = () => {
    try {
      if (!dem) return
      const bounds = dem.bounds || [0, 0, 1, 1]
      const header = new ArrayBuffer(64)
      const view = new DataView(header)

      view.setUint16(0, 0x4949, true)
      view.setUint16(2, 42, true)

      view.setFloat64(8, bounds[0], true)
      view.setFloat64(16, bounds[1], true)
      view.setFloat64(24, bounds[2], true)
      view.setFloat64(32, bounds[3], true)
      view.setUint32(40, dem.width || 0, true)
      view.setUint32(44, dem.height || 0, true)

      const elevationData = dem.elevation || new Float32Array(0)
      const elevationBuffer = new ArrayBuffer(elevationData.byteLength)
      new Float32Array(elevationBuffer).set(elevationData)

      const blob = new Blob([header, elevationBuffer], { type: 'image/tiff' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${route.name.replace(/\s+/g, '-').toLowerCase()}.tif`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      onExport?.('tif')
    } catch (error) {
      console.error('Failed to export GeoTIFF:', error)
    }
  }

  if (!route || !mounted) return null

  return (
    <div className="flex flex-col">
      {/* Draggable Handle - Always visible */}
      <div
        onMouseDown={handleDragStart}
        className="h-1 bg-gradient-to-r from-primary/0 via-primary/50 to-primary/0 cursor-grab active:cursor-grabbing hover:h-1.5 transition-all"
        title="Drag down to collapse panel"
      />
      
      {/* Collapsible Panel */}
      {!isCollapsed && (
        <Card className="border-border/50 bg-gradient-to-r from-card via-card to-card/80 backdrop-blur-md shadow-lg rounded-t-none">
          <CardContent className="p-4">
            {/* Header with Collapse Button */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-primary/10">
                  <BarChart3 className="w-4 h-4 text-primary" />
                </div>
                <span className="text-sm font-semibold">Route Statistics & Export</span>
              </div>
              <button
                onClick={() => setIsCollapsed(true)}
                className="p-1 hover:bg-secondary/50 rounded transition-colors"
                title="Collapse panel"
              >
                <ChevronDown className="w-4 h-4 text-muted-foreground rotate-180" />
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
            <Button
              size="sm"
              variant="outline"
              onClick={handleExportGeoJSON}
              className="h-8 text-xs hover:bg-primary/10 hover:text-primary transition-colors"
            >
              <Download className="w-3 h-3 mr-1" />
              GeoJSON
            </Button>

            {route.intervalCoordinates && route.intervalCoordinates.length > 0 && (
              <Button
                size="sm"
                variant="outline"
                onClick={handleExportCSV}
                className="h-8 text-xs hover:bg-primary/10 hover:text-primary transition-colors"
              >
                <Download className="w-3 h-3 mr-1" />
                CSV
              </Button>
            )}

            <Button
              size="sm"
              variant="outline"
              onClick={handleExportPNG}
              disabled={!mapRef?.current || isExporting}
              className="h-8 text-xs hover:bg-primary/10 hover:text-primary transition-colors"
            >
              <ImageIcon className="w-3 h-3 mr-1" />
              {isExporting ? 'PNG...' : 'PNG'}
            </Button>

            {dem && (
              <Button
                size="sm"
                variant="outline"
                onClick={handleExportGeoTIFF}
                className="h-8 text-xs hover:bg-primary/10 hover:text-primary transition-colors"
              >
                <Database className="w-3 h-3 mr-1" />
                TIFF
              </Button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4 p-3 rounded-lg bg-secondary/30 border border-border/30">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-1.5">
              <Ruler className="w-3 h-3 text-blue-400" />
              <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Distance</span>
            </div>
            <p className="text-base font-bold text-primary">
              {route.totalDistance.toFixed(2)} <span className="text-xs font-normal text-muted-foreground">km</span>
            </p>
          </div>

          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-1.5">
              <TrendingUp className="w-3 h-3 text-amber-400" />
              <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Max Grade</span>
            </div>
            <p className="text-base font-bold text-amber-400">
              {route.maxGradient.toFixed(1)} <span className="text-xs font-normal text-muted-foreground">%</span>
            </p>
          </div>

          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-1.5">
              <TrendingUp className="w-3 h-3 text-emerald-400" />
              <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Avg Grade</span>
            </div>
            <p className="text-base font-bold text-emerald-400">
              {route.avgGradient.toFixed(1)} <span className="text-xs font-normal text-muted-foreground">%</span>
            </p>
          </div>

          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-1.5">
              <MapPin className="w-3 h-3 text-cyan-400" />
              <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Waypoints</span>
            </div>
            <p className="text-base font-bold text-cyan-400">{route.waypoints.length}</p>
          </div>
        </div>

        {route.isModified && (
          <div className="mb-3 p-2 rounded-lg bg-amber-400/10 border border-amber-400/30 text-[11px] text-amber-400">
            Route has been manually adjusted
          </div>
        )}

        {route.intervalCoordinates && route.intervalCoordinates.length > 0 && (
          <div className="border-t border-border/30 pt-3">
            <button
              onClick={() => setShowCoordinates(!showCoordinates)}
              className="flex items-center gap-2 w-full p-2.5 rounded-lg hover:bg-secondary/50 transition-colors group"
            >
              <ChevronDown
                className={`w-4 h-4 text-muted-foreground transition-transform group-hover:text-primary ${
                  showCoordinates ? 'rotate-180' : ''
                }`}
              />
              <span className="text-xs font-semibold text-muted-foreground group-hover:text-foreground">
                Route Coordinates ({route.intervalCoordinates.length})
              </span>
            </button>

            {showCoordinates && (
              <div className="mt-2 max-h-48 overflow-y-auto border border-border/30 rounded-lg bg-secondary/20 shadow-inner">
                <table className="w-full text-[10px]">
                  <thead className="sticky top-0 bg-secondary/50 border-b border-border/30">
                    <tr>
                      <th className="px-2 py-1.5 text-left font-semibold text-muted-foreground">#</th>
                      <th className="px-2 py-1.5 text-left font-semibold text-muted-foreground">Latitude</th>
                      <th className="px-2 py-1.5 text-left font-semibold text-muted-foreground">Longitude</th>
                      <th className="px-2 py-1.5 text-left font-semibold text-muted-foreground">Dist (km)</th>
                      <th className="px-2 py-1.5 text-left font-semibold text-muted-foreground">Elev (m)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {route.intervalCoordinates.map((coord) => (
                      <tr
                        key={coord.index}
                        className="border-b border-border/20 hover:bg-secondary/40 transition-colors"
                      >
                        <td className="px-2 py-1.5 text-foreground/70 font-medium">{coord.index}</td>
                        <td className="px-2 py-1.5 font-mono text-cyan-400/80">{coord.lat.toFixed(6)}</td>
                        <td className="px-2 py-1.5 font-mono text-cyan-400/80">{coord.lng.toFixed(6)}</td>
                        <td className="px-2 py-1.5 text-primary font-semibold">{coord.distanceFromStart.toFixed(2)}</td>
                        <td className="px-2 py-1.5 text-emerald-400/80">
                          {coord.elevation ? coord.elevation.toFixed(0) : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
      )}

      {/* Expand Button - When Collapsed */}
      {isCollapsed && (
        <div className="flex items-center justify-between p-3 bg-gradient-to-r from-card via-card to-card/80 rounded-lg shadow-lg cursor-pointer hover:shadow-xl transition-shadow" onClick={() => setIsCollapsed(false)}>
          <div className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-primary" />
            <span className="text-sm font-semibold text-muted-foreground">Route Statistics & Export</span>
          </div>
          <ChevronDown className="w-4 h-4 text-muted-foreground" />
        </div>
      )}
    </div>
  )
}
