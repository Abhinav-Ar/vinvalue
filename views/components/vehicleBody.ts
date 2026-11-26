/**
 * Picks the line drawing that matches a car's real body style. One classifier for the whole app.
 *
 * Order: a known model (most reliable), refined by the decoded NHTSA body class when the model
 * comes in several styles (Civic sedan vs hatchback, Camaro coupe vs convertible), then the body
 * class alone, then sedan.
 *
 * Names are compared "compressed": lower case, letters and digits only, so "CR-V", "CRV" and
 * "cr v" are the same, and "F-150" equals "F150". A model matches a key when it starts with it;
 * the longest key wins ("Civic Hatchback" beats "Civic", "Mustang Mach-E" beats "Mustang").
 * Keys written "make:model" only apply to that make (Toyota "86", Kia "K5", Mazda "3").
 */
import type { CarVariant } from './CarDrawing';

const MODELS: Record<CarVariant, string> = {
  sedan: `
    camry corolla avalon crown mirai
    accord civic insight clarity
    altima sentra maxima versa
    elantra sonata accent ioniq6 genesis genesis:g70 genesis:g80 genesis:g90 azera equus
    forte k5 optima rio stinger cadenza k900
    impreza legacy wrx
    mazda:3 mazda3 mazda:6 mazda6
    jetta passat arteon cc
    malibu impala cruze volt
    fusion taurus focus crownvictoria
    chrysler:300 chrysler:200
    tesla:model3 tesla:models model3 models
    3series 5series 7series i4 i5 i7 m3 m5 2seriesgrancoupe
    cclass eclass sclass cla eqe eqs
    a3 a4 a5sportback a6 a7 a8 s3 s4 s6 s8 rs3 rs7 etrongt
    es is ls gs hs
    tlx ilx rlx tl tsx integra
    q50 q70 g37 g35
    s60 s90
    ct4 ct5 ct6 cts ats xts
    mks mkz continental
    regal lacrosse verano
    ghibli quattroporte
    giulia
    lucid:air polestar:2
    panamera taycan
    ghost phantom flyingspur
    xe xf xj
  `,
  coupe: `
    toyota:86 gr86 brz frs
    4series 2series 6series 8series m2 m4 m6 m8
    rc lc sc
    infiniti:q60 g37coupe
    civiccoupe accordcoupe genesiscoupe tiburon
    cclasscoupe eclasscoupe
    a5 s5 rs5 tt
    370z 350z nissan:300zx nissan:z
    rx8 rx7
    eclipse
    clk
  `,
  gt: `
    supra grsupra 911 cayman 718cayman nsx gtr
    r8 huracan aventador revuelto
    corvette viper
    ferrari:roma ferrari:portofino 296 488 458 f8 812 sf90
    mclaren 570s 720s 750s artura mclaren:gt
    vantage db11 db12 dbs
    continentalgt
    amggt sls slr
    lotus:emira evora exige
    rcf
    granturismo mc20
    i8
  `,
  muscle: `
    mustang camaro challenger charger chevelle gto firebird transam nova cuda barracuda
  `,
  roadster: `
    mx5 miata boxster 718boxster z4 s2000 spider spyder 124spider roadster
    slk slc sl
    elise lotus:elan
    solstice sky
  `,
  hatch: `
    golf gti golfr
    fit yaris
    civichatchback civictyper
    corollahatchback mazda3hatchback
    veloster
    bolt spark
    focusst fiestast fiesta
    mini:cooper mini:hardtop cooper
    fiat:500 500e
    leaf prius
    ioniq
    i3
    rio5 soul versanote
  `,
  wagon: `
    outback
    v60 v90 v70 xc70
    allroad a4allroad a6allroad
    golfsportwagen golfalltrack alltrack sportwagen
    eclasswagon
    magnum taurusx
    tsxsportwagon
    panamerasporttourismo taycancrosstur
    regaltourx
    mazda6wagon
  `,
  crossover: `
    modelx modely tesla:modelx tesla:modely
    mustangmache mache
    tucson ioniq5 ioniq9 kona konaelectric niro ev6 ev9 seltos sportage sorento
    rav4 chr venza bz4x corollacross
    crv hrv zrv prologue
    rogue kicks murano ariya juke qashqai
    cx3 cx30 cx5 cx50 cx70 mx30
    crosstrek forester solterra
    tiguan id4 atlascrosssport taos
    equinox trax trailblazer blazer bolteuv
    escape edge ecosport broncosport
    terrain compass renegade
    q3 q4 q5 q8 sq5 sq8 q4etron etron qe
    x1 x2 x3 x4 x6 ix ix3 xm
    gla glb glc glk gle eqb eqc
    nx ux rx rz
    rdx mdx zdx
    qx30 qx50 qx55 qx60
    xc40 xc60 c40 ex30 ex40
    macan cayenne
    stelvio tonale
    levante grecale
    eclipsecross outlandersport outlander rvr
    encore envision envista
    xt4 xt5 xt6 lyriq optiq
    corsair nautilus mkc mkx
    gv60 gv70 gv80
    rivian:r2 r2
    polestar:3 polestar:4
    lucid:gravity
    mini:countryman countryman
    urus purosangue dbx bentayga cullinan
    fpace epace ipace
    evoque velar discoverysport
  `,
  suv: `
    4runner landcruiser sequoia fjcruiser highlander grandhighlander lx gx
    tahoe suburban yukon escalade traverse
    expedition explorer navigator aviator bronco
    wrangler grandcherokee cherokee wagoneer grandwagoneer commander
    durango
    pathfinder armada xterra
    pilot passport
    telluride palisade santafe
    atlas ascent cx9 cx90
    acadia enclave
    qx80 qx56
    gclass g550 g63 gls gl
    x5 x7 q7 sq7
    xc90 ex90
    defender rangerover discovery lr4 lr3
    rivian:r1s r1s
    hummerev h2 h3
    montero pajero
  `,
  van: `
    sienna odyssey pacifica voyager carnival sedona quest grandcaravan caravan townandcountry routan
    transit transitconnect econoline express savana sprinter metris nv200 nv promaster promastercity
    idbuzz previa estima mpv mazda5
    uplander venture montana freestar windstar
  `,
  truck: `
    f150 f250 f350 f450 superduty lightning maverick ranger
    silverado colorado avalanche s10 ssr
    sierra canyon hummerevpickup
    ram 1500 2500 3500 dakota
    tacoma tundra t100
    frontier titan
    ridgeline gladiator santacruz
    cybertruck
    rivian:r1t r1t
    hilux
  `,
};

/** key -> variant. Keys written "make:model" only match that make. */
const TABLE = new Map<string, CarVariant>();
for (const [variant, list] of Object.entries(MODELS) as [CarVariant, string][]) {
  for (const key of list.split(/\s+/)) if (key && !TABLE.has(key)) TABLE.set(key, variant);
}

export function compress(s: string | null | undefined): string {
  return (s ?? '').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]/g, '');
}

function fromModel(make: string, model: string): CarVariant | null {
  if (!model) return null;
  let best: { len: number; v: CarVariant } | null = null;
  for (const [key, v] of TABLE) {
    const i = key.indexOf(':');
    const keyMake = i >= 0 ? key.slice(0, i) : null;
    const keyModel = i >= 0 ? key.slice(i + 1) : key;
    if (keyMake && keyMake !== make) continue;
    if (!model.startsWith(keyModel)) continue;
    // Make-specific keys beat generic ones of the same length.
    const len = keyModel.length + (keyMake ? 0.5 : 0);
    if (!best || len > best.len) best = { len, v };
  }
  return best?.v ?? null;
}

function fromBody(body: string): CarVariant | null {
  if (!body) return null;
  if (/pickup/i.test(body)) return 'truck';
  if (/minivan|\bvan\b|cargo/i.test(body)) return 'van';
  if (/crossover|\bcuv\b/i.test(body)) return 'crossover';
  if (/sport utility|\bsuv\b|multi-purpose|\bmpv\b/i.test(body)) return 'suv';
  if (/wagon/i.test(body)) return 'wagon';
  if (/hatchback|liftback/i.test(body)) return 'hatch';
  if (/convertible|cabriolet|roadster/i.test(body)) return 'roadster';
  if (/coupe/i.test(body)) return 'coupe';
  if (/sedan|saloon|notchback/i.test(body)) return 'sedan';
  return null;
}

/** Variants a decoded body class may refine (a sedan-family model sold as a wagon, a coupe sold as a convertible). */
const OPEN_TOP_FROM: CarVariant[] = ['coupe', 'gt', 'muscle', 'sedan'];
const CAR_FAMILY: CarVariant[] = ['sedan', 'coupe', 'hatch', 'wagon'];

/** Makes, compressed, for labels that arrive as one string ("Tesla Model X"). Longest first. */
const MAKES = ['mercedesbenz', 'landrover', 'astonmartin', 'alfaromeo', 'rollsroyce', 'volkswagen', 'chevrolet', 'mitsubishi', 'lamborghini',
  'cadillac', 'chrysler', 'infiniti', 'maserati', 'porsche', 'genesis', 'hyundai', 'lincoln', 'mclaren', 'ferrari', 'pontiac', 'polestar',
  'bentley', 'jaguar', 'subaru', 'toyota', 'nissan', 'rivian', 'lexus', 'acura', 'buick', 'dodge', 'mazda', 'tesla', 'volvo', 'lotus',
  'lucid', 'honda', 'mini', 'fiat', 'jeep', 'ford', 'audi', 'bmw', 'gmc', 'kia', 'ram'];

export function carVariant(make: string | null | undefined, model: string | null | undefined, body?: string | null): CarVariant {
  let mk = compress(make);
  // Labels like "Ford Mustang GT" sometimes arrive as the model: drop a leading make.
  let md = compress(model);
  if (!mk) {
    const found = MAKES.find((m) => md.startsWith(m) && md.length > m.length);
    if (found) mk = found;
  }
  if (mk && md.startsWith(mk) && md.length > mk.length) md = md.slice(mk.length);
  const byModel = fromModel(mk, md);
  const byBody = fromBody(body ?? '');
  if (byModel) {
    if (byBody === 'roadster' && OPEN_TOP_FROM.includes(byModel)) return 'roadster';
    if (byBody && CAR_FAMILY.includes(byModel) && CAR_FAMILY.includes(byBody)) return byBody;
    return byModel;
  }
  return byBody ?? 'sedan';
}
