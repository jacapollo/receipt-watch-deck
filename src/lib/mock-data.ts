// All data here is FICTIONAL — illustrative sample for the PolySnitch demo.
// No real people, real votes, or real funding amounts are referenced.

export type Level = "federal" | "state" | "local";
export type Party = "D" | "R" | "I";
export type ActionType = "VOTE" | "BILL" | "STATEMENT" | "FUNDING" | "PUBLIC EVENT";
export type BillStatus = "Introduced" | "In Committee" | "Passed" | "Signed" | "Failed";

export interface Official {
  id: string;
  name: string;
  office: string;
  level: Level;
  state: string;
  district: string;
  party: Party;
  termStart: string;
  termEnd: string;
  photoSeed: string;
  bio: string;
  stats: {
    billsSponsored: number;
    attendance: number; // %
    topSector: string;
    alignment: string; // e.g. "Party 92%"
  };
}

export interface OfficialAction {
  id: string;
  officialId: string;
  type: ActionType;
  summary: string;
  detail?: string;
  source: string;
  sourceUrl: string;
  timestamp: string; // ISO
  comments: number;
  upvotes: number;
}

export interface FundingItem {
  donor: string;
  sector: string;
  amount: number;
  type: "PAC" | "Individual" | "Self" | "Party";
}

export interface Bill {
  id: string;
  title: string;
  summary: string;
  level: Level;
  status: BillStatus;
  sponsors: string[]; // official ids
  tags: string[];
  introduced: string;
  votes?: { officialId: string; vote: "Yea" | "Nay" | "Present" | "Absent" }[];
}

export interface Thread {
  id: string;
  title: string;
  body: string;
  author: string;
  tags: string[];
  scope: string; // "CA-12" or "Federal" etc.
  upvotes: number;
  downvotes: number;
  createdAt: string;
  comments: Comment[];
  relatedOfficialId?: string;
}

export interface Comment {
  id: string;
  author: string;
  body: string;
  upvotes: number;
  createdAt: string;
  replies?: Comment[];
}

const iso = (daysAgo: number, hour = 9) => {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  d.setHours(hour, Math.floor(Math.random() * 59), 0, 0);
  return d.toISOString();
};

export const officials: Official[] = [
  {
    id: "fed-sen-ca-holloway",
    name: "Sen. Margaret Holloway",
    office: "U.S. Senator",
    level: "federal",
    state: "CA",
    district: "California (Statewide)",
    party: "D",
    termStart: "2023-01-03",
    termEnd: "2029-01-03",
    photoSeed: "holloway",
    bio: "Sample senator profile. All data illustrative.",
    stats: { billsSponsored: 41, attendance: 94, topSector: "Tech / Communications", alignment: "Party 92%" },
  },
  {
    id: "fed-sen-ca-vance",
    name: "Sen. Curtis Vance",
    office: "U.S. Senator",
    level: "federal",
    state: "CA",
    district: "California (Statewide)",
    party: "D",
    termStart: "2021-01-03",
    termEnd: "2027-01-03",
    photoSeed: "vance",
    bio: "Sample senator profile.",
    stats: { billsSponsored: 27, attendance: 88, topSector: "Finance / Insurance", alignment: "Party 86%" },
  },
  {
    id: "fed-rep-ca12-okafor",
    name: "Rep. Adaeze Okafor",
    office: "U.S. Representative",
    level: "federal",
    state: "CA",
    district: "CA-12",
    party: "D",
    termStart: "2023-01-03",
    termEnd: "2027-01-03",
    photoSeed: "okafor",
    bio: "Sample U.S. House profile.",
    stats: { billsSponsored: 19, attendance: 97, topSector: "Labor", alignment: "Party 81%" },
  },
  {
    id: "fed-rep-tx07-mendez",
    name: "Rep. Hector Mendez",
    office: "U.S. Representative",
    level: "federal",
    state: "TX",
    district: "TX-07",
    party: "R",
    termStart: "2021-01-03",
    termEnd: "2027-01-03",
    photoSeed: "mendez",
    bio: "Sample U.S. House profile.",
    stats: { billsSponsored: 22, attendance: 91, topSector: "Oil & Gas", alignment: "Party 95%" },
  },
  {
    id: "gov-ca-rourke",
    name: "Gov. Daniel Rourke",
    office: "Governor",
    level: "state",
    state: "CA",
    district: "California",
    party: "D",
    termStart: "2023-01-02",
    termEnd: "2027-01-02",
    photoSeed: "rourke",
    bio: "Sample governor profile.",
    stats: { billsSponsored: 0, attendance: 100, topSector: "Real Estate", alignment: "Party 89%" },
  },
  {
    id: "gov-tx-barlow",
    name: "Gov. Patricia Barlow",
    office: "Governor",
    level: "state",
    state: "TX",
    district: "Texas",
    party: "R",
    termStart: "2023-01-17",
    termEnd: "2027-01-19",
    photoSeed: "barlow",
    bio: "Sample governor profile.",
    stats: { billsSponsored: 0, attendance: 100, topSector: "Energy", alignment: "Party 97%" },
  },
  {
    id: "ca-asm-14-park",
    name: "Asm. Jin Park",
    office: "State Assemblymember",
    level: "state",
    state: "CA",
    district: "AD-14",
    party: "D",
    termStart: "2024-12-02",
    termEnd: "2026-12-07",
    photoSeed: "park",
    bio: "Sample state assembly profile.",
    stats: { billsSponsored: 11, attendance: 93, topSector: "Education", alignment: "Party 90%" },
  },
  {
    id: "ca-sen-11-ortiz",
    name: "State Sen. Rosa Ortiz",
    office: "State Senator",
    level: "state",
    state: "CA",
    district: "SD-11",
    party: "D",
    termStart: "2022-12-05",
    termEnd: "2026-12-07",
    photoSeed: "ortiz",
    bio: "Sample state senate profile.",
    stats: { billsSponsored: 16, attendance: 95, topSector: "Healthcare", alignment: "Party 84%" },
  },
  {
    id: "tx-rep-78-callahan",
    name: "State Rep. Wesley Callahan",
    office: "State Representative",
    level: "state",
    state: "TX",
    district: "HD-78",
    party: "R",
    termStart: "2023-01-10",
    termEnd: "2027-01-12",
    photoSeed: "callahan",
    bio: "Sample state house profile.",
    stats: { billsSponsored: 9, attendance: 87, topSector: "Construction", alignment: "Party 93%" },
  },
  {
    id: "local-mayor-sf-bishop",
    name: "Mayor Cordelia Bishop",
    office: "Mayor",
    level: "local",
    state: "CA",
    district: "City of San Vicente",
    party: "D",
    termStart: "2024-01-08",
    termEnd: "2028-01-10",
    photoSeed: "bishop",
    bio: "Sample mayor profile.",
    stats: { billsSponsored: 0, attendance: 100, topSector: "Real Estate", alignment: "Coalition 73%" },
  },
  {
    id: "local-cc-sf-3-nguyen",
    name: "Councilmember Tam Nguyen",
    office: "City Council, District 3",
    level: "local",
    state: "CA",
    district: "San Vicente D3",
    party: "I",
    termStart: "2025-01-06",
    termEnd: "2029-01-08",
    photoSeed: "nguyen",
    bio: "Sample city council profile.",
    stats: { billsSponsored: 5, attendance: 96, topSector: "Small Business", alignment: "Coalition 61%" },
  },
  {
    id: "local-cc-sf-5-abernathy",
    name: "Councilmember Joel Abernathy",
    office: "City Council, District 5",
    level: "local",
    state: "CA",
    district: "San Vicente D5",
    party: "D",
    termStart: "2023-01-09",
    termEnd: "2027-01-11",
    photoSeed: "abernathy",
    bio: "Sample city council profile.",
    stats: { billsSponsored: 7, attendance: 89, topSector: "Hospitality", alignment: "Coalition 78%" },
  },
];

const actionTemplates: Record<ActionType, string[]> = {
  VOTE: [
    "Voted YEA on HR-2241 (Public Transit Modernization Act)",
    "Voted NAY on amendment to SB-118 stripping rent-cap protections",
    "Voted YEA on appropriations rider expanding broadband subsidies",
    "Voted NAY on motion to table the Police Oversight Act",
  ],
  BILL: [
    "Co-sponsored bill to limit no-bid municipal contracts over $250k",
    "Introduced bill requiring lobbyist disclosure within 48 hours",
    "Sponsored measure to fund 2,400 new affordable housing units",
    "Introduced resolution opposing federal infrastructure cuts",
  ],
  STATEMENT: [
    "Issued public statement opposing the proposed gas tax rollback",
    "Floor remarks defending committee subpoena power",
    "Press release endorsing school funding formula reform",
  ],
  FUNDING: [
    "Filed Q-report: $412,800 received this quarter — 38% from PACs",
    "Top quarterly donor sector shifted to Real Estate (was Tech)",
    "Reported $1.2M cycle total; small-dollar share fell to 11%",
  ],
  "PUBLIC EVENT": [
    "Held public town hall at Civic Center auditorium",
    "Spoke at chamber of commerce breakfast (open press)",
    "Hosted constituent office hours at district office",
  ],
};

const sources = [
  { src: "congress.gov", url: "https://www.congress.gov" },
  { src: "fec.gov", url: "https://www.fec.gov" },
  { src: "leginfo.ca.gov", url: "https://leginfo.legislature.ca.gov" },
  { src: "capitol.texas.gov", url: "https://capitol.texas.gov" },
  { src: "city clerk records", url: "#" },
  { src: "official press office", url: "#" },
];

function generateActions(): OfficialAction[] {
  const all: OfficialAction[] = [];
  let dayCounter = 0;
  officials.forEach((o) => {
    const types: ActionType[] = ["VOTE", "BILL", "STATEMENT", "FUNDING", "PUBLIC EVENT"];
    const count = 7 + Math.floor(Math.random() * 4);
    for (let i = 0; i < count; i++) {
      const type = types[(i + o.id.length) % types.length];
      const template = actionTemplates[type][i % actionTemplates[type].length];
      const source = sources[(i + o.id.length) % sources.length];
      all.push({
        id: `${o.id}-act-${i}`,
        officialId: o.id,
        type,
        summary: template,
        source: source.src,
        sourceUrl: source.url,
        timestamp: iso(dayCounter++ * 0.3 + Math.random() * 0.5, 8 + (i % 10)),
        comments: Math.floor(Math.random() * 240),
        upvotes: Math.floor(Math.random() * 1800),
      });
    }
  });
  return all.sort((a, b) => +new Date(b.timestamp) - +new Date(a.timestamp));
}

export const actions: OfficialAction[] = generateActions();

// Deterministic per-official funding profiles, biased toward each official's topSector.
// Sector pools list candidate interest-sector PAC donors (no "Individual", "Party", or "Self" here).
const sectorDonorPool: Record<string, string[]> = {
  "Real Estate": ["Pinnacle Realty PAC", "Coastal Developers Assn.", "Urban Land Council PAC", "Skyline Property Group"],
  "Energy": ["Atlas Energy Coalition", "Continental Grid PAC", "Western Power Alliance", "Heartland Utilities PAC"],
  "Oil & Gas": ["Permian Producers PAC", "Lone Star Petroleum Assn.", "Gulf Drillers Coalition", "Pipeline Workers PAC"],
  "Education": ["United Educators Fund", "Charter Schools Now PAC", "State Teachers Assn.", "Higher Ed Advocates PAC"],
  "Tech / Communications": ["Bay Tech Workers United", "Pacific Software Alliance", "Wireless Carriers PAC", "Cloud Industry Council"],
  "Tech": ["Bay Tech Workers United", "Pacific Software Alliance", "Wireless Carriers PAC", "Cloud Industry Council"],
  "Finance / Insurance": ["Pacific Mutual PAC", "Federated Bankers Assn.", "Securities Industry PAC", "Insurance Underwriters Fund"],
  "Healthcare": ["Healthcare Access Now", "Hospital Systems Council", "Nurses United PAC", "Pharma Innovators PAC"],
  "Labor": ["Service Workers Local 1199", "Building Trades Council", "Hospitality Workers Local 802", "Teamsters Joint Council"],
  "Construction": ["Associated Builders PAC", "Heavy Equipment Operators", "Concrete & Aggregate PAC", "Subcontractors Alliance"],
  "Hospitality": ["Restaurant Owners Assn.", "Hotel & Lodging PAC", "Tourism Council PAC", "Beverage Distributors PAC"],
  "Small Business": ["Main Street Alliance", "Independent Retailers PAC", "Local Chambers Coalition", "Family Business Council"],
};

const secondarySectors = ["Real Estate", "Finance / Insurance", "Healthcare", "Tech", "Labor", "Education", "Energy", "Construction"];

function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function makeRng(seed: number) {
  let s = seed || 1;
  return () => {
    s = Math.imul(s ^ (s >>> 15), 2246822507);
    s = Math.imul(s ^ (s >>> 13), 3266489909);
    s ^= s >>> 16;
    return (s >>> 0) / 4294967296;
  };
}

function buildFundingFor(o: Official): FundingItem[] {
  const rng = makeRng(hashStr(o.id));
  const items: FundingItem[] = [];
  const top = o.stats.topSector;
  const topPool = sectorDonorPool[top] ?? sectorDonorPool[secondarySectors[Math.floor(rng() * secondarySectors.length)]];

  // 3 heavy donors in the official's top sector
  const heavyCount = 3;
  for (let i = 0; i < heavyCount; i++) {
    items.push({
      donor: topPool[i % topPool.length],
      sector: top,
      amount: Math.round((35000 + rng() * 45000) / 100) * 100,
      type: "PAC",
    });
  }

  // 2 secondary sector donors (different from top)
  const others = secondarySectors.filter((s) => s !== top);
  for (let i = 0; i < 2; i++) {
    const sec = others[Math.floor(rng() * others.length)];
    const pool = sectorDonorPool[sec];
    items.push({
      donor: pool[Math.floor(rng() * pool.length)],
      sector: sec,
      amount: Math.round((8000 + rng() * 22000) / 100) * 100,
      type: "PAC",
    });
  }

  // Individuals (always)
  items.push({
    donor: "Small-dollar donors (avg $34)",
    sector: "Individual",
    amount: Math.round((20000 + rng() * 140000) / 100) * 100,
    type: "Individual",
  });

  // Party (most have one)
  if (rng() > 0.15) {
    items.push({
      donor: o.party === "R" ? "State Republican Committee" : o.party === "D" ? "State Democratic Committee" : "Independent Caucus Fund",
      sector: "Party",
      amount: Math.round((10000 + rng() * 70000) / 100) * 100,
      type: "Party",
    });
  }

  // Self-funding (some)
  if (rng() > 0.7) {
    items.push({
      donor: `${o.name.split(" ").slice(-1)[0]} for ${o.state}`,
      sector: "Self",
      amount: Math.round((5000 + rng() * 60000) / 100) * 100,
      type: "Self",
    });
  }

  return items;
}

export const funding: Record<string, FundingItem[]> = Object.fromEntries(
  officials.map((o) => [o.id, buildFundingFor(o)]),
);

export const bills: Bill[] = [
  {
    id: "bill-hr-2241",
    title: "HR-2241 — Public Transit Modernization Act",
    summary:
      "Authorizes $14B over 5 years for bus, rail, and accessibility upgrades; requires transparent procurement above $500k.",
    level: "federal",
    status: "In Committee",
    sponsors: ["fed-rep-ca12-okafor", "fed-sen-ca-holloway"],
    tags: ["Transit", "Infrastructure", "Spending"],
    introduced: iso(22),
    votes: [
      { officialId: "fed-sen-ca-holloway", vote: "Yea" },
      { officialId: "fed-sen-ca-vance", vote: "Yea" },
      { officialId: "fed-rep-ca12-okafor", vote: "Yea" },
      { officialId: "fed-rep-tx07-mendez", vote: "Nay" },
    ],
  },
  {
    id: "bill-sb-118",
    title: "SB-118 — Renter Stability & Cap Reform",
    summary:
      "Caps annual residential rent increases at CPI+3% statewide and creates a renter relocation fund.",
    level: "state",
    status: "Passed",
    sponsors: ["ca-sen-11-ortiz", "ca-asm-14-park"],
    tags: ["Housing", "Renters"],
    introduced: iso(63),
    votes: [
      { officialId: "ca-sen-11-ortiz", vote: "Yea" },
      { officialId: "ca-asm-14-park", vote: "Yea" },
    ],
  },
  {
    id: "bill-hb-991",
    title: "HB-991 — Oil & Gas Setback Rollback",
    summary:
      "Reduces minimum drilling setback from schools and homes from 1,500 ft to 500 ft.",
    level: "state",
    status: "Introduced",
    sponsors: ["tx-rep-78-callahan"],
    tags: ["Energy", "Environment"],
    introduced: iso(11),
  },
  {
    id: "bill-ord-44",
    title: "Ord. 44-2026 — Lobbyist 48-Hour Disclosure",
    summary:
      "Requires all paid municipal lobbyists to file contact disclosures within 48 hours.",
    level: "local",
    status: "Signed",
    sponsors: ["local-cc-sf-3-nguyen"],
    tags: ["Ethics", "Transparency"],
    introduced: iso(94),
  },
  {
    id: "bill-ord-58",
    title: "Ord. 58-2026 — Affordable Housing Bond",
    summary:
      "Authorizes $480M bond for 2,400 new affordable units across the city.",
    level: "local",
    status: "In Committee",
    sponsors: ["local-cc-sf-5-abernathy", "local-mayor-sf-bishop"],
    tags: ["Housing", "Spending"],
    introduced: iso(8),
  },
  {
    id: "bill-hr-3010",
    title: "HR-3010 — Algorithmic Transparency Act",
    summary:
      "Requires platforms above 50M users to publish recommender-system audits annually.",
    level: "federal",
    status: "Introduced",
    sponsors: ["fed-rep-ca12-okafor"],
    tags: ["Tech", "Transparency"],
    introduced: iso(5),
  },
  {
    id: "bill-sb-7",
    title: "SB-7 — Police Oversight Board Authority",
    summary:
      "Expands civilian oversight board subpoena power for sworn officer misconduct cases.",
    level: "state",
    status: "Failed",
    sponsors: ["ca-sen-11-ortiz"],
    tags: ["Policing", "Civil Rights"],
    introduced: iso(140),
  },
];

const anonHandles = [
  "civic_owl_47",
  "ledger_rat",
  "block_by_block",
  "sunlight_only",
  "ward_3_lurker",
  "the_minutes",
  "filer_404",
  "open_records_fan",
  "district_ghost",
  "subpoena_szn",
];

export const threads: Thread[] = [
  {
    id: "thr-1",
    title: "Why is the housing bond in committee for 3 months with no markup?",
    body: "Ord. 58 was introduced in early spring. Per the city clerk's site no committee hearings have been scheduled. Anyone have a council aide who'll talk on background?",
    author: anonHandles[0],
    tags: ["Housing", "Local"],
    scope: "San Vicente",
    upvotes: 412,
    downvotes: 18,
    createdAt: iso(2, 14),
    relatedOfficialId: "local-cc-sf-5-abernathy",
    comments: [
      {
        id: "c1",
        author: anonHandles[1],
        body: "Chair's calendar shows two cancelled hearings. Receipts in source link on the action card.",
        upvotes: 102,
        createdAt: iso(2, 16),
        replies: [
          {
            id: "c1r1",
            author: anonHandles[2],
            body: "Pinnacle Realty PAC also maxed out to two committee members last cycle. Public FEC-equivalent filing.",
            upvotes: 54,
            createdAt: iso(1, 9),
          },
        ],
      },
      {
        id: "c2",
        author: anonHandles[3],
        body: "Stick to the record — let's keep this on the public docket, not speculation.",
        upvotes: 71,
        createdAt: iso(1, 11),
      },
    ],
  },
  {
    id: "thr-2",
    title: "Sen. Holloway's Q-report — small-dollar share dropped to 11%",
    body: "Filings show a clear pivot to PAC money this cycle. Real Estate now the top sector. Discuss the public filing, not the person.",
    author: anonHandles[4],
    tags: ["Funding", "Federal"],
    scope: "Federal — CA",
    upvotes: 988,
    downvotes: 42,
    createdAt: iso(4, 10),
    relatedOfficialId: "fed-sen-ca-holloway",
    comments: [
      {
        id: "c3",
        author: anonHandles[5],
        body: "Cross-reference with the transit bill committee schedule — that's where the receipts are.",
        upvotes: 211,
        createdAt: iso(3, 13),
      },
    ],
  },
  {
    id: "thr-3",
    title: "HB-991 setback rollback — every committee member's stated reason",
    body: "Compiling the public floor statements so we can see the rationale side-by-side. Drop links to clips that are on the official record.",
    author: anonHandles[6],
    tags: ["Energy", "State"],
    scope: "Texas",
    upvotes: 624,
    downvotes: 73,
    createdAt: iso(6, 9),
    relatedOfficialId: "tx-rep-78-callahan",
    comments: [],
  },
  {
    id: "thr-4",
    title: "How to read a Q-report in 5 minutes (no spin)",
    body: "Quick guide — Schedule A is individuals, Schedule B is disbursements, look at itemized vs unitemized ratio.",
    author: anonHandles[7],
    tags: ["Guide", "Funding"],
    scope: "All",
    upvotes: 1820,
    downvotes: 31,
    createdAt: iso(11, 8),
    comments: [],
  },
];

// Districts on the fake map (illustrative geometry)
export interface MapDistrict {
  id: string;
  stateCode: string;
  name: string;
  level: "federal" | "state";
  d: string; // SVG path
  officialIds: string[];
}

export const states = [
  {
    code: "CA",
    name: "California",
    d: "M120 120 L220 110 L240 180 L260 260 L220 360 L140 360 L100 270 L110 200 Z",
    color: "#1c2230",
  },
  {
    code: "TX",
    name: "Texas",
    d: "M460 230 L600 220 L640 280 L620 360 L540 400 L460 380 L440 310 Z",
    color: "#1c2230",
  },
  {
    code: "NY",
    name: "New York",
    d: "M740 130 L840 120 L860 170 L820 210 L750 195 Z",
    color: "#1c2230",
  },
  {
    code: "FL",
    name: "Florida",
    d: "M700 360 L790 360 L820 410 L800 460 L740 460 L710 410 Z",
    color: "#1c2230",
  },
];

export const districts: MapDistrict[] = [
  {
    id: "CA-12",
    stateCode: "CA",
    name: "CA-12 (Bay Area)",
    level: "federal",
    d: "M120 120 L180 115 L185 175 L130 180 Z",
    officialIds: ["fed-rep-ca12-okafor", "fed-sen-ca-holloway", "fed-sen-ca-vance", "gov-ca-rourke"],
  },
  {
    id: "CA-AD-14",
    stateCode: "CA",
    name: "CA Assembly District 14",
    level: "state",
    d: "M125 185 L185 180 L195 240 L135 245 Z",
    officialIds: ["ca-asm-14-park", "gov-ca-rourke"],
  },
  {
    id: "CA-SD-11",
    stateCode: "CA",
    name: "CA Senate District 11",
    level: "state",
    d: "M135 250 L210 245 L225 320 L150 325 Z",
    officialIds: ["ca-sen-11-ortiz", "gov-ca-rourke"],
  },
  {
    id: "SV-Local",
    stateCode: "CA",
    name: "San Vicente (City)",
    level: "state",
    d: "M155 330 L210 325 L215 358 L165 360 Z",
    officialIds: [
      "local-mayor-sf-bishop",
      "local-cc-sf-3-nguyen",
      "local-cc-sf-5-abernathy",
    ],
  },
  {
    id: "TX-07",
    stateCode: "TX",
    name: "TX-07 (Houston area)",
    level: "federal",
    d: "M540 250 L605 245 L610 305 L545 310 Z",
    officialIds: ["fed-rep-tx07-mendez", "gov-tx-barlow"],
  },
  {
    id: "TX-HD-78",
    stateCode: "TX",
    name: "TX House District 78",
    level: "state",
    d: "M470 310 L545 305 L555 370 L480 375 Z",
    officialIds: ["tx-rep-78-callahan", "gov-tx-barlow"],
  },
];

export const trendingThreadIds = ["thr-2", "thr-1", "thr-3"];

export const topFunded = [
  { officialId: "fed-sen-ca-holloway", total: 1840000 },
  { officialId: "gov-ca-rourke", total: 1520000 },
  { officialId: "local-mayor-sf-bishop", total: 612000 },
  { officialId: "fed-rep-ca12-okafor", total: 480000 },
];

export function getOfficial(id: string) {
  return officials.find((o) => o.id === id);
}
export function getActionsFor(id: string) {
  return actions.filter((a) => a.officialId === id);
}
export function getThread(id: string) {
  return threads.find((t) => t.id === id);
}
export function getBill(id: string) {
  return bills.find((b) => b.id === id);
}

export function formatTimeAgo(iso: string): string {
  const diff = Date.now() - +new Date(iso);
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d`;
  return `${Math.floor(days / 30)}mo`;
}

export function formatStamp(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}Z`;
}

export function partyColor(p: Party): string {
  return p === "D" ? "var(--party-dem)" : p === "R" ? "var(--party-rep)" : "var(--party-ind)";
}
