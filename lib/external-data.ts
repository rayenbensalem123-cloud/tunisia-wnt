// lib/external-data.ts

export type DataSource = 'api-football' | 'manual';
export const DATA_SOURCES: DataSource[] = ['api-football'];

export const TUNISIAN_WOMEN_SCOUTS = [
  { name: "Chaima Abbassi", club: "NEOM SC", pos: "Midfielder", age: 32, matches: 14, goals: 1 },
  { name: "Mariem Houij", club: "Galatasaray", pos: "Forward", age: 31, matches: 18, goals: 12 },
  { name: "Sabrine Ellouzi", club: "Excelsior", pos: "Forward", age: 28, matches: 15, goals: 7 },
  { name: "Chirine Lamti", club: "Venezia FC", pos: "Midfielder", age: 31, matches: 20, goals: 3 },
  { name: "Yesmin Khanchouch", club: "HERA United", pos: "Midfielder", age: 20, matches: 12, goals: 0 },
  { name: "Ahlem Ammar", club: "AS Cannes", pos: "Defender", age: 21, matches: 11, goals: 0 }
];

export function externalToPlayer(data: any) {
  return { ...data, nationality: "Tunisia", tournaments: [] };
}

export function getScoutingLinks(name: string) {
  const query = encodeURIComponent(`${name} Tunisia Women Football`);
  return {
    transfermarkt: `https://www.transfermarkt.com/schnellsuche/ergebnis/schnellsuche?query=${query}`,
    soccerdonna: `https://www.soccerdonna.de/en/suche/ergebnissuche/suche.html?query=${query}`,
    google: `https://www.google.com/search?q=${query}+stats+2026`
  };
}

export async function searchPlayerByName(name: string) {
  const player = TUNISIAN_WOMEN_SCOUTS.find(p => p.name.toLowerCase().includes(name.toLowerCase()));
  if (player) return { found: true, data: { ...player } };
  return { found: false };
}