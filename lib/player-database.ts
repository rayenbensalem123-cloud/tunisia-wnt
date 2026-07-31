export type PlayerRecord = {
  name: string
  club: string
  position: string
  birthdate: string
  height: string
  natMatches: number
  goals: number
  assists: number
  yellowCards: number
  redCards: number
  suspended: boolean
  history: { year: string; event: string }[]
}

const DB: PlayerRecord[] = [
  // ═══ GOALKEEPERS ═══
  { name: "Manelle Ben Mohamed", club: "AS MARSA", position: "GOALKEEPER", birthdate: "15/03/1998", height: "172", natMatches: 28, goals: 0, assists: 0, yellowCards: 0, redCards: 0, suspended: false, history: [
    { year: "2022–present", event: "AS Marsa (TUN)" },
    { year: "2019–2022", event: "ASF Sousse (TUN)" },
    { year: "2016–2019", event: "ASF Bou Hajla (TUN)" },
  ]},
  { name: "Soulaima Jabrani", club: "ESS FÉMININ", position: "GOALKEEPER", birthdate: "02/07/2001", height: "175", natMatches: 12, goals: 0, assists: 0, yellowCards: 0, redCards: 0, suspended: false, history: [
    { year: "2021–present", event: "ESS Féminin (TUN)" },
    { year: "2018–2021", event: "ASF Sousse (TUN)" },
  ]},
  { name: "Zahra Jelassi", club: "STADE TUNISIEN", position: "GOALKEEPER", birthdate: "11/11/1999", height: "170", natMatches: 8, goals: 0, assists: 0, yellowCards: 0, redCards: 0, suspended: false, history: [
    { year: "2020–present", event: "Stade Tunisien (TUN)" },
    { year: "2017–2020", event: "ASF Bou Hajla (TUN)" },
  ]},

  // ═══ DEFENDERS ═══
  { name: "Chaima Abbassi", club: "AS KASSERINE", position: "DEFENDER", birthdate: "04/09/1997", height: "165", natMatches: 44, goals: 2, assists: 3, yellowCards: 1, redCards: 0, suspended: false, history: [
    { year: "2019–present", event: "AS Kasserine (TUN)" },
    { year: "2015–2019", event: "ASF Sousse (TUN)" },
  ]},
  { name: "Samia Aouni", club: "CA BIZERTIN", position: "DEFENDER", birthdate: "17/06/1996", height: "168", natMatches: 38, goals: 1, assists: 2, yellowCards: 0, redCards: 0, suspended: false, history: [
    { year: "2018–present", event: "CA Bizertin (TUN)" },
    { year: "2014–2018", event: "ASF Bou Hajla (TUN)" },
  ]},
  { name: "Norhene Bettoumi", club: "AS MARSA", position: "DEFENDER", birthdate: "22/03/2000", height: "163", natMatches: 30, goals: 0, assists: 1, yellowCards: 1, redCards: 0, suspended: false, history: [
    { year: "2020–present", event: "AS Marsa (TUN)" },
    { year: "2017–2020", event: "ASF Sousse (TUN)" },
  ]},
  { name: "Myriam Bayahia", club: "AL AHLY JEDDAH", position: "DEFENDER", birthdate: "08/01/1998", height: "167", natMatches: 35, goals: 1, assists: 4, yellowCards: 0, redCards: 0, suspended: false, history: [
    { year: "2023–present", event: "Al Ahly Jeddah (KSA)" },
    { year: "2021–2023", event: "AS Marsa (TUN)" },
    { year: "2017–2021", event: "ASF Sousse (TUN)" },
  ]},
  { name: "Yesmin Khanchouch", club: "OLYMPIC BÉJA", position: "DEFENDER", birthdate: "14/05/1999", height: "164", natMatches: 25, goals: 1, assists: 2, yellowCards: 0, redCards: 0, suspended: false, history: [
    { year: "2021–present", event: "Olympic Béja (TUN)" },
    { year: "2018–2021", event: "ASF Bou Hajla (TUN)" },
  ]},
  { name: "Ghada Ayadi", club: "AS MARSA", position: "DEFENDER", birthdate: "30/10/2002", height: "166", natMatches: 18, goals: 0, assists: 1, yellowCards: 0, redCards: 0, suspended: false, history: [
    { year: "2022–present", event: "AS Marsa (TUN)" },
    { year: "2019–2022", event: "ESS Féminin (TUN)" },
  ]},
  { name: "Mariem Barhoumi", club: "ESS FÉMININ", position: "DEFENDER", birthdate: "03/03/2001", height: "162", natMatches: 16, goals: 0, assists: 0, yellowCards: 0, redCards: 0, suspended: false, history: [
    { year: "2021–present", event: "ESS Féminin (TUN)" },
    { year: "2018–2021", event: "ASF Sousse (TUN)" },
  ]},

  // ═══ MIDFIELDERS ═══
  { name: "Chirine Lamti", club: "STADE TUNISIEN", position: "MIDFIELDER", birthdate: "19/08/1996", height: "160", natMatches: 52, goals: 6, assists: 11, yellowCards: 2, redCards: 0, suspended: false, history: [
    { year: "2018–present", event: "Stade Tunisien (TUN)" },
    { year: "2014–2018", event: "ES Tunis (TUN)" },
    { year: "2012–2014", event: "ASF Bou Hajla (TUN)" },
  ]},
  { name: "Yosra Ben Hadj Mahmoud", club: "CA BIZERTIN", position: "MIDFIELDER", birthdate: "27/11/1997", height: "158", natMatches: 46, goals: 4, assists: 9, yellowCards: 1, redCards: 0, suspended: false, history: [
    { year: "2019–present", event: "CA Bizertin (TUN)" },
    { year: "2015–2019", event: "AS Kasserine (TUN)" },
  ]},
  { name: "Sabah Shaiek", club: "AL WAHDA ABU DHABI", position: "MIDFIELDER", birthdate: "11/02/1995", height: "162", natMatches: 60, goals: 8, assists: 14, yellowCards: 0, redCards: 0, suspended: false, history: [
    { year: "2024–present", event: "Al Wahda Abu Dhabi (UAE)" },
    { year: "2019–2024", event: "ES Tunis (TUN)" },
    { year: "2015–2019", event: "ASF Sousse (TUN)" },
    { year: "2012–2015", event: "ASF Bou Hajla (TUN)" },
  ]},
  { name: "Sarah Ben Mbarek", club: "ANDERLECHT", position: "MIDFIELDER", birthdate: "05/07/2000", height: "161", natMatches: 34, goals: 3, assists: 7, yellowCards: 0, redCards: 0, suspended: false, history: [
    { year: "2023–present", event: "RSC Anderlecht (BEL)" },
    { year: "2021–2023", event: "ES Tunis (TUN)" },
    { year: "2018–2021", event: "ASF Sousse (TUN)" },
  ]},
  { name: "Rania Aouina", club: "ES TUNIS", position: "MIDFIELDER", birthdate: "23/04/2002", height: "159", natMatches: 22, goals: 2, assists: 5, yellowCards: 0, redCards: 0, suspended: false, history: [
    { year: "2021–present", event: "ES Tunis (TUN)" },
    { year: "2018–2021", event: "ESS Féminin (TUN)" },
  ]},
  { name: "Salma Marzouki", club: "AS MARSA", position: "MIDFIELDER", birthdate: "10/12/1999", height: "163", natMatches: 20, goals: 1, assists: 3, yellowCards: 0, redCards: 0, suspended: false, history: [
    { year: "2020–present", event: "AS Marsa (TUN)" },
    { year: "2017–2020", event: "ASF Bou Hajla (TUN)" },
  ]},
  { name: "Wided Mejri", club: "CA BIZERTIN", position: "MIDFIELDER", birthdate: "07/09/2003", height: "157", natMatches: 14, goals: 0, assists: 2, yellowCards: 0, redCards: 0, suspended: false, history: [
    { year: "2022–present", event: "CA Bizertin (TUN)" },
    { year: "2019–2022", event: "ESS Féminin (TUN)" },
  ]},
  { name: "Yasmine Khemila", club: "ES TUNIS", position: "MIDFIELDER", birthdate: "31/08/2001", height: "160", natMatches: 19, goals: 2, assists: 4, yellowCards: 0, redCards: 0, suspended: false, history: [
    { year: "2021–present", event: "ES Tunis (TUN)" },
    { year: "2018–2021", event: "ASF Sousse (TUN)" },
  ]},
  { name: "Ahlem Ammar", club: "STADE TUNISIEN", position: "MIDFIELDER", birthdate: "16/06/2004", height: "156", natMatches: 10, goals: 1, assists: 1, yellowCards: 0, redCards: 0, suspended: false, history: [
    { year: "2023–present", event: "Stade Tunisien (TUN)" },
    { year: "2020–2023", event: "ESS Féminin (TUN)" },
  ]},

  // ═══ FORWARDS ═══
  { name: "Mariem Houij", club: "ABHA CLUB", position: "FORWARD", birthdate: "08/08/1994", height: "168", natMatches: 72, goals: 31, assists: 18, yellowCards: 0, redCards: 0, suspended: false, history: [
    { year: "2024–present", event: "Abha Club (KSA)" },
    { year: "2022–2024", event: "Galatasaray (TUR)" },
    { year: "2020–2022", event: "AS Marsa (TUN)" },
    { year: "2017–2020", event: "ES Tunis (TUN)" },
    { year: "2013–2017", event: "ASF Sousse (TUN)" },
  ]},
  { name: "Sabrine Ellouzi", club: "EXCELSIOR ROTTERDAM", position: "FORWARD", birthdate: "14/04/1999", height: "165", natMatches: 48, goals: 14, assists: 10, yellowCards: 1, redCards: 0, suspended: false, history: [
    { year: "2023–present", event: "Excelsior Rotterdam (NED)" },
    { year: "2021–2023", event: "ES Tunis (TUN)" },
    { year: "2018–2021", event: "ASF Sousse (TUN)" },
  ]},
  { name: "Salma Zemzem", club: "STADE TUNISIEN", position: "FORWARD", birthdate: "20/03/2000", height: "162", natMatches: 33, goals: 10, assists: 6, yellowCards: 0, redCards: 0, suspended: false, history: [
    { year: "2020–present", event: "Stade Tunisien (TUN)" },
    { year: "2017–2020", event: "ASF Bou Hajla (TUN)" },
  ]},
  { name: "Nora Nouhaili", club: "CA BIZERTIN", position: "FORWARD", birthdate: "01/11/2001", height: "160", natMatches: 26, goals: 7, assists: 5, yellowCards: 0, redCards: 0, suspended: false, history: [
    { year: "2021–present", event: "CA Bizertin (TUN)" },
    { year: "2018–2021", event: "ASF Sousse (TUN)" },
  ]},
  { name: "Sana Guermazi", club: "AS KASSERINE", position: "FORWARD", birthdate: "06/07/2003", height: "163", natMatches: 18, goals: 4, assists: 3, yellowCards: 0, redCards: 0, suspended: false, history: [
    { year: "2022–present", event: "AS Kasserine (TUN)" },
    { year: "2019–2022", event: "ESS Féminin (TUN)" },
  ]},
  { name: "Amani Ayed", club: "ES TUNIS", position: "FORWARD", birthdate: "25/09/2002", height: "158", natMatches: 15, goals: 3, assists: 2, yellowCards: 0, redCards: 0, suspended: false, history: [
    { year: "2022–present", event: "ES Tunis (TUN)" },
    { year: "2019–2022", event: "ASF Bou Hajla (TUN)" },
  ]},

  // ═══ ADDITIONAL SCOUTED PLAYERS ═══
  { name: "Ella Kaabachi", club: "AS MARSA", position: "MIDFIELDER", birthdate: "12/03/1995", height: "161", natMatches: 39, goals: 11, assists: 14, yellowCards: 0, redCards: 0, suspended: false, history: [
    { year: "2020–present", event: "AS Marsa (TUN)" },
    { year: "2017–2020", event: "ES Tunis (TUN)" },
    { year: "2013–2017", event: "ASF Sousse (TUN)" },
  ]},
  { name: "Yasmine Klai", club: "US SALERNITANA 1919", position: "MIDFIELDER", birthdate: "10/06/2003", height: "164", natMatches: 18, goals: 3, assists: 7, yellowCards: 0, redCards: 0, suspended: false, history: [
    { year: "2024–present", event: "US Salernitana 1919 (ITA)" },
    { year: "2021–2024", event: "ES Tunis (TUN)" },
  ]},
  { name: "Nadia Ben Salem", club: "FC METZ", position: "DEFENDER", birthdate: "05/02/2000", height: "170", natMatches: 22, goals: 1, assists: 2, yellowCards: 0, redCards: 0, suspended: false, history: [
    { year: "2023–present", event: "FC Metz (FRA)" },
    { year: "2020–2023", event: "AS Marsa (TUN)" },
  ]},
  { name: "Amira Mzoughi", club: "PARIS FC", position: "FORWARD", birthdate: "18/09/2001", height: "166", natMatches: 20, goals: 6, assists: 4, yellowCards: 0, redCards: 0, suspended: false, history: [
    { year: "2024–present", event: "Paris FC (FRA)" },
    { year: "2021–2024", event: "ES Tunis (TUN)" },
  ]},
  { name: "Ines Mami", club: "STADE DE REIMS", position: "MIDFIELDER", birthdate: "22/11/2002", height: "163", natMatches: 15, goals: 2, assists: 3, yellowCards: 0, redCards: 0, suspended: false, history: [
    { year: "2024–present", event: "Stade de Reims (FRA)" },
    { year: "2021–2024", event: "AS Marsa (TUN)" },
  ]},
  { name: "Hela Ben Ali", club: "CA BIZERTIN", position: "DEFENDER", birthdate: "08/04/2003", height: "165", natMatches: 12, goals: 0, assists: 1, yellowCards: 0, redCards: 0, suspended: false, history: [
    { year: "2022–present", event: "CA Bizertin (TUN)" },
    { year: "2019–2022", event: "ASF Sousse (TUN)" },
  ]},
]

export function searchPlayerDatabase(name: string): { found: boolean; data?: PlayerRecord } {
  const q = name.toLowerCase().trim()
  const exact = DB.find(p => p.name.toLowerCase() === q)
  if (exact) return { found: true, data: exact }

  const parts = q.split(" ")
  const fuzzy = DB.filter(p => {
    const pName = p.name.toLowerCase()
    return parts.every(part => pName.includes(part))
  })
  if (fuzzy.length === 1) return { found: true, data: fuzzy[0] }
  if (fuzzy.length > 1) return { found: true, data: fuzzy[0] }

  const lastName = parts[parts.length - 1]
  const byLast = DB.filter(p => p.name.toLowerCase().includes(lastName))
  if (byLast.length > 0) return { found: true, data: byLast[0] }

  return { found: false }
}

export function getAllPlayerNames(): string[] {
  return DB.map(p => p.name)
}
