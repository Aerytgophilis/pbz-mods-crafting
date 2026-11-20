// pbz-testbench — local test helper for PBZ mod development. NOT shipped with any mod.
// MIT License. Game build 26367565, PBZModLoader Kintaro 2.1.0.
//
// 1. Measure: every poll, read Health / Shachi of NPCs near the player and log every change (one line per frame and NPC),
//    so hit counts and damage can be read from loader.log next to other mods' lines.
// 2. Spawn: on every load (game start or Alt+F5), spawn `spawn.count` enemies of `spawn.class` in front of the player.
//    `spawn.dummy`: their AI is switched off (they stand still). A dummy below `dummyMinHealth` of its max is removed
//    (not killed: no death, no loot, nothing for the save) and a new one is put in its place.
//    stop() (Alt+F5) removes everything this tool spawned.
// Spawn route learned from Cringe Blade Zero (Jersyi, MIT): BP_SGameAIFunctionLibrary.SpawnAI, then walking movement mode.
"use strict";

const MOD = "pbz-testbench";
const VERSION = "0.1.0";
const UE = require("ue");
const puerts = require("puerts");
const P_AILIB = "/SGameAI/FunctionLibrary/BP_SGameAIFunctionLibrary.BP_SGameAIFunctionLibrary_C";
const POLL_MS = 50;

const log = (m) => console.log(`[PBZMOD] [${MOD}] ${m}`);
const KSL = UE.KismetSystemLibrary;
const valid = (o) => { try { return !!o && KSL.IsValid(o); } catch (e) { return false; } };
const nameOf = (o) => { try { return KSL.GetObjectName(o); } catch (e) { return String(o); } };

const DEFAULTS = {
    enabled: true,
    measure: { enabled: true, radius: 3000 },
    spawn: { enabled: true, class: "/PBZCombatAsset/ActorData/Mobs/003_MaleThug/BP_Monster_MaleThug_Sword_Blue.BP_Monster_MaleThug_Sword_Blue_C",
             count: 1, distance: 500, spacing: 300, dummy: true },
    dummyMinHealth: 0.25,
};
let cfg = DEFAULTS;
try {
    const c = require("./config.json");
    cfg = { ...DEFAULTS, ...c, measure: { ...DEFAULTS.measure, ...(c.measure || {}) }, spawn: { ...DEFAULTS.spawn, ...(c.spawn || {}) } };
} catch (e) { log("config.json not read, using defaults: " + e); }

const shared = globalThis.__pbzTestbench = globalThis.__pbzTestbench || {};
if (typeof shared.stop === "function") { try { shared.stop(); } catch (e) { } }
shared.spawned = [];          // { pawn, transform } we own
const last = new Map();        // npc name -> { hp, sc }
const once = new Set();
const logOnce = (k, m) => { if (!once.has(k)) { once.add(k); log(m); } };

const gi = puerts.argv.getByName("GameInstance");
const player = () => { try { return UE.GameplayStatics.GetPlayerCharacter(gi, 0); } catch (e) { return null; } };
const now = () => { try { return UE.GameplayStatics.GetTimeSeconds(gi); } catch (e) { return 0; } };

let attrs = null;
function attr(npc, name) {
    if (!attrs) {
        const set = UE.BasicAttributeSet.StaticClass();
        attrs = {};
        for (const n of ["Health", "Health_Max", "Shachi", "Shachi_Max"]) attrs[n] = UE.PBZBlueprintFunctionLibrary.MakeAttribute(n, set);
    }
    return UE.PBZBlueprintFunctionLibrary.GetAttributeFromCharacter(npc, attrs[name]);
}
const r1 = (x) => Math.round(x * 10) / 10;

// ---- measure ----
function measure(pawn) {
    const out = puerts.$ref(UE.NewArray(UE.Actor));
    UE.GameplayStatics.GetAllActorsOfClass(gi, UE.PBZCharacter_NPC.StaticClass(), out);
    const arr = puerts.$unref(out), seen = new Set(), t = r1(now());
    const here = pawn.K2_GetActorLocation(), rad2 = cfg.measure.radius * cfg.measure.radius;
    for (let i = 0; i < arr.Num(); i++) {
        const npc = arr.Get(i);
        if (!valid(npc)) continue;
        const p = npc.K2_GetActorLocation(), dx = p.X - here.X, dy = p.Y - here.Y, dz = p.Z - here.Z;
        if (dx * dx + dy * dy + dz * dz > rad2) continue;
        const key = nameOf(npc);
        seen.add(key);
        let hp, sc, hpMax, scMax;
        try { hp = attr(npc, "Health"); sc = attr(npc, "Shachi"); hpMax = attr(npc, "Health_Max"); scMax = attr(npc, "Shachi_Max"); }
        catch (e) { logOnce("attr-err", "reading attributes failed: " + e); return; }
        const was = last.get(key);
        last.set(key, { hp, sc });
        if (!was) { log(`t=${t} npc ${key} in range: HP ${r1(hp)}/${r1(hpMax)}, Shachi ${r1(sc)}/${r1(scMax)}`); continue; }
        if (hp !== was.hp || sc !== was.sc)
            log(`t=${t} hit ${key}: HP ${r1(was.hp)} -> ${r1(hp)} (${r1(hp - was.hp)}), Shachi ${r1(was.sc)} -> ${r1(sc)} (${r1(sc - was.sc)})`);
    }
    for (const k of [...last.keys()]) if (!seen.has(k)) last.delete(k);
}

// ---- spawn ----
let lib = null;
function aiLib() {
    if (lib) return lib;
    const cls = UE.Class.Load(P_AILIB);
    if (!cls) throw new Error("BP_SGameAIFunctionLibrary not found");
    lib = puerts.blueprint.tojs(cls);
    return lib;
}

function spawnOne(cls, transform) {
    const pawn = aiLib().SpawnAI(cls, transform, null, null, gi);
    if (!valid(pawn)) { log("SpawnAI returned nothing"); return null; }
    try { pawn.CharacterMovement.SetMovementMode(1, 0); } catch (e) { logOnce("move-err", "SetMovementMode(walking) failed: " + e); } // comes out flying
    if (cfg.spawn.dummy) { try { aiLib().DeactivateAI(pawn, gi); } catch (e) { logOnce("deact-err", "DeactivateAI failed: " + e); } }
    shared.spawned.push({ pawn, transform });
    let hp = "?", hpMax = "?";
    try { hp = r1(attr(pawn, "Health")); hpMax = r1(attr(pawn, "Health_Max")); } catch (e) { }
    log(`spawned ${nameOf(pawn)} (${cfg.spawn.dummy ? "dummy, AI off" : "AI on"}), HP ${hp}/${hpMax}`);
    return pawn;
}

function spawnAll(pawn) {
    const s = cfg.spawn;
    const cls = UE.Class.Load(s.class);
    if (!cls) { log("enemy class not found: " + s.class); return; }
    const loc = pawn.K2_GetActorLocation(), fwd = pawn.GetActorForwardVector(), right = pawn.GetActorRightVector();
    const yaw = Math.atan2(-fwd.Y, -fwd.X);           // face the player
    for (let i = 0; i < Math.max(1, s.count | 0); i++) {
        const off = (i - (s.count - 1) / 2) * s.spacing;
        const at = new UE.Vector(loc.X + fwd.X * s.distance + right.X * off, loc.Y + fwd.Y * s.distance + right.Y * off, loc.Z + 50);
        const rot = UE.KismetMathLibrary.MakeRotator(0, 0, yaw * 180 / Math.PI); // (Roll, Pitch, Yaw)
        const tr = UE.KismetMathLibrary.MakeTransform(at, rot, new UE.Vector(1, 1, 1));
        try { spawnOne(cls, tr); } catch (e) { log("spawn threw: " + (e && e.stack || e)); shared.spawnFailed = (shared.spawnFailed | 0) + 1; return; }
    }
}

function guardDummies() {
    if (!cfg.spawn.dummy) return;
    for (const s of shared.spawned) {
        if (!valid(s.pawn)) continue;
        let hp, max;
        try { hp = attr(s.pawn, "Health"); max = attr(s.pawn, "Health_Max"); } catch (e) { return; }
        if (max > 0 && hp / max < cfg.dummyMinHealth) {
            log(`dummy ${nameOf(s.pawn)} at ${r1(hp)}/${r1(max)} HP: removed before it can die, replacing it`);
            try { s.pawn.K2_DestroyActor(); } catch (e) { }
            try { const cls = UE.Class.Load(cfg.spawn.class); const p = cls && spawnOne(cls, s.transform); if (p) s.replaced = true; } catch (e) { log("respawn threw: " + e); }
        }
    }
    shared.spawned = shared.spawned.filter((s) => valid(s.pawn));
}

// ---- loop ----
let timer, spawnedThisLoad = false, errors = 0;
function tick() {
    try {
        const pawn = player();
        if (!valid(pawn)) return;
        if (!spawnedThisLoad && cfg.spawn.enabled) { spawnedThisLoad = true; spawnAll(pawn); }
        guardDummies();
        if (cfg.measure.enabled) measure(pawn);
        errors = 0;
    } catch (e) {
        log("tick threw: " + (e && e.stack || e));
        if (++errors >= 20) { log("20 errors in a row, stopping"); shared.stop(); }
    }
}

shared.stop = () => {
    if (timer !== undefined) clearInterval(timer);
    timer = undefined;
    for (const s of shared.spawned) { try { if (valid(s.pawn)) s.pawn.K2_DestroyActor(); } catch (e) { } }
    if (shared.spawned.length) log(`removed ${shared.spawned.length} spawned enemy(s)`);
    shared.spawned = [];
    shared.stop = undefined;
};

if (cfg.enabled) timer = setInterval(tick, POLL_MS);
log(`${VERSION} started (enabled=${cfg.enabled}, spawn=${cfg.spawn.enabled ? cfg.spawn.count + "x " + cfg.spawn.class.split(".").pop() + (cfg.spawn.dummy ? " dummy" : "") : "off"}, measure=${cfg.measure.enabled})`);

exports.stop = function () {
    const s = globalThis.__pbzTestbench;
    if (s && typeof s.stop === "function") s.stop();
    log("stopped");
};
