using System.Collections.Generic;
using System.Linq;
using UnityEngine;

namespace GSG.Snow
{
    /// <summary>
    /// Port of shared/matches/snowball.ts (SB): 22 × 22 arena with point-symmetric snow walls and
    /// pines, at most two balls (form by standing still after a tap, or pick up at a pile), throws
    /// that lock onto an opponent near the aim and lead its run, −10 % speed per hit, snowman after
    /// three hits, last one standing wins (after 120 s fewest hits taken, then most dealt).
    /// Game x right, y down; time in ms, 50-ms steps with two substeps.
    /// </summary>
    public struct Rect2 { public float x0, y0, x1, y1; public Rect2(float x0, float x1, float y0, float y1) { this.x0 = x0; this.x1 = x1; this.y0 = y0; this.y1 = y1; } }

    public class Baller
    {
        public int seat, balls = 1, hits, dealt;
        public float x, y, fx, fy, form, lastThrow = -1e9f, hitAt = -1e9f, outAt = -1f;
        public bool forming;
        public bool Out => outAt >= 0f;
    }

    public class Ball { public int id, owner; public float x, y, vx, vy, sx, sy, born; }
    public class Pile { public int id; public float x, y, readyAt; }
    public struct SnowEvent { public string kind; public int a, b; public float x, y; }

    public class SnowSim
    {
        public const float Size = 22f, Radius = 0.42f, Speed = 4.4f, SlowPerHit = 0.1f, FormMs = 1000f, ThrowGap = 450f, BallSpeed = 15f, Range = 12f, BallRadius = 0.2f,
            HitGrace = 500f, PileRespawn = 6000f, PileRadius = 0.7f, MaxMs = 120000f, Assist = 0.38f, TapCone = 1.15f;
        /// <summary>Unity change (feedback "trifft zu einfach"): the player's tap throw only locks within ±11° of the view and does not lead the target.</summary>
        public const float PlayerCone = 0.2f;
        public const int HitsOut = 3, MaxBalls = 2, Substeps = 2;
        const float Half = Size / 2f;

        public static readonly Rect2[] Walls;
        public static readonly (float x, float y, float r)[] Trees;
        static readonly (float x, float y)[] PilePlaces = { (Half, 3.2f), (Half, Size - 3.2f), (3.4f, Half + 3f), (Size - 3.4f, Half - 3f), (Half - 4.5f, Half + 4.5f), (Half + 4.5f, Half - 4.5f) };
        static readonly (float x, float y)[] Spawns = { (1.6f, 1.6f), (Size - 1.6f, Size - 1.6f), (Size - 1.6f, 1.6f), (1.6f, Size - 1.6f), (Half, 1.4f), (Half, Size - 1.4f) };

        static SnowSim()
        {
            var half = new[] { new Rect2(4.5f, 8f, 5.4f, 6.2f), new Rect2(13.8f, 14.6f, 3.5f, 7f), new Rect2(3.2f, 4f, 10f, 13.5f), new Rect2(9.6f, 12.4f, 9.6f, 10.4f) };
            Walls = half.Concat(half.Select(r => new Rect2(Size - r.x1, Size - r.x0, Size - r.y1, Size - r.y0))).ToArray();
            var trees = new[] { (6.2f, 2.3f), (10.5f, 5.2f), (18.6f, 4.6f), (9.4f, 13.4f) };
            Trees = trees.Concat(trees.Select(t => (Size - t.Item1, Size - t.Item2))).Select(t => (t.Item1, t.Item2, 0.55f)).ToArray();
        }

        public float time;
        public readonly List<Baller> players = new();
        public List<Ball> balls = new();
        public readonly List<Pile> piles = new();
        public int nextId = 100, winner = -1;
        public bool done;
        public readonly List<SnowEvent> events = new();
        public Vector2[] runInput;

        public SnowSim(int count)
        {
            for (int i = 0; i < PilePlaces.Length; i++) piles.Add(new Pile { id = i + 1, x = PilePlaces[i].x, y = PilePlaces[i].y });
            for (int i = 0; i < count; i++)
            {
                var (x, y) = Spawns[i % Spawns.Length];
                float fx = Half - x, fy = Half - y, n = Mathf.Max(1e-6f, Mathf.Sqrt(fx * fx + fy * fy));
                players.Add(new Baller { seat = i, x = x, y = y, fx = fx / n, fy = fy / n });
            }
            runInput = new Vector2[count];
        }

        void Emit(string kind, int a = -1, int b = -1, float x = 0f, float y = 0f) => events.Add(new SnowEvent { kind = kind, a = a, b = b, x = x, y = y });
        static float Dist(float ax, float ay, float bx, float by) => Mathf.Sqrt((ax - bx) * (ax - bx) + (ay - by) * (ay - by));
        static float Slow(Baller p) => 1f - SlowPerHit * p.hits;

        static bool SegmentHitsRect(float ax, float ay, float bx, float by, Rect2 r, float pad)
        {
            float t0 = 0f, t1 = 1f, dx = bx - ax, dy = by - ay;
            var pairs = new[] { (-dx, ax - (r.x0 - pad)), (dx, r.x1 + pad - ax), (-dy, ay - (r.y0 - pad)), (dy, r.y1 + pad - ay) };
            foreach (var (p, q) in pairs)
            {
                if (Mathf.Abs(p) < 1e-9f) { if (q < 0f) return false; continue; }
                float t = q / p;
                if (p < 0f) { if (t > t1) return false; if (t > t0) t0 = t; } else { if (t < t0) return false; if (t < t1) t1 = t; }
            }
            return true;
        }

        public static bool ClearShot(float ax, float ay, float bx, float by)
        {
            if (Walls.Any(w => SegmentHitsRect(ax, ay, bx, by, w, BallRadius * 0.5f))) return false;
            float dx = bx - ax, dy = by - ay, len2 = dx * dx + dy * dy; if (len2 < 1e-9f) len2 = 1f;
            return !Trees.Any(t => { float k = Mathf.Clamp01(((t.x - ax) * dx + (t.y - ay) * dy) / len2); return Dist(ax + dx * k, ay + dy * k, t.x, t.y) < t.r + BallRadius; });
        }

        static bool Blocked(float x, float y) => x < 0f || y < 0f || x > Size || y > Size
            || Walls.Any(w => x > w.x0 - BallRadius && x < w.x1 + BallRadius && y > w.y0 - BallRadius && y < w.y1 + BallRadius)
            || Trees.Any(t => Dist(x, y, t.x, t.y) < t.r + BallRadius);

        static bool BodyBlocked(float x, float y) => x < Radius || y < Radius || x > Size - Radius || y > Size - Radius
            || Walls.Any(w => x > w.x0 - Radius && x < w.x1 + Radius && y > w.y0 - Radius && y < w.y1 + Radius)
            || Trees.Any(t => Dist(x, y, t.x, t.y) < t.r + Radius);

        static (float, float) SteerAround(Baller me, float dx, float dy, float side)
        {
            float n = Mathf.Sqrt(dx * dx + dy * dy); if (n < 1e-6f) n = 1f; dx /= n; dy /= n;
            foreach (var turn in new[] { 0f, 0.6f, -0.6f, 1.2f, -1.2f, 1.8f, -1.8f, 2.5f, -2.5f })
            {
                float t = turn * side, c = Mathf.Cos(t), sn = Mathf.Sin(t), x = dx * c - dy * sn, y = dx * sn + dy * c;
                if (!BodyBlocked(me.x + x * 0.7f, me.y + y * 0.7f) && !BodyBlocked(me.x + x * 1.4f, me.y + y * 1.4f)) return (x, y);
            }
            return (dx, dy);
        }

        static void PushOut(Baller c, float r, Rect2 rect)
        {
            float nx = Mathf.Clamp(c.x, rect.x0, rect.x1), ny = Mathf.Clamp(c.y, rect.y0, rect.y1);
            float dx = c.x - nx, dy = c.y - ny, d = Mathf.Sqrt(dx * dx + dy * dy);
            if (d >= r) return;
            if (d < 1e-6f)
            {
                float left = c.x - rect.x0, right = rect.x1 - c.x, top = c.y - rect.y0, bottom = rect.y1 - c.y, m = Mathf.Min(Mathf.Min(left, right), Mathf.Min(top, bottom));
                if (m == left) c.x = rect.x0 - r; else if (m == right) c.x = rect.x1 + r; else if (m == top) c.y = rect.y0 - r; else c.y = rect.y1 + r;
                return;
            }
            c.x = nx + dx / d * r; c.y = ny + dy / d * r;
        }

        void Move(Baller me, Vector2 input, bool holdForm, float h)
        {
            float stick = input.magnitude;
            if (stick > 0.15f)
            {
                float speed = Speed * Slow(me) * Mathf.Min(1f, stick);
                me.x += input.x / stick * speed * h; me.y += input.y / stick * speed * h;
                me.fx = input.x / stick; me.fy = input.y / stick;
            }
            if (me.balls >= MaxBalls) me.forming = false;
            if ((holdForm || me.forming) && stick <= 0.15f && me.balls < MaxBalls)
            {
                me.form += h * 1000f;
                if (me.form >= FormMs) { me.balls++; me.form = 0f; if (me.balls >= MaxBalls) me.forming = false; Emit("formed", me.seat); }
            }
            else me.form = 0f;
            me.x = Mathf.Clamp(me.x, Radius, Size - Radius); me.y = Mathf.Clamp(me.y, Radius, Size - Radius);
            foreach (var w in Walls) PushOut(me, Radius, w);
            foreach (var t in Trees)
            {
                float d = Dist(me.x, me.y, t.x, t.y), min = Radius + t.r;
                if (d < min && d > 1e-6f) { me.x = t.x + (me.x - t.x) / d * min; me.y = t.y + (me.y - t.y) / d * min; }
            }
        }

        /// <summary>The opponent a throw locks onto (snowball.ts throwTarget).</summary>
        public Baller Target(Baller me, Vector2? aim, float cone = Assist)
        {
            Baller best = null; float score = float.MaxValue;
            foreach (var o in players)
            {
                if (o == me || o.Out) continue;
                float ox = o.x - me.x, oy = o.y - me.y, d = Mathf.Sqrt(ox * ox + oy * oy);
                if (d < 0.01f || d > Range - 0.5f || !ClearShot(me.x, me.y, o.x, o.y)) continue;
                float k = d;
                if (aim.HasValue)
                {
                    float dx = aim.Value.x, dy = aim.Value.y;
                    float off = Mathf.Abs(Mathf.Atan2(dx * oy - dy * ox, dx * ox + dy * oy));
                    if (off > cone) continue;
                    k = cone > Assist ? d : off * 10f + d * 0.05f;
                }
                if (k < score) { score = k; best = o; }
            }
            return best;
        }

        void Fly(float h)
        {
            var gone = new HashSet<int>();
            foreach (var b in balls)
            {
                b.x += b.vx * h; b.y += b.vy * h;
                if (Dist(b.x, b.y, b.sx, b.sy) > Range || Blocked(b.x, b.y)) { gone.Add(b.id); Emit("splat", b.owner, -1, b.x, b.y); continue; }
                foreach (var t in players)
                {
                    if (t.Out || t.seat == b.owner || time - t.hitAt < HitGrace || Dist(t.x, t.y, b.x, b.y) > Radius + BallRadius) continue;
                    gone.Add(b.id); t.hits++; t.hitAt = time; t.form = 0f; t.forming = false;
                    players[b.owner].dealt++;
                    if (t.hits >= HitsOut) { t.outAt = time; t.balls = 0; Emit("frozen", t.seat, b.owner, b.x, b.y); }
                    else Emit("hit", t.seat, b.owner, b.x, b.y);
                    break;
                }
            }
            if (gone.Count > 0) balls = balls.Where(b => !gone.Contains(b.id)).ToList();
        }

        public void Step(float dt, Vector2[] inputs, bool[] holdForm)
        {
            time += dt * 1000f;
            runInput = inputs;
            float h = dt / Substeps;
            for (int k = 0; k < Substeps; k++)
            {
                foreach (var me in players) if (!me.Out) Move(me, inputs[me.seat], holdForm[me.seat], h);
                var alive = players.Where(p => !p.Out).ToList();
                for (int i = 0; i < alive.Count; i++)
                    for (int j = i + 1; j < alive.Count; j++)
                    {
                        var a = alive[i]; var b = alive[j];
                        float d = Dist(a.x, a.y, b.x, b.y), min = Radius * 2f;
                        if (d >= min || d < 1e-6f) continue;
                        float nx = (b.x - a.x) / d, ny = (b.y - a.y) / d, push = (min - d) / 2f;
                        a.x -= nx * push; a.y -= ny * push; b.x += nx * push; b.y += ny * push;
                    }
                Fly(h);
            }
            foreach (var pile in piles)
            {
                if (time < pile.readyAt) continue;
                var taker = players.FirstOrDefault(me => !me.Out && me.balls < MaxBalls && Dist(me.x, me.y, pile.x, pile.y) < PileRadius + Radius);
                if (taker != null) { taker.balls++; pile.readyAt = time + PileRespawn; Emit("pickup", taker.seat); }
            }
            var standing = players.Where(p => !p.Out).ToList();
            if (standing.Count <= 1) { winner = standing.Count == 1 ? standing[0].seat : -1; done = true; }
            else if (time >= MaxMs) done = true;
        }

        public void Form(int seat) { var me = players[seat]; if (!me.Out && me.balls < MaxBalls) me.forming = true; }

        /// <summary>A throw: towards the target near the aim (leading its run), else along the facing.</summary>
        public bool Throw(int seat, Vector2? aim, float cone = Assist, bool lead = true)
        {
            var me = players[seat];
            if (me.Out || me.balls <= 0 || time - me.lastThrow < ThrowGap) return false;
            var target = Target(me, aim, cone);
            float dx = aim?.x ?? me.fx, dy = aim?.y ?? me.fy;
            if (target != null)
            {
                var run = lead ? runInput[target.seat] : Vector2.zero; float stick = run.magnitude;
                float v = stick > 0.15f ? Speed * Slow(target) * Mathf.Min(1f, stick) / stick : 0f, fly = Dist(me.x, me.y, target.x, target.y) / BallSpeed;
                float lx = target.x + run.x * v * fly - me.x, ly = target.y + run.y * v * fly - me.y, n = Mathf.Max(1e-6f, Mathf.Sqrt(lx * lx + ly * ly));
                dx = lx / n; dy = ly / n;
            }
            me.fx = dx; me.fy = dy; me.balls--; me.lastThrow = time; me.form = 0f; me.forming = false;
            float x = me.x + dx * (Radius + 0.1f), y = me.y + dy * (Radius + 0.1f);
            balls.Add(new Ball { id = nextId++, owner = seat, x = x, y = y, vx = dx * BallSpeed, vy = dy * BallSpeed, sx = x, sy = y, born = time });
            Emit("throw", seat);
            return true;
        }

        public List<Baller> Standings() => players
            .OrderByDescending(p => p.Out ? 0 : 1).ThenByDescending(p => p.Out ? p.outAt : 0f).ThenBy(p => p.hits).ThenByDescending(p => p.dealt).ToList();

        static int Hash(int seat, int slot)
        {
            uint h = (uint)(seat * 73856093) ^ (uint)(slot * 19349663);
            h ^= h >> 13; h *= 0x5bd1e995u; h ^= h >> 15;
            return (int)(h % 1000u);
        }

        /// <summary>Port of the bot: fetch or form balls, aim with an error and throw now and then, sidestep, close in around cover.</summary>
        public (Vector2 move, bool form, Vector2? aim, bool throwNow) Bot(int seat)
        {
            var me = players[seat];
            if (me.Out) return (Vector2.zero, false, null, false);
            var others = players.Where(o => o != me && !o.Out).OrderBy(o => Dist(o.x, o.y, me.x, me.y)).ToList();
            int salt = Hash(seat, Mathf.FloorToInt(time / 900f));
            float side = Hash(seat + 17, Mathf.FloorToInt(time / 4000f)) % 2 == 1 ? 1f : -1f;
            if (me.balls == 0)
            {
                var pile = piles.Where(q => time >= q.readyAt).OrderBy(q => Dist(q.x, q.y, me.x, me.y)).FirstOrDefault();
                if (pile != null && Dist(pile.x, pile.y, me.x, me.y) < 5f) { var (x, y) = SteerAround(me, pile.x - me.x, pile.y - me.y, side); return (new Vector2(x, y), false, null, false); }
                return (Vector2.zero, true, null, false);
            }
            var target = others.FirstOrDefault(o => ClearShot(me.x, me.y, o.x, o.y) && Dist(o.x, o.y, me.x, me.y) < Range * 0.75f) ?? others.FirstOrDefault();
            if (target == null) return (Vector2.zero, false, null, false);
            float d = Mathf.Max(1e-6f, Dist(target.x, target.y, me.x, me.y));
            if (ClearShot(me.x, me.y, target.x, target.y) && d < Range * 0.75f)
            {
                float err = (salt % 100) / 100f - 0.5f, a = Mathf.Atan2(target.y - me.y, target.x - me.x) + err;
                bool ready = time - me.lastThrow > ThrowGap + 1200f && salt % 4 == 0;
                var (x, y) = SteerAround(me, -Mathf.Sin(a) * side, Mathf.Cos(a) * side, side);
                return (new Vector2(x * 0.6f, y * 0.6f), false, new Vector2(Mathf.Cos(a), Mathf.Sin(a)), ready);
            }
            var (mx, my) = SteerAround(me, (target.x - me.x) / d + (salt % 2 == 1 ? 0.3f : -0.3f), (target.y - me.y) / d, side);
            return (new Vector2(mx, my), false, null, false);
        }
    }
}
