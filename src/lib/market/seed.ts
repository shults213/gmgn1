import { hash32, mulberry32 } from "@/lib/utils";
import { emptyDev, type DevProfile } from "@/lib/screening/developer";
import type { TrendingRow } from "./types";

const B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

const NAMES: [string, string][] = [
  ["NOVA", "Nova Pup"],
  ["GLINT", "Glint Frog"],
  ["EMBER", "Ember Fox"],
  ["DRIFT", "Drift Kit"],
  ["HALO", "Halo Crab"],
  ["VEX", "Vex Otter"],
  ["QUILL", "Quill Hare"],
  ["BRINE", "Brine Seal"],
  ["KITE", "Kite Moth"],
  ["LOOM", "Loom Beetle"],
  ["PRISM", "Prism Eel"],
  ["RUST", "Rust Lynx"],
  ["SPARK", "Spark Goby"],
  ["TIDE", "Tide Wren"],
  ["UMBRA", "Umbra Cub"],
  ["VOLT", "Volt Gecko"],
  ["WISP", "Wisp Finch"],
  ["YARROW", "Yarrow Bat"],
  ["ZEST", "Zest Puffin"],
  ["ARROW", "Arrow Mole"],
  ["BOLT", "Bolt Ibis"],
  ["CROWN", "Crown Newt"],
  ["DUNE", "Dune Shrew"],
  ["ECHO", "Echo Tern"],
  ["FLINT", "Flint Toad"],
  ["GALE", "Gale Stoat"],
  ["HEARTH", "Hearth Jay"],
  ["IVORY", "Ivory Skink"],
  ["JADE", "Jade Minnow"],
  ["KNURL", "Knurl Dove"],
  ["LUMEN", "Lumen Carp"],
  ["MIRTH", "Mirth Rook"],
  ["NORTH", "North Pike"],
  ["ONYX", "Onyx Crane"],
  ["PULSE", "Pulse Mite"],
  ["QUARTZ", "Quartz Elk"],
  ["RIDGE", "Ridge Cod"],
  ["SABLE", "Sable Wren"],
  ["THORN", "Thorn Bass"],
  ["ULNA", "Ulna Crow"],
  ["VAULT", "Vault Perch"],
  ["WELD", "Weld Asp"],
  ["XENON", "Xenon Hare"],
  ["YIELD", "Yield Roach"],
  ["ZINC", "Zinc Gnat"],
  ["ASTER", "Aster Cub"],
  ["BRIAR", "Briar Eel"],
  ["CEDAR", "Cedar Pup"],
  ["DELTA", "Delta Fox"],
  ["ELDER", "Elder Frog"],
  ["FORGE", "Forge Crab"],
  ["GRAIN", "Grain Otter"],
  ["HUSK", "Husk Seal"],
  ["INLET", "Inlet Moth"],
  ["JORUM", "Jorum Beetle"],
  ["KELP", "Kelp Goby"],
  ["LEDGER", "Ledger Wren"],
  ["MARSH", "Marsh Cub"],
  ["NEEDLE", "Needle Finch"],
  ["ORBIT", "Orbit Bat"],
  ["PETAL", "Petal Puffin"],
  ["QUERN", "Quern Mole"],
  ["RAVEN", "Raven Ibis"],
  ["SCOUR", "Scour Newt"],
  ["TRUSS", "Truss Shrew"],
  ["UDDER", "Udder Tern"],
  ["VAPOR", "Vapor Toad"],
  ["WHARF", "Wharf Stoat"],
  ["XYLEM", "Xylem Jay"],
  ["YEW", "Yew Skink"],
  ["ZONAL", "Zonal Carp"],
  ["ALDER", "Alder Rook"],
  ["BASIN", "Basin Pike"],
  ["CRAG", "Crag Crane"],
  ["DOWER", "Dower Mite"],
  ["EMBER2", "Ember Elk"],
  ["FJORD", "Fjord Cod"],
  ["GROVE", "Grove Bass"],
  ["HILT", "Hilt Crow"],
  ["INLAY", "Inlay Perch"],
];

export type Archetype =
  | "survivor"
  | "late"
  | "watch"
  | "honeypot"
  | "mint"
  | "rug"
  | "bundler"
  | "top10"
  | "consensus"
  | "factory"
  | "bleed"
  | "distribute";

const ARCH: Archetype[] = [
  "survivor", "survivor", "survivor", "survivor", "survivor",
  "survivor", "survivor", "survivor", "survivor", "survivor",
  "late", "late", "watch", "watch",
  "honeypot", "honeypot", "mint", "mint", "mint",
  "rug", "rug", "bundler", "bundler", "top10", "top10",
  "consensus", "consensus", "consensus", "consensus",
  "factory", "factory", "factory", "factory",
  "bleed", "bleed", "bleed", "bleed", "bleed",
  "distribute", "distribute", "distribute", "distribute",
];

function addr(rng: () => number, len = 44): string {
  let s = "";
  for (let i = 0; i < len; i++) s += B58[Math.floor(rng() * B58.length)];
  return s;
}

function pick(rng: () => number, lo: number, hi: number): number {
  return lo + rng() * (hi - lo);
}

function archetypeFor(i: number): Archetype {
  return ARCH[i % ARCH.length] ?? "watch";
}

export function solAddress(seed: string): string {
  return addr(mulberry32(hash32(seed)));
}

export function buildUniverse(count = 80): {
  rows: TrendingRow[];
  profiles: Record<string, DevProfile>;
} {
  const now = Date.now() / 1000;
  const rows: TrendingRow[] = [];
  const profiles: Record<string, DevProfile> = {};

  for (let i = 0; i < count; i++) {
    const [symbol, name] = NAMES[i % NAMES.length] ?? [`TKN${i}`, `Token ${i}`];
    const unique = i >= NAMES.length ? `${symbol}${i}` : symbol;
    const rng = mulberry32(hash32(`gmgn-desk-${i}-${unique}`));
    const kind = archetypeFor(i);
    const creator = addr(rng);
    const address = addr(rng);
    const ageH = pick(rng, 0.4, 72);
    const created = now - ageH * 3600;

    const price = pick(rng, 0.000008, 0.004);
    const mcap = pick(rng, 18_000, 2_400_000);
    const liq = mcap * pick(rng, 0.08, 0.35);
    let vol = mcap * pick(rng, 0.4, 3.2);
    let ch5 = pick(rng, -8, 18);
    let ch1h = pick(rng, -20, 80);
    let buys = Math.round(pick(rng, 40, 900));
    let sells = Math.round(pick(rng, 40, 900));
    let rug = pick(rng, 0.02, 0.22);
    let bundler = pick(rng, 0.01, 0.18);
    let devHold = pick(rng, 0.01, 0.08);
    let top10 = pick(rng, 0.12, 0.32);
    let sm = Math.round(pick(rng, 0, 6));
    let kol = Math.round(pick(rng, 0, 4));
    let honeypot = false;
    let mint = true;
    let freeze = true;
    const sniper = Math.round(pick(rng, 0, 8));
    const tax = 0;

    if (kind === "survivor") {
      ch5 = pick(rng, 4, 22);
      ch1h = pick(rng, 8, 70);
      const buyRatio = pick(rng, 0.54, 0.72);
      const swaps = Math.round(pick(rng, 400, 1800));
      buys = Math.round(swaps * buyRatio);
      sells = swaps - buys;
      sm = Math.round(pick(rng, 2, 9));
      kol = Math.round(pick(rng, 1, 5));
      rug = pick(rng, 0.02, 0.18);
      bundler = pick(rng, 0.02, 0.16);
      vol = mcap * pick(rng, 1.1, 3.4);
    } else if (kind === "late") {
      ch5 = pick(rng, 2, 10);
      ch1h = pick(rng, 310, 480);
      const buyRatio = pick(rng, 0.51, 0.6);
      const swaps = Math.round(pick(rng, 800, 2400));
      buys = Math.round(swaps * buyRatio);
      sells = swaps - buys;
      sm = Math.round(pick(rng, 1, 5));
      kol = Math.round(pick(rng, 1, 4));
    } else if (kind === "watch") {
      ch5 = pick(rng, -1.5, 3);
      ch1h = pick(rng, 4, 18);
      const buyRatio = pick(rng, 0.46, 0.52);
      const swaps = Math.round(pick(rng, 200, 700));
      buys = Math.round(swaps * buyRatio);
      sells = swaps - buys;
      sm = Math.round(pick(rng, 1, 3));
    } else if (kind === "honeypot") {
      honeypot = true;
      ch5 = pick(rng, 10, 40);
    } else if (kind === "mint") {
      mint = false;
      freeze = rng() > 0.4;
    } else if (kind === "rug") {
      rug = pick(rng, 0.62, 0.92);
    } else if (kind === "bundler") {
      bundler = pick(rng, 0.34, 0.72);
    } else if (kind === "top10") {
      top10 = pick(rng, 0.48, 0.78);
      devHold = pick(rng, 0.04, 0.18);
    } else if (kind === "consensus") {
      sm = 0;
      kol = 0;
      ch5 = pick(rng, 6, 20);
      ch1h = pick(rng, 10, 40);
    } else if (kind === "factory") {
      sm = Math.round(pick(rng, 1, 4));
      kol = Math.round(pick(rng, 0, 2));
      ch5 = pick(rng, 5, 16);
      ch1h = pick(rng, 12, 50);
      const buyRatio = pick(rng, 0.52, 0.64);
      const swaps = Math.round(pick(rng, 300, 900));
      buys = Math.round(swaps * buyRatio);
      sells = swaps - buys;
    } else if (kind === "bleed") {
      ch5 = pick(rng, -18, -7);
      ch1h = pick(rng, -40, -14);
      sm = Math.round(pick(rng, 1, 3));
    } else if (kind === "distribute") {
      const buyRatio = pick(rng, 0.22, 0.4);
      const swaps = Math.round(pick(rng, 400, 1400));
      buys = Math.round(swaps * buyRatio);
      sells = swaps - buys;
      ch5 = pick(rng, -4, 8);
      ch1h = pick(rng, 6, 40);
      sm = Math.round(pick(rng, 1, 5));
    }

    const row: TrendingRow = {
      address,
      chain: "sol",
      symbol: unique,
      name: i >= NAMES.length ? `${name} ${i}` : name,
      price,
      market_cap: mcap,
      liquidity: liq,
      volume: vol,
      price_change_percent5m: ch5,
      price_change_percent1h: ch1h,
      buys,
      sells,
      swaps: buys + sells,
      holder_count: Math.round(pick(rng, 80, 4200)),
      creation_timestamp: created,
      rug_ratio: rug,
      is_honeypot: honeypot,
      is_wash_trading: kind === "honeypot" || kind === "bundler",
      renounced_mint: mint,
      renounced_freeze_account: freeze,
      buy_tax: tax,
      sell_tax: tax,
      bundler_rate: bundler,
      dev_team_hold_rate: devHold,
      top_10_holder_rate: top10,
      smart_degen_count: sm,
      renowned_count: kol,
      sniper_count: sniper,
      creator,
      launchpad: rng() > 0.25 ? "Pump.fun" : "pump_mayhem",
      creator_close: kind === "distribute",
      cto_flag: false,
      stage: "listed",
      progress: 0,
      complete: false,
      completeAt: 0,
      openAt: created,
      exchange: "",
    };
    rows.push(row);
    profiles[address] = makeProfile(kind, creator, rng);
  }

  return { rows, profiles };
}

function makeProfile(kind: Archetype, creator: string, rng: () => number): DevProfile {
  const p = emptyDev(creator);
  if (kind === "factory") {
    p.analyzed = Math.round(pick(rng, 24, 60));
    p.alive = Math.round(p.analyzed * pick(rng, 0.05, 0.18));
    p.rugged = p.analyzed - p.alive;
    p.rug_rate = p.rugged / p.analyzed;
    p.launches = p.analyzed;
    p.inner_count = Math.round(pick(rng, 180, 900));
    p.survival_rate = 1 - p.rug_rate;
    p.ath_mc = pick(rng, 20_000, 90_000);
    p.own_img_reuse = Math.round(pick(rng, 3, 8));
    p.exited = rng() > 0.4;
    p.sec_risk_rate = pick(rng, 0.4, 0.8);
    p.sec_unsafe = 2;
    p.sec_risks = ["mintable", "honeypot"];
    p.sec_checked = 3;
    return p;
  }
  if (kind === "survivor" || kind === "late") {
    p.analyzed = Math.round(pick(rng, 3, 12));
    p.alive = Math.max(1, Math.round(p.analyzed * pick(rng, 0.55, 0.9)));
    p.rugged = p.analyzed - p.alive;
    p.rug_rate = p.rugged / p.analyzed;
    p.launches = p.analyzed;
    p.inner_count = Math.round(pick(rng, 0, 20));
    p.survival_rate = 1 - p.rug_rate;
    p.ath_mc = pick(rng, 250_000, 8_000_000);
    p.own_img_reuse = rng() > 0.8 ? 1 : 0;
    p.cto = rng() > 0.85;
    p.sec_checked = 3;
    return p;
  }
  p.analyzed = Math.round(pick(rng, 2, 18));
  p.alive = Math.round(p.analyzed * pick(rng, 0.2, 0.6));
  p.rugged = p.analyzed - p.alive;
  p.rug_rate = p.analyzed ? p.rugged / p.analyzed : 0.4;
  p.launches = p.analyzed;
  p.inner_count = Math.round(pick(rng, 8, 80));
  p.survival_rate = 1 - p.rug_rate;
  p.ath_mc = pick(rng, 40_000, 400_000);
  p.sec_checked = 2;
  return p;
}

export const KOL_NAMES = [
  "orbitcap",
  "navybags",
  "ledgerwolf",
  "silkdegen",
  "northmint",
  "quietalpha",
  "brinecall",
  "halovault",
];
