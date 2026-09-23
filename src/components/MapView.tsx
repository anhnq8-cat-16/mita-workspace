import 'leaflet/dist/leaflet.css'
import type { LatLngBoundsExpression } from 'leaflet'
import type { ReactNode } from 'react'
import { CircleMarker, MapContainer, Popup, TileLayer } from 'react-leaflet'
import { cn } from '@/lib/utils'

export interface MapPoint {
  id: string
  lat: number
  lng: number
  color?: string
  popup?: ReactNode
}

/** Trung tâm mặc định: Hà Nội (VP Lĩnh Nam) */
const DEFAULT_CENTER: [number, number] = [20.98, 105.87]

/** Bản đồ OpenStreetMap với các điểm tròn (không cần ảnh marker) */
export function MapView({ points, className }: { points: MapPoint[]; className?: string }) {
  const bounds: LatLngBoundsExpression | undefined =
    points.length > 1 ? points.map((p) => [p.lat, p.lng] as [number, number]) : undefined
  const center: [number, number] = points[0] ? [points[0].lat, points[0].lng] : DEFAULT_CENTER

  return (
    <div className={cn('h-80 overflow-hidden rounded-xl border border-border', className)}>
      <MapContainer
        key={points.map((p) => p.id).join(',')}
        center={center}
        zoom={points.length === 1 ? 15 : 12}
        bounds={bounds}
        boundsOptions={{ padding: [30, 30] }}
        scrollWheelZoom={false}
        className="size-full"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {points.map((p) => (
          <CircleMarker
            key={p.id}
            center={[p.lat, p.lng]}
            radius={9}
            pathOptions={{
              color: '#fff',
              weight: 2,
              fillColor: p.color ?? '#7a4520',
              fillOpacity: 0.9,
            }}
          >
            {p.popup && <Popup>{p.popup}</Popup>}
          </CircleMarker>
        ))}
      </MapContainer>
    </div>
  )
}
