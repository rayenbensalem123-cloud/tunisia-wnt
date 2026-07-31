import React from 'react';

interface PlayerCardProps {
  name: string;
  club: string;
  position: string;
  age: number;
  caps?: number;
  goals?: number;
  imageSrc?: string;
  fullPosition?: boolean;
}

const posAbbr: Record<string, string> = {
  GOALKEEPER: "GK",
  DEFENDER: "DEF",
  MIDFIELDER: "MID",
  FORWARD: "FWD",
}

const titleCase=(s:string)=>s.toLowerCase().replace(/\b\w/g,c=>c.toUpperCase())

export const PlayerCard: React.FC<PlayerCardProps> = ({
  name,
  club,
  position,
  age,
  caps,
  goals,
  imageSrc = "/placeholder.jpg",
  fullPosition,
}) => {
  return (
    <div className="w-64 h-80 bg-zinc-900 rounded-xl text-white shadow-xl flex flex-col overflow-hidden transition-all duration-500 hover:-translate-y-2 hover:shadow-2xl hover:shadow-red-500/20 group border border-white/10 relative">

      {/* Hover shine effect */}
      <div className="absolute inset-0 z-20 opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none">
        <div className="w-full h-full bg-gradient-to-br from-white/10 via-transparent to-transparent animate-[shine_1.5s_ease-in-out_infinite]"/>
      </div>

      {/* Image fills entire card */}
      <img src={imageSrc} alt={name} onError={e=>{(e.target as HTMLImageElement).src='/placeholder.jpg'}} className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />

      {/* Dark gradient overlay at bottom for readability */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent" />

      {/* Top colored bar with animated pulse */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#E30613] via-[#ff4444] to-[#E30613] z-10 group-hover:animate-[pulse_1s_ease-in-out_infinite]" />

      {/* Info at bottom center */}
      <div className="relative z-10 mt-auto px-4 pb-3">
        <div className="text-center">
          <h3 className="font-black text-sm tracking-tight uppercase truncate drop-shadow-lg">
            {name}
          </h3>
          <p className="text-[9px] text-zinc-300 font-semibold uppercase tracking-wider drop-shadow-lg">
            {club}
          </p>
          <div className="flex items-center justify-center gap-2 mt-2">
            <span className="text-[8px] font-black bg-[#E30613] px-1.5 py-0.5 rounded tracking-wider shadow-lg">
              {fullPosition?position:(posAbbr[position] || position.slice(0, 4))}
            </span>
          </div>
          <div className="flex gap-3 mt-2 justify-center">
            <div className="text-center">
              <div className="text-[7px] text-zinc-400 font-bold uppercase tracking-wider">Age</div>
              <div className="text-sm font-black text-white">{age}</div>
            </div>
            {caps!==undefined&&<div className="text-center">
              <div className="text-[7px] text-zinc-400 font-bold uppercase tracking-wider">Cap</div>
              <div className="text-sm font-black text-white">{caps}</div>
            </div>}
            {goals!==undefined&&<div className="text-center">
              <div className="text-[7px] text-zinc-400 font-bold uppercase tracking-wider">Gl</div>
              <div className="text-sm font-black text-[#E30613]">{goals}</div>
            </div>}
          </div>
        </div>
      </div>
    </div>
  );
};
