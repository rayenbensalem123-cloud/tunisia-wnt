"use client"
import React, { createContext, useContext, useState, useEffect } from "react"

const PlayersContext = createContext<any>(null)

export function PlayersProvider({ children }: { children: React.ReactNode }) {
  const [players, setPlayers] = useState<any[]>([])
  const [coaches, setCoaches] = useState<any[]>([])

  useEffect(() => {
    const savedP = localStorage.getItem("squad_players_final")
    const savedC = localStorage.getItem("squad_coaches_final")
    if (savedP) setPlayers(JSON.parse(savedP))
    if (savedC) setCoaches(JSON.parse(savedC))
  }, [])

  const addPlayer = (p: any) => {
    const updated = [...players, { ...p, id: Date.now().toString() }]
    setPlayers(updated); localStorage.setItem("squad_players_final", JSON.stringify(updated))
  }

  const updatePlayer = (updatedP: any) => {
    const newList = players.map(p => p.id === updatedP.id ? updatedP : p)
    setPlayers(newList); localStorage.setItem("squad_players_final", JSON.stringify(newList))
  }

  const addCoach = (c: any) => {
    const updated = [...coaches, { ...c, id: Date.now().toString() }]
    setCoaches(updated); localStorage.setItem("squad_coaches_final", JSON.stringify(updated))
  }

  const updateCoach = (updatedC: any) => {
    const newList = coaches.map(c => c.id === updatedC.id ? updatedC : c)
    setCoaches(newList); localStorage.setItem("squad_coaches_final", JSON.stringify(newList))
  }

  return (
    <PlayersContext.Provider value={{ players, coaches, addPlayer, updatePlayer, addCoach, updateCoach }}>
      {children}
    </PlayersContext.Provider>
  )
}

export const usePlayers = () => useContext(PlayersContext)