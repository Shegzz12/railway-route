'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import 'leaflet/dist/leaflet.css'
import type { RoutePoint, Coordinates, IntervalCoordinate } from '@/lib/types/spatial-types'

interface MapViewContentProps {
  datasets: any[]
  startPoint: Coordinates | null
  endPoint: Coordinates | null
  routeWaypoints: RoutePoint[]
  intervalCoordinates?: IntervalCoordinate[]
  mapMode: string
  selectedWaypointIndex: number | null
  onMapClick: (coords: Coordinates) => void
  onWaypointDrag: (index: number, newPosition: Coordinates) => void
  onWaypointSelect: (index: number | null) => void
}

// Map component for railway route visualization
export default function MapViewContent(props: MapViewContentProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<any>(null)
  const LRef = useRef<any>(null)
  const [mapReady, setMapReady] = useState(false)

  useEffect(() => {
    if (mapRef.current) return
    if (!containerRef.current) return
    if ((containerRef.current as any)?._leaflet_id) return

    let mounted = true

    const init = async () => {
      try {
        const L = await import('leaflet').then(m => m.default)
        if (!mounted || !containerRef.current) return

        LRef.current = L

        delete (L.Icon.Default.prototype as any)._getIconUrl
        L.Icon.Default.mergeOptions({
          iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
          iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
          shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
        })

        const map = L.map(containerRef.current, { center: [20, 0], zoom: 2 })
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '&copy; OpenStreetMap',
          maxZoom: 19,
        }).addTo(map)

        mapRef.current = map
        setMapReady(true)
      } catch (e) {
        console.error('Map init failed:', e)
      }
    }

    init()
    return () => { mounted = false }
  }, [])

  useEffect(() => {
    if (!mapReady || !mapRef.current || !LRef.current) return
    if (props.routeWaypoints.length < 2) return

    const L = LRef.current
    const map = mapRef.current
    const isEditMode = props.mapMode === 'edit-route'

    // Remove existing route layers
    map.eachLayer((layer: any) => {
      if (layer instanceof L.Polyline || layer instanceof L.CircleMarker || layer instanceof L.Marker) {
        map.removeLayer(layer)
      }
    })

    const latLngs = props.routeWaypoints.map((wp: RoutePoint) => [wp.lat, wp.lng])
    
    // Draw route line (dashed in edit mode)
    L.polyline(latLngs, { 
      color: '#3b82f6', 
      weight: 4, 
      opacity: 0.8,
      dashArray: isEditMode ? '10, 5' : undefined
    }).addTo(map)

    // In edit mode, add draggable markers at intervals
    if (isEditMode) {
      const step = Math.max(1, Math.floor(props.routeWaypoints.filter(wp => !wp.isHelperNode).length / 15))
      
      for (let i = 0; i < props.routeWaypoints.length; i++) {
        const wp = props.routeWaypoints[i]
        const isHelper = wp.isHelperNode
        const isEndNode = i === 0 || i === props.routeWaypoints.length - 1
        
        // Always show helper nodes and end nodes
        // For regular nodes, only show every 'step' nodes
        if (!isHelper && !isEndNode) {
          const nonHelperIndex = props.routeWaypoints.filter((w, idx) => idx <= i && !w.isHelperNode).length - 1
          if (nonHelperIndex % step !== 0) continue
        }
        
        const marker = L.marker([wp.lat, wp.lng], {
          draggable: true,
          icon: L.divIcon({
            className: isHelper ? 'helper-node-marker' : 'custom-drag-marker',
            html: isHelper 
              ? `<div style="width:8px;height:8px;background:#ec4899;border:1.5px solid white;border-radius:50%;cursor:grab;opacity:0.8;"></div>`
              : `<div style="width:12px;height:12px;background:#f59e0b;border:2px solid white;border-radius:50%;cursor:grab;"></div>`,
            iconSize: isHelper ? [8, 8] : [12, 12],
            iconAnchor: isHelper ? [4, 4] : [6, 6],
          })
        })
        
        // Capture the current index and handler in closure
        marker.on('dragend', (e: any) => {
          const pos = e.target.getLatLng()
          console.log('[v0] Dragging node index:', i, 'isHelper:', isHelper, 'newPos:', pos)
          props.onWaypointDrag(i, { lat: pos.lat, lng: pos.lng })
        })
        
        marker.addTo(map)
      }
    } else if (props.intervalCoordinates?.length) {
      // Normal mode: show interval markers
      props.intervalCoordinates.forEach((coord: IntervalCoordinate) => {
        const isEnd = coord.index === 0 || coord.index === props.intervalCoordinates!.length - 1
        L.circleMarker([coord.lat, coord.lng], {
          radius: isEnd ? 6 : 4,
          fillColor: isEnd ? '#10b981' : '#06b6d4',
          color: '#fff',
          weight: 2,
          fillOpacity: 0.8,
        }).bindPopup(`WP ${coord.index} - ${coord.distanceFromStart.toFixed(1)}km`).addTo(map)
      })
    }

    if (latLngs.length > 0) {
      map.fitBounds(L.latLngBounds(latLngs), { padding: [50, 50] })
    }
  }, [mapReady, props.routeWaypoints, props.intervalCoordinates, props.mapMode, props.onWaypointDrag])

  useEffect(() => {
    if (!mapReady || !mapRef.current || !LRef.current) return
    const L = LRef.current
    const map = mapRef.current

    if (props.startPoint) {
      L.circleMarker([props.startPoint.lat, props.startPoint.lng], {
        radius: 8, fillColor: '#10b981', color: '#fff', weight: 3, fillOpacity: 0.9,
      }).bindPopup('Start').addTo(map)
    }

    if (props.endPoint) {
      L.circleMarker([props.endPoint.lat, props.endPoint.lng], {
        radius: 8, fillColor: '#ef4444', color: '#fff', weight: 3, fillOpacity: 0.9,
      }).bindPopup('End').addTo(map)
    }
  }, [mapReady, props.startPoint, props.endPoint])

  return (
    <div className="relative w-full h-full rounded-lg overflow-hidden" style={{ minHeight: '400px' }}>
      <div ref={containerRef} className="w-full h-full" />
      
      {/* Map Legend - Bottom Right */}
      {mapReady && (
        <div className="absolute bottom-4 right-4 bg-white/95 backdrop-blur-sm rounded-lg shadow-lg p-4 max-w-sm border border-gray-200 z-50 pointer-events-auto">
          <h3 className="font-semibold text-sm mb-3 text-gray-900">Map Features</h3>
          <div className="space-y-2 text-xs">
            <div className="space-y-1.5">
              <p className="font-medium text-gray-800">Route</p>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-blue-500 rounded" />
                <span className="text-gray-700">Generated Railway Route</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 bg-amber-500 rounded-full" />
                <span className="text-gray-700">Route Waypoint</span>
              </div>
            </div>
            <div className="border-t pt-2">
              <p className="font-medium text-gray-800">Geography</p>
              <div className="flex items-center gap-2">
                <div className="w-2 h-6 bg-blue-400" />
                <span className="text-gray-700">River / Water</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-6 bg-green-600" />
                <span className="text-gray-700">Forest / Dense Vegetation</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-6 bg-gray-500" />
                <span className="text-gray-700">Mountain / Steep Terrain</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-6 bg-yellow-600" />
                <span className="text-gray-700">Settlement / Urban Area</span>
              </div>
            </div>
            <div className="border-t pt-2">
              <p className="font-medium text-gray-800">Infrastructure</p>
              <div className="flex items-center gap-2">
                <div className="w-3 border-b-2 border-gray-800" />
                <span className="text-gray-700">Road Network</span>
              </div>
              <div className="flex items-center gap-2">
                <svg className="w-3 h-3" viewBox="0 0 12 12" fill="none" stroke="currentColor" className="text-gray-800">
                  <circle cx="6" cy="6" r="4" strokeWidth="1" />
                </svg>
                <span className="text-gray-700">Town / City</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
