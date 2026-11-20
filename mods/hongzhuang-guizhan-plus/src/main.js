// Scarlet Wraithblade Plus (hongzhuang-guizhan-plus) — PBZModLoader mod (Kintaro fork 2.1.0)
// MIT License. Game build 26367565 (CL-302256_JKS-17280).
//
// Stage: minimal verification (step 1, phase 1). Three checks, each with its own switch and log lines:
//   a) periodic explosion: every `tickInterval` s of a flower's own age (game time), spawn its explosion; the flower stays.
//   b) E (manual explode): explode all flowers, keep them, and do NOT remove the HasFlower GE.
//   c) E cooldown: passive `SpecialCooldown` = `manualCooldown`.
// The explosion path copies the passive's "Process Explosion" bytecode (docs/game-notes/scarlet-wraithblade-flowers-assets.md §2):
//   BD.CreateBullet(identity, passive) -> Initialize(null, avatar, passive, BD, false) -> "Parent Bullet Transforms" = positions -> Start()
// without the trailing Deactivate loop.
"use strict";

const MOD = "hongzhuang-guizhan-plus";
const VERSION = "0.0.3-verify";
const UE = require("ue");
const puerts = require("puerts");

const P_FLOWER = "/PBZCombatAsset/ActorData/Players/Hun/Weapon/GuiTouBlade/FlowerBullet/BP_Hun_GuiTouBlade_Flower_Base.BP_Hun_GuiTouBlade_Flower_Base_C";
const P_PASSIVE = "/PBZCombatAsset/ActorData/Players/Hun/Abilities/AHuaBlade/GA_Hun_GuiTouBlade_Passive.GA_Hun_GuiTouBlade_Passive_C";
const STOCK_COOLDOWN = 0.4; // passive CDO SpecialCooldown (asset default)
const POLL_MS = 50;         // how often we look; the decision itself uses game time (timer elapsed), so pause/slomo are respected

const log = (m) => console.log(`[PBZMOD] [${MOD}] ${m}`);
const KSL = UE.KismetSystemLibrary;
const valid = (o) => { try { return !!o && KSL.IsValid(o); } catch (e) { return false; } };
const pathOf = (o) => { try { return KSL.GetPathName(o); } catch (e) { return String(o); } };

// ---- config (re-read on every load, so Alt+F5 picks up edits) ----
const DEFAULTS = { enabled: true, debugLog: true, tickInterval: 4.0, tickCoalesce: 0.4, tickShake: false, manualCooldown: 5.0, manualKeepsFlower: true };
let cfg = { ...DEFAULTS };
try { cfg = { ...DEFAULTS, ...require("./config.json") }; } catch (e) { log("config.json not read, using defaults: " + e); }
const dbg = (m) => { if (cfg.debugLog) log(m); };

// ---- shared state: survives hot reload. Every load resets the switches explicitly (no `??=` carry-over of on=false). ----
const shared = globalThis.__hzgzPlus = globalThis.__hzgzPlus || {};
if (typeof shared.stop === "function") { try { shared.stop(); } catch (e) { } }
shared.on = !!cfg.enabled;
shared.cfg = cfg;
shared.lastBucket = new Map();   // flower path -> { k, age } (rebuilt from each flower's current age after a reload)
shared.passives = shared.passives || new Set(); // live passive instances we touched (to put SpecialCooldown back on stop)
const once = shared.once = new Set(); // one-time log keys, fresh on every load so a reload logs its own first steps
const logOnce = (k, m) => { if (!once.has(k)) { once.add(k); log(m); } };

const gi = puerts.argv.getByName("GameInstance");

function player() { try { return UE.GameplayStatics.GetPlayerCharacter(gi, 0); } catch (e) { return null; } }

function playerFlowers(pawn) {
    const cls = UE.Class.Load(P_FLOWER);
    if (!cls) return [];
    const out = puerts.$ref(UE.NewArray(UE.Actor));
    UE.GameplayStatics.GetAllActorsOfClass(gi, cls, out);
    const arr = puerts.$unref(out), list = [];
    for (let i = 0; i < arr.Num(); i++) {
        const f = arr.Get(i);
        if (!valid(f)) continue;
        let owner = null;
        try { owner = f.GetOwnerAvatar(); } catch (e) { owner = f.BulletOwnerAvatar; }
        if (owner !== pawn && pathOf(owner) !== pathOf(pawn)) continue; // drops Boss AHua flowers (same base class)
        list.push(f);
    }
    return list;
}

function flowerTransform(f) {
    try { const r = puerts.$ref(new UE.Transform()); f.GetBulletTransform(r); return puerts.$unref(r); }
    catch (e) { return f.GetTransform(); }
}

// Explode `flowers` without removing them. Groups by explosion BulletData like "Process Explosion" does: one bullet per group.
// Returns the number of explosion bullets started.
function explodeKeep(passive, flowers, why) {
    const avatar = passive.GetAvatarActorFromActorInfo();
    const groups = new Map(); // bd path -> { bd, transforms[] }
    for (const f of flowers) {
        const bd = f["Explode Bullet Data"];
        if (!valid(bd)) continue;
        const k = pathOf(bd);
        if (!groups.has(k)) groups.set(k, { bd, ts: [] });
        groups.get(k).ts.push(flowerTransform(f));
    }
    let started = 0;
    for (const [k, g] of groups) {
        const b = g.bd.CreateBullet(new UE.Transform(), passive);
        if (!valid(b)) { logOnce("cb-null", `[${why}] CreateBullet returned nothing for ${k}`); continue; }
        logOnce("cb-ok", `[${why}] CreateBullet ok: ${pathOf(b)}`);
        b.Initialize(null, avatar, passive, g.bd, false);
        logOnce("init-ok", `[${why}] Initialize(null, avatar, passive, BD, false) returned`);
        let arr;
        try { arr = UE.NewArray(UE.Transform); for (const t of g.ts) arr.Add(t); b["Parent Bullet Transforms"] = arr; }
        catch (e) {
            logOnce("pbt-assign", `[${why}] assigning Parent Bullet Transforms failed (${e}); trying Add on the bullet's own array`);
            const own = b["Parent Bullet Transforms"]; own.Empty(); for (const t of g.ts) own.Add(t);
        }
        logOnce("pbt-ok", `[${why}] Parent Bullet Transforms set, count ${b["Parent Bullet Transforms"].Num()} (want ${g.ts.length})`);
        // Camera shake / rumble are read from the BD in the bullet's PostStart (game-notes §6). For automatic ticks without
        // `tickShake`, blank them on the shared BD just around Start() and put them back right after (same frame, game thread).
        const mute = why === "tick" && !cfg.tickShake;
        let shake, ff;
        if (mute) {
            try { shake = g.bd["Explosion Shake"]; ff = g.bd["Explosion Force Feedback"]; g.bd["Explosion Shake"] = null; g.bd["Explosion Force Feedback"] = null; }
            catch (e) { logOnce("mute-err", "could not blank Explosion Shake: " + e); }
        }
        try { b.Start(); }
        finally {
            if (mute) { try { g.bd["Explosion Shake"] = shake; g.bd["Explosion Force Feedback"] = ff; } catch (e) { log("RESTORE of Explosion Shake failed: " + e); } }
        }
        logOnce("start-ok", `[${why}] Start() returned`);
        started++;
    }
    return started;
}

// ---- (a) periodic explosion ----
function tickPeriodic() {
    const interval = Number(cfg.tickInterval);
    if (!(interval > 0)) return;
    const pawn = player();
    if (!valid(pawn)) return;
    const coalesce = Math.max(0, Number(cfg.tickCoalesce) || 0);
    const seen = new Set(), cand = [];
    let anyStrict = false;
    for (const f of playerFlowers(pawn)) {
        const key = pathOf(f);
        seen.add(key);
        let age;
        try {
            const h = f["Explode Timer"];
            if (!KSL.K2_IsTimerActiveHandle(f, h)) continue;          // timer cleared (exploding / expired): leave it alone
            age = KSL.K2_GetTimerElapsedTimeHandle(f, h);              // world timer = game time
        } catch (e) { logOnce("timer-err", "reading Explode Timer failed: " + e); continue; }
        // shared.lastBucket: key -> { k: ticks already done (tick n happens at age n*interval), age }
        let st = shared.lastBucket.get(key);
        if (!st || age < st.age - 0.05) {                              // new, reused from a pool, or first sight after a reload
            st = { k: Math.floor(age / interval), age };
            shared.lastBucket.set(key, st);
            continue;
        }
        st.age = age;
        const strict = Math.floor(age / interval), loose = Math.floor((age + coalesce) / interval);
        if (strict > st.k) anyStrict = true;
        if (loose > st.k) cand.push({ f, st, loose });
    }
    for (const k of [...shared.lastBucket.keys()]) if (!seen.has(k)) shared.lastBucket.delete(k);
    // A ring spawns over ~0.1-0.4 s. Fire only when some flower is strictly due, and take along every flower that is due
    // within `tickCoalesce` s, so the whole ring is one bullet (one hit, one sound) instead of 2-4.
    if (!anyStrict) return;
    const due = new Map(); // passive path -> { passive, flowers[] }
    for (const { f, st, loose } of cand) {
        st.k = loose;
        const passive = f["Passive Ability"];
        if (!valid(passive)) { logOnce("no-passive", "flower has no Passive Ability; skipped"); continue; }
        const pk = pathOf(passive);
        if (!due.has(pk)) due.set(pk, { passive, flowers: [] });
        due.get(pk).flowers.push(f);
    }
    for (const { passive, flowers } of due.values()) {
        const n = explodeKeep(passive, flowers, "tick");
        dbg(`tick: ${flowers.length} flower(s) exploded in ${n} bullet(s), kept`);
    }
}

// ---- (b)+(c) E override. The mixin goes on once per game run; its body reads `globalThis.__hzgzPlus`, so a reload swaps logic. ----
function onTriggerFlowers(passive) {
    const s = globalThis.__hzgzPlus;
    if (!s || !s.on) return false;
    const c = s.cfg;
    const pawn = player();
    let avatar = null;
    try { avatar = passive.GetAvatarActorFromActorInfo(); } catch (e) { }
    if (!valid(pawn) || pathOf(avatar) !== pathOf(pawn)) return false; // not the player's passive (Boss subclass inherits it)
    if (Number(c.manualCooldown) > 0) { passive.SpecialCooldown = Number(c.manualCooldown); s.passives.add(passive); } // (c) read by WaitDelay right after us
    if (!c.manualKeepsFlower) return false; // vanilla body runs
    const cur = passive["Current Flowers"], flowers = [];
    for (let i = 0; i < cur.Num(); i++) { const f = cur.Get(i); if (valid(f)) flowers.push(f); }
    const n = explodeKeep(passive, flowers, "E");
    dbg(`E: ${flowers.length} flower(s) exploded in ${n} bullet(s), kept; HasFlower GE untouched; cooldown ${passive.SpecialCooldown}`);
    return true; // handled: skip the vanilla Deactivate loop and the HasFlower GE removal
}
shared.onTriggerFlowers = onTriggerFlowers;

class PassiveMixin {
    ["Trigger Flowers"]() {
        try {
            const s = globalThis.__hzgzPlus;
            if (s && typeof s.onTriggerFlowers === "function" && s.onTriggerFlowers(this)) return;
        } catch (e) { console.log(`[PBZMOD] [${MOD}] Trigger Flowers override threw, running vanilla: ${e}`); }
        // vanilla body (bytecode: Process Explosion(Current Flowers); BP_RemoveGameplayEffectFromOwnerWithHandle(Has Flower Handle, -1))
        this["Process Explosion"](this["Current Flowers"]);
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

// FGameplayTag from a name: the game's own helper first, then the struct's TagName field.
function makeTag(name) {
    try { return UE.PBZBlueprintFunctionLibrary.ConvertStringToGameplayTag(name); }
    catch (e) { logOnce("tag-conv", "ConvertStringToGameplayTag failed (" + e + "), using GameplayTag.TagName"); }
    const t = new UE.GameplayTag(); t.TagName = name; return t;
}

// Which weapon-upgrade tags the player has (to map Lv25 / Lv30 to tags: the user states the weapon level, we read the log).
let lastTagLine = "";
function logUpgradeTags() {
    let asc = null;
    try { asc = UE.AbilitySystemBlueprintLibrary.GetAbilitySystemComponent(player()); } catch (e) { }
    if (!valid(asc)) return;
    const names = [];
    try {
        for (const t of ["CanManualExplode", "CanBuff", "CanCharge", "Evolution"])
            if (asc.HasMatchingGameplayTag(makeTag("CharacterState.WeaponUpgrade.GuiTouBlade." + t))) names.push(t);
    } catch (e) { logOnce("tag-err", "reading tags failed: " + e); return; }
    const line = names.sort().join(", ") || "(none)";
    if (line !== lastTagLine) { lastTagLine = line; log("weapon upgrade tags on player: " + line); }
}

// ---- loop ----
let timer, errors = 0;
function tick() {
    if (!shared.on) return;
    try {
        if (!valid(player())) return; // title screen / loading
        ensureMixin();
        logUpgradeTags();
        if (!shared.cdoSet && Number(cfg.manualCooldown) > 0) shared.cdoSet = setCdoCooldown(Number(cfg.manualCooldown));
        tickPeriodic();
        errors = 0;
    } catch (e) {
        log("tick threw: " + (e && e.stack || e));
        if (++errors >= 20) { log("20 errors in a row, stopping"); shared.stop(); }
    }
}

shared.stop = () => {
    if (timer !== undefined) clearInterval(timer);
    timer = undefined;
    shared.on = false; // the mixin stays on the class but falls through to the vanilla body
    setCdoCooldown(STOCK_COOLDOWN);
    shared.cdoSet = false;
    for (const p of shared.passives) { try { if (valid(p)) p.SpecialCooldown = STOCK_COOLDOWN; } catch (e) { } }
    shared.passives.clear();
    shared.stop = undefined;
};

if (shared.on) timer = setInterval(tick, POLL_MS);
log(`${VERSION} started (enabled=${shared.on}, tickInterval=${cfg.tickInterval}, manualCooldown=${cfg.manualCooldown}, manualKeepsFlower=${cfg.manualKeepsFlower})`);

exports.stop = function () {
    const s = globalThis.__hzgzPlus;
    if (s && typeof s.stop === "function") s.stop();
    log("stopped");
};
