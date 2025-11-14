import { useEffect, useState } from 'react'

export function Confetti({ duration = 3000, onComplete }) {
  const [pieces, setPieces] = useState([])

  useEffect(() => {
    // Generate confetti pieces
    const newPieces = Array.from({ length: 50 }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      delay: Math.random() * 0.5,
      duration: 2 + Math.random() * 2,
      color: ['#fbbf24', '#f59e0b', '#3b82f6', '#10b981', '#ef4444', '#8b5cf6'][Math.floor(Math.random() * 6)],
      rotation: Math.random() * 360
    }))
    
    setPieces(newPieces)

    const timer = setTimeout(() => {
      onComplete?.()
    }, duration)

    return () => clearTimeout(timer)
  }, [duration, onComplete])

  return (
    <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
      {pieces.map(piece => (
        <div
          key={piece.id}
          className="absolute w-3 h-3 confetti-piece"
          style={{
            left: `${piece.left}%`,
            top: '-10px',
            backgroundColor: piece.color,
            animationDelay: `${piece.delay}s`,
            animationDuration: `${piece.duration}s`,
            transform: `rotate(${piece.rotation}deg)`
          }}
        />
      ))}
      
      <style jsx>{`
        @keyframes confetti-fall {
          0% {
            transform: translateY(0) rotate(0deg);
            opacity: 1;
          }
          100% {
            transform: translateY(100vh) rotate(720deg);
            opacity: 0;
          }
        }

        .confetti-piece {
          animation: confetti-fall linear forwards;
        }
      `}</style>
    </div>
  )
}

// Hook for triggering confetti
export function useConfetti() {
  const [showConfetti, setShowConfetti] = useState(false)

  const celebrate = () => {
    setShowConfetti(true)
  }

  const ConfettiContainer = () => (
    <>
      {showConfetti && (
        <Confetti onComplete={() => setShowConfetti(false)} />
      )}
    </>
  )

  return { celebrate, ConfettiContainer }
}
