/** Nhãn cố định cho biết đây là bản xem thử */
export function DemoBadge() {
  return (
    <div className="pointer-events-none fixed right-3 bottom-20 z-50 rounded-full bg-slate-900/90 px-3 py-1.5 text-xs font-medium text-white shadow-lg md:bottom-4">
      Bản xem thử · dữ liệu mẫu, không lưu thay đổi
    </div>
  )
}
