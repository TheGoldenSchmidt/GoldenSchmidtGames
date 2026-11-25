using System.Collections.Generic;
using System.Linq;
using UnityEngine;

namespace GSG.Ring
{
    /// <summary>
    /// Port of shared/matches/ringCore.ts (Sumo Smash, Bumper Mayhem): circular arena, three lives,
    /// respawn with protection, credited ring-outs (+2), shrinking edge, the 75-second decision and
    /// sudden death. Same 50-ms steps, units and constants as the app; ring (x, y) is Unity (x, z).
    /// Time in milliseconds, step length in seconds, as in the TypeScript rules.
    /// </summary>
    public class Fighter
    {
        public int seat;
        public float x, y, vx, vy, heading;
        public int lives, ringOuts, lastHitBy = -1;
        public bool alive = true, isOut;
        public float respawnAt, shieldUntil, actionAt = -99999f, actionUntil, lastHitAt = -9999f, stunUntil, bigUntil, outAt = -1f;
    }

    public class RingItem { public int id; public string kind; public float x, y; }
    public class Slick { public int id, owner; public float x, y, until, armedAt; }
    public class Obstacle { public int id; public float x, y, r, angle; }
    public struct RingEvent { public string kind; public int a, b; public float v; }

    public abstract class RingRules
    {
        public float radius, minRadius, shrinkFrom, shrinkTo, body, respawn, shield, credit, regular, suddenMax, suddenRadius, actionCooldown;
        public int lives = 3;
        public bool restartAll;
        public abstract void Drive(Fighter f, Vector2 input, float dt, float now);
        public abstract void Action(Fighter f, float now);
        public virtual float BodyOf(Fighter f, float now) => body;
        public virtual void Extras(RingSim s, float dt) { }
        /// <summary>Contact between two fighters; returns the victim of a hard strike.</summary>
        public abstract Fighter Collide(Fighter a, Fighter b, float now);
        public virtual List<Obstacle> Obstacles(RingSim s) => new();
        public virtual void MoveObstacles(RingSim s, float time) { }
        public abstract (Vector2 dir, bool act) Bot(RingSim s, Fighter me);
        /// <summary>Unity change (feedback): no dash or turbo while sliding after a hit.</summary>
        public virtual bool CanAct(Fighter f, float now) => now >= f.stunUntil;
        /// <summary>Closing speed of the last ordinary contact (for bounce effects), set by Collide.</summary>
        public float lastClosing;
    }

    public class RingSim
    {
        public readonly RingRules rules;
        public readonly List<Fighter> fighters = new();
        public float radius, time, resetAt = -1f, suddenStart;
        public bool sudden, decided, done;
        public int winner = -1;
        public List<Obstacle> obstacles;
        public List<RingItem> items = new();
        public List<Slick> slicks = new();
        public float nextItem = -1f;
        public int nextId = 1;
        public readonly List<RingEvent> events = new();
        readonly System.Random rng;

        public RingSim(RingRules rules, int count, int seed)
        {
            this.rules = rules;
            rng = new System.Random(seed);
            radius = rules.radius;
            for (int i = 0; i < count; i++)
            {
                var (x, y, h) = SpawnPoint(i, count, rules.radius * 0.55f);
                fighters.Add(new Fighter { seat = i, x = x, y = y, heading = h, lives = rules.lives, shieldUntil = 600f });
            }
            obstacles = rules.Obstacles(this);
        }

        public float Random() => (float)rng.NextDouble();
        public void Emit(string kind, int a = -1, int b = -1, float v = 0f) => events.Add(new RingEvent { kind = kind, a = a, b = b, v = v });

        public static (float x, float y, float heading) SpawnPoint(int i, int count, float r)
        {
            float a = i / (float)count * Mathf.PI * 2f - Mathf.PI / 2f;
            return (Mathf.Cos(a) * r, Mathf.Sin(a) * r, a + Mathf.PI);
        }

        public IEnumerable<Fighter> Contenders => fighters.Where(f => f.alive);
        public static float Dist(float ax, float ay, float bx, float by) => Mathf.Sqrt((ax - bx) * (ax - bx) + (ay - by) * (ay - by));

        void Respawn(Fighter f)
        {
            var others = fighters.Where(o => o.alive && !o.isOut && o != f).ToList();
            (float x, float y, float h) best = (0f, 0f, 0f); float score = -1f;
            for (int i = 0; i < 8; i++)
            {
                var p = SpawnPoint(i, 8, Mathf.Min(1.6f, radius * 0.4f));
                float d = others.Count > 0 ? others.Min(o => Dist(o.x, o.y, p.x, p.y)) : 9f;
                if (d > score + 1e-6f) { best = p; score = d; }
            }
            Place(f, best, time + rules.shield);
        }

        void Place(Fighter f, (float x, float y, float h) p, float shieldUntil)
        {
            f.x = p.x; f.y = p.y; f.heading = p.h; f.vx = 0f; f.vy = 0f; f.isOut = false; f.stunUntil = 0f; f.actionUntil = 0f;
            f.shieldUntil = shieldUntil; f.lastHitBy = -1; f.lastHitAt = -9999f; f.bigUntil = 0f;
        }

        void ResetAll()
        {
            resetAt = -1f;
            foreach (var f in fighters)
                if (f.alive) Place(f, SpawnPoint(f.seat, fighters.Count, Mathf.Min(rules.radius * 0.55f, radius * 0.6f)), time + rules.shield);
            Emit("reset");
        }

        void RingOut(Fighter f)
        {
            f.isOut = true; f.lives--; f.respawnAt = time + rules.respawn; f.vx = 0f; f.vy = 0f;
            if ((rules.restartAll || Contenders.Count() == 2) && resetAt < 0f) resetAt = time + rules.respawn;
            int by = f.lastHitBy >= 0 && time - f.lastHitAt <= rules.credit ? f.lastHitBy : -1;
            if (by >= 0 && by != f.seat) fighters[by].ringOuts++;
            if (f.lives <= 0) { f.alive = false; f.outAt = time; }
            Emit("out", f.seat, by);
        }

        void Decide()
        {
            var alive = Contenders.ToList();
            if (alive.Count <= 1) { winner = alive.Count == 1 ? alive[0].seat : -1; decided = true; done = true; return; }
            int bestLives = alive.Max(f => f.lives);
            var byLives = alive.Where(f => f.lives == bestLives).ToList();
            int bestOuts = byLives.Max(f => f.ringOuts);
            var top = byLives.Where(f => f.ringOuts == bestOuts).ToList();
            if (top.Count == 1) { winner = top[0].seat; decided = true; done = true; return; }
            if (sudden) { decided = true; done = true; return; }
            sudden = true; suddenStart = time; resetAt = -1f; items.Clear(); slicks.Clear();
            foreach (var f in fighters) if (!top.Contains(f)) { f.alive = false; if (f.outAt < 0f) f.outAt = time; f.isOut = true; }
            for (int i = 0; i < top.Count; i++) { top[i].lives = 1; Place(top[i], SpawnPoint(i, top.Count, 1.4f), time + 800f); }
            Emit("sudden");
        }

        /// <summary>One 50-ms step with the players' stick directions (ring plane, length ≤ 1).</summary>
        public void Step(float dt, Vector2[] inputs)
        {
            time += dt * 1000f;
            radius = sudden ? rules.suddenRadius : time <= rules.shrinkFrom ? rules.radius
                : rules.radius - (rules.radius - rules.minRadius) * Mathf.Min(1f, (time - rules.shrinkFrom) / (rules.shrinkTo - rules.shrinkFrom));
            rules.MoveObstacles(this, time);
            if (resetAt >= 0f)
            {
                if (time < resetAt)
                {
                    foreach (var f in fighters) if (f.alive && !f.isOut) { f.vx *= 0.6f; f.vy *= 0.6f; f.x += f.vx * dt; f.y += f.vy * dt; }
                    if (sudden ? time - suddenStart >= rules.suddenMax : time >= rules.regular) Decide();
                    return;
                }
                ResetAll();
            }
            foreach (var f in fighters)
            {
                if (!f.alive) continue;
                if (f.isOut) { if (time >= f.respawnAt) Respawn(f); continue; }
                rules.Drive(f, inputs[f.seat], dt, time);
                f.x += f.vx * dt; f.y += f.vy * dt;
            }
            rules.Extras(this, dt);
            var active = fighters.Where(f => f.alive && !f.isOut).ToList();
            for (int i = 0; i < active.Count; i++)
                for (int j = i + 1; j < active.Count; j++)
                {
                    var a = active[i]; var b = active[j];
                    if (Dist(a.x, a.y, b.x, b.y) >= rules.BodyOf(a, time) + rules.BodyOf(b, time)) continue;
                    rules.lastClosing = 0f;
                    var victim = rules.Collide(a, b, time);
                    if (victim != null) Emit("strike", victim.seat, victim == a ? b.seat : a.seat, rules.lastClosing);
                    else if (rules.lastClosing > 0.3f) Emit("bounce", a.seat, b.seat, rules.lastClosing);
                }
            foreach (var f in active)
                foreach (var o in obstacles)
                {
                    float d = Dist(f.x, f.y, o.x, o.y), min = rules.BodyOf(f, time) + o.r;
                    if (d >= min || d < 1e-6f) continue;
                    float nx = (f.x - o.x) / d, ny = (f.y - o.y) / d, along = f.vx * nx + f.vy * ny;
                    f.x = o.x + nx * min; f.y = o.y + ny * min;
                    if (along < 0f) { f.vx -= 1.8f * along * nx; f.vy -= 1.8f * along * ny; Emit("bump", f.seat); }
                }
            foreach (var f in active) if (Mathf.Sqrt(f.x * f.x + f.y * f.y) > radius + rules.BodyOf(f, time) * 0.4f) RingOut(f);
            if (Contenders.Count() <= 1) { Decide(); return; }
            if (sudden ? time - suddenStart >= rules.suddenMax : time >= rules.regular) Decide();
        }

        public bool Press(int seat)
        {
            var f = fighters[seat];
            if (!f.alive || f.isOut || resetAt >= 0f || time - f.actionAt < rules.actionCooldown || !rules.CanAct(f, time)) return false;
            f.actionAt = time;
            rules.Action(f, time);
            Emit("action", seat);
            return true;
        }

        /// <summary>Bot stick and button (rules' bot plus the small hash jitter of ringCore).</summary>
        public (Vector2 dir, bool act) BotInput(int seat)
        {
            var f = fighters[seat];
            if (!f.alive || f.isOut || resetAt >= 0f) return (Vector2.zero, false);
            var (dir, act) = rules.Bot(this, f);
            uint h = (uint)(seat * 73856093) ^ (uint)(Mathf.FloorToInt(time / 900f) * 19349663);
            h = (h ^ (h >> 13)) * 0x5bd1e995u; float jitter = (h % 100u) / 100f - 0.5f;
            return (new Vector2(Mathf.Clamp(dir.x + jitter * 0.2f, -1f, 1f), Mathf.Clamp(dir.y - jitter * 0.2f, -1f, 1f)), act);
        }

        /// <summary>Order of the result table: winner, still in, later out, lives, ring-outs (ringCore standings).</summary>
        public List<Fighter> Standings() => fighters
            .OrderByDescending(f => winner == f.seat ? 1 : 0)
            .ThenByDescending(f => f.alive ? 1e9f : f.outAt)
            .ThenByDescending(f => f.lives)
            .ThenByDescending(f => f.ringOuts)
            .ToList();

        /// <summary>Overlap and momentum exchange of two circles (ringCore bounce).</summary>
        public static (float nx, float ny, float closing) Bounce(Fighter a, Fighter b, float radius, float restitution, float now, bool protectedA, bool protectedB)
        {
            float dx = b.x - a.x, dy = b.y - a.y, d = Mathf.Sqrt(dx * dx + dy * dy);
            if (d < 1e-6f) { dx = 1f; dy = 0f; d = 1f; }
            float nx = dx / d, ny = dy / d, overlap = radius * 2f - d;
            a.x -= nx * overlap / 2f; a.y -= ny * overlap / 2f; b.x += nx * overlap / 2f; b.y += ny * overlap / 2f;
            float pushA = a.vx * nx + a.vy * ny, pushB = -(b.vx * nx + b.vy * ny), closing = pushA + pushB;
            if (closing <= 0f || protectedA || protectedB) return (nx, ny, 0f);
            float j = closing * (1f + restitution) / 2f;
            a.vx -= j * nx; a.vy -= j * ny; b.vx += j * nx; b.vy += j * ny;
            if (pushA > pushB) { b.lastHitBy = a.seat; b.lastHitAt = now; } else { a.lastHitBy = b.seat; a.lastHitAt = now; }
            return (nx, ny, closing);
        }

        public static float Wrap(float a)
        {
            while (a > Mathf.PI) a -= Mathf.PI * 2f;
            while (a <= -Mathf.PI) a += Mathf.PI * 2f;
            return a;
        }
    }

    /// <summary>Sumo Smash (shared/matches/sumoSmash.ts SUMO).</summary>
    public class SumoRules : RingRules
    {
        public const float Speed = 3.4f, Accel = 0.22f, Dash = 9.5f, DashMs = 240f, Knock = 12.5f, StunMs = 520f, Slide = 0.94f, Bump = 1f, BumpStunMs = 180f, Cooldown = 2500f;

        public SumoRules()
        {
            radius = 5.5f; minRadius = 3.2f; shrinkFrom = 40000f; shrinkTo = 75000f; body = 0.5f; respawn = 2000f; shield = 1500f; credit = 3000f;
            regular = 75000f; suddenMax = 20000f; suddenRadius = 3f; actionCooldown = Cooldown;
        }

        static bool Dashing(Fighter f, float now) => now < f.actionUntil;
        /// <summary>Two dashes this close in speed count as equally strong (sumoSmash.ts CLASH_TIE).</summary>
        const float ClashTie = 0.25f;

        public override void Drive(Fighter f, Vector2 input, float dt, float now)
        {
            if (input.magnitude > 0.1f) f.heading = Mathf.Atan2(input.y, input.x);
            if (Dashing(f, now)) return;
            if (now < f.stunUntil) { f.vx *= Slide; f.vy *= Slide; return; }
            f.vx += (input.x * Speed - f.vx) * Accel; f.vy += (input.y * Speed - f.vy) * Accel;
        }

        public override void Action(Fighter f, float now)
        {
            f.vx = Mathf.Cos(f.heading) * Dash; f.vy = Mathf.Sin(f.heading) * Dash; f.actionUntil = now + DashMs;
        }

        public override Fighter Collide(Fighter a, Fighter b, float now)
        {
            bool shieldA = now < a.shieldUntil, shieldB = now < b.shieldUntil;
            float dx = b.x - a.x, dy = b.y - a.y, d = Mathf.Sqrt(dx * dx + dy * dy);
            if (d < 1e-6f) { dx = 1f; dy = 0f; d = 1f; }
            float nx = dx / d, ny = dy / d;
            // A dash into the opponent becomes a knockback along the contact normal. Head-on clash of two
            // dashes: the faster one wins; equally fast dashes knock both back, so the seat order never decides.
            var strikes = new List<(Fighter hitter, Fighter victim, float sign)>();
            foreach (var (hitter, victim, sign) in new[] { (a, b, 1f), (b, a, -1f) })
            {
                if (!Dashing(hitter, now) || (victim == b ? shieldB : shieldA) || (hitter == a ? shieldA : shieldB)) continue;
                if ((hitter.vx * nx + hitter.vy * ny) * sign <= 0.5f) continue;
                strikes.Add((hitter, victim, sign));
            }
            if (strikes.Count == 2)
            {
                float speedA = a.vx * nx + a.vy * ny, speedB = -(b.vx * nx + b.vy * ny);
                if (Mathf.Abs(speedA - speedB) < ClashTie)
                {
                    RingSim.Bounce(a, b, body, 0f, now, true, true);
                    foreach (var (f, sign) in new[] { (a, -1f), (b, 1f) })
                    {
                        f.vx = nx * sign * Knock * 0.6f; f.vy = ny * sign * Knock * 0.6f; f.stunUntil = now + StunMs; f.actionUntil = now;
                    }
                    lastClosing = speedA + speedB; // shown as a hard bounce
                    return null;
                }
                strikes.RemoveAt(speedA > speedB ? 1 : 0);
            }
            foreach (var (hitter, victim, sign) in strikes)
            {
                RingSim.Bounce(a, b, body, 0f, now, true, true);
                victim.vx = nx * sign * Knock; victim.vy = ny * sign * Knock; victim.stunUntil = now + StunMs;
                hitter.vx *= 0.15f; hitter.vy *= 0.15f; hitter.actionUntil = now;
                victim.lastHitBy = hitter.seat; victim.lastHitAt = now;
                return victim;
            }
            var (_, _, closing) = RingSim.Bounce(a, b, body, Bump, now, shieldA, shieldB);
            lastClosing = closing;
            if (closing > 1.5f)
            {
                if (!shieldA) a.stunUntil = Mathf.Max(a.stunUntil, now + BumpStunMs);
                if (!shieldB) b.stunUntil = Mathf.Max(b.stunUntil, now + BumpStunMs);
            }
            return null;
        }

        public override (Vector2 dir, bool act) Bot(RingSim s, Fighter me)
        {
            var others = s.fighters.Where(f => f.alive && !f.isOut && f != me).ToList();
            float r = Mathf.Sqrt(me.x * me.x + me.y * me.y);
            if (r > s.radius - 1.1f || others.Count == 0) return (new Vector2(-me.x / (r > 0f ? r : 1f), -me.y / (r > 0f ? r : 1f)), false);
            var target = others.OrderBy(o => RingSim.Dist(o.x, o.y, me.x, me.y)).First();
            float dx = target.x - me.x, dy = target.y - me.y, d = Mathf.Max(1e-6f, Mathf.Sqrt(dx * dx + dy * dy));
            float facing = Mathf.Cos(Mathf.Atan2(dy, dx) - me.heading);
            return (new Vector2(dx / d, dy / d), d < 2.2f && facing > 0.9f && s.time - me.actionAt >= Cooldown);
        }
    }

    /// <summary>Bumper Mayhem (shared/matches/bumperMayhem.ts BUMPER, ITEMS).</summary>
    public class BumperRules : RingRules
    {
        // Unity changes after feedback ("langweilig"): bouncy rubber (restitution 0.5 → 0.95), every
        // contact pushes both cars apart by at least MinBounce, hard hits kick harder (0.9 → 1.3,
        // cap 11 → 14) and the rammer rebounds instead of stopping.
        public const float MinBounce = 2.6f, BounceGain = 0.6f, Rebound = 0.35f;
        public const float Body = 0.55f, AccelK = 7f, MaxSpeed = 4.4f, TurboSpeed = 8f, TurboMs = 800f, Turn = 4.2f, Grip = 0.25f, Drag = 0.985f, Coast = 0.92f,
            Overspeed = 0.88f, Restitution = 0.95f, Kick = 1.3f, TurboKick = 1.75f, MaxKnock = 14f, HitterKeeps = 0.25f, StunBase = 220f, StunPer = 55f, StunMax = 700f,
            Slide = 0.93f, SpinRate = 6f, Hard = 2.5f, Cooldown = 4000f, Orbit = 2.8f, PostRadius = 0.6f, Spin = 0.6f;
        public const float ItemFirst = 4000f, ItemMin = 6000f, ItemMax = 9000f, Pick = 0.35f, Spread = 0.62f, MegaMs = 6000f, MegaScale = 1.45f, MegaKick = 1.5f, MegaTake = 0.45f,
            OilMs = 8000f, OilRadius = 0.85f, OilArm = 900f, OilStun = 650f, WaveRadius = 2.8f, WaveKnock = 7.5f, WaveStun = 350f;
        static readonly string[] Kinds = { "mega", "oil", "wave" };

        public BumperRules()
        {
            radius = 6f; minRadius = 3.4f; shrinkFrom = 45000f; shrinkTo = 75000f; body = Body; respawn = 2000f; shield = 1500f; credit = 3000f;
            regular = 75000f; suddenMax = 20000f; suddenRadius = 3.4f; actionCooldown = Cooldown;
        }

        public static bool Turbo(Fighter f, float now) => now < f.actionUntil;
        public static bool Big(Fighter f, float now) => now < f.bigUntil;
        public override float BodyOf(Fighter f, float now) => Body * (Big(f, now) ? MegaScale : 1f);

        public override void Drive(Fighter f, Vector2 input, float dt, float now)
        {
            if (now < f.stunUntil) { f.vx *= Slide; f.vy *= Slide; f.heading = RingSim.Wrap(f.heading + SpinRate * dt); return; }
            float throttle = Mathf.Min(1f, input.magnitude);
            if (throttle > 0.1f)
            {
                float diff = RingSim.Wrap(Mathf.Atan2(input.y, input.x) - f.heading);
                f.heading = RingSim.Wrap(f.heading + Mathf.Clamp(diff, -Turn * dt, Turn * dt));
            }
            float hx = Mathf.Cos(f.heading), hy = Mathf.Sin(f.heading);
            bool boost = Turbo(f, now);
            float push = (boost ? 1.6f : throttle) * AccelK * dt;
            f.vx += hx * push; f.vy += hy * push;
            float forward = f.vx * hx + f.vy * hy, side = -f.vx * hy + f.vy * hx;
            float keptSide = side * (1f - Grip), drag = boost || throttle > 0.1f ? Drag : Coast;
            f.vx = (hx * forward - hy * keptSide) * drag; f.vy = (hy * forward + hx * keptSide) * drag;
            float limit = boost ? TurboSpeed : MaxSpeed, speed = Mathf.Sqrt(f.vx * f.vx + f.vy * f.vy);
            if (speed > limit) { float k = Mathf.Max(limit / speed, Overspeed); f.vx *= k; f.vy *= k; }
        }

        public override void Action(Fighter f, float now) { f.actionUntil = now + TurboMs; }

        public override void Extras(RingSim s, float dt)
        {
            var cars = s.fighters.Where(f => f.alive && !f.isOut).ToList();
            if (s.nextItem < 0f) s.nextItem = ItemFirst;
            s.slicks.RemoveAll(o => s.time >= o.until);
            if (s.time >= s.nextItem && !s.sudden)
            {
                s.nextItem = s.time + ItemMin + s.Random() * (ItemMax - ItemMin);
                if (s.items.Count < 2)
                {
                    float a = s.Random() * Mathf.PI * 2f, r = Mathf.Sqrt(s.Random()) * s.radius * Spread;
                    s.items.Add(new RingItem { id = s.nextId++, kind = Kinds[Mathf.Min(2, (int)(s.Random() * 3f))], x = Mathf.Cos(a) * r, y = Mathf.Sin(a) * r });
                    s.Emit("item");
                }
            }
            foreach (var f in cars)
            {
                var item = s.items.FirstOrDefault(i => RingSim.Dist(i.x, i.y, f.x, f.y) < BodyOf(f, s.time) + Pick);
                if (item == null) continue;
                s.items.Remove(item);
                if (item.kind == "mega") { f.bigUntil = s.time + MegaMs; s.Emit("mega", f.seat); }
                else if (item.kind == "oil") { s.slicks.Add(new Slick { id = s.nextId++, owner = f.seat, x = f.x, y = f.y, until = s.time + OilMs, armedAt = s.time + OilArm }); s.Emit("oil", f.seat); }
                else
                {
                    foreach (var o in cars)
                    {
                        float d = RingSim.Dist(o.x, o.y, f.x, f.y);
                        if (o == f || d > WaveRadius || s.time < o.shieldUntil) continue;
                        float nx = d > 1e-6f ? (o.x - f.x) / d : 1f, ny = d > 1e-6f ? (o.y - f.y) / d : 0f;
                        float k = WaveKnock * (Big(o, s.time) ? MegaTake : 1f) * (1f - d / WaveRadius * 0.4f);
                        o.vx += nx * k; o.vy += ny * k; o.stunUntil = Mathf.Max(o.stunUntil, s.time + WaveStun); o.lastHitBy = f.seat; o.lastHitAt = s.time;
                    }
                    s.Emit("wave", f.seat);
                }
            }
            foreach (var f in cars)
                foreach (var o in s.slicks)
                {
                    if (s.time < o.armedAt || s.time < f.stunUntil || s.time < f.shieldUntil || RingSim.Dist(o.x, o.y, f.x, f.y) > OilRadius + BodyOf(f, s.time) * 0.3f) continue;
                    if (o.owner == f.seat) continue;
                    f.stunUntil = s.time + OilStun; f.vx *= 1.1f; f.vy *= 1.1f;
                    f.lastHitBy = o.owner; f.lastHitAt = s.time;
                    s.Emit("slip", f.seat, o.owner);
                }
        }

        public override Fighter Collide(Fighter a, Fighter b, float now)
        {
            var (nx, ny, closing) = RingSim.Bounce(a, b, (BodyOf(a, now) + BodyOf(b, now)) / 2f, Restitution, now, now < a.shieldUntil, now < b.shieldUntil);
            lastClosing = closing;
            if (closing <= 0f) return null;
            // Every contact bounces: both cars are pushed apart, a giant car takes less of it.
            float push = Mathf.Max(MinBounce, closing * BounceGain);
            float takeA = Big(a, now) ? MegaTake : 1f, takeB = Big(b, now) ? MegaTake : 1f;
            a.vx -= nx * push * takeA * 0.5f; a.vy -= ny * push * takeA * 0.5f;
            b.vx += nx * push * takeB * 0.5f; b.vy += ny * push * takeB * 0.5f;
            if (closing <= Hard) return null;
            var victim = b.lastHitBy == a.seat && Mathf.Approximately(b.lastHitAt, now) ? b : a;
            var hitter = victim == a ? b : a;
            float sign = victim == b ? 1f : -1f;
            float mass = (Big(hitter, now) ? MegaKick : 1f) * (Big(victim, now) ? MegaTake : 1f);
            float kick = Mathf.Min(MaxKnock, closing * Kick * (Turbo(hitter, now) ? TurboKick : 1f) * mass);
            float ux = nx * sign, uy = ny * sign, along = victim.vx * ux + victim.vy * uy;
            if (along < kick) { victim.vx += ux * (kick - along); victim.vy += uy * (kick - along); }
            if (!Big(victim, now)) victim.stunUntil = now + Mathf.Min(StunMax, StunBase + closing * StunPer);
            hitter.vx = hitter.vx * HitterKeeps - ux * closing * Rebound; hitter.vy = hitter.vy * HitterKeeps - uy * closing * Rebound;
            return victim;
        }

        public override List<Obstacle> Obstacles(RingSim s) =>
            new() { new Obstacle { id = 0, x = Orbit, y = 0f, r = PostRadius }, new Obstacle { id = 1, x = -Orbit, y = 0f, r = PostRadius, angle = Mathf.PI } };

        public override void MoveObstacles(RingSim s, float time)
        {
            foreach (var o in s.obstacles)
            {
                o.angle = o.id * Mathf.PI + time / 1000f * Spin;
                float r = Mathf.Min(Orbit, s.radius - 1f);
                o.x = Mathf.Cos(o.angle) * r; o.y = Mathf.Sin(o.angle) * r;
            }
        }

        public override (Vector2 dir, bool act) Bot(RingSim s, Fighter me)
        {
            var others = s.fighters.Where(f => f.alive && !f.isOut && f != me).ToList();
            float r = Mathf.Sqrt(me.x * me.x + me.y * me.y);
            if (r > s.radius - 1.4f || others.Count == 0) return (new Vector2(-me.x / (r > 0f ? r : 1f), -me.y / (r > 0f ? r : 1f)), false);
            var item = s.items.FirstOrDefault(i => RingSim.Dist(i.x, i.y, me.x, me.y) < 2.4f);
            if (item != null) { float di = Mathf.Max(1e-6f, RingSim.Dist(item.x, item.y, me.x, me.y)); return (new Vector2((item.x - me.x) / di, (item.y - me.y) / di), false); }
            var target = others.OrderBy(o => RingSim.Dist(o.x, o.y, me.x, me.y)).First();
            float dx = target.x - me.x, dy = target.y - me.y, d = Mathf.Max(1e-6f, Mathf.Sqrt(dx * dx + dy * dy));
            bool aligned = Mathf.Cos(Mathf.Atan2(dy, dx) - me.heading) > 0.92f;
            return (new Vector2(dx / d, dy / d), aligned && d < 3f && s.time - me.actionAt >= Cooldown);
        }
    }
}
