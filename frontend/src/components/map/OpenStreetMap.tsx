import React, { useEffect, useRef, useState } from 'react'
import L from 'leaflet'

export interface MapMarker {
  id?: string | number
  lat: number
  lng: number
  type?: 'pickup' | 'destination' | 'ambulance' | 'hospital' | 'police' | 'incident' | 'custom'
  title: string
  description?: string
  badge?: string
  eta_min?: number
  km?: number
}

export interface OpenStreetMapProps {
  center?: [number, number]
  zoom?: number
  markers?: MapMarker[]
  route?: [number, number][]
  onLocationSelect?: (coords: { lat: number; lng: number }) => void
  height?: string
  className?: string
  interactive?: boolean
  autoFit?: boolean
}

// Custom SVG Icons using L.divIcon
const createCustomIcon = (type: MapMarker['type'] = 'custom', label?: string) => {
  let bgColor = 'bg-primary-600'
  let borderColor = 'border-primary-700'
  let iconSvg = ''
  let pulse = false

  switch (type) {
    case 'incident':
    case 'pickup':
      bgColor = 'bg-red-600'
      borderColor = 'border-red-700'
      pulse = true
      iconSvg = `
        <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/>
          <circle cx="12" cy="10" r="3"/>
        </svg>
      `
      break
    case 'destination':
      bgColor = 'bg-amber-600'
      borderColor = 'border-amber-700'
      iconSvg = `
        <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"/>
          <circle cx="12" cy="12" r="6"/>
          <circle cx="12" cy="12" r="2"/>
        </svg>
      `
      break
    case 'ambulance':
      bgColor = 'bg-emerald-600'
      borderColor = 'border-emerald-700'
      pulse = true
      iconSvg = `
        <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M10 10H6"/>
          <path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/>
          <path d="M19 18h2a1 1 0 0 0 1-1v-3.28a1 1 0 0 0-.684-.948l-1.923-.641a1 1 0 0 1-.578-.559l-.763-1.527A2 2 0 0 0 17.26 8H14"/>
          <circle cx="17" cy="18" r="2"/>
          <circle cx="7" cy="18" r="2"/>
        </svg>
      `
      break
    case 'hospital':
      bgColor = 'bg-indigo-600'
      borderColor = 'border-indigo-700'
      iconSvg = `
        <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 6v12"/>
          <path d="M6 12h12"/>
          <rect width="18" height="18" x="3" y="3" rx="2"/>
        </svg>
      `
      break
    case 'police':
      bgColor = 'bg-blue-800'
      borderColor = 'border-blue-900'
      iconSvg = `
        <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/>
        </svg>
      `
      break
    default:
      iconSvg = `
        <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="6"/>
        </svg>
      `
  }

  const html = `
    <div class="relative flex items-center justify-center">
      ${pulse ? `<div class="absolute -inset-1 rounded-full ${bgColor} opacity-40 animate-ping"></div>` : ''}
      <div class="relative w-8 h-8 rounded-full ${bgColor} border-2 border-white shadow-lg flex items-center justify-center transform -translate-x-1/2 -translate-y-1/2 hover:scale-110 transition-transform">
        ${iconSvg}
      </div>
      ${label ? `<div class="absolute top-4 left-1/2 -translate-x-1/2 whitespace-nowrap bg-gray-900 text-white text-[10px] font-semibold px-1.5 py-0.5 rounded shadow pointer-events-none">${label}</div>` : ''}
    </div>
  `

  return L.divIcon({
    html,
    className: 'custom-div-icon',
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -18],
  })
}

export default function OpenStreetMap({
  center = [8.5241, 76.9366], // Default: Trivandrum / Kerala
  zoom = 13,
  markers = [],
  route = [],
  onLocationSelect,
  height = '400px',
  className = '',
  interactive = true,
  autoFit = true,
}: OpenStreetMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<L.Map | null>(null)
  const markersLayerRef = useRef<L.LayerGroup | null>(null)
  const routeLayerRef = useRef<L.Polyline | null>(null)
  const [pickerCoords, setPickerCoords] = useState<{ lat: number; lng: number } | null>(null)

  // Initialize Map
  useEffect(() => {
    const container = mapContainerRef.current
    if (!container) return

    // Clean up existing instance or stale _leaflet_id if any (prevents "Map container is already initialized")
    try {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove()
        mapInstanceRef.current = null
      }
    } catch (e) {
      console.warn('Map cleanup warning:', e)
    }

    if ((container as any)._leaflet_id) {
      delete (container as any)._leaflet_id
    }

    let map: L.Map | null = null
    try {
      map = L.map(container, {
        center,
        zoom,
        zoomControl: interactive,
        dragging: interactive,
        scrollWheelZoom: interactive,
        doubleClickZoom: interactive,
        attributionControl: true,
      })

      // OpenStreetMap standard tile layer
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors',
      }).addTo(map)

      const markersGroup = L.layerGroup().addTo(map)
      markersLayerRef.current = markersGroup
      mapInstanceRef.current = map

      // Handle Click for Location Picking
      if (onLocationSelect) {
        map.on('click', (e: L.LeafletMouseEvent) => {
          const coords = { lat: Number(e.latlng.lat.toFixed(5)), lng: Number(e.latlng.lng.toFixed(5)) }
          setPickerCoords(coords)
          onLocationSelect(coords)
        })
      }
    } catch (err) {
      console.error('Error creating Leaflet map instance:', err)
      return
    }

    // Handle container resize
    let resizeObserver: ResizeObserver | null = null
    try {
      resizeObserver = new ResizeObserver(() => {
        if (mapInstanceRef.current) {
          mapInstanceRef.current.invalidateSize()
        }
      })
      resizeObserver.observe(container)
    } catch (e) {}

    // Trigger initial invalidate size after DOM paints
    const timer = setTimeout(() => {
      try {
        if (mapInstanceRef.current) {
          mapInstanceRef.current.invalidateSize()
        }
      } catch (e) {}
    }, 250)

    return () => {
      clearTimeout(timer)
      if (resizeObserver) {
        resizeObserver.disconnect()
      }
      try {
        if (mapInstanceRef.current) {
          mapInstanceRef.current.remove()
          mapInstanceRef.current = null
        }
      } catch (e) {
        console.warn('Error during map unmount:', e)
      }
      if (container && (container as any)._leaflet_id) {
        delete (container as any)._leaflet_id
      }
    }
  }, [])

  // Update Markers and Route
  useEffect(() => {
    const map = mapInstanceRef.current
    const markersGroup = markersLayerRef.current
    if (!map || !markersGroup) return

    markersGroup.clearLayers()
    const boundsPoints: L.LatLngExpression[] = []

    // Add provided markers
    markers.forEach((m) => {
      if (typeof m.lat !== 'number' || typeof m.lng !== 'number' || isNaN(m.lat) || isNaN(m.lng)) return

      const icon = createCustomIcon(m.type, m.badge)
      const marker = L.marker([m.lat, m.lng], { icon })

      const popupContent = `
        <div class="p-1 text-xs">
          <div class="font-bold text-gray-900 text-sm mb-1">${m.title}</div>
          ${m.description ? `<p class="text-gray-600 mb-1">${m.description}</p>` : ''}
          <div class="flex items-center gap-2 text-gray-500 font-mono text-[11px]">
            <span>${m.lat.toFixed(4)}, ${m.lng.toFixed(4)}</span>
            ${m.eta_min != null ? `<span class="bg-emerald-100 text-emerald-800 px-1 rounded font-bold">~${Math.round(m.eta_min)}m</span>` : ''}
            ${m.km != null ? `<span class="bg-gray-100 text-gray-700 px-1 rounded">${m.km.toFixed(1)} km</span>` : ''}
          </div>
        </div>
      `
      marker.bindPopup(popupContent)
      marker.addTo(markersGroup)
      boundsPoints.push([m.lat, m.lng])
    })

    // If location picker is active, show the chosen pin
    if (pickerCoords) {
      const pickerIcon = createCustomIcon('pickup', 'Selected')
      const pMarker = L.marker([pickerCoords.lat, pickerCoords.lng], { icon: pickerIcon })
      pMarker.bindPopup(`<div class="text-xs font-bold text-red-600">Selected: ${pickerCoords.lat}, ${pickerCoords.lng}</div>`)
      pMarker.addTo(markersGroup)
      boundsPoints.push([pickerCoords.lat, pickerCoords.lng])
    }

    // Add Route Polyline
    if (routeLayerRef.current) {
      map.removeLayer(routeLayerRef.current)
      routeLayerRef.current = null
    }

    if (route && route.length > 1) {
      const polyline = L.polyline(route, {
        color: '#2563eb',
        weight: 4,
        opacity: 0.85,
        dashArray: '8, 6',
        lineCap: 'round',
        lineJoin: 'round',
      }).addTo(map)

      routeLayerRef.current = polyline
      route.forEach(pt => boundsPoints.push(pt))
    }

    // Fit bounds if autoFit is enabled and points exist
    try {
      if (autoFit && boundsPoints.length > 1) {
        const bounds = L.latLngBounds(boundsPoints)
        if (bounds.isValid()) {
          map.fitBounds(bounds, { padding: [40, 40], maxZoom: 16 })
        }
      } else if (boundsPoints.length === 1 && !pickerCoords) {
        map.setView(boundsPoints[0], Math.max(map.getZoom(), 14))
      }
    } catch (e) {
      console.warn('Map fitBounds warning:', e)
    }
  }, [markers, route, pickerCoords, autoFit])

  return (
    <div className={`relative rounded-xl overflow-hidden border border-gray-200 shadow-sm bg-gray-100 ${className}`}>
      {/* Map Element */}
      <div
        ref={mapContainerRef}
        style={{ height, width: '100%' }}
        className="z-0"
      />

      {/* Interactive Helper Overlay for Picker */}
      {onLocationSelect && (
        <div className="absolute top-3 left-3 z-[1000] bg-white/95 backdrop-blur-sm border border-gray-200 shadow-md rounded-lg px-3 py-1.5 text-xs font-medium text-gray-700 flex items-center gap-1.5 pointer-events-none">
          <span className="w-2 h-2 rounded-full bg-red-600 animate-pulse"></span>
          Click on the map to set location
        </div>
      )}

      {/* OpenStreetMap Badge */}
      <div className="absolute bottom-1 left-2 z-[1000] bg-white/80 backdrop-blur-sm rounded px-1.5 py-0.5 text-[10px] text-gray-500 font-medium pointer-events-none">
        OpenStreetMap
      </div>
    </div>
  )
}

export { OpenStreetMap }

