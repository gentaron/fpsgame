'use client'

import dynamic from 'next/dynamic'

const FPSGame = dynamic(() => import('@/components/game/FPSGame'), {
  ssr: false,
  loading: () => (
    <div className="w-screen h-screen bg-black flex items-center justify-center">
      <div className="text-white text-2xl font-bold animate-pulse">Loading FPS Arena...</div>
    </div>
  ),
})

export default function Home() {
  return <FPSGame />
}