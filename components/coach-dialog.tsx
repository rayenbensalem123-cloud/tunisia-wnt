"use client"
import { useState, useEffect, useRef } from "react"
import { usePlayers } from "@/lib/players-context"
import { X, ShieldCheck, Camera, Upload } from "lucide-react"

export function CoachDialog({ open, onOpenChange, coach }: any) {
  const { addCoach, updateCoach } = usePlayers()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [formData, setFormData] = useState({ 
    name: "", 
    role: "HEAD COACH", 
    license: "UEFA PRO", 
    nationality: "TUNISIA",
    image: ""
  })

  useEffect(() => {
    if (coach) setFormData(coach)
    else setFormData({ name: "", role: "HEAD COACH", license: "UEFA PRO", nationality: "TUNISIA", image: "" })
  }, [coach, open])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onloadend = () => {
        setFormData({ ...formData, image: reader.result as string })
      }
      reader.readAsDataURL(file)
    }
  }

  if (!open) return null

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (coach?.id) updateCoach(formData)
    else addCoach(formData)
    onOpenChange(false)
  }

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[100] flex items-center justify-center p-4">
      <div className="bg-white rounded-[2.5rem] w-full max-w-lg p-10 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-zinc-50 -mr-16 -mt-16 rotate-45" />
        
        <button onClick={() => onOpenChange(false)} className="absolute top-6 right-6 text-zinc-400 hover:text-black transition-colors">
          <X size={24} />
        </button>

        <h2 className="text-3xl font-[1000] italic uppercase tracking-tighter mb-2 leading-none">
          {coach ? "EDIT" : "HIRE"} <span className="text-[#E30613]">STAFF</span>
        </h2>
        <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-8">Technical & Management Registration</p>

        <form onSubmit={handleSubmit} className="space-y-4 relative">
          <div className="mb-6">
            <label className="text-[9px] font-black text-zinc-400 uppercase ml-2 mb-2 block">Staff Photo</label>
            <div className="flex gap-4 items-center">
              <div className="w-24 h-24 bg-zinc-100 rounded-3xl border-2 border-dashed border-zinc-200 flex items-center justify-center overflow-hidden">
                {formData.image ? (
                  <img src={formData.image} className="w-full h-full object-cover" alt="Preview" />
                ) : (
                  <Camera className="text-zinc-300" size={28} />
                )}
              </div>
              <div className="flex-1">
                <button 
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full bg-zinc-50 border border-zinc-100 p-4 rounded-2xl font-black text-[10px] uppercase tracking-widest text-zinc-600 hover:bg-zinc-100 transition-all flex items-center justify-center gap-2"
                >
                  <Upload size={14} /> Select Picture
                </button>
                <input 
                  type="file" 
                  ref={fileInputRef}
                  className="hidden" 
                  accept="image/*"
                  onChange={handleFileChange} 
                />
              </div>
            </div>
          </div>

          <div>
            <label className="text-[9px] font-black text-zinc-400 uppercase ml-2 mb-1 block">Full Name</label>
            <input 
              value={formData.name}
              placeholder="E.G. SABRI GHANEM" 
              className="w-full bg-zinc-50 border border-zinc-100 p-4 rounded-2xl font-bold text-xs uppercase outline-none focus:border-black transition-all" 
              onChange={e => setFormData({...formData, name: e.target.value})} 
              required 
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[9px] font-black text-zinc-400 uppercase ml-2 mb-1 block">Role</label>
              <select 
                value={formData.role}
                className="w-full bg-zinc-50 border border-zinc-100 p-4 rounded-2xl font-bold text-xs uppercase outline-none focus:border-black appearance-none"
                onChange={e => setFormData({...formData, role: e.target.value})}
              >
                <option>HEAD COACH</option>
                <option>ASSISTANT COACH</option>
                <option>ANALYST</option>
                <option>MENTAL PREPARATION COACH</option>
                <option>GK COACH</option>
                <option>FITNESS COACH</option>
              </select>
            </div>
            <div>
              <label className="text-[9px] font-black text-zinc-400 uppercase ml-2 mb-1 block">Nationality</label>
              <input 
                value={formData.nationality}
                placeholder="TUNISIA" 
                className="w-full bg-zinc-50 border border-zinc-100 p-4 rounded-2xl font-bold text-xs uppercase outline-none focus:border-black transition-all" 
                onChange={e => setFormData({...formData, nationality: e.target.value})} 
              />
            </div>
          </div>

          <div>
            <label className="text-[9px] font-black text-zinc-400 uppercase ml-2 mb-1 block">License Type</label>
            <input 
              value={formData.license}
              placeholder="E.G. UEFA PRO" 
              className="w-full bg-zinc-50 border border-zinc-100 p-4 rounded-2xl font-bold text-xs uppercase outline-none focus:border-black transition-all" 
              onChange={e => setFormData({...formData, license: e.target.value})} 
            />
          </div>

          <button type="submit" className="w-full bg-black text-white py-5 rounded-2xl font-black text-[11px] uppercase tracking-tighter hover:bg-[#E30613] transition-all flex items-center justify-center gap-2 shadow-xl">
            <ShieldCheck size={16} /> Confirm Staff
          </button>
        </form>
      </div>
    </div>
  )
}