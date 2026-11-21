// Scarlet Wraithblade Plus (hongzhuang-guizhan-plus) — PBZModLoader mod (Kintaro fork 2.1.0)
// MIT License. Game build 26367565 (CL-302256_JKS-17280).
//
// Effect 1 (field flowers), spec v3.1-v3.3 in README.md:
//   - auto explosion every `tickInterval` s of each flower's own age (game time); the flower stays. Damage x`tickDamageScale`,
//     plus a Shachi (AngerDamage) term. Lv5- flowers (3 s life) tick every 1.5 s with a remaining-life guard.
//   - E explodes all flowers and keeps them; E cooldown `manualCooldown`.
//   - lifetime tier, 生生不息 (linger while enemies stand in the flower), 120 s safety cap: by pausing the flower's own
//     vanilla "Explode Timer", so expiry stays the vanilla path and stop() just unpauses.
//   - 彼岸·极: after `ultraAfterTicks` auto explosions, enemies in that flower get the loose tag
//     CharacterState.AbilityState.GuiTouBlade.InDebuffArea.UltraFlower; the vanilla Debuff's UltraFlower effect has it as
//     an ongoing requirement, so it switches itself on.
//   - 断情增幅: while the player has CharacterState.AbilityState.GuiTouDao.Buff, the auto explosion interval x0.5.
//   - area: flower actors scaled by sqrt(1+p), explosion BD radius x sqrt(1+p), rings spread x sqrt(1+p) around their centre.
// Explosion path = the passive's "Process Explosion" without the Deactivate loop (game-notes §2, §11):
//   BD.CreateBullet(identity, passive) -> Initialize(null, avatar, passive, BD, false) -> "Parent Bullet Transforms" -> Start()
"use strict";

const MOD = "hongzhuang-guizhan-plus";
const VERSION = "0.1.0";
const UE = require("ue");
const puerts = require("puerts");

const P_FLOWER = "/PBZCombatAsset/ActorData/Players/Hun/Weapon/GuiTouBlade/FlowerBullet/BP_Hun_GuiTouBlade_Flower_Base.BP_Hun_GuiTouBlade_Flower_Base_C";
const P_PASSIVE = "/PBZCombatAsset/ActorData/Players/Hun/Abilities/AHuaBlade/GA_Hun_GuiTouBlade_Passive.GA_Hun_GuiTouBlade_Passive_C";
const P_BD_EXPLODE = [
    "/PBZCombatAsset/ActorData/Players/Hun/BulletData/LongBlade/GuiTouBlade/Flower/BD_Hun_GuiTouBlade_Flower_Explode.BD_Hun_GuiTouBlade_Flower_Explode",
    "/PBZCombatAsset/ActorData/Players/Hun/BulletData/LongBlade/GuiTouBlade/Flower/BD_Hun_GuiTouBlade_Flower_Big_Explode.BD_Hun_GuiTouBlade_Flower_Big_Explode",
];
const P_ULTRA_FX = "/PBZVFXPack/VFX/BattleFX/Weapon/GuiTouBlade/NS_GuiTouBlade_Flower_301_Loop.NS_GuiTouBlade_Flower_301_Loop"; // the big flower's loop
const P_ULTRA_GE = "/PBZCombatAsset/ActorData/Players/Hun/Weapon/GuiTouBlade/GE_Hun_GuiTouBlade_Debuff_Effect_UltraFlower.GE_Hun_GuiTouBlade_Debuff_Effect_UltraFlower_C";
const P_CALC_CANT_BREAK ="/PBZCombatAsset/Config/DamageCalculator/DamageCalculator_CantBreakTarget.DamageCalculator_CantBreakTarget";
const P_COMBAT_UTILS = "/PBZCombatAsset/Prototypes/BPL_PBZCombatUtils.BPL_PBZCombatUtils_C";
const TAG = {
    canManual: "CharacterState.WeaponUpgrade.GuiTouBlade.CanManualExplode",
    canBuff: "CharacterState.WeaponUpgrade.GuiTouBlade.CanBuff",
    canCharge: "CharacterState.WeaponUpgrade.GuiTouBlade.CanCharge",
    evolution: "CharacterState.WeaponUpgrade.GuiTouBlade.Evolution",
    duanqing: "CharacterState.AbilityState.GuiTouDao.Buff",
    ultra: "CharacterState.AbilityState.GuiTouBlade.InDebuffArea.UltraFlower",
    dmgPhys: "Damage.Attack.Target.PhysicalDamage",
    dmgElem: "Damage.Attack.Target.ElementDamage",
    dmgAnger: "Damage.Attack.Target.AngerDamage",
};
const STOCK_COOLDOWN = 0.4;   // passive CDO SpecialCooldown
const STOCK_LIFETIME = 15;    // Lv5+ flower life (Get Lifetime)
const POLL_MS = 50;           // how often we look; every decision uses game time
const MOD_MULTIPLY = 1, MOD_ADD = 0; // EGenericValueModifyType

// Fixed constants (spec v3.3 "写死的常量"; tuned in game).
const K = {
    tickCoalesce: 0.4,        // take along flowers due within this many seconds: one ring = one bullet
    tickIntervalEarly: 1.5,   // Lv5- flowers live 3 s
    earlyShachiScale: 0.5,
    tickShachiSmall: 0.25,    // half of Boss AHua flower explosion AngerDamage (0.5 / 1.0)
    tickShachiBig: 0.5,
    ultimateTickFactor: 0.5,  // 断情: interval x this
    // Damage of an automatic explosion = tickDamageScale x (hit + burn) of a normal one. Measured 2026-11-21 (Lv30, Sword
    // Thug, not broken): hit 149.7, burn (GE_Hun_GuiTouBlade_Explode) 67.4 + 91 + 91 = 249.4; total 399.1.
    // Automatic explosions keep the burn's first tick (it lands with the hit) and then remove the burn from the enemies
    // they hit; the hit is scaled so that hit + first tick = tickDamageScale x total:
    //   hit multiplier = (tickDamageScale - firstBurnShare) / hitShare, at least 0.
    // (dev.1/dev.2 blanked the burn GE on the shared BD around Start() instead; dropped because it touches the BD that
    //  E and expiry explosions share. Its link to the enemy deaths seen then was never established.)
    tickBurn: false,          // true: automatic explosions keep the whole burn and scale only the hit by tickDamageScale
    hitShare: 0.375,          // 149.7 / 399.1
    firstBurnShare: 0.169,    // 67.4 / 399.1
    burnStripDelay: 0.1,      // game seconds after an automatic explosion before its burn is removed
    remainGuard: 0.3,         // no auto explosion this close to expiry (the expiry explosion follows)
    forceLevel: 0,            // probe only: pretend this weapon level (0 = real level)
    forceDuanqing: false,     // probe only: pretend 断情 is always on
    shachiFirstTickOnly: false, // probe only: the Shachi term only on a flower's first automatic explosion
    maxTickSounds: 4,         // per auto explosion batch
    maxTickParticles: 16,
};

const log = (m) => console.log(`[PBZMOD] [${MOD}] ${m}`);
const KSL = UE.KismetSystemLibrary;
const valid = (o) => { try { return !!o && KSL.IsValid(o); } catch (e) { return false; } };
const pathOf = (o) => { try { return KSL.GetPathName(o); } catch (e) { return String(o); } };
const r2 = (x) => Math.round(x * 100) / 100;

// ======================================================================= config
const PRESETS = {
    "含苞": { flowerAreaScale: 0, flowerLifetime: 15, tickInterval: 6, tickDamageScale: 0.25, lingerEnabled: false, ultraEnabled: false },
    "盛放": { flowerAreaScale: 0.25, flowerLifetime: 15, tickInterval: 4, tickDamageScale: 0.4, lingerEnabled: true, ultraEnabled: true },
    "花海": { flowerAreaScale: 0.8, flowerLifetime: 25, tickInterval: 3, tickDamageScale: 0.5, lingerEnabled: true, ultraEnabled: true },
};
const PRESET_ALIAS = { bud: "含苞", hanbao: "含苞", bloom: "盛放", shengfang: "盛放", sea: "花海", huahai: "花海" };
const BASE = {
    enabled: true, preset: "盛放", tickVolume: 0.25,
    manualCooldown: 5.0, manualKeepsFlower: true, tickShake: false,
    lingerMaxLv15: 10, lingerMaxLv20: 20, lingerSafetyCap: 120, ultraAfterTicks: 2,
    areaSpreadRings: true, debugLog: false,
    // DamageCalculator_CantBreakTarget (the vanilla flower Debuff_Tick's calculator: Shachi stops at 0.1). A flower that
    // truly breaks a small enemy near the player makes the player's GA_SimpleExecution_GuiTouBlade fire with no input
    // (game-notes §13), so both are on by default (user decision 2026-11-21); the break is left to the player's own hits.
    tickCantBreak: true,      // automatic explosions (their AngerDamage term is what broke enemies)
    ultraCantBreak: true,     // 彼岸·极 (stock calculator PBZPlayerNonLethal breaks)
};
// [min, max, kind]. kind "tier": listed values are the supported tiers; others are allowed but warned about.
const RANGE = {
    flowerAreaScale: [0, 2, [0, 0.25, 0.4, 0.8, 2]], flowerLifetime: [15, 60, [15, 25, 60]],
    tickInterval: [1.5, 30], tickDamageScale: [0, 1], tickVolume: [0, 1], manualCooldown: [0.4, 60],
    lingerMaxLv15: [0, 120], lingerMaxLv20: [0, 120], lingerSafetyCap: [0, 600], ultraAfterTicks: [1, 10],
};
// `_probe` (only read when debugLog is on): overrides of the fixed constants K, for in-game probes. Not documented.
const BOOL = ["enabled", "manualKeepsFlower", "tickShake", "lingerEnabled", "ultraEnabled", "areaSpreadRings", "debugLog", "tickCantBreak", "ultraCantBreak"];
const LATER = ["extraWhiteFlowersLv25", "extraWhiteFlowersLv30", "whiteFlowerTargeting"]; // effect 2, not in this version

// JSON with // and /* */ comments and trailing commas (we read the file ourselves, so it does not depend on the loader).
function stripJsonc(s) {
    let out = "", i = 0, str = false;
    while (i < s.length) {
        const c = s[i], n = s[i + 1];
        if (str) { out += c; if (c === "\\") { out += n || ""; i += 2; continue; } if (c === '"') str = false; i++; continue; }
        if (c === '"') { str = true; out += c; i++; continue; }
        if (c === "/" && n === "/") { while (i < s.length && s[i] !== "\n") i++; continue; }
        if (c === "/" && n === "*") { i += 2; while (i < s.length && !(s[i] === "*" && s[i + 1] === "/")) i++; i += 2; continue; }
        out += c; i++;
    }
    return out.replace(/,(\s*[}\]])/g, "$1");
}
function readConfigText() {
    try {
        const p = KSL.ConvertToAbsolutePath(String(__dirname).replace(/[\\/]+$/, "") + "/config.json");
        if (!UE.BlueprintPathsLibrary.FileExists(p)) return { err: "config.json not found at " + p };
        const out = puerts.$ref("");
        if (!UE.EasyCsv.LoadStringFromLocalFile(p, out)) return { err: "config.json could not be read" };
        return { text: String(puerts.$unref(out)).replace(/^﻿/, "") };
    } catch (e) { return { err: "reading config.json threw: " + e }; }
}
function loadConfig() {
    let raw = {}, src = "file";
    const r = readConfigText();
    if (r.text !== undefined) {
        try { raw = JSON.parse(stripJsonc(r.text)); } catch (e) { log("config.json is not valid JSON, using the preset defaults: " + e); raw = {}; }
    } else {
        log(r.err + "; trying require()");
        try { raw = require("./config.json"); src = "require"; } catch (e) { log("config.json not read, using defaults: " + e); src = "defaults"; }
    }
    let pname = String(raw.preset ?? BASE.preset).trim();
    pname = PRESET_ALIAS[pname.toLowerCase()] || pname;
    if (!PRESETS[pname]) { log(`unknown preset "${raw.preset}", using 盛放 (bloom)`); pname = "盛放"; }
    const cfg = { ...BASE, ...PRESETS[pname], preset: pname };
    const overrides = [];
    for (const [k, v] of Object.entries(raw)) {
        if (k === "_probe" && raw.debugLog && v && typeof v === "object") { for (const [pk, pv] of Object.entries(v)) if (pk in K) { K[pk] = pv; log(`probe: ${pk} = ${JSON.stringify(pv)}`); } continue; }
        if (k.startsWith("_") || k === "preset") continue;
        if (LATER.includes(k)) { log(`"${k}" belongs to effect 2 (white flowers), not in this version; ignored`); continue; }
        if (!(k in cfg)) { log(`unknown setting "${k}" ignored`); continue; }
        if (BOOL.includes(k)) { cfg[k] = !!v; }
        else {
            let x = Number(v);
            const rg = RANGE[k];
            if (!Number.isFinite(x)) { log(`"${k}": ${JSON.stringify(v)} is not a number, keeping ${cfg[k]}`); continue; }
            if (rg) {
                if (k === "lingerSafetyCap" && x > 0 && x < 30) { log(`lingerSafetyCap ${x} raised to 30 (0 = no cap)`); x = 30; }
                if (x < rg[0] || x > rg[1]) { const y = Math.min(rg[1], Math.max(rg[0], x)); log(`"${k}": ${x} is out of range ${rg[0]}..${rg[1]}, using ${y}`); x = y; }
                if (rg[2] && !rg[2].includes(x)) log(`"${k}": ${x} is not one of the tested tiers (${rg[2].join(" / ")}); used as is`);
            }
            if (k === "ultraAfterTicks") x = Math.round(x);
            cfg[k] = x;
        }
        if (k in PRESETS[pname] ? PRESETS[pname][k] !== cfg[k] : BASE[k] !== cfg[k]) overrides.push(k);
    }
    log(`config (${src}): ${pname}` + (overrides.length ? ` + ${overrides.length} custom (${overrides.join(", ")})` : "") +
        ` -> area +${Math.round(cfg.flowerAreaScale * 100)}%, life ${cfg.flowerLifetime} s, tick ${cfg.tickInterval} s x${cfg.tickDamageScale}, volume ${Math.round(cfg.tickVolume * 100)}%,` +
        ` linger ${cfg.lingerEnabled ? "on" : "off"}, ultra ${cfg.ultraEnabled ? "on" : "off"}, E cooldown ${cfg.manualCooldown} s, cap ${cfg.lingerSafetyCap || "none"}`);
    if (cfg.flowerAreaScale >= 0.8 && cfg.flowerLifetime >= 25) log("warning: large flowers (+80% or more) that live 25 s or more can cover the screen and hide enemy attacks");
    if (cfg.lingerSafetyCap === 0) log("warning: lingerSafetyCap 0 = no cap; an enemy stuck in a wall can keep a flower alive forever (it still counts toward the 25-flower limit)");
    return cfg;
}

// ======================================================================= shared state (survives hot reload)
const shared = globalThis.__hzgzPlus = globalThis.__hzgzPlus || {};
if (typeof shared.stop === "function") { try { shared.stop(); } catch (e) { } }
const cfg = loadConfig();
shared.on = !!cfg.enabled;
shared.cfg = cfg;
shared.recs = new Map();                         // flower path -> record
shared.passives = shared.passives || new Set();  // passive instances whose SpecialCooldown we set
shared.ultraTagged = new Map();                  // actor path -> actor carrying our UltraFlower loose tag
shared.bdRadius = shared.bdRadius || new Map();
// BD path -> stock radius (restored on stop)
shared.pendingStrip = [];                        // automatic explosions whose burn is still to be removed (see stripBurns)
const once = new Set();
const logOnce = (k, m) => { if (!once.has(k)) { once.add(k); log(m); } };
const dbg = (m) => { if (cfg.debugLog) log(m); };

const gi = puerts.argv.getByName("GameInstance");
const player = () => { try { return UE.GameplayStatics.GetPlayerCharacter(gi, 0); } catch (e) { return null; } };
const now = () => UE.GameplayStatics.GetTimeSeconds(gi); // game time: pause and slow motion are respected

const tagCache = new Map();
function makeTag(name) {
    if (tagCache.has(name)) return tagCache.get(name);
    let t;
    try { t = UE.PBZBlueprintFunctionLibrary.ConvertStringToGameplayTag(name); }
    catch (e) { t = new UE.GameplayTag(); t.TagName = name; }
    tagCache.set(name, t);
    return t;
}
function hasTag(asc, name) { try { return !!asc && asc.HasMatchingGameplayTag(makeTag(name)); } catch (e) { logOnce("tag-err", "HasMatchingGameplayTag failed: " + e); return false; } }
const ascOf = (a) => { try { return UE.AbilitySystemBlueprintLibrary.GetAbilitySystemComponent(a); } catch (e) { return null; } };

// ======================================================================= weapon state (level, 铸魂, 断情)
let wst = { at: -1, level: null, lv5: false, evolution: false, duanqing: false };
let lastWLine = "";
function weaponState(pawn, t) {
    const asc = ascOf(pawn);
    wst.duanqing = K.forceDuanqing || hasTag(asc, TAG.duanqing);   // changes often: every poll
    if (t - wst.at < 1 && wst.at >= 0) return wst;
    wst.at = t;
    wst.lv5 = hasTag(asc, TAG.canManual);
    wst.evolution = hasTag(asc, TAG.evolution);
    let level = null;
    try {
        const bp = UE.SubsystemBlueprintLibrary.GetWorldSubsystem(pawn, UE.PBZBackPackSubsystem.StaticClass());
        // The level of Scarlet Wraithblade itself (weapon id "GuiTouBlade"), not of the weapon in hand.
        if (valid(bp)) level = Number(bp.GetWeaponLevel("GuiTouBlade", true));
    } catch (e) { logOnce("lvl-err", "GetWeaponLevel(GuiTouBlade) failed, falling back to upgrade tags: " + e); }
    if (!(level > 0)) level = wst.evolution ? 30 : hasTag(asc, TAG.canCharge) ? 25 : wst.lv5 ? 5 : 1; // fallback only
    wst.level = K.forceLevel > 0 ? K.forceLevel : level;
    const line = `weapon level ${level}, Lv5 tag ${wst.lv5}, Evolution tag ${wst.evolution}, CanBuff tag ${hasTag(asc, TAG.canBuff)}`;
    if (line !== lastWLine) { lastWLine = line; log(line); }
    return wst;
}
function lingerMax(w) {
    if (!cfg.lingerEnabled) return 0;
    if (w.level >= 30) return Infinity;
    if (w.level >= 20) return cfg.lingerMaxLv20;
    if (w.level >= 15) return cfg.lingerMaxLv15;
    return 0;
}
let lastDuanqing = false;

// ======================================================================= flowers
function playerFlowers(pawn) {
    const cls = UE.Class.Load(P_FLOWER);
    if (!cls) return [];
    const out = puerts.$ref(UE.NewArray(UE.Actor));
    UE.GameplayStatics.GetAllActorsOfClass(gi, cls, out);
    const arr = puerts.$unref(out), list = [], me = pathOf(pawn);
    for (let i = 0; i < arr.Num(); i++) {
        const f = arr.Get(i);
        if (!valid(f)) continue;
        let owner = null;
        try { owner = f.GetOwnerAvatar(); } catch (e) { owner = f.BulletOwnerAvatar; }
        if (owner !== pawn && pathOf(owner) !== me) continue; // drops Boss AHua flowers (same base class)
        list.push(f);
    }
    return list;
}
function flowerTransform(f) {
    try { const r = puerts.$ref(new UE.Transform()); f.GetBulletTransform(r); return puerts.$unref(r); }
    catch (e) { return f.GetTransform(); }
}
const isBig = (f) => /_Big_C/.test(pathOf(f.GetClass ? f.GetClass() : f)) || /Flower_Big/.test(pathOf(f));

let healthAttr = null;
function alive(a) {
    try {
        if (!healthAttr) healthAttr = UE.PBZBlueprintFunctionLibrary.MakeAttribute("Health", UE.BasicAttributeSet.StaticClass());
        return UE.PBZBlueprintFunctionLibrary.GetAttributeFromCharacter(a, healthAttr) > 0;
    } catch (e) { return true; }
}
// Enemies (NPC characters, alive) inside a flower, by distance: the flower's own "Overlapping Actors" list loses an
// enemy that is still standing in it (seen 2026-11-21 after the enemy's Shachi broke), so it is not used.
// `npcs` is gathered once per poll (alive NPCs near the player).
function nearbyNpcs(pawn) {
    const out = [];
    try {
        const ref = puerts.$ref(UE.NewArray(UE.Actor));
        UE.GameplayStatics.GetAllActorsOfClass(gi, UE.PBZCharacter_NPC.StaticClass(), ref);
        const arr = puerts.$unref(ref), here = pawn.K2_GetActorLocation();
        for (let i = 0; i < arr.Num(); i++) {
            const a = arr.Get(i);
            if (!valid(a) || a === pawn) continue;
            const p = a.K2_GetActorLocation();
            if (Math.hypot(p.X - here.X, p.Y - here.Y) > 5000 || !alive(a)) continue;
            let r = 40; try { r = a.CapsuleComponent.GetScaledCapsuleRadius(); } catch (e) { }
            out.push({ a, p, r });
        }
    } catch (e) { logOnce("npc-err", "listing NPCs failed: " + e); }
    return out;
}
function flowerRadius(f, rec) {
    if (rec.radius) return rec.radius;
    let r = rec.big ? 280 : 100;
    try { r = f.Capsule.GetScaledCapsuleRadius(); } catch (e) { logOnce("cap-r", `flower Capsule radius not readable (${e}); using ${r}`); }
    rec.radius = r;
    return r;
}
function enemiesIn(f, rec, npcs) {
    const fp = f.K2_GetActorLocation(), R = flowerRadius(f, rec), out = [];
    for (const n of npcs) if (Math.hypot(n.p.X - fp.X, n.p.Y - fp.Y) < R + n.r && Math.abs(n.p.Z - fp.Z) < 250) out.push(n.a);
    return out;
}

// --- timer helpers (the flower's own vanilla Explode Timer) ---
function timer(f) {
    const h = f["Explode Timer"];
    if (!KSL.K2_TimerExistsHandle(f, h)) return null;           // cleared: being exploded by vanilla code
    return { h, paused: KSL.K2_IsTimerPausedHandle(f, h), elapsed: KSL.K2_GetTimerElapsedTimeHandle(f, h), remaining: KSL.K2_GetTimerRemainingTimeHandle(f, h) };
}
// The flower's parent (BP_PBZ_ProjectileEmitter) also runs a "Lifetime Timer" (MyData.Lifetime, ~30 s for flowers) that
// Deactivates the flower silently. It is paused together with the Explode Timer, so it never runs ahead of it.
function setPaused(f, h, p) {
    try {
        if (p) KSL.K2_PauseTimerHandle(f, h); else KSL.K2_UnPauseTimerHandle(f, h);
        try {
            const lt = f["Lifetime Timer"];
            if (KSL.K2_TimerExistsHandle(f, lt)) { if (p) KSL.K2_PauseTimerHandle(f, lt); else KSL.K2_UnPauseTimerHandle(f, lt); }
        } catch (e) { logOnce("lt-err", "pausing the flower Lifetime Timer failed (flowers may vanish at ~30 s): " + e); }
        return true;
    }
    catch (e) { logOnce("pause-err", "pausing the flower timer failed (lifetime tiers / linger off): " + e); return false; }
}
function lifetimeTimerLeft(f) {
    try { const lt = f["Lifetime Timer"]; return KSL.K2_TimerExistsHandle(f, lt) ? r2(KSL.K2_GetTimerRemainingTimeHandle(f, lt)) : "none"; } catch (e) { return "?"; }
}

// ======================================================================= explosion
// puerts TMap: iterate by index (no Keys()).
function mapEntries(m) {
    const out = [];
    if (!m) return out;
    if (typeof m.GetMaxIndex === "function") {
        for (let i = 0; i < m.GetMaxIndex(); i++) if (m.IsValidIndex(i)) { const k = m.GetKey(i); out.push([k, m.Get(k)]); }
    } else if (typeof m.Keys === "function") { const ks = m.Keys(); for (let i = 0; i < ks.Num(); i++) { const k = ks.Get(i); out.push([k, m.Get(k)]); } }
    return out;
}
function attackModules(b) {
    try {
        const ms = b.FindModulesByClass(UE.BulletAttackModule.StaticClass()), list = [];
        for (let i = 0; i < ms.Num(); i++) if (valid(ms.Get(i))) list.push(ms.Get(i));
        return list;
    } catch (e) { logOnce("mod-err", "FindModulesByClass(BulletAttackModule) failed: " + e); return []; }
}
function attackDataStr(m) {
    try {
        const r = puerts.$ref(UE.NewMap(UE.GameplayTag, UE.BuiltinFloat)); m.GetModifiedAttackData(r);
        return mapEntries(puerts.$unref(r)).map(([k, v]) => `${String(k.TagName).replace("Damage.Attack.Target.", "")}=${r2(v)}`).join(" ") || "(empty)";
    } catch (e) { return "ERR " + e; }
}
// Per-bullet damage change: modifiers on this bullet's own attack module; the shared BD stays untouched.
function applyTickDamage(b, mods, why) {
    const ms = attackModules(b);
    if (!ms.length) { logOnce("no-mod", `[${why}] explosion bullet has no BulletAttackModule: tick damage stays at 100%`); return; }
    let calc = null;
    if (cfg.tickCantBreak) {
        try { calc = UE.Object.Load(P_CALC_CANT_BREAK); } catch (e) { }
        if (!valid(calc)) { calc = null; logOnce("calc-miss", "DamageCalculator_CantBreakTarget not found: automatic explosions can break (finish) enemies"); }
    }
    for (const m of ms) {
        if (calc) {
            try { const was = m.DamageCalculator; m.DamageCalculator = calc; logOnce("calc-ok", `[${why}] damage calculator ${was ? pathOf(was).split(".").pop() : "(none)"} -> ${pathOf(m.DamageCalculator).split(".").pop()}`); }
            catch (e) { logOnce("calc-err", "setting the damage calculator failed: " + e); }
        }
        const before = cfg.debugLog || !once.has("dmg-first") ? attackDataStr(m) : "";
        try {
            m.AddModifier(makeTag(TAG.dmgPhys), MOD_MULTIPLY, mods.dmg);
            m.AddModifier(makeTag(TAG.dmgElem), MOD_MULTIPLY, mods.dmg);
            if (mods.shachi > 0) m.AddModifier(makeTag(TAG.dmgAnger), MOD_ADD, mods.shachi);
        } catch (e) { logOnce("addmod-err", "AddModifier failed: " + e); return; }
        const after = attackDataStr(m);
        logOnce("dmg-first", `[${why}] attack data ${before} -> ${after} (want Physical/Element x${mods.dmg}, AngerDamage +${mods.shachi})`);
        dbg(`[${why}] ${ms.length} attack module(s); passed dmg x${mods.dmg}, shachi +${mods.shachi}; attack data -> ${after}`);
    }
}
let sfx = null;
function playSounds(ev, ts, volume) {
    if (!ev || volume <= 0) return;
    try { if (!valid(sfx)) sfx = UE.SubsystemBlueprintLibrary.GetWorldSubsystem(player(), UE.PBZSoundFXSubsystem.StaticClass()); } catch (e) { }
    if (!valid(sfx)) { logOnce("sfx-none", "no PBZSoundFXSubsystem: auto explosions are silent"); return; }
    for (const t of pickSpread(ts, K.maxTickSounds)) {
        try {
            const comp = puerts.$ref(null);
            const [l, r] = locRot(t);
            sfx.PBZPostEventAtLocation(ev, l, comp, undefined, r, 0, 1.0);
            const c = puerts.$unref(comp);
            if (valid(c) && volume < 1) {
                try { c.SetOutputBusVolume(volume); logOnce("vol-ok", `auto explosion sound posted, SetOutputBusVolume(${volume}) ok`); }
                catch (e) { logOnce("vol-err", "SetOutputBusVolume failed (sound at full volume): " + e); }
            } else if (!valid(c)) logOnce("vol-nocomp", "PBZPostEventAtLocation gave no AkComponent: volume not applied");
        } catch (e) {
            logOnce("post-err", "PBZPostEventAtLocation failed (" + e + "), using SpawnAudioUniversal at full volume");
            try { sfx.SpawnAudioUniversal(ev, player(), "None", t, false, false, 0, 0); } catch (e2) { logOnce("spawnaudio-err", "SpawnAudioUniversal failed: " + e2); }
        }
    }
}
function locRot(t) {
    try { const l = puerts.$ref(new UE.Vector()), r = puerts.$ref(new UE.Rotator()), sc = puerts.$ref(new UE.Vector()); UE.KismetMathLibrary.BreakTransform(t, l, r, sc); return [puerts.$unref(l), puerts.$unref(r), puerts.$unref(sc)]; }
    catch (e) { return [t.Translation, new UE.Rotator(), new UE.Vector(1, 1, 1)]; }
}
function pickSpread(list, n) {
    if (list.length <= n) return list;
    const out = [];
    for (let i = 0; i < n; i++) out.push(list[Math.floor(i * list.length / n)]);
    return out;
}
function playParticles(ps, ts) {
    if (!ps) return;
    for (const t of ts) {
        const [l, r, sc] = locRot(t);
        try { UE.NiagaraFunctionLibrary.SpawnSystemAtLocation(player(), ps, l, r, sc, true, true, 0, true); }
        catch (e) { logOnce("ps-err", "SpawnSystemAtLocation failed: " + e); return; }
    }
}

// Explode `flowers` without removing them; one bullet per explosion BD (like "Process Explosion"). `tick` = { dmg, shachi(f) }
// for automatic explosions (null for E). Returns the number of bullets started.
function explodeKeep(passive, flowers, why, tick) {
    const avatar = passive.GetAvatarActorFromActorInfo();
    const groups = new Map();
    for (const f of flowers) {
        const bd = f["Explode Bullet Data"];
        if (!valid(bd)) continue;
        const shachi = tick ? tick.shachi(f) : 0;
        const k = pathOf(bd) + "|" + shachi;
        if (!groups.has(k)) groups.set(k, { bd, shachi, ts: [] });
        groups.get(k).ts.push(flowerTransform(f));
    }
    let started = 0;
    for (const [k, g] of groups) {
        const b = g.bd.CreateBullet(new UE.Transform(), passive);
        if (!valid(b)) { logOnce("cb-null", `[${why}] CreateBullet returned nothing for ${k}`); continue; }
        b.Initialize(null, avatar, passive, g.bd, false);
        const arr = UE.NewArray(UE.Transform);
        for (const t of g.ts) arr.Add(t);
        b["Parent Bullet Transforms"] = arr;
        if (tick) applyTickDamage(b, { dmg: tick.dmg, shachi: g.shachi }, why);
        // The bullet's PostStart reads shake / rumble / sound / particle from the BD (game-notes §6). For automatic
        // explosions blank them on the shared BD just around Start() (same frame, game thread), then play capped,
        // quieter copies ourselves. E keeps everything vanilla.
        const saved = {};
        // Particles are blanked (and replayed for a spread subset) only above the per-batch cap.
        const blank = !tick ? [] : ["Explosion Sound"].concat(g.ts.length > K.maxTickParticles ? ["Explosion Particle"] : [], cfg.tickShake ? [] : ["Explosion Shake", "Explosion Force Feedback"]);
        for (const fld of blank) { try { saved[fld] = g.bd[fld]; g.bd[fld] = null; } catch (e) { logOnce("blank-" + fld, `could not blank ${fld}: ${e}`); } }
        try { b.Start(); }
        finally { for (const fld of Object.keys(saved)) { try { g.bd[fld] = saved[fld]; } catch (e) { log(`RESTORE of ${fld} failed: ${e}`); } } }
        if (tick && !K.tickBurn) queueBurnStrip(g.bd, g.ts);
        if (tick) {
            if ("Explosion Particle" in saved) playParticles(saved["Explosion Particle"], pickSpread(g.ts, K.maxTickParticles));
            playSounds(saved["Explosion Sound"], g.ts, cfg.tickVolume);
        }
        started++;
    }
    return started;
}

// The burn GE an explosion BD applies on hit (read only: the BD is never changed for this).
function burnClassOf(bd) {
    try {
        const evs = bd.PreAttackEvents.Events;
        for (let i = 0; i < evs.Num(); i++) { const ev = evs.Get(i); if (valid(ev) && ev.GameplayEffect) return ev.GameplayEffect; }
    } catch (e) { logOnce("burn-cls", "reading the burn GE of the explosion BD failed: " + e); }
    return null;
}
function queueBurnStrip(bd, ts) {
    const ge = burnClassOf(bd);
    if (!ge) return;
    let r = 120; try { r = bd.ColliderData.Radius; } catch (e) { }
    shared.pendingStrip.push({ at: now() + K.burnStripDelay, ge, r, ps: ts.map((t) => locRot(t)[0]) });
}
// Remove one stack of the burn from each enemy the automatic explosion could have hit. Stacks from other sources
// (an E explosion in the same instant) are the same GE, so at most one stack per automatic explosion is taken.
function stripBurns(pawn) {
    const t = now();
    if (!shared.pendingStrip.some((p) => p.at <= t)) return;
    const npcs = nearbyNpcs(pawn);
    let pasc = null; try { pasc = UE.AbilitySystemBlueprintLibrary.GetAbilitySystemComponent(pawn); } catch (e) { }
    shared.pendingStrip = shared.pendingStrip.filter((p) => {
        if (p.at > t) return true;
        let n = 0;
        for (const e of npcs) {
            if (!p.ps.some((q) => Math.hypot(e.p.X - q.X, e.p.Y - q.Y) < p.r + e.r + 50 && Math.abs(e.p.Z - q.Z) < 300)) continue;
            try {
                const asc = UE.AbilitySystemBlueprintLibrary.GetAbilitySystemComponent(e.a);
                if (valid(asc)) { asc.RemoveActiveGameplayEffectBySourceEffect(p.ge, pasc, 1); n++; }
            } catch (err) { logOnce("strip-err", "removing the burn failed (automatic explosions keep it): " + err); }
        }
        if (n) dbg(`burn removed from ${n} enemy(s)`);
        return false;
    });
}

// ======================================================================= area (flower size, explosion radius, ring spread)
const areaK = () => Math.sqrt(1 + cfg.flowerAreaScale);
function applyBdRadius(k) {
    for (const p of P_BD_EXPLODE) {
        try {
            const bd = UE.Object.Load(p);
            if (!valid(bd)) { logOnce("bd-miss-" + p, "explosion BD not loaded yet: " + p.split(".").pop()); continue; }
            if (!shared.bdRadius.has(p)) shared.bdRadius.set(p, bd.ColliderData.Radius);
            const cd = bd.ColliderData; cd.Radius = shared.bdRadius.get(p) * k; bd.ColliderData = cd;
            logOnce("bd-r-" + p + k, `explosion radius ${p.split(".").pop()}: ${shared.bdRadius.get(p)} -> ${r2(bd.ColliderData.Radius)}`);
        } catch (e) { logOnce("bd-r-err", "changing the explosion radius failed: " + e); }
    }
}
function restoreBdRadius() {
    for (const [p, r] of shared.bdRadius) { try { const bd = UE.Object.Load(p); const cd = bd.ColliderData; cd.Radius = r; bd.ColliderData = cd; } catch (e) { } }
}
function scaleFlower(f, k) {
    try { f.SetActorScale3D(new UE.Vector(k, k, k)); return true; } catch (e) { logOnce("scale-err", "SetActorScale3D on a flower failed: " + e); return false; }
}
// A ring is spawned over ~0.1-0.4 s. New flowers wait in `pendingRing` until no new flower came for 0.25 s; a group of
// 5+ is pushed out from its centre by k. Single flowers (FlowerWalk, big flowers) are left where they are.
let pendingRing = [], pendingAt = 0;
function spreadRings(t, k) {
    if (!pendingRing.length || t - pendingAt < 0.25) return;
    const g = pendingRing.filter((r) => valid(r.f)); pendingRing = [];
    if (g.length < 5 || k <= 1.001) return;
    const ps = g.map((r) => r.f.K2_GetActorLocation());
    const cx = ps.reduce((s, p) => s + p.X, 0) / ps.length, cy = ps.reduce((s, p) => s + p.Y, 0) / ps.length;
    const ds = ps.map((p) => Math.hypot(p.X - cx, p.Y - cy)), mean = ds.reduce((s, d) => s + d, 0) / ds.length;
    const sd = Math.sqrt(ds.reduce((s, d) => s + (d - mean) * (d - mean), 0) / ds.length);
    // Any burst of 5+ flowers is spread about its centre: one ring, or concentric rings (e.g. 6 + 8 in the same move).
    if (mean < 50) { dbg(`burst of ${g.length} flowers too tight (radius ${r2(mean)}): left in place`); return; }
    for (let i = 0; i < g.length; i++) {
        const p = ps[i];
        try { g[i].f.K2_SetActorLocation(new UE.Vector(cx + (p.X - cx) * k, cy + (p.Y - cy) * k, p.Z), false, puerts.$ref(new UE.HitResult()), true); }
        catch (e) { logOnce("move-err", "moving a flower failed: " + e); return; }
    }
    dbg(`burst of ${g.length} spread: mean radius ${r2(mean)} (+- ${r2(sd)}) -> ${r2(mean * k)}`);
}

// ======================================================================= main tick
let lastT = null;
function tickFlowers(pawn) {
    const t = now();
    const dt = lastT === null ? 0 : Math.min(0.5, Math.max(0, t - lastT));
    lastT = t;
    const w = weaponState(pawn, t);
    if (w.duanqing !== lastDuanqing) { lastDuanqing = w.duanqing; dbg(`断情 (GuiTouDao.Buff) ${w.duanqing ? "on" : "off"}`); }
    const k = areaK();
    if (cfg.flowerAreaScale > 0) applyBdRadius(k);
    const lMax = lingerMax(w);
    const cap = cfg.lingerSafetyCap > 0 ? cfg.lingerSafetyCap : Infinity;
    const ultraOn = cfg.ultraEnabled && w.evolution;
    const seen = new Set(), due = [], ultraEnemies = new Map();
    let npcCache = null;
    const npcs = () => npcCache || (npcCache = nearbyNpcs(pawn));
    let anyStrict = false;

    for (const f of playerFlowers(pawn)) {
        const key = pathOf(f);
        let tm;
        try { tm = timer(f); } catch (e) { logOnce("timer-err", "reading Explode Timer failed: " + e); continue; }
        if (!tm) { dropRec(key); continue; }
        seen.add(key);
        let rec = shared.recs.get(key);
        if (rec && (rec.f !== f || (!tm.paused && tm.elapsed < rec.lastElapsed - 0.05))) { dropRec(key); rec = null; } // reused from the pool
        if (!rec) {
            const life = tm.elapsed + tm.remaining;
            const early = life < 5;                                                   // 3 s flower (before Lv5)
            rec = { f, born: t - tm.elapsed, early, big: isBig(f), ticks: 0, lifeUsed: 0, lingerUsed: 0, pausedBy: null,
                    lifeBudget: early || cfg.flowerLifetime - life < 0.1 ? 0 : cfg.flowerLifetime - life, nextAt: 0, ultra: false };
            rec.nextAt = rec.born + (early ? K.tickIntervalEarly : cfg.tickInterval);
            shared.recs.set(key, rec);
            if (k > 1.001 && scaleFlower(f, k)) rec.scaled = true;
            if (k > 1.001 && cfg.areaSpreadRings && !rec.big && !early) { pendingRing.push(rec); pendingAt = t; }
            dbg(`flower seen: ${rec.big ? "big" : "small"}, life ${r2(life)} s${early ? " (early)" : ""}, extra life ${r2(rec.lifeBudget)} s, age ${r2(tm.elapsed)}, radius ${r2(flowerRadius(f, rec))}, emitter lifetime left ${lifetimeTimerLeft(f)}`);
        }
        rec.lastElapsed = tm.elapsed;
        const age = t - rec.born;

        // --- lifetime: pause the vanilla timer while there is budget (life tier first, then linger) ---
        if (!rec.early) {
            if (age >= cap) {
                if (tm.paused) setPaused(f, tm.h, false);
                log(`flower reached the ${cap} s safety cap: expiring it`);
                try { f["Expire Explode"](); } catch (e) { logOnce("expire-err", "Expire Explode failed: " + e); }
                dropRec(key); seen.delete(key); continue;
            }
            const inside = lMax > 0 || ultraOn ? enemiesIn(f, rec, npcs()) : [];
            if (rec.pausedBy && tm.paused) rec[rec.pausedBy] += dt;               // consume the budget of the last poll
            let want = null;
            if (rec.lifeUsed < rec.lifeBudget) want = "lifeUsed";
            else if (inside.length && rec.lingerUsed < lMax) want = "lingerUsed";
            if (want && !tm.paused) { if (setPaused(f, tm.h, true)) dbg(`flower timer paused (${want === "lifeUsed" ? "lifetime tier" : "linger, " + inside.length + " enemy(s) inside"})`); }
            if (!want && tm.paused && rec.pausedBy) { setPaused(f, tm.h, false); dbg(`flower timer resumed (life +${r2(rec.lifeUsed)} s, linger +${r2(rec.lingerUsed)} s)`); }
            rec.pausedBy = want;
            if (rec.ultra) for (const a of inside) ultraEnemies.set(pathOf(a), a);
        }

        // --- automatic explosion ---
        const live = tm.paused || tm.remaining > K.remainGuard;
        if (!live) continue;
        if (t >= rec.nextAt) anyStrict = true;
        if (t >= rec.nextAt - K.tickCoalesce) due.push(rec);
    }
    for (const key of [...shared.recs.keys()]) if (!seen.has(key)) dropRec(key);
    if (k > 1.001 && cfg.areaSpreadRings) spreadRings(t, k);

    if (anyStrict && due.length) {
        const byPassive = new Map();
        for (const rec of due) {
            const p = rec.f["Passive Ability"];
            if (!valid(p)) { logOnce("no-passive", "flower has no Passive Ability; skipped"); continue; }
            const pk = pathOf(p);
            if (!byPassive.has(pk)) byPassive.set(pk, { p, recs: [] });
            byPassive.get(pk).recs.push(rec);
            dumpSetByCaller(p);
        }
        for (const { p, recs } of byPassive.values()) {
            const map = new Map(recs.map((r) => [r.f, r]));
            const n = explodeKeep(p, recs.map((r) => r.f), "tick", {
                dmg: K.tickBurn ? cfg.tickDamageScale : Math.max(0, (cfg.tickDamageScale - K.firstBurnShare) / K.hitShare),
                shachi: (f) => { const r = map.get(f); if (K.shachiFirstTickOnly && r.ticks > 0) return 0; return (r.big ? K.tickShachiBig : K.tickShachiSmall) * (r.early ? K.earlyShachiScale : 1); },
            });
            for (const r of recs) {
                const iv = r.early ? K.tickIntervalEarly : cfg.tickInterval * (w.duanqing ? K.ultimateTickFactor : 1);
                r.nextAt = t + iv;                                  // the whole batch shares one phase from now on
                r.ticks++;
                if (ultraOn && !r.early && !r.ultra && r.ticks >= cfg.ultraAfterTicks) { r.ultra = true; addUltraFx(r); dbg("flower became 彼岸·极"); }
            }
            dbg(`tick: ${recs.length} flower(s) in ${n} bullet(s), kept; interval ${w.duanqing ? "x" + K.ultimateTickFactor + " (断情)" : "normal"}`);
        }
    }
    syncUltraTags(ultraEnemies);
}

// A 极 flower also shows the big flower's loop effect, attached to it; removed with the flower record.
function addUltraFx(rec) {
    try {
        const ns = UE.Object.Load(P_ULTRA_FX);
        if (!valid(ns)) { logOnce("ufx-miss", "彼岸·极 effect asset not found: " + P_ULTRA_FX); return; }
        const k = rec.big ? 1 : 0.5;
        rec.ultraFx = UE.NiagaraFunctionLibrary.SpawnSystemAttached(ns, rec.f.K2_GetRootComponent(), "None", new UE.Vector(0, 0, 0), new UE.Rotator(), new UE.Vector(k, k, k), 0, false, 0, true, true);
        if (!valid(rec.ultraFx)) logOnce("ufx-null", "彼岸·极 effect did not spawn");
    } catch (e) { logOnce("ufx-err", "彼岸·极 effect failed: " + e); }
}
function dropRec(key) {
    const rec = shared.recs.get(key);
    if (rec && rec.ultraFx) { try { if (valid(rec.ultraFx)) rec.ultraFx.DestroyComponent(); } catch (e) { } }
    shared.recs.delete(key);
}

// UltraFlower: loose tag on enemies standing in a 极 flower; removed when they leave every 极 flower.
function syncUltraTags(want) {
    const tagC = () => UE.BlueprintGameplayTagLibrary.MakeGameplayTagContainerFromTag(makeTag(TAG.ultra));
    for (const [k, a] of want) if (!shared.ultraTagged.has(k)) {
        try { UE.AbilitySystemBlueprintLibrary.AddLooseGameplayTags(a, tagC(), false); shared.ultraTagged.set(k, a); dbg("UltraFlower tag on " + k.split(".").pop()); }
        catch (e) { logOnce("ultra-add", "AddLooseGameplayTags failed (彼岸·极 off): " + e); }
    }
    for (const [k, a] of [...shared.ultraTagged]) if (!want.has(k)) {
        try { if (valid(a)) UE.AbilitySystemBlueprintLibrary.RemoveLooseGameplayTags(a, tagC(), false); } catch (e) { }
        shared.ultraTagged.delete(k);
    }
}

// 彼岸·极 Shachi: the UltraFlower GE's hit component carries its own calculator (PBZPlayerNonLethal). Measured 2026-11-21:
// with it the enemy shows the break signature (Shachi refills from 0.1, later hits x1.5); CantBreakTarget holds Shachi at
// 0.1 like the flower Debuff_Tick, same HP damage (both kill). With ultraCantBreak we swap it in on the class default; periodic executions read the
// definition each time, so it also covers effects already running. stop() puts the stock calculator back.
function ultraHitComponent() {
    const cls = UE.Class.Load(P_ULTRA_GE);
    const cdo = cls && UE.SGameAIFunctionLibrary.GetClassDefaultObject(cls);
    if (!cdo) return null;
    const arr = cdo.GEComponents;
    for (let i = 0; i < arr.Num(); i++) {
        const c = arr.Get(i);
        if (valid(c) && c.IsA(UE.HitGameplayEfectComponent.StaticClass())) return c;
    }
    return null;
}
function setUltraCalc(cantBreak) {
    try {
        const c = ultraHitComponent();
        if (!c) { logOnce("ucalc-miss", "UltraFlower hit component not found: 彼岸·极 keeps the stock calculator"); return false; }
        if (shared.ultraCalcStock === undefined) shared.ultraCalcStock = c.CustomCalculator || null;
        let want = shared.ultraCalcStock;
        if (cantBreak) {
            want = UE.Object.Load(P_CALC_CANT_BREAK);
            if (!valid(want)) { logOnce("calc-miss2", "DamageCalculator_CantBreakTarget not found: 彼岸·极 keeps the stock calculator"); return false; }
        }
        c.CustomCalculator = want;
        dbg(`UltraFlower calculator -> ${want ? pathOf(c.CustomCalculator).split(".").pop() : "(none)"}`);
        return true;
    } catch (e) { logOnce("ucalc-err", "UltraFlower calculator swap failed: " + e); return false; }
}

// One-time research log: the SetByCaller values the weapon upgrade data gives this passive (DebuffTickShachi, ...).
let sbcDone = false;
function dumpSetByCaller(passive) {
    if (sbcDone) return;
    sbcDone = true;
    try {
        const lib = puerts.blueprint.tojs(UE.Class.Load(P_COMBAT_UTILS));
        const r = puerts.$ref(UE.NewMap(UE.GameplayTag, UE.BuiltinFloat));
        const ok = lib.GetWeaponUpgradeSetByCallerDataMap(passive, gi, r);
        const out = mapEntries(puerts.$unref(r)).map(([k, v]) => `${String(k.TagName).replace("SetByCaller.MainWeapon.GuiTouBlade.", "")}=${r2(v)}`);
        log(`weapon upgrade SetByCaller (ok=${ok}, level ${wst.level}): ${out.join(", ") || "(none)"}`);
    } catch (e) { log("SetByCaller dump failed: " + e); }
}

// ======================================================================= E override (mixin once per game run; body reads globalThis)
function onTriggerFlowers(passive) {
    const s = globalThis.__hzgzPlus;
    if (!s || !s.on) return false;
    const c = s.cfg, pawn = player();
    let avatar = null;
    try { avatar = passive.GetAvatarActorFromActorInfo(); } catch (e) { }
    if (!valid(pawn) || pathOf(avatar) !== pathOf(pawn)) return false; // not the player's passive (Boss subclass inherits it)
    passive.SpecialCooldown = c.manualCooldown; s.passives.add(passive); // read by WaitDelay right after us
    if (!c.manualKeepsFlower) return false;
    const cur = passive["Current Flowers"], flowers = [];
    for (let i = 0; i < cur.Num(); i++) { const f = cur.Get(i); if (valid(f)) flowers.push(f); }
    const n = explodeKeep(passive, flowers, "E", null);
    dbg(`E: ${flowers.length} flower(s) exploded in ${n} bullet(s), kept; cooldown ${passive.SpecialCooldown}`);
    return true; // handled: skip the vanilla Deactivate loop and the HasFlower GE removal
}
shared.onTriggerFlowers = onTriggerFlowers;

class PassiveMixin {
    ["Trigger Flowers"]() {
        try {
            const s = globalThis.__hzgzPlus;
            if (s && typeof s.onTriggerFlowers === "function" && s.onTriggerFlowers(this)) return;
        } catch (e) { console.log(`[PBZMOD] [${MOD}] Trigger Flowers override threw, running vanilla: ${e}`); }
        this["Process Explosion"](this["Current Flowers"]);  // vanilla body
        this.BP_RemoveGameplayEffectFromOwnerWithHandle(this["Has Flower Handle"], -1);
    }
}
function ensureMixin() {
    if (shared.mixed && valid(shared.mixed)) return;
    if (shared.mixFailed) return;
    try {
        const cls = UE.Class.Load(P_PASSIVE);
        if (!cls) throw new Error("passive class missing");
        puerts.blueprint.mixin(puerts.blueprint.tojs(cls), PassiveMixin, { objectTakeByNative: true, inherit: false, noMixinedWarning: true });
        shared.mixed = cls;
        log("mixin on GA_Hun_GuiTouBlade_Passive.Trigger Flowers: ok");
    } catch (e) { shared.mixFailed = true; log("mixin on Trigger Flowers FAILED (E stays vanilla): " + e); }
}
function setCdoCooldown(v) {
    try {
        const cls = UE.Class.Load(P_PASSIVE);
        const cdo = cls && UE.SGameAIFunctionLibrary.GetClassDefaultObject(cls);
        if (cdo) { cdo.SpecialCooldown = v; return true; }
    } catch (e) { logOnce("cdo-err", "CDO SpecialCooldown write failed: " + e); }
    return false;
}

// ======================================================================= loop / stop
let timerId, errors = 0;
function tick() {
    if (!shared.on) return;
    try {
        const pawn = player();
        if (!valid(pawn)) return; // title screen / loading
        ensureMixin();
        if (!shared.cdoSet) shared.cdoSet = setCdoCooldown(cfg.manualCooldown);
        if (!shared.ultraCalcSet) shared.ultraCalcSet = setUltraCalc(cfg.ultraCantBreak) || once.has("ucalc-miss") || once.has("ucalc-err") || once.has("calc-miss2");
        tickFlowers(pawn);
        stripBurns(pawn);
        errors = 0;
    } catch (e) {
        log("tick threw: " + (e && e.stack || e));
        if (++errors >= 20) { log("20 errors in a row, stopping"); shared.stop(); }
    }
}

// Back to vanilla: unpause every flower timer we paused, unscale flowers, drop our UltraFlower tags, stock radius / cooldown.
// The mixin stays on the class but falls through to the vanilla body while `on` is false.
shared.stop = () => {
    if (timerId !== undefined) clearInterval(timerId);
    timerId = undefined;
    shared.on = false;
    for (const rec of shared.recs.values()) {
        try { if (!valid(rec.f)) continue; const h = rec.f["Explode Timer"]; if (KSL.K2_TimerExistsHandle(rec.f, h) && KSL.K2_IsTimerPausedHandle(rec.f, h)) setPaused(rec.f, h, false); } catch (e) { }
        try { if (rec.scaled && valid(rec.f)) rec.f.SetActorScale3D(new UE.Vector(1, 1, 1)); } catch (e) { }
    }
    for (const key of [...shared.recs.keys()]) dropRec(key);
    syncUltraTags(new Map());
    restoreBdRadius();
    shared.pendingStrip = [];
    setCdoCooldown(STOCK_COOLDOWN);
    shared.cdoSet = false;
    if (shared.ultraCalcStock !== undefined) setUltraCalc(false);
    shared.ultraCalcSet = false;
    for (const p of shared.passives) { try { if (valid(p)) p.SpecialCooldown = STOCK_COOLDOWN; } catch (e) { } }
    shared.passives.clear();
    shared.stop = undefined;
};

if (shared.on) timerId = setInterval(tick, POLL_MS);
else log("enabled = false: the mod does nothing (vanilla)");
log(`${VERSION} started`);

exports.stop = function () {
    const s = globalThis.__hzgzPlus;
    if (s && typeof s.stop === "function") s.stop();
    log("stopped");
};
