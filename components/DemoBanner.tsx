export default function DemoBanner() {
  return (
    <div style={{
      position: 'fixed',
      bottom: 16,
      left: '50%',
      transform: 'translateX(-50%)',
      zIndex: 999,
      background: 'rgba(5,12,26,0.92)',
      border: '1px solid rgba(37,99,235,0.4)',
      borderRadius: 6,
      padding: '7px 18px',
      fontSize: 12,
      color: 'rgba(255,255,255,0.6)',
      backdropFilter: 'blur(8px)',
      whiteSpace: 'nowrap',
      pointerEvents: 'none',
    }}>
      Demo instance — data resets nightly
    </div>
  )
}
