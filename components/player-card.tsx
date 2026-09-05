"use client"
import React, { useState, useRef, useEffect } from 'react';

interface PlayerCardProps {
  name: string;
  club: string;
  position: string;
  age: number;
  caps?: number;
  goals?: number;
  imageSrc?: string;
  fullPosition?: boolean;
  n?: number;
  nationality?: string;
  height?: string | number;
  foot?: string;
  assists?: number;
  yellows?: number;
  reds?: number;
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
  n,
  nationality,
  height,
  foot,
  assists,
  yellows,
  reds,
}) => {
  const code = fullPosition ? "STAFF" : (posAbbr[position] || position.slice(0, 4));
  const num = String(n ?? "—").padStart(2, "0");
  const [popped, setPopped] = useState(false);
  const [hovering, setHovering] = useState(false);
  const [posterReady, setPosterReady] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const gifRef = useRef<HTMLImageElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isGif = /\.gif($|\?)/i.test(imageSrc);

  // Freeze the gif on a snapshot canvas by default; hovering reveals the live, moving gif underneath.
  const captureSnapshot = () => {
    const img = gifRef.current, canvas = canvasRef.current;
    if (!img || !canvas || !img.naturalWidth) return;
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext("2d");
    if (ctx) { ctx.drawImage(img, 0, 0); setPosterReady(true); }
  };

  const triggerPop = (e: React.MouseEvent) => {
    e.stopPropagation(); // don't open the full profile, this is just the media effect
    setPopped(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setPopped(false), 2600); // ~one loop of a short reveal clip
  };
  const mediaTransformStyle = {
    willChange:"transform",
    backfaceVisibility:"hidden" as const,
    WebkitBackfaceVisibility:"hidden" as const,
    transition:"transform 0.5s cubic-bezier(0.34,1.56,0.64,1), filter 0.4s ease",
    transform: popped ? "translateZ(90px) scale(1.5) rotateY(-4deg)" : "translateZ(0) scale(1) rotateY(0deg)",
    filter: popped ? "drop-shadow(0 20px 30px rgba(0,0,0,0.55))" : "none",
    transformOrigin: "center 40%",
  };
  return (
    <article className="player-squad-card w-72 h-[25rem] bg-[#112950] text-[#f7f1e6] overflow-hidden transition-all duration-500 hover:-translate-y-2 group relative flex" style={{transform:"translateZ(0)", backfaceVisibility:"hidden", WebkitBackfaceVisibility:"hidden"}}>
      <div
        className="player-card-photo relative w-44 shrink-0 border-r border-[#2a4568]"
        style={{perspective:"900px", zIndex: popped?50:1, overflow: popped?"visible":"hidden"}}
        onMouseEnter={()=>setHovering(true)}
        onMouseLeave={()=>setHovering(false)}
      >
        {isGif && (
          <img
            ref={gifRef}
            src={imageSrc}
            alt={name}
            crossOrigin="anonymous"
            onLoad={captureSnapshot}
            onClick={triggerPop}
            onError={e=>{(e.target as HTMLImageElement).src='/placeholder.jpg'}}
            className="absolute inset-0 w-full h-full object-cover object-top cursor-pointer"
            style={mediaTransformStyle}
          />
        )}
        {isGif ? (
          <canvas
            ref={canvasRef}
            onClick={triggerPop}
            className="absolute inset-0 w-full h-full cursor-pointer"
            style={{
              objectFit:"cover",
              opacity: (hovering && posterReady) ? 0 : 1,
              transition:"opacity 0.35s ease",
            }}
          />
        ) : (
          <img
            src={imageSrc}
            alt={name}
            onClick={triggerPop}
            onError={e=>{(e.target as HTMLImageElement).src='/placeholder.jpg'}}
            className="absolute inset-0 w-full h-full object-cover object-top cursor-pointer"
            style={mediaTransformStyle}
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-[#0c1f3d]/75 via-transparent to-[#0c1f3d]/20 pointer-events-none" />
        <div className="absolute left-0 top-0 border-t-[26px] border-l-[26px] border-t-[#e3062c] border-l-transparent pointer-events-none" />
        <span className="absolute bottom-2 left-2 text-[13px] font-black italic leading-none text-white/90 drop-shadow-[0_1px_2px_rgba(0,0,0,.65)] pointer-events-none">{fullPosition ? "T" : code}</span>
      </div>

      <div className="flex-1 px-4 py-4 flex flex-col min-w-0 relative">
        <p className="text-[7px] text-[#c2b7a6] font-black uppercase tracking-[.22em] truncate">{club}</p>
        <h3 className="font-black text-[21px] leading-[1.05] uppercase mt-1 text-[#f7f1e6] break-words">{titleCase(name)}</h3>
        <div className="mt-2 flex items-center gap-2">
          <span className="px-1.5 py-0.5 rounded-sm bg-[#e3062c] text-white text-[6px] font-black uppercase tracking-[.18em]">{code}</span>
          <span className="text-[6.5px] font-black tracking-[.2em] text-[#f7f1e6]/55 uppercase">{fullPosition ? "DELEGATION STAFF" : "TUNISIA WNT"}</span>
        </div>

        <div className="mt-4 space-y-1.5 relative z-10">
          <div className="flex items-baseline gap-2">
            <span className="text-[22px] leading-none font-black italic text-[#e3062c] tracking-tight">№ {num}</span>
            <span className="text-[6px] font-black uppercase tracking-[.24em] text-[#f7f1e6]/45">{fullPosition ? "OFFICIAL" : "NATIONAL"}</span>
          </div>
          <div className="flex items-center gap-2 text-[7px] font-black uppercase tracking-widest text-[#a89c8a]">
            <span>{(nationality || "TUN").slice(0, 3)}</span>
            {height ? <span>• {height} cm</span> : null}
            {foot ? <span>• {foot}</span> : null}
          </div>
          {fullPosition ? (
            <div className="pt-1">
              <span className="px-1.5 py-0.5 rounded-sm border border-[#2a4568] bg-[#0e2345] text-[6px] font-black uppercase tracking-widest text-[#f7f1e6]/60">Fédération Tunisienne — Team Staff</span>
            </div>
          ) : (
            <div className="pt-1 flex items-center gap-2">
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-sm border border-[#2a4568] bg-[#0e2345]">
                <span className="w-2 h-2 rounded-full bg-yellow-400" />
                <span className="text-[6px] font-black uppercase tracking-widest text-[#a89c8a]">{yellows || 0} YC</span>
              </span>
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-sm border border-[#2a4568] bg-[#0e2345]">
                <span className="w-2 h-2 rounded-full bg-[#e3062c]" />
                <span className="text-[6px] font-black uppercase tracking-widest text-[#a89c8a]">{reds || 0} RC</span>
              </span>
            </div>
          )}
        </div>

        <span className="absolute right-2 bottom-10 text-[5.5rem] leading-none font-black italic text-[#e3062c]/[.09] select-none pointer-events-none">{num}</span>

        <div className="mt-auto relative z-10">
          <div className="h-px bg-[#2a4568]" />
          {fullPosition ? (
            <div className="grid grid-cols-3 pt-3">
              <div><span className="block text-[6px] text-[#a89c8a] font-black uppercase tracking-widest">Age</span><strong className="text-lg leading-none text-[#f7f1e6]">{age || "—"}</strong></div>
              <div className="border-l border-[#2a4568] pl-3"><span className="block text-[6px] text-[#a89c8a] font-black uppercase tracking-widest">Role</span><strong className="text-[13px] leading-none font-black uppercase text-[#e3062c]">{code}</strong></div>
              <div className="border-l border-[#2a4568] pl-3"><span className="block text-[6px] text-[#a89c8a] font-black uppercase tracking-widest">Foot</span><strong className="text-lg leading-none text-[#f7f1e6]">{(foot || "—").slice(0, 1)}</strong></div>
            </div>
          ) : (
            <div className="grid grid-cols-4 pt-3">
              <div><span className="block text-[6px] text-[#a89c8a] font-black uppercase tracking-widest">Age</span><strong className="text-lg leading-none text-[#f7f1e6]">{age || "—"}</strong></div>
              <div className="border-l border-[#2a4568] pl-3"><span className="block text-[6px] text-[#a89c8a] font-black uppercase tracking-widest">Caps</span><strong className="text-lg leading-none text-[#f7f1e6]">{caps ?? "—"}</strong></div>
              <div className="border-l border-[#2a4568] pl-3"><span className="block text-[6px] text-[#a89c8a] font-black uppercase tracking-widest">Goals</span><strong className="text-lg leading-none text-[#e3062c]">{goals ?? "—"}</strong></div>
              <div className="border-l border-[#2a4568] pl-3"><span className="block text-[6px] text-[#a89c8a] font-black uppercase tracking-widest">Ast</span><strong className="text-lg leading-none text-[#f7f1e6]">{assists ?? "—"}</strong></div>
            </div>
          )}
        </div>
      </div>

      <div className="absolute inset-x-0 bottom-0 h-[3px] bg-[#e3062c]" />
    </article>
  );
};