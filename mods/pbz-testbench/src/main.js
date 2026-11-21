// pbz-testbench — local test helper for PBZ mod development. NOT shipped with any mod.
// MIT License. Game build 26367565, PBZModLoader Kintaro 2.1.0.
//
// 1. Measure: every poll, read Health / Shachi of NPCs near the player and log every change (one line per frame and NPC),
//    so hit counts and damage can be read from loader.log next to other mods' lines.
// 2. Spawn: on every load (game start or Alt+F5), spawn `spawn.count` enemies of `spawn.class` in front of the player.
//    `spawn.dummy`: their AI is switched off (they stand still). A dummy below `dummyMinHealth` of its max is removed
//    (not killed: no death, no loot, nothing for the save); Alt+F5 spawns a new one.
//    stop() (Alt+F5) removes everything this tool spawned.
// 3. Dump (`dump.enabled`): once per load, log the upgrade table (GEs per level) of the equipped main weapons, read-only.
// 4. Self-test (`selftest.enabled`): spawn a ring of Scarlet Wraithblade flowers around the dummy, call E, log HP drops.
// Spawn route learned from Cringe Blade Zero (Jersyi, MIT): BP_SGameAIFunctionLibrary.SpawnAI, then walking movement mode.
"use strict";

const MOD = "pbz-testbench";
const VERSION = "0.3.0";
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
    dump: { enabled: false, weaponFilter: "" },
    selftest: { enabled: false, flowersAt: 1.5, count: 6, ringRadius: 60, eAt: 10, endAt: 20, noHitCounter: false, pinDummy: false, centerFlower: true },
};
let cfg = DEFAULTS;
try {
    const c = require("./config.json");
    cfg = { ...DEFAULTS, ...c, measure: { ...DEFAULTS.measure, ...(c.measure || {}) }, spawn: { ...DEFAULTS.spawn, ...(c.spawn || {}) }, dump: { ...DEFAULTS.dump, ...(c.dump || {}) }, selftest: { ...DEFAULTS.selftest, ...(c.selftest || {}) } };
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
            log(`t=${t} hit ${key}: HP ${r1(was.hp)} -> ${r1(hp)} (${r1(hp - was.hp)}), Shachi ${r1(was.sc)} -> ${r1(sc)} (${r1(sc - was.sc)})${extraState(npc)}`);
    }
    for (const k of [...last.keys()]) if (!seen.has(k)) last.delete(k);
}

// Extra state on hit lines: the flower debuff tag and the Lv30 (铸魂) hit counter of Scarlet Wraithblade.
const P_HITCOUNTER = "/PBZCombatAsset/ActorData/Players/Hun/Weapon/GuiTouBlade/UpgradeData/GE_Weapon_GuiTouBlade_Evolution_HitCounter.GE_Weapon_GuiTouBlade_Evolution_HitCounter_C";
let tagInDebuff = null;
function extraState(npc) {
    try {
        const asc = UE.AbilitySystemBlueprintLibrary.GetAbilitySystemComponent(npc);
        if (!valid(asc)) return "";
        if (!tagInDebuff) tagInDebuff = UE.PBZBlueprintFunctionLibrary.ConvertStringToGameplayTag("CharacterState.AbilityState.GuiTouBlade.InDebuff");
        const cls = UE.Class.Load(P_HITCOUNTER);
        const n = cls ? asc.GetGameplayEffectCount(cls, null, true) : "?";
        const has = (a, t) => { try { return a.HasMatchingGameplayTag(UE.PBZBlueprintFunctionLibrary.ConvertStringToGameplayTag(t)); } catch (e) { return "?"; } };
        const pl = player(), pasc = UE.AbilitySystemBlueprintLibrary.GetAbilitySystemComponent(pl);
        const pp = pl.K2_GetActorLocation(), np = npc.K2_GetActorLocation();
        return `, InDebuff ${asc.HasMatchingGameplayTag(tagInDebuff)}, hit counter ${n}; npc Executing ${has(asc, "CharacterState.HitReact.State.Executing")} Dead ${has(asc, "CharacterState.Dead")}`
            + `; player Execution ${has(pasc, "Ability.Action.Execution")} at ${r1(Math.hypot(pp.X - np.X, pp.Y - np.Y))} cm`;
    } catch (e) { logOnce("extra-err", "reading debuff / hit counter failed: " + e); return ""; }
}
function stripHitCounter(npc) {
    try { const asc = UE.AbilitySystemBlueprintLibrary.GetAbilitySystemComponent(npc), cls = UE.Class.Load(P_HITCOUNTER); if (valid(asc) && cls) asc.RemoveActiveGameplayEffectBySourceEffect(cls, null, -1); }
    catch (e) { logOnce("strip-err", "removing the hit counter failed: " + e); }
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
    shared.spawned.push({ pawn, transform, born: now() });
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

// A dummy below `dummyMinHealth` is removed (not killed). No automatic replacement: 0.1.0 replaced it at once and fell
// into a loop (each new dummy read 0 HP on the next poll, ~20 spawns a second). Press Alt+F5 for a new one.
function guardDummies() {
    if (!cfg.spawn.dummy) return;
    for (const s of shared.spawned) {
        if (!valid(s.pawn)) continue;
        let hp, max;
        try { hp = attr(s.pawn, "Health"); max = attr(s.pawn, "Health_Max"); } catch (e) { return; }
        if (max > 0 && hp / max < cfg.dummyMinHealth) {
            log(`dummy ${nameOf(s.pawn)} at ${r1(hp)}/${r1(max)} HP, ${r1(now() - s.born)} s after spawn: removed before it can die (Alt+F5 for a new one)`);
            try { s.pawn.K2_DestroyActor(); } catch (e) { log("destroy threw: " + e); }
        }
    }
    shared.spawned = shared.spawned.filter((s) => valid(s.pawn));
}

// ---- dump: the weapon upgrade table of the equipped main weapons, read at runtime (read-only) ----
// PBZBackPackSubsystem.GetMainWeaponLevelData(id, level) -> WeaponUpLevelData { GEDatas, SnapSoulGEDatas, PersistentGEDatas, GEUIDataArray, AttackMultipliers }.
function softPath(p) {
    for (const f of [() => KSL.Conv_SoftClassReferenceToString(p), () => KSL.Conv_SoftObjectReferenceToString(p), () => p.ToString(), () => String(p)]) {
        try { const s = f(); if (s && s !== "[object Object]") return String(s).split("/").pop(); } catch (e) { }
    }
    return "?";
}
function tagName(t) { try { return t.TagName || UE.BlueprintGameplayTagLibrary.GetTagName(t); } catch (e) { return "?"; } }
function arr(a, f) { const out = []; try { for (let i = 0; i < a.Num(); i++) out.push(f(a.Get(i))); } catch (e) { out.push("ERR " + e); } return out; }
function dumpWeapons() {
    const bp = UE.SubsystemBlueprintLibrary.GetWorldSubsystem(player(), UE.PBZBackPackSubsystem.StaticClass());
    if (!valid(bp)) { log("dump: no PBZBackPackSubsystem"); return; }
    const lv = puerts.$ref(0);
    try { if (bp.GetCurrentHoldingWeaponLevel(true, lv)) log(`dump: current holding main weapon level ${puerts.$unref(lv)}`); } catch (e) { log("dump: GetCurrentHoldingWeaponLevel threw " + e); }
    const ids = arr(bp.GetEquipmentNormalWeapons(), (x) => String(x));
    log(`dump: equipped main weapons: ${ids.join(", ")}`);
    for (const id of ids) {
        if (cfg.dump.weaponFilter && !id.includes(cfg.dump.weaponFilter)) continue;
        let cur = "?", max = "?", snap = "?";
        try { cur = bp.GetWeaponLevel(id, true); max = bp.GetWeaponMaxLevel(id, true); } catch (e) { }
        try { const l = puerts.$ref(0), j = puerts.$ref(false), s = puerts.$ref(false); bp.GetButtonDisplayInfo(id, 2, l, j, s); snap = puerts.$unref(s); } catch (e) { snap = "ERR " + e; }
        log(`dump: weapon ${id}: level ${cur}/${max}, already snap-souled ${snap}`);
        try { const m = bp.GetWeaponCurrentGEUIData(id, true, false); log(`dump: ${id} current GE UI data: ${mapStr(m)}`); } catch (e) { log("dump: GetWeaponCurrentGEUIData threw " + e); }
        for (let L = 0; L <= (Number(max) || 30); L++) {
            const r = puerts.$ref(new UE.WeaponUpLevelData());
            let ok = false;
            try { ok = bp.GetMainWeaponLevelData(id, L, r); } catch (e) { log(`dump: L${L} threw ${e}`); continue; }
            if (!ok) continue;
            const d = puerts.$unref(r);
            const ge = (x) => `${softPath(x.SoftClassPtr)}@${x.GELevel}${x.bApplyOnCurrentEquipOnly ? "(equip)" : ""}`;
            log(`dump: ${id} L${L}: atk x${d.AttackMultipliers}; GE [${arr(d.GEDatas, ge).join(", ")}]; snapSoul GE [${arr(d.SnapSoulGEDatas, ge).join(", ")}]; persistent [${arr(d.PersistentGEDatas, (x) => softPath(x.GameplayEffect) + "@" + x.Level).join(", ")}]; UI [${arr(d.GEUIDataArray, (x) => tagName(x.GETag) + "=" + x.GEValue).join(", ")}]`);
        }
    }
}
// puerts TMap: iterate by index (no Keys()).
function mapEntries(m) {
    const out = [];
    if (!m) return out;
    if (typeof m.GetMaxIndex === "function") {
        for (let i = 0; i < m.GetMaxIndex(); i++) if (m.IsValidIndex(i)) { const k = m.GetKey(i); out.push([k, m.Get(k)]); }
    } else if (typeof m.Keys === "function") { const ks = m.Keys(); for (let i = 0; i < ks.Num(); i++) { const k = ks.Get(i); out.push([k, m.Get(k)]); } }
    return out;
}
function mapStr(m) {
    const out = [];
    try { for (const [k, v] of mapEntries(m)) out.push(tagName(k) + "=" + v); } catch (e) { return "ERR " + e; }
    return out.join(", ");
}

// ---- self-test (`selftest.enabled`): flowers of Scarlet Wraithblade around the first dummy, then E, all from code ----
// Timeline (game seconds from the first poll with a dummy): `flowersAt` spawn `count` small flowers on a circle of
// `ringRadius` around the dummy (the same CreateBullet -> Initialize -> Start path the game uses); `eAt` call the
// passive's "Trigger Flowers" (what E does after its checks); `endAt` log a summary of every HP drop of the dummy.
const P_FLOWER_SMALL_BD = "/PBZCombatAsset/ActorData/Players/Hun/BulletData/LongBlade/GuiTouBlade/Flower/BD_Hun_GuiTouBlade_Flower_Small.BD_Hun_GuiTouBlade_Flower_Small";
const P_FLOWER_BASE = "/PBZCombatAsset/ActorData/Players/Hun/Weapon/GuiTouBlade/FlowerBullet/BP_Hun_GuiTouBlade_Flower_Base.BP_Hun_GuiTouBlade_Flower_Base_C";
const st = { t0: null, steps: new Set(), drops: [], lastHp: null, lastCountAt: -1 };
function myFlowers(pawn) {
    const cls = UE.Class.Load(P_FLOWER_BASE);
    if (!cls) return [];
    const out = puerts.$ref(UE.NewArray(UE.Actor));
    UE.GameplayStatics.GetAllActorsOfClass(gi, cls, out);
    const arr = puerts.$unref(out), list = [];
    for (let i = 0; i < arr.Num(); i++) { const f = arr.Get(i); if (!valid(f)) continue; let o = null; try { o = f.GetOwnerAvatar(); } catch (e) { } if (o === pawn) list.push(f); }
    return list;
}
function selftest(pawn) {
    const s = cfg.selftest, d = shared.spawned.find((x) => valid(x.pawn));
    if (!d) return;
    const t = now();
    if (st.t0 === null) { st.t0 = t; log(`selftest: start (dummy ${nameOf(d.pawn)})`); }
    const rel = t - st.t0;
    let hp = null;
    try { hp = attr(d.pawn, "Health"); } catch (e) { }
    if (hp !== null && st.lastHp !== null && hp < st.lastHp) st.drops.push({ at: r1(rel), d: r1(hp - st.lastHp), afterE: st.steps.has("E") });
    if (hp !== null) st.lastHp = hp;
    if (s.noHitCounter) stripHitCounter(d.pawn);
    // `pinDummy`: explosions stagger the dummy out of the flowers; put it back every poll (tests of linger timing).
    if (s.pinDummy && st.pin) { try { d.pawn.K2_SetActorLocation(st.pin, false, puerts.$ref(new UE.HitResult()), true); } catch (e) { } }   // keep the Lv30 hit-counter burst from killing the dummy
    if (!st.steps.has("flowers") && rel >= s.flowersAt) {
        st.steps.add("flowers");
        try {
            const bd = UE.Object.Load(P_FLOWER_SMALL_BD), c = d.pawn.K2_GetActorLocation();
            if (!valid(bd)) throw new Error("flower BD not found");
            // The flower applies its debuff through ApplyGameplayEffectWithWeaponUpgradeData(source ability, ...), so it
            // needs the passive as source ability. The passive registers each new flower (SpawnFlower event) and writes
            // itself into the flower's "Passive Ability": the first flower (centre, i = count) tells us the passive.
            let passive = null;
            const order = s.centerFlower ? [s.count, ...Array.from({ length: s.count }, (_, k) => k)] : Array.from({ length: s.count }, (_, k) => k);
            for (const i of order) {
                const a = 2 * Math.PI * i / s.count, rr = i === s.count ? 0 : s.ringRadius;
                const tr = UE.KismetMathLibrary.MakeTransform(new UE.Vector(c.X + Math.cos(a) * rr, c.Y + Math.sin(a) * rr, c.Z), new UE.Rotator(), new UE.Vector(1, 1, 1));
                const b = bd.CreateBullet(tr, pawn);
                if (!valid(b)) throw new Error("CreateBullet returned nothing");
                b.Initialize(null, pawn, passive, bd, false);
                b.Start();
                if (!passive) { try { passive = b["Passive Ability"]; } catch (e) { } if (!valid(passive)) passive = null; log(`selftest: passive from the first flower: ${passive ? "found" : "not found (debuff may not apply)"}`); }
            }
            const fl = myFlowers(pawn).map((f) => f.K2_GetActorLocation());
            const fz = fl.length ? fl.map((v) => `(${r1(v.X - c.X)},${r1(v.Y - c.Y)},${r1(v.Z - c.Z)})`).join(" ") : "none yet";
            log(`selftest: t=${r1(rel)} spawned ${s.count} small flowers r=${s.ringRadius} around the dummy at (${r1(c.X)},${r1(c.Y)},${r1(c.Z)}); flower offsets ${fz}`);
        } catch (e) { log("selftest: spawning flowers FAILED: " + (e && e.stack || e)); }
    }
    // The dummy (AI off) can hang in the air over a slope; once the flowers have found the floor, set it down on
    // their mean height so it stands inside the ring.
    if (st.steps.has("flowers") && !st.steps.has("ground") && rel >= s.flowersAt + 0.3) {
        st.steps.add("ground");
        try {
            const c = d.pawn.K2_GetActorLocation(), fl = myFlowers(pawn).map((f) => f.K2_GetActorLocation()).filter((v) => Math.abs(v.Z - c.Z) > 1);
            if (fl.length) {
                fl.sort((a, b) => Math.hypot(a.X - c.X, a.Y - c.Y) - Math.hypot(b.X - c.X, b.Y - c.Y));
                const gz = fl[0].Z;                       // the floor under the centre flower
                let hh = 90; try { hh = d.pawn.CapsuleComponent.GetScaledCapsuleHalfHeight(); } catch (e) { }
                st.pin = new UE.Vector(c.X, c.Y, gz + hh);
                d.pawn.K2_SetActorLocation(st.pin, false, puerts.$ref(new UE.HitResult()), true);
                log(`selftest: dummy set down from z ${r1(c.Z)} to ${r1(gz + hh)} (centre flower floor ${r1(gz)}, half height ${r1(hh)})`);
            }
        } catch (e) { log("selftest: setting the dummy down failed: " + e); }
    }
    if (rel - st.lastCountAt >= 1) { st.lastCountAt = rel; const n = myFlowers(pawn).length; log(`selftest: t=${r1(rel)} flowers alive ${n}, dummy HP ${hp === null ? "?" : r1(hp)}`); }
    if (!st.steps.has("E") && s.eAt > 0 && rel >= s.eAt) {
        st.steps.add("E");
        const f = myFlowers(pawn)[0];
        const p = f && f["Passive Ability"];
        if (!valid(p)) log("selftest: E skipped, no flower with a passive");
        else { try { p["Trigger Flowers"](); log(`selftest: t=${r1(rel)} E (passive Trigger Flowers called)`); } catch (e) { log("selftest: Trigger Flowers threw: " + e); } }
    }
    if (!st.steps.has("end") && rel >= s.endAt) {
        st.steps.add("end");
        log(`selftest: done. HP drops of the dummy (t, delta, after E): ${st.drops.map((x) => `${x.at}:${x.d}${x.afterE ? "E" : ""}`).join(" ") || "(none)"}`);
    }
}

// ---- loop ----
let timer, spawnedThisLoad = false, dumpedThisLoad = false, errors = 0;
function tick() {
    try {
        const pawn = player();
        if (!valid(pawn)) return;
        if (!dumpedThisLoad && cfg.dump.enabled) { dumpedThisLoad = true; try { dumpWeapons(); } catch (e) { log("dump threw: " + (e && e.stack || e)); } }
        if (!spawnedThisLoad && cfg.spawn.enabled) { spawnedThisLoad = true; spawnAll(pawn); }
        if (cfg.measure.enabled) measure(pawn);
        if (cfg.selftest.enabled) selftest(pawn);
        guardDummies();
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
    if (cfg.selftest.enabled) { // the next run starts clean: no flowers left over from this one
        let n = 0;
        try { for (const f of myFlowers(player())) { try { f.Deactivate(0); n++; } catch (e) { } } } catch (e) { }
        if (n) log(`selftest: removed ${n} flower(s)`);
    }
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
