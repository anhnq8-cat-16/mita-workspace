import { useRef, useState } from 'react'
import { Avatar } from '@/components/ui/avatar'
import { Textarea } from '@/components/ui/input'

interface Person {
  id: string
  name: string
  avatar_url?: string | null
}

/** Ô nhập có gợi ý @nhắc tên: gõ "@" + vài chữ → chọn người → chèn "@Tên " */
export function MentionTextarea({
  value,
  onChange,
  people,
  placeholder,
  rows = 2,
}: {
  value: string
  onChange: (v: string) => void
  people: Person[]
  placeholder?: string
  rows?: number
}) {
  const ref = useRef<HTMLTextAreaElement>(null)
  const [query, setQuery] = useState<{ start: number; text: string } | null>(null)

  function detect(text: string, caret: number) {
    const before = text.slice(0, caret)
    const at = before.lastIndexOf('@')
    if (at < 0 || (at > 0 && !/\s/.test(before[at - 1]!))) return setQuery(null)
    const q = before.slice(at + 1)
    if (q.length > 20 || /\n/.test(q)) return setQuery(null)
    setQuery({ start: at, text: q })
  }

  const matches = query
    ? people.filter((p) => p.name.toLowerCase().includes(query.text.toLowerCase())).slice(0, 6)
    : []

  function pick(p: Person) {
    if (!query) return
    const caret = ref.current?.selectionStart ?? value.length
    const next = `${value.slice(0, query.start)}@${p.name} ${value.slice(caret)}`
    onChange(next)
    setQuery(null)
    requestAnimationFrame(() => {
      const pos = query.start + p.name.length + 2
      ref.current?.focus()
      ref.current?.setSelectionRange(pos, pos)
    })
  }

  return (
    <div className="relative">
      <Textarea
        ref={ref}
        rows={rows}
        value={value}
        placeholder={placeholder}
        aria-label={placeholder}
        onChange={(e) => {
          onChange(e.target.value)
          detect(e.target.value, e.target.selectionStart)
        }}
        onBlur={() => setTimeout(() => setQuery(null), 150)}
      />
      {matches.length > 0 && (
        <ul className="absolute bottom-full left-0 z-10 mb-1 w-64 overflow-hidden rounded-lg border border-border bg-card shadow-lg">
          {matches.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                className="flex min-h-11 w-full items-center gap-2 px-3 text-left text-sm hover:bg-muted"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(p)}
              >
                <Avatar name={p.name} src={p.avatar_url} className="size-7" />
                {p.name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
