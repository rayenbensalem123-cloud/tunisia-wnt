"use client"
import React, { useState, useRef, useEffect, useCallback } from 'react';

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
  entranceDelay?: number;
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
  entranceDelay = 0,
}) => {
  const code = fullPosition ? "STAFF" : (posAbbr[position] || position.slice(0, 4));
  const num = String(n ?? "—").padStart(2, "0");
  const [popped, setPopped] = useState(false);
  const [imgFailed, setImgFailed] = useState(false);
  const [gifMoving, setGifMoving] = useState(false);
  const isGif = /\.gif(?:\?|#|$)|^data:image\/gif/i.test(imageSrc || "");
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (!isGif || gifMoving) return;
    const im = new Image();
    im.src = imageSrc;
    im.onload = () => {
      const cv = canvasRef.current;
      if (cv) {
        cv.width = im.naturalWidth;
        cv.height = im.naturalHeight;
        cv.getContext("2d")?.drawImage(im, 0, 0, im.naturalWidth, im.naturalHeight);
      }
    };
  }, [isGif, gifMoving, imageSrc]);
  const noPhoto = !imageSrc || imageSrc === "/placeholder.jpg" || imgFailed;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const triggerPop = (e: React.MouseEvent) => {
    e.stopPropagation(); // don't open the full profile, this is just the media effect
    setPopped(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setPopped(false), 2600); // ~one loop of a short reveal clip
  };
  const frozen = isGif && !gifMoving;
  return (
    <article className="player-squad-card w-72 h-[25rem] bg-[var(--c-panel)] text-[var(--c-cream)] overflow-hidden transition-all duration-500 hover:-translate-y-2 group relative flex" style={{transform:"translateZ(0)", backfaceVisibility:"hidden", WebkitBackfaceVisibility:"hidden"}}>
      <div className="player-card-photo relative w-28 shrink-0 border-r border-[var(--c-hover)]" style={{perspective:"900px", zIndex: popped?50:1, overflow: popped?"visible":"hidden"}}>
        {noPhoto ? (
          <div
            onClick={triggerPop}
            className="absolute inset-0 w-full h-full animate-[lineupReveal_0.9s_cubic-bezier(0.16,1,0.3,1)_backwards] cursor-pointer"
            style={{
              willChange:"transform",
              animationDelay:`${entranceDelay}ms`,
              animation: popped ? "none" : undefined,
              transition:"transform 0.5s cubic-bezier(0.34,1.56,0.64,1), filter 0.4s ease",
              transform: popped
                ? "translateZ(90px) scale(1.5) rotateY(-4deg)"
                : "translateZ(0) scale(1) rotateY(0deg)",
              filter: popped ? "drop-shadow(0 20px 30px rgba(0,0,0,0.55))" : "none",
              transformOrigin: "center 40%",
              zIndex: popped ? 10 : undefined,
            }}
          >
            <div className="absolute inset-0 bg-[radial-gradient(120%_90%_at_20%_12%,var(--c-blueDk)_0%,var(--c-panel)_45%,var(--c-body)_100%)]" />
            <div className="absolute inset-0 opacity-[.13]" style={{backgroundImage:"repeating-linear-gradient(-55deg, transparent 0 14px, var(--c-cream) 14px 15px)"}} />
            <span className="absolute inset-0 flex items-center justify-center text-[2.6rem] font-black italic leading-none text-[var(--c-cream)]/[.22] select-none">{fullPosition ? "T" : code}</span>
            <span className="absolute bottom-1.5 left-2 text-[6px] font-black uppercase tracking-[.3em] text-[var(--c-textWarm)]/70 select-none">TUNISIA WNT</span>
          </div>
        ) : (
          <>
          <img
            src={imageSrc}
            alt={name}
            onClick={triggerPop}
            onError={() => setImgFailed(true)}
            onMouseEnter={isGif ? () => setGifMoving(true) : undefined}
            onMouseLeave={isGif ? () => setGifMoving(false) : undefined}
            className="absolute inset-0 w-full h-full object-cover object-top animate-[lineupReveal_0.9s_cubic-bezier(0.16,1,0.3,1)_backwards] cursor-pointer"
            style={{
              willChange:"transform",
              animationDelay:`${entranceDelay}ms`,
              animation: popped ? "none" : undefined,
              backfaceVisibility:"hidden",
              WebkitBackfaceVisibility:"hidden",
              opacity: frozen ? 0 : 1,
              transition:"transform 0.5s cubic-bezier(0.34,1.56,0.64,1), filter 0.4s ease, opacity 0.3s ease",
              transform: popped
                ? "translateZ(90px) scale(1.5) rotateY(-4deg)"
                : "translateZ(0) scale(1) rotateY(0deg)",
              filter: popped ? "drop-shadow(0 20px 30px rgba(0,0,0,0.55))" : "none",
              transformOrigin: "center 40%",
            }}
          />
          {isGif && (
            <canvas
              ref={canvasRef}
              className={`absolute inset-0 w-full h-full pointer-events-none transition-opacity duration-300 ${frozen ? "opacity-100" : "opacity-0"}`}
              style={{ objectFit: "cover", objectPosition: "top" }}
            />
          )}
        </>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-[var(--c-bg)]/75 via-transparent to-[var(--c-bg)]/20 pointer-events-none" />
        <span className="absolute bottom-2 left-2 text-[13px] font-black italic leading-none text-white/90 drop-shadow-[0_1px_2px_rgba(0,0,0,.65)] pointer-events-none">{fullPosition ? "T" : code}</span>
      </div>

      <div className="flex-1 px-4 py-4 flex flex-col min-w-0 relative">
        <p className="text-[7px] text-[var(--c-textWarm2)] font-black uppercase tracking-[.22em] truncate">{club}</p>
        <h3 className="font-black text-[21px] leading-[1.05] uppercase mt-1 text-[var(--c-cream)] break-words">{titleCase(name)}</h3>
        <div className="mt-2 flex items-center gap-2">
          <span className="px-1.5 py-0.5 rounded-sm bg-[#e3062c] text-white text-[6px] font-black uppercase tracking-[.18em]">{code}</span>
          <span className="text-[6.5px] font-black tracking-[.2em] text-[var(--c-cream)]/55 uppercase">{fullPosition ? "DELEGATION STAFF" : "TUNISIA WNT"}</span>
        </div>

        <div className="mt-4 space-y-1.5 relative z-10">
          <div className="flex items-baseline gap-2">
            <span className="text-[22px] leading-none font-black italic text-[#e3062c] tracking-tight">№ {num}</span>
            <span className="text-[6px] font-black uppercase tracking-[.24em] text-[var(--c-cream)]/45">{fullPosition ? "OFFICIAL" : "NATIONAL"}</span>
          </div>
          <div className="flex items-center gap-2 text-[7px] font-black uppercase tracking-widest text-[var(--c-textWarm)]">
            <span>{(nationality || "TUN").slice(0, 3)}</span>
            {height ? <span>• {height} cm</span> : null}
            {foot ? <span>• {foot}</span> : null}
          </div>
          {fullPosition ? (
            <div className="pt-1">
              <span className="px-1.5 py-0.5 rounded-sm border border-[var(--c-hover)] bg-[var(--c-panel4)] text-[6px] font-black uppercase tracking-widest text-[var(--c-cream)]/60">Fédération Tunisienne — Team Staff</span>
            </div>
          ) : (
            <div className="pt-1 flex items-center gap-2">
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-sm border border-[var(--c-hover)] bg-[var(--c-panel4)]">
                <span className="w-2 h-2 rounded-full bg-yellow-400" />
                <span className="text-[6px] font-black uppercase tracking-widest text-[var(--c-textWarm)]">{yellows || 0} YC</span>
              </span>
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-sm border border-[var(--c-hover)] bg-[var(--c-panel4)]">
                <span className="w-2 h-2 rounded-full bg-[#e3062c]" />
                <span className="text-[6px] font-black uppercase tracking-widest text-[var(--c-textWarm)]">{reds || 0} RC</span>
              </span>
            </div>
          )}
        </div>

        <span className="absolute right-2 bottom-10 text-[5.5rem] leading-none font-black italic text-[#e3062c]/[.09] select-none pointer-events-none">{num}</span>

        <div className="mt-auto relative z-10">
          <div className="h-px bg-[var(--c-hover)]" />
          {fullPosition ? (
            <div className="grid grid-cols-3 pt-3">
              <div><span className="block text-[6px] text-[var(--c-textWarm)] font-black uppercase tracking-widest">Age</span><strong className="text-lg leading-none text-[var(--c-cream)]">{age || "—"}</strong></div>
              <div className="border-l border-[var(--c-hover)] pl-3"><span className="block text-[6px] text-[var(--c-textWarm)] font-black uppercase tracking-widest">Role</span><strong className="text-[13px] leading-none font-black uppercase text-[#e3062c]">{code}</strong></div>
              <div className="border-l border-[var(--c-hover)] pl-3"><span className="block text-[6px] text-[var(--c-textWarm)] font-black uppercase tracking-widest">Foot</span><strong className="text-lg leading-none text-[var(--c-cream)]">{(foot || "—").slice(0, 1)}</strong></div>
            </div>
          ) : (
            <div className="grid grid-cols-4 pt-3">
              <div><span className="block text-[6px] text-[var(--c-textWarm)] font-black uppercase tracking-widest">Age</span><strong className="text-lg leading-none text-[var(--c-cream)]">{age || "—"}</strong></div>
              <div className="border-l border-[var(--c-hover)] pl-3"><span className="block text-[6px] text-[var(--c-textWarm)] font-black uppercase tracking-widest">Caps</span><strong className="text-lg leading-none text-[var(--c-cream)]">{caps ?? "—"}</strong></div>
              <div className="border-l border-[var(--c-hover)] pl-3"><span className="block text-[6px] text-[var(--c-textWarm)] font-black uppercase tracking-widest">Goals</span><strong className="text-lg leading-none text-[#e3062c]">{goals ?? "—"}</strong></div>
              <div className="border-l border-[var(--c-hover)] pl-3"><span className="block text-[6px] text-[var(--c-textWarm)] font-black uppercase tracking-widest">Ast</span><strong className="text-lg leading-none text-[var(--c-cream)]">{assists ?? "—"}</strong></div>
            </div>
          )}
        </div>
      </div>

      <div className="absolute inset-x-0 bottom-0 h-[3px] bg-[#e3062c]" />
    </article>
  );
};