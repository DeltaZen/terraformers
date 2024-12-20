import { cam } from "./cam"
import { dropCoin } from "./coin"
import { addPhysicsComp } from "./components/physics"
import { addRenderComp } from "./components/render"
import {
    MOB0_ATTACK,
    MOB0_HEALTH,
    MOB0_SPEED,
    MOB1_ATTACK,
    MOB1_HEALTH,
    MOB1_SPEED,
    MOB2_ATTACK,
    MOB2_HEALTH,
    MOB2_SPEED,
    MOB3_ATTACK,
    MOB3_HEALTH,
    MOB3_SPEED,
    MOB0BOSS_ATTACK,
    MOB0BOSS_HEALTH,
    MOB0BOSS_SPEED,
    MOB1BOSS_ATTACK,
    MOB1BOSS_HEALTH,
    MOB1BOSS_SPEED,
    MOB2BOSS_ATTACK,
    MOB2BOSS_HEALTH,
    MOB2BOSS_SPEED,
    MOB3BOSS_ATTACK,
    MOB3BOSS_HEALTH,
    MOB3BOSS_SPEED,
    MOB_MAX_COLLISION_SNAP_DIST,
    SPAWN_RADIUS,
    SPRITE_ANIM_RATE_MS,
    WHITE,
    DEBUG,
    RED,
    BLACK0,
} from "./const"
import { ticker } from "./core/interpolation"
import { aabb, angleToVec, distance, limitMagnitude, rand } from "./core/math"
import { endGame, prepareDeathScene } from "./scene"
import { playHit, playStart } from "./sound"
import { stats } from "./stat"
import { spawnFloatingText } from "./text"

export const enum MobType {
    mob0,
    mob1,
    mob2,
    mob3,
    mob0boss,
    mob1boss,
    mob2boss,
    mob3boss,
}

// poor man's ecs
const E = {
    x: [] as number[],
    y: [] as number[],
    health: [] as number[],
    flipped: [] as boolean[],
    // is close to hero
    near: [] as boolean[],
    frame: [] as number[],
    frameTicker: [] as number[],
    dmgTicker: [] as number[],
    type: [] as MobType[],
    active: [] as boolean[],
}

// stores ids of free entities
let freePool: number[] = []

let wavesEnded = false
let playHitSound = false

export const MOB_COLLISION_BOX_SIZE = 8
const DMG_BLINK_ANIM_TIME = 200
const COLLISION_RADIUS = MOB_COLLISION_BOX_SIZE / 2

const tenSec = ticker(10000)
const fiveSec = ticker(5000)
const twoSec = ticker(2000)
const sec = ticker(1000)
const sec2 = ticker(500)
const sec4 = ticker(250)
const secf = ticker(100)
const endGameAnim = ticker(3e3)

const frames = [0, 1, 2, 1]
const maxFrames = frames.length

const healths = {
    [MobType.mob0]: MOB0_HEALTH,
    [MobType.mob1]: MOB1_HEALTH,
    [MobType.mob2]: MOB2_HEALTH,
    [MobType.mob3]: MOB3_HEALTH,
    [MobType.mob0boss]: MOB0BOSS_HEALTH,
    [MobType.mob1boss]: MOB1BOSS_HEALTH,
    [MobType.mob2boss]: MOB2BOSS_HEALTH,
    [MobType.mob3boss]: MOB3BOSS_HEALTH,
}

const speeds = {
    [MobType.mob0]: MOB0_SPEED,
    [MobType.mob1]: MOB1_SPEED,
    [MobType.mob2]: MOB2_SPEED,
    [MobType.mob3]: MOB3_SPEED,
    [MobType.mob0boss]: MOB0BOSS_SPEED,
    [MobType.mob1boss]: MOB1BOSS_SPEED,
    [MobType.mob2boss]: MOB2BOSS_SPEED,
    [MobType.mob3boss]: MOB3BOSS_SPEED,
}

const attacks = {
    [MobType.mob0]: MOB0_ATTACK,
    [MobType.mob1]: MOB1_ATTACK,
    [MobType.mob2]: MOB2_ATTACK,
    [MobType.mob3]: MOB3_ATTACK,
    [MobType.mob0boss]: MOB0BOSS_ATTACK,
    [MobType.mob1boss]: MOB1BOSS_ATTACK,
    [MobType.mob2boss]: MOB2BOSS_ATTACK,
    [MobType.mob3boss]: MOB3BOSS_ATTACK,
}

// throwaway temporary variable for optimization
const _vec = { x: 0, y: 0 }

let unloadPhysics: () => void
let unloadRender: () => void

export type WavesKey = keyof typeof waves

const waves = {
    1: (dt: number) => {
        const time = stats.time - stats.waveStartTime
        if (time < 30) {
            if (sec.tick(dt)) {
                spawnMob(MobType.mob0)
            }
        } else if (time < 60) {
            if (fiveSec.tick(dt)) {
                spawnMob(MobType.mob1)
            }
            if (sec2.tick(dt)) {
                spawnMob(MobType.mob0)
            }
        } else if (time < 90) {
            if (sec.tick(dt)) {
                spawnMob(MobType.mob0)
            }
            if (fiveSec.tick(dt)) {
                spawnMob(MobType.mob0boss)
            }
            if (twoSec.tick(dt)) {
                spawnMob(MobType.mob1)
            }
        } else if (time < 120) {
            if (fiveSec.tick(dt)) {
                spawnMob(MobType.mob0boss)
            }
            if (sec2.tick(dt)) {
                spawnMob(MobType.mob0)
            }
            if (sec.tick(dt)) {
                spawnMob(MobType.mob1)
            }
        } else if (time < 180) {
            if (sec4.tick(dt)) {
                spawnMob(MobType.mob0)
            }
            if (fiveSec.tick(dt)) {
                spawnMob(MobType.mob1boss)
            }
            if (sec2.tick(dt)) {
                spawnMob(MobType.mob1)
            }
        } else if (!hasMobs()) {
            increaseWave()
        }
    },
    2: (dt: number) => {
        const time = stats.time - stats.waveStartTime
        if (time < 60) {
            if (fiveSec.tick(dt)) {
                spawnMob(MobType.mob0boss)
                spawnMob(MobType.mob1boss)
            }
            if (sec4.tick(dt)) {
                spawnMob(MobType.mob0)
                spawnMob(MobType.mob1)
            }
        } else if (time < 90) {
            if (fiveSec.tick(dt)) {
                spawnMob(MobType.mob0boss)
                spawnMob(MobType.mob0boss)
                spawnMob(MobType.mob0boss)
            }
            if (secf.tick(dt)) {
                spawnMob(MobType.mob0)
                spawnMob(MobType.mob0)
                spawnMob(MobType.mob0)
            }
        } else if (time < 120) {
            if (fiveSec.tick(dt)) {
                spawnMob(MobType.mob1boss)
                spawnMob(MobType.mob1boss)
            }
            if (secf.tick(dt)) {
                spawnMob(MobType.mob1)
                spawnMob(MobType.mob1)
            }
        } else if (time < 150) {
            if (sec2.tick(dt)) {
                spawnMob(MobType.mob1)
            }
            if (fiveSec.tick(dt)) {
                spawnMob(MobType.mob2boss)
            }
            if (twoSec.tick(dt)) {
                spawnMob(MobType.mob2)
            }
        } else if (time < 180) {
            if (sec4.tick(dt)) {
                spawnMob(MobType.mob1)
            }
            if (fiveSec.tick(dt)) {
                spawnMob(MobType.mob0boss)
                spawnMob(MobType.mob2boss)
            }
            if (sec2.tick(dt)) {
                spawnMob(MobType.mob0boss)
                spawnMob(MobType.mob2)
            }
        } else if (!hasMobs()) {
            increaseWave()
        }
    },
    3: (dt: number) => {
        const time = stats.time - stats.waveStartTime
        if (time < 60) {
            if (sec4.tick(dt)) {
                spawnMob(MobType.mob0)
                spawnMob(MobType.mob1)
            }
            if (fiveSec.tick(dt)) {
                spawnMob(MobType.mob2boss)
            }
            if (sec2.tick(dt)) {
                spawnMob(MobType.mob2)
            }
        } else if (time < 120) {
            if (fiveSec.tick(dt)) {
                spawnMob(MobType.mob2boss)
            }
            if (secf.tick(dt)) {
                spawnMob(MobType.mob2)
            }
        } else if (time < 180) {
            if (fiveSec.tick(dt)) {
                spawnMob(MobType.mob1boss)
                spawnMob(MobType.mob1boss)
            }
            if (secf.tick(dt)) {
                spawnMob(MobType.mob1)
                spawnMob(MobType.mob1)
            }
            if (sec4.tick(dt)) {
                spawnMob(MobType.mob2)
            }
        } else if (!hasMobs()) {
            increaseWave()
        }
    },
    4: (dt: number) => {
        const time = stats.time - stats.waveStartTime
        if (time < 60) {
            if (fiveSec.tick(dt)) {
                spawnMob(MobType.mob1boss)
                spawnMob(MobType.mob2boss)
            }
            if (secf.tick(dt)) {
                spawnMob(MobType.mob1)
                spawnMob(MobType.mob2)
            }
        } else if (time < 90) {
            if (secf.tick(dt)) {
                spawnMob(MobType.mob1)
                spawnMob(MobType.mob1)
                spawnMob(MobType.mob2)
            }
            if (sec4.tick(dt)) {
                spawnMob(MobType.mob2)
            }
            if (fiveSec.tick(dt)) {
                spawnMob(MobType.mob3boss)
            }
            if (sec.tick(dt)) {
                spawnMob(MobType.mob3)
            }
        } else if (time < 120) {
            if (sec2.tick(dt)) {
                spawnMob(MobType.mob2)
            }
            if (fiveSec.tick(dt)) {
                spawnMob(MobType.mob3boss)
                spawnMob(MobType.mob0boss)
            }
            if (sec.tick(dt)) {
                spawnMob(MobType.mob3)
                spawnMob(MobType.mob0boss)
            }
        } else if (time < 150) {
            if (fiveSec.tick(dt)) {
                spawnMob(MobType.mob3boss)
            }
            if (sec2.tick(dt)) {
                spawnMob(MobType.mob3)
            }
            if (sec4.tick(dt)) {
                spawnMob(MobType.mob2)
            }
        } else if (time < 180) {
            if (twoSec.tick(dt)) {
                spawnMob(MobType.mob3boss)
            }
            if (sec4.tick(dt)) {
                spawnMob(MobType.mob3)
            }
            if (sec2.tick(dt)) {
                spawnMob(MobType.mob2)
                spawnMob(MobType.mob1)
            }
        } else if (time < 210) {
            if (sec4.tick(dt)) {
                spawnMob(MobType.mob2)
                spawnMob(MobType.mob1boss)
            }
            if (twoSec.tick(dt)) {
                spawnMob(MobType.mob3boss)
                spawnMob(MobType.mob0boss)
            }
            if (sec2.tick(dt)) {
                spawnMob(MobType.mob3)
                spawnMob(MobType.mob0)
            }
        } else if (time < 240) {
            if (secf.tick(dt)) {
                spawnMob(MobType.mob3)
                spawnMob(MobType.mob3)
                spawnMob(MobType.mob2)
                spawnMob(MobType.mob1)
                spawnMob(MobType.mob0boss)
                spawnMob(MobType.mob0)
                spawnMob(MobType.mob0)
            }
        } else if (!hasMobs()) {
            if (!wavesEnded) {
                stats.won = true
                prepareDeathScene()
                wavesEnded = true
            }
            if (endGameAnim.tick(dt)) {
                playStart()
                endGame()
            }
        }
    },
}

const hasMobs = () => {
    return E.active.some((active) => active)
}

const getActiveMobsCount = () => {
    return E.active.reduce((count, active) => count + (active ? 1 : 0), 0)
}

const increaseWave = () => {
    stats.wave += 1
    stats.waveStartTime = stats.time
    tenSec.clear()
    fiveSec.clear()
    twoSec.clear()
}

export const unloadMob = () => {
    unloadPhysics()
    unloadRender()
}

export const loadMob = () => {
    E.x = []
    E.y = []
    E.health = []
    E.flipped = []
    E.near = []
    E.frame = []
    E.frameTicker = []
    E.dmgTicker = []
    E.type = []
    E.active = []
    freePool = []
    tenSec.clear()
    fiveSec.clear()
    twoSec.clear()
    sec.clear()
    sec2.clear()
    sec4.clear()
    wavesEnded = false

    unloadPhysics = addPhysicsComp((dt: number) => {
        // mob spawn manager
        waves[stats.wave](dt)

        // todo optimize out offscreen mobs?
        iterMobs(
            (x, y, id, _flip, _near, _frame, _framet, type, _dmgTicker) => {
                // check proximity to hero
                E.near[id] = stats.hero.isNearHero(
                    x - COLLISION_RADIUS,
                    y - COLLISION_RADIUS,
                    MOB_COLLISION_BOX_SIZE,
                    MOB_COLLISION_BOX_SIZE,
                )

                // check hero collision
                // todo: possible optimization: skip detection if hero is invulnerable
                if (
                    E.near[id] &&
                    stats.hero.isHittingHero(
                        x - COLLISION_RADIUS,
                        y - COLLISION_RADIUS,
                        MOB_COLLISION_BOX_SIZE,
                        MOB_COLLISION_BOX_SIZE,
                    )
                ) {
                    stats.hero.hitHero(attacks[type])
                } else {
                    // move towards hero
                    // note that we only move if not hitting hero
                    _vec.x = stats.hero.x - x
                    _vec.y = stats.hero.y - y
                    limitMagnitude(_vec)
                    const speed = speeds[type]
                    E.x[id] += _vec.x * speed * dt
                    E.y[id] += _vec.y * speed * dt
                    E.flipped[id] = _vec.x < 0
                }

                // sprite animation
                if ((E.frameTicker[id] += dt) > SPRITE_ANIM_RATE_MS) {
                    E.frameTicker[id] = 0
                    E.frame[id] = (E.frame[id] + 1) % maxFrames
                }

                // hit animation
                if (E.dmgTicker[id] > 0) {
                    E.dmgTicker[id] -= dt
                }
            },
        )

        // solve collisions within mobs, only for the ones close to hero
        // we don't need high accuracy or stability, so offsets are limited
        // such that mobs do not snap like crazy
        // this will cause some overlap
        // and mobs will push each other equally
        // this is also just one pass, so it's quite unstable
        for (let i = 0; i < E.active.length; i++) {
            if (!E.active[i] || !E.near[i]) {
                continue
            }
            for (let j = i + 1; j < E.active.length; j++) {
                if (!E.active[j] || !E.near[j]) {
                    continue
                }
                if (
                    aabb(
                        E.x[i],
                        E.y[i],
                        MOB_COLLISION_BOX_SIZE,
                        MOB_COLLISION_BOX_SIZE,
                        E.x[j],
                        E.y[j],
                        MOB_COLLISION_BOX_SIZE,
                        MOB_COLLISION_BOX_SIZE,
                    )
                ) {
                    const xOffset = Math.max(
                        E.x[i] + MOB_COLLISION_BOX_SIZE - E.x[j],
                        MOB_MAX_COLLISION_SNAP_DIST,
                    )
                    const yOffset = Math.max(
                        E.y[i] + MOB_COLLISION_BOX_SIZE - E.y[j],
                        MOB_MAX_COLLISION_SNAP_DIST,
                    )
                    if (xOffset > yOffset) {
                        E.y[i] -= yOffset / 2
                        E.y[j] += yOffset / 2
                    } else {
                        E.x[i] -= xOffset / 2
                        E.x[j] += xOffset / 2
                    }
                }
            }
        }

        if (playHitSound) {
            playHit()
            playHitSound = false
        }
    })

    unloadRender = addRenderComp((ctx, assets) => {
        iterMobs(
            (
                x,
                y,
                _id,
                flipped,
                _near,
                currentFrame,
                _ticker,
                type,
                dmgAnim,
            ) => {
                const dirOffset = flipped ? 3 : 0
                const asset =
                    type === MobType.mob0
                        ? assets.mob0
                        : type === MobType.mob1
                          ? assets.mob1
                          : type === MobType.mob2
                            ? assets.mob2
                            : type === MobType.mob3
                              ? assets.mob3
                              : type === MobType.mob0boss
                                ? assets.mob0boss
                                : type === MobType.mob1boss
                                  ? assets.mob1boss
                                  : type === MobType.mob2boss
                                    ? assets.mob2boss
                                    : assets.mob3boss
                const frame = asset[frames[currentFrame] + dirOffset]

                // blink if damaged
                if (dmgAnim > 0 && dmgAnim % 10 === 0) {
                    return false
                }

                ctx.drawImage(
                    frame,
                    ~~(x - MOB_COLLISION_BOX_SIZE - cam.x),
                    ~~(y - MOB_COLLISION_BOX_SIZE - cam.y),
                )
                /*
                // draw collision rect
                if (DEBUG) {
                    ctx.strokeStyle = BLACK0
                    ctx.strokeRect(
                        x - COLLISION_RADIUS - cam.x,
                        y - COLLISION_RADIUS - cam.y,
                        MOB_COLLISION_BOX_SIZE,
                        MOB_COLLISION_BOX_SIZE,
                    )
                    ctx.strokeStyle = RED
                    ctx.strokeRect(x - cam.x, y - cam.y, 1, 1)
                }
                */
                return false
            },
        )

        /*
        // draw spawn circle
        if (DEBUG) {
            ctx.strokeStyle = BLACK0
            ctx.beginPath()
            ctx.arc(
                stats.hero.x - cam.x,
                stats.hero.y - cam.y,
                SPAWN_RADIUS,
                0,
                Math.PI * 2,
            )
            ctx.stroke()
        }
        */
    })
}

/** returns mob index */
const spawnMob = (type: MobType) => {
    const spawnPos = angleToVec(rand(0, Math.PI * 2))
    spawnPos.x = spawnPos.x * SPAWN_RADIUS + stats.hero.x
    spawnPos.y = spawnPos.y * SPAWN_RADIUS + stats.hero.y
    if (freePool.length > 0) {
        const i = freePool.pop()!
        E.x[i] = spawnPos.x
        E.y[i] = spawnPos.y
        E.health[i] = healths[type]
        E.flipped[i] = false
        E.frame[i] = 0
        E.frameTicker[i] = 0
        E.dmgTicker[i] = 0
        E.near[i] = false
        E.type[i] = type
        E.active[i] = true
        return i
    }
    E.x.push(spawnPos.x)
    E.y.push(spawnPos.y)
    E.health.push(healths[type])
    E.flipped.push(false)
    E.frame.push(0)
    E.frameTicker.push(0)
    E.dmgTicker.push(0)
    E.near.push(false)
    E.type.push(type)
    return E.active.push(true)
}

export const attackMob = (id: number, dmg: number) => {
    E.health[id] -= dmg
    spawnFloatingText(dmg, E.x[id], E.y[id])
    playHitSound = true
    if (E.health[id] <= 0) {
        E.active[id] = false
        freePool.push(id)
        dropCoin(E.x[id], E.y[id])
        stats.score += 1
    } else {
        E.dmgTicker[id] = DMG_BLINK_ANIM_TIME
    }
}

export const iterMobs = (
    fn: (
        x: number,
        y: number,
        id: number,
        flipped: boolean,
        near: boolean,
        frame: number,
        frameTicker: number,
        type: MobType,
        dmgTicker: number,
    ) => boolean | void,
) => {
    for (let i = 0; i < E.x.length; i++) {
        if (E.active[i]) {
            const end = fn(
                E.x[i],
                E.y[i],
                i,
                E.flipped[i],
                E.near[i],
                E.frame[i],
                E.frameTicker[i],
                E.type[i],
                E.dmgTicker[i],
            )
            if (end) {
                break
            }
        }
    }
}

export const isHittingMob = (
    id: number,
    x: number,
    y: number,
    w: number,
    h: number,
) => {
    return aabb(
        x,
        y,
        w,
        h,
        E.x[id] + COLLISION_RADIUS,
        E.y[id] + COLLISION_RADIUS,
        MOB_COLLISION_BOX_SIZE,
        MOB_COLLISION_BOX_SIZE,
    )
}

/**
 * This returns undefined if there are no mobs alive
 */
export const nearestMobPos = (x: number, y: number, maxDist: number = 1e3) => {
    let smallestDist = maxDist
    let id: number | undefined = undefined
    iterMobs((mobx, moby, mobid) => {
        const dist = distance(x, y, mobx, moby)
        if (dist < smallestDist) {
            smallestDist = dist
            id = mobid
        }
    })
    if (id !== undefined) {
        return { x: E.x[id], y: E.y[id] }
    }
}
