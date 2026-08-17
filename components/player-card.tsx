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
    <article className="player-squad-card w-72 h-[25rem] bg-[#071b37] text-white shadow-xl overflow-hidden transition-all duration-500 hover:-translate-y-2 group relative">
      <div className="player-card-photo absolute inset-x-0 top-0 h-[58%] overflow-hidden">
        <img src={imageSrc} alt={name} onError={e=>{(e.target as HTMLImageElement).src='/placeholder.jpg'}} className="w-full h-full object-cover object-top transition-transform duration-700 group-hover:scale-105" />
      </div>
      <div className="absolute inset-0 bg-gradient-to-b from-[#06152d]/5 via-transparent to-[#06152d]" />
      <span className="absolute right-3 top-1 text-[8.5rem] leading-none font-black italic text-white/[.13] select-none">{fullPosition ? "T" : (posAbbr[position] || position.slice(0, 1))}</span>
      <div className="absolute left-0 top-0 border-t-[34px] border-l-[34px] border-t-[#e3062c] border-l-transparent" />
      <div className="absolute left-4 top-4 flex flex-col gap-1.5">
        <span className="bg-white text-[#071b37] text-[8px] font-black px-2 py-1 tracking-[.16em]">{fullPosition ? "STAFF" : posAbbr[position] || position.slice(0, 4)}</span>
        <span className="text-[8px] font-black tracking-[.18em]">TUNISIA</span>
      </div>
      <div className="absolute inset-x-0 bottom-0 min-h-[48%] px-5 pt-8 pb-4 bg-[#071b37] [clip-path:polygon(0_18%,100%_0,100%_100%,0_100%)]">
        <p className="text-[8px] text-[#f6c744] font-black uppercase tracking-[.2em] truncate">{club}</p>
        <h3 className="font-black text-xl leading-none uppercase mt-1.5 truncate">{titleCase(name)}</h3>
        <div className="mt-5 grid grid-cols-3 border-t border-white/20">
          <div className="pt-2"><span className="block text-[7px] text-slate-400 font-black uppercase tracking-wider">Age</span><strong className="text-lg leading-none">{age || "—"}</strong></div>
          <div className="pt-2 border-l border-white/20 pl-3"><span className="block text-[7px] text-slate-400 font-black uppercase tracking-wider">Caps</span><strong className="text-lg leading-none">{caps ?? "—"}</strong></div>
          <div className="pt-2 border-l border-white/20 pl-3"><span className="block text-[7px] text-slate-400 font-black uppercase tracking-wider">Goals</span><strong className="text-lg leading-none text-[#f6c744]">{goals ?? "—"}</strong></div>
        </div>
      </div>
    </article>
  );
};
