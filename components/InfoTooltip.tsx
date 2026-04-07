'use client'

export function InfoTooltip({ text }: { text: string }) {
  return (
    <span className="info-tip-wrap">
      <span className="info-tip-icon">ⓘ</span>
      <span className="info-tip-box">{text}</span>
    </span>
  )
}
