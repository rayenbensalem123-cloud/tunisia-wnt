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
    <div className="w-64 h-[22rem] bg-[#071b37] text-white shadow-xl flex flex-col overflow-hidden transition-all duration-500 hover:-translate-y-2 group border border-white/10 relative">
      <div className="absolute inset-x-0 top-0 z-20 h-1 bg-[#e3062c]" />
      <div className="absolute z-20 top-4 left-4 flex items-center gap-2">
        <span className="bg-white text-[#071b37] text-[8px] font-black px-2 py-1 tracking-[.16em] shadow-sm">
          {fullPosition ? "STAFF" : posAbbr[position] || position.slice(0, 4)}
        </span>
        <span className="border border-white/30 bg-[#071b37]/80 text-[8px] font-black px-2 py-1 tracking-[.12em]">TUN</span>
      </div>
      <img src={imageSrc} alt={name} onError={e=>{(e.target as HTMLImageElement).src='/placeholder.jpg'}} className="absolute inset-0 w-full h-[72%] object-cover object-top transition-transform duration-700 group-hover:scale-105" />
      <div className="absolute inset-x-0 top-0 h-[74%] bg-gradient-to-t from-[#071b37] via-[#071b37]/10 to-transparent" />
      <div className="relative z-10 mt-auto bg-[#071b37] px-4 pt-3 pb-4 border-t border-white/10">
        <p className="text-[8px] text-[#f6c744] font-black uppercase tracking-[.18em] truncate">{club}</p>
        <h3 className="font-black text-base leading-tight tracking-tight uppercase truncate mt-1">{titleCase(name)}</h3>
        <div className="mt-3 grid grid-cols-3 divide-x divide-white/15 border-y border-white/15 py-2">
          <div className="text-center"><span className="block text-[7px] text-slate-400 font-black uppercase tracking-wider">Age</span><strong className="text-sm">{age || "—"}</strong></div>
          <div className="text-center"><span className="block text-[7px] text-slate-400 font-black uppercase tracking-wider">Caps</span><strong className="text-sm">{caps ?? "—"}</strong></div>
          <div className="text-center"><span className="block text-[7px] text-slate-400 font-black uppercase tracking-wider">Goals</span><strong className="text-sm text-[#f6c744]">{goals ?? "—"}</strong></div>
        </div>
      </div>
    </div>
  );
};
