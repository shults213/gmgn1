import { clamp } from "@/lib/utils";

export type DevProfile = {
  creator: string;
  analyzed: number;
  alive: number;
  rugged: number;
  rug_rate: number;
  launches: number;
  inner_count: number;
  survival_rate: number;
  ath_mc: number;
  exited: boolean;
  own_img_reuse: number;
  cto: boolean;
  sec_risk_rate: number;
  sec_unsafe: number;
  sec_risks: string[];
  sec_checked: number;
};

export function emptyDev(creator: string): DevProfile {
  return {
    creator,
    analyzed: 0,
    alive: 0,
    rugged: 0,
    rug_rate: 0,
    launches: 0,
    inner_count: 0,
    survival_rate: 0.5,
    ath_mc: 0,
    exited: false,
    own_img_reuse: 0,
    cto: false,
    sec_risk_rate: 0,
    sec_unsafe: 0,
    sec_risks: [],
    sec_checked: 0,
  };
}

function devReskin(p: DevProfile): number {
  return clamp((p.own_img_reuse - 1) / 4);
}

export function devScore(profile: DevProfile | null | undefined): number {
  if (!profile) return 0.5;
  const ath = profile.ath_mc || 0;
  const track = clamp((Math.log10(Math.max(1, ath)) - 5) / 2);
  let s: number;
  if (profile.analyzed > 0) {
    const surv = 1 - profile.rug_rate;
    s = 0.25 + 0.55 * surv;
    s -= 0.3 * clamp((profile.inner_count - 50) / 950);
    s += 0.15 * track * surv;
  } else {
    const surv = profile.survival_rate;
    if (surv != null) {
      s = 0.25 + 0.55 * surv;
      s -= 0.3 * clamp((profile.inner_count - 50) / 950);
      s += 0.15 * track * surv;
    } else {
      const serial = clamp((profile.launches - 20) / 180);
      s = 0.3 + 0.55 * track * (1 - 0.7 * serial) - 0.2 * serial;
    }
  }
  s -= 0.35 * (profile.sec_risk_rate || 0);
  s -= 0.2 * devReskin(profile);
  if (profile.exited) s -= 0.1;
  if (profile.cto) s += 0.05;
  return Math.round(clamp(s) * 1000) / 1000;
}

export function devRejectReason(score: number, profile: DevProfile | null | undefined): string {
  const dp = profile ?? emptyDev("");
  const bits: string[] = [];
  if (dp.analyzed > 0) {
    bits.push(`last ${dp.analyzed} launches rug rate ${(dp.rug_rate * 100).toFixed(0)}%`);
  }
  if (dp.inner_count > 50) bits.push(`${dp.inner_count} stuck in inner curve`);
  if (dp.sec_unsafe > 0) bits.push(`unsafe launches: ${dp.sec_risks.join("/")}`);
  if (devReskin(dp) >= 0.25) bits.push("reskin relaunch");
  if (dp.exited) bits.push("dev already exited");
  return bits.length
    ? `Developer score ${score.toFixed(2)} — ${bits.join("; ")}`
    : `Developer score ${score.toFixed(2)} below threshold`;
}

export function publicDev(profile: DevProfile | null, score: number | null) {
  if (!profile && score == null) return null;
  const d = profile ?? emptyDev("");
  return {
    score: score != null ? Math.round(score * 1000) / 1000 : null,
    creator: d.creator || null,
    analyzed: d.analyzed,
    alive: d.alive,
    rugged: d.rugged,
    rug_rate: d.rug_rate,
    launches: d.launches,
    inner_count: d.inner_count,
    survival_rate: d.survival_rate,
    ath_mc: d.ath_mc,
    exited: d.exited,
    own_img_reuse: d.own_img_reuse,
    cto: d.cto,
    sec_checked: d.sec_checked,
    sec_unsafe: d.sec_unsafe,
    sec_risks: d.sec_risks,
  };
}

export type PublicDev = NonNullable<ReturnType<typeof publicDev>>;
