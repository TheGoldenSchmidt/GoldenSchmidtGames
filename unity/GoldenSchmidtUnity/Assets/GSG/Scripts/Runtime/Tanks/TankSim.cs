using System;
using System.Collections.Generic;
using System.Linq;
using System.Numerics;

namespace GSG.Tanks
{
    // The project's top-down Tank Trouble rules (shared/matches/tankTrouble.ts).
    // Unity only presents the result of these 50 ms steps.
    internal sealed class TankSim
    {
        public const int Cols = 7, Rows = 11, StepMs = 50, Hp = 3, KillsToWin = 7;
        public const int Regular = 90000, Overtime = 30000, Respawn = 2000, Cooldown = 450, RapidCooldown = 180;
        public const float Cell = 1.6f, Width = Cols * Cell, Height = Rows * Cell;
        public const float TankRadius = 0.42f, BulletRadius = 0.09f, Muzzle = TankRadius + BulletRadius + 0.02f;
        const float Edge = 0.09f, Speed = 3f, BulletSpeed = 6.5f;
        const int BulletLife = 5000, Bounces = 2, OwnerGrace = 220, SpawnShield = 1500;
        const int PowerEvery = 9000, PowerMs = 8000, ShieldMs = 6000, Substeps = 4;
        static readonly (int x, int y)[] Directions = { (1, 0), (-1, 0), (0, 1), (0, -1) };
        static readonly int[] Spawns = { 0, 76, 6, 70, 35, 41 };
        static readonly float[] Triple = { -0.22f, 0f, 0.22f };

        public enum Power { None, Rapid, Triple, Shield }
        public enum Effect { Shot, Bounce, Crack, Break, Block, Hit, Destroyed, Pickup, Tiebreak }

        public sealed class Tank
        {
            public Vector2 Position, Previous;
            public float Heading, Aim;
            public int Life = Hp, Kills, Deaths, LastShot = -9999, ShieldUntil = SpawnShield, RespawnAt, PowerUntil;
            public Power Bonus;
            public bool Alive => Life > 0;
        }

        public sealed class Bullet
        {
            public int Id, Owner, Bounces, Born;
            public Vector2 Position, Previous, Velocity;
            public bool Extra;
        }

        public sealed class Wall
        {
            public int Kind = 1;
            public readonly Vector2 Min, Max;
            public Vector2 Center => (Min + Max) / 2f;

            public Wall(Vector2 min, Vector2 max) { Min = min; Max = max; }

            public bool Contains(Vector2 p, float pad) =>
                p.X >= Min.X - pad && p.X <= Max.X + pad && p.Y >= Min.Y - pad && p.Y <= Max.Y + pad;

            public bool Segment(Vector2 start, Vector2 end, float pad, out float fraction)
            {
                var delta = end - start;
                float enter = 0f, exit = 1f;
                bool hit = Slab(start.X, delta.X, Min.X - pad, Max.X + pad, ref enter, ref exit)
                    && Slab(start.Y, delta.Y, Min.Y - pad, Max.Y + pad, ref enter, ref exit);
                fraction = enter;
                return hit;
            }

            static bool Slab(float p, float d, float min, float max, ref float enter, ref float exit)
            {
                if (MathF.Abs(d) < 0.000001f) return p >= min && p <= max;
                float a = (min - p) / d, b = (max - p) / d;
                enter = MathF.Max(enter, MathF.Min(a, b));
                exit = MathF.Min(exit, MathF.Max(a, b));
                return enter <= exit;
            }

            public Vector2 Push(Vector2 p)
            {
                var nearest = Vector2.Clamp(p, Min, Max);
                var offset = p - nearest;
                float d = offset.Length();
                if (d >= TankRadius) return p;
                if (d > 0.000001f) return nearest + offset * (TankRadius / d);
                float left = p.X - Min.X, right = Max.X - p.X, top = p.Y - Min.Y, bottom = Max.Y - p.Y;
                float side = MathF.Min(MathF.Min(left, right), MathF.Min(top, bottom));
                if (side == left) return new Vector2(Min.X - TankRadius, p.Y);
                if (side == right) return new Vector2(Max.X + TankRadius, p.Y);
                if (side == top) return new Vector2(p.X, Min.Y - TankRadius);
                return new Vector2(p.X, Max.Y + TankRadius);
            }
        }

        public readonly Tank[] Tanks;
        public readonly Wall[] Walls = new Wall[(Rows + 1) * Cols + Rows * (Cols + 1)];
        public readonly List<Bullet> Bullets = new();
        public readonly List<(int id, Power kind, Vector2 at)> Pickups = new();
        public readonly List<(Effect kind, Vector2 at, int seat, int by, Power power)> Events = new();
        public int Time { get; private set; }
        public int Winner { get; private set; } = -1;
        public bool Done { get; private set; }
        public bool InOvertime => leaders.Count > 0;

        readonly HashSet<int> leaders = new();
        readonly int[] queue = new int[Rows * Cols], from = new int[Rows * Cols], choices = new int[4];
        readonly List<(Bullet bullet, int seat)> hits = new();
        uint random;
        int nextId, nextPower = PowerEvery;

        public TankSim(int players, uint seed)
        {
            random = seed ^ 0x9e3779b9u;
            MakeMaze();
            Tanks = new Tank[players];
            for (int i = 0; i < players; i++)
            {
                var p = Center(Spawns[i]);
                float angle = Angle(new Vector2(Width / 2, Height / 2) - p);
                Tanks[i] = new Tank { Position = p, Previous = p, Heading = angle, Aim = angle };
            }
        }

        double Random() { random = unchecked(random * 1664525u + 1013904223u); return random / 4294967296.0; }
        int Roll(int n) => (int)(Random() * n);
        static Vector2 Center(int i) => new((i % Cols + 0.5f) * Cell, (i / Cols + 0.5f) * Cell);
        static int CellAt(Vector2 p) => Math.Clamp((int)(p.X / Cell), 0, Cols - 1) + Math.Clamp((int)(p.Y / Cell), 0, Rows - 1) * Cols;
        static int H(int x, int y) => x + y * Cols;
        static int V(int x, int y) => (Rows + 1) * Cols + x + y * (Cols + 1);
        static int EdgeBetween(int x, int y, int nx, int ny) => x == nx ? H(x, Math.Max(y, ny)) : V(Math.Max(x, nx), y);
        static float Angle(Vector2 d) => MathF.Atan2(d.Y, d.X);
        public static Vector2 Direction(float a) => new(MathF.Cos(a), MathF.Sin(a));

        void MakeMaze()
        {
            for (int y = 0; y <= Rows; y++) for (int x = 0; x < Cols; x++)
                Walls[H(x, y)] = new Wall(new Vector2(x * Cell - Edge, y * Cell - Edge), new Vector2((x + 1) * Cell + Edge, y * Cell + Edge));
            for (int y = 0; y < Rows; y++) for (int x = 0; x <= Cols; x++)
                Walls[V(x, y)] = new Wall(new Vector2(x * Cell - Edge, y * Cell - Edge), new Vector2(x * Cell + Edge, (y + 1) * Cell + Edge));

            // A spanning tree keeps every spawn reachable; extra openings create loops.
            var stack = new Stack<int>();
            var seen = new bool[Rows * Cols];
            seen[0] = true;
            stack.Push(0);
            while (stack.Count > 0)
            {
                int i = stack.Peek(), x = i % Cols, y = i / Cols, count = 0;
                foreach (var (dx, dy) in Directions)
                {
                    int nx = x + dx, ny = y + dy;
                    if (nx < 0 || nx >= Cols || ny < 0 || ny >= Rows || seen[nx + ny * Cols]) continue;
                    choices[count++] = nx + ny * Cols;
                }
                if (count == 0) { stack.Pop(); continue; }
                int next = choices[Roll(count)];
                Walls[EdgeBetween(x, y, next % Cols, next / Cols)].Kind = 0;
                seen[next] = true;
                stack.Push(next);
            }
            for (int y = 1; y < Rows; y++) for (int x = 0; x < Cols; x++) OpenExtra(Walls[H(x, y)]);
            for (int y = 0; y < Rows; y++) for (int x = 1; x < Cols; x++) OpenExtra(Walls[V(x, y)]);
        }

        void OpenExtra(Wall w)
        {
            if (w.Kind == 0) return;
            double roll = Random();
            if (roll < 0.38) w.Kind = 0;
            else if (roll < 0.62) w.Kind = 2;
        }

        public bool Protected(Tank t) => Time < t.ShieldUntil || t.Bonus == Power.Shield && Time < t.PowerUntil;
        public int ShotCooldown(Tank t) => t.Bonus == Power.Rapid && Time < t.PowerUntil ? RapidCooldown : Cooldown;

        public void Shoot(int seat)
        {
            var t = Tanks[seat];
            bool rapid = ShotCooldown(t) == RapidCooldown;
            if (!t.Alive || Time - t.LastShot < ShotCooldown(t) || Bullets.Count(b => b.Owner == seat && !b.Extra) >= (rapid ? 4 : 2)) return;
            t.LastShot = Time;
            if (t.Bonus == Power.Triple && Time < t.PowerUntil)
            {
                for (int i = 0; i < Triple.Length; i++) AddBullet(seat, t, Triple[i], i > 0);
            }
            else AddBullet(seat, t, 0f, false);
            Events.Add((Effect.Shot, t.Position + Direction(t.Aim) * Muzzle, seat, -1, Power.None));
        }

        void AddBullet(int seat, Tank t, float spread, bool extra)
        {
            var d = Direction(t.Aim + spread);
            var p = t.Position + d * Muzzle;
            Bullets.Add(new Bullet { Id = nextId++, Owner = seat, Born = Time, Position = p, Previous = p, Velocity = d * BulletSpeed, Extra = extra });
        }

        public void Step(Vector2 move, Vector2 aim, bool shoot)
        {
            if (Done) return;
            Time += StepMs;
            Events.Clear();
            for (int i = 0; i < Tanks.Length; i++)
            {
                var t = Tanks[i];
                t.Previous = t.Position;
                if (!t.Alive)
                {
                    if (Time >= t.RespawnAt) Spawn(i);
                    continue;
                }
                if (t.PowerUntil <= Time) t.Bonus = Power.None;
                var input = i == 0 ? (move, aim, shoot) : Think(i);
                if (input.Item2.LengthSquared() > 0.25f * 0.25f) t.Aim = Angle(input.Item2);
                if (input.Item3) Shoot(i);
                if (input.Item1.LengthSquared() > 0.08f * 0.08f)
                {
                    t.Heading = Angle(input.Item1);
                    t.Position += input.Item1 * (Speed * StepMs / 1000f);
                }
                for (int pass = 0; pass < 2; pass++)
                    foreach (var wall in Walls)
                        if (wall.Kind != 0) t.Position = wall.Push(t.Position);
                t.Position = Vector2.Clamp(t.Position, new Vector2(TankRadius), new Vector2(Width - TankRadius, Height - TankRadius));
            }
            for (int i = 0; i < Tanks.Length; i++) for (int j = i + 1; j < Tanks.Length; j++)
                if (Tanks[i].Alive && Tanks[j].Alive) Separate(Tanks[i], Tanks[j], i + j);
            foreach (var b in Bullets) b.Previous = b.Position;
            for (int i = 0; i < Substeps && !Done; i++) MoveBullets(StepMs / (1000f * Substeps));
            UpdatePowers();
            Judge();
        }

        void Spawn(int seat)
        {
            float score = -1f;
            Vector2 best = default;
            foreach (int cell in Spawns)
            {
                var p = Center(cell);
                float nearest = float.PositiveInfinity;
                for (int i = 0; i < Tanks.Length; i++)
                    if (i != seat && Tanks[i].Alive) nearest = MathF.Min(nearest, Vector2.DistanceSquared(Tanks[i].Position, p));
                if (nearest <= score) continue;
                best = p;
                score = nearest;
            }
            var tank = Tanks[seat];
            tank.Position = tank.Previous = best;
            tank.Life = Hp;
            tank.ShieldUntil = Time + SpawnShield;
        }

        static void Separate(Tank a, Tank b, int fallback)
        {
            var d = b.Position - a.Position;
            float distance = d.Length();
            if (distance >= 2 * TankRadius) return;
            var push = (distance > 0.000001f ? d / distance : Direction(fallback)) * ((2 * TankRadius - distance) / 2f);
            a.Position -= push;
            b.Position += push;
        }

        void MoveBullets(float dt)
        {
            for (int i = 0; i < Bullets.Count;)
            {
                var b = Bullets[i];
                var p = b.Position;
                b.Position += b.Velocity * dt;
                Wall wall = null;
                foreach (var candidate in Walls)
                {
                    if (candidate.Kind == 0 || !candidate.Contains(b.Position, BulletRadius)) continue;
                    wall = candidate;
                    break;
                }
                if (wall != null && wall.Kind >= 2)
                {
                    var kind = wall.Kind == 2 ? Effect.Crack : Effect.Break;
                    wall.Kind = wall.Kind == 2 ? 3 : 0;
                    Events.Add((kind, wall.Center, b.Owner, -1, Power.None));
                    Bullets.RemoveAt(i);
                    continue;
                }
                if (wall != null)
                {
                    if (++b.Bounces > Bounces) { Bullets.RemoveAt(i); continue; }
                    bool x = p.X < wall.Min.X - BulletRadius || p.X > wall.Max.X + BulletRadius;
                    bool y = p.Y < wall.Min.Y - BulletRadius || p.Y > wall.Max.Y + BulletRadius;
                    if (x || !y) b.Velocity.X = -b.Velocity.X;
                    if (y || !x) b.Velocity.Y = -b.Velocity.Y;
                    b.Position = p;
                    Events.Add((Effect.Bounce, p, b.Owner, -1, Power.None));
                }
                if (Time - b.Born > BulletLife) { Bullets.RemoveAt(i); continue; }
                i++;
            }
            // Select contacts before resolving any of them (both tanks can be knocked out).
            hits.Clear();
            foreach (var b in Bullets)
                for (int i = 0; i < Tanks.Length; i++)
                {
                    var t = Tanks[i];
                    if (!t.Alive || (i == b.Owner && Time - b.Born < OwnerGrace)) continue;
                    if (Vector2.DistanceSquared(b.Position, t.Position) > (TankRadius + BulletRadius) * (TankRadius + BulletRadius)) continue;
                    hits.Add((b, i));
                    break;
                }
            foreach (var (b, seat) in hits)
            {
                Bullets.Remove(b);
                var t = Tanks[seat];
                if (!t.Alive) continue;
                if (Protected(t)) { Events.Add((Effect.Block, b.Position, seat, b.Owner, Power.None)); continue; }
                t.Life--;
                Events.Add((Effect.Hit, b.Position, seat, b.Owner, Power.None));
                if (!t.Alive) Destroy(seat, b.Owner);
            }
        }

        void Destroy(int seat, int by)
        {
            var t = Tanks[seat];
            t.Deaths++;
            t.RespawnAt = Time + Respawn;
            t.Bonus = Power.None;
            Events.Add((Effect.Destroyed, t.Position, seat, by, Power.None));
            if (seat == by) return;
            int kills = ++Tanks[by].Kills;
            if (!Done && (leaders.Contains(by) || kills >= KillsToWin)) { Winner = by; Done = true; }
        }

        void UpdatePowers()
        {
            for (int i = 0; i < Tanks.Length; i++)
            {
                var t = Tanks[i];
                if (!t.Alive) continue;
                int index = Pickups.FindIndex(p => Vector2.DistanceSquared(p.at, t.Position) < (TankRadius + 0.35f) * (TankRadius + 0.35f));
                if (index < 0) continue;
                var p = Pickups[index];
                t.Bonus = p.kind;
                t.PowerUntil = Time + (p.kind == Power.Shield ? ShieldMs : PowerMs);
                Pickups.RemoveAt(index);
                Events.Add((Effect.Pickup, p.at, i, -1, p.kind));
            }
            if (Time < nextPower) return;
            nextPower = Time + PowerEvery;
            if (Pickups.Count >= 2) return;
            var at = Center(Roll(Cols) + (2 + Roll(Rows - 4)) * Cols);
            Pickups.Add((nextId++, (Power)(1 + Roll(3)), at));
        }

        void Judge()
        {
            if (Done || Time < Regular) return;
            if (InOvertime) { Done = Time >= Regular + Overtime; return; }
            int best = Tanks.Max(t => t.Kills);
            int fewest = Tanks.Where(t => t.Kills == best).Min(t => t.Deaths);
            for (int i = 0; i < Tanks.Length; i++)
                if (Tanks[i].Kills == best && Tanks[i].Deaths == fewest) leaders.Add(i);
            if (leaders.Count == 1)
            {
                Winner = leaders.First();
                leaders.Clear();
                Done = true;
            }
            else Events.Add((Effect.Tiebreak, default, -1, -1, Power.None));
        }

        public float FirstWall(Vector2 p, Vector2 d, float max, float pad = 0f)
        {
            var end = p + d * max;
            float nearest = 1f;
            foreach (var wall in Walls)
                if (wall.Kind != 0 && wall.Segment(p, end, pad, out float fraction)) nearest = MathF.Min(nearest, fraction);
            return nearest * max;
        }

        (Vector2 move, Vector2 aim, bool shoot) Think(int seat)
        {
            var me = Tanks[seat];
            Vector2 delta = default;
            float nearest = float.PositiveInfinity;
            for (int i = 0; i < Tanks.Length; i++)
            {
                if (i == seat || !Tanks[i].Alive) continue;
                var d = Tanks[i].Position - me.Position;
                if (d.LengthSquared() >= nearest) continue;
                delta = d;
                nearest = d.LengthSquared();
            }
            if (float.IsPositiveInfinity(nearest)) return default;
            float distance = MathF.Sqrt(nearest);
            bool clear = distance < 0.000001f || FirstWall(me.Position, delta / distance, distance, BulletRadius) >= distance;
            uint hash = unchecked((uint)(seat * 73856093) ^ (uint)(Time / 700 * 19349663));
            hash = unchecked((hash ^ (hash >> 13)) * 0x5bd1e995u);
            float jitter = ((hash % 100) / 100f - 0.5f) * 0.3f;
            var drive = clear && distance < 4f ? Vector2.Zero : Drive(me.Position, me.Position + delta);
            return (drive, Direction(Angle(delta) + jitter), clear && Time - me.LastShot >= Cooldown);
        }

        Vector2 Drive(Vector2 me, Vector2 target)
        {
            int start = CellAt(me), goal = CellAt(target), head = 0, tail = 1;
            Array.Fill(from, -1);
            queue[0] = start;
            from[start] = start;
            while (head < tail)
            {
                int i = queue[head++];
                if (i == goal) break;
                int x = i % Cols, y = i / Cols;
                foreach (var (dx, dy) in Directions)
                {
                    int nx = x + dx, ny = y + dy, next = nx + ny * Cols;
                    if (nx < 0 || nx >= Cols || ny < 0 || ny >= Rows || from[next] >= 0) continue;
                    if (Walls[EdgeBetween(x, y, nx, ny)].Kind != 0) continue;
                    from[next] = i;
                    queue[tail++] = next;
                }
            }
            int step = goal;
            while (from[step] >= 0 && from[step] != step && from[step] != start) step = from[step];
            var d = (from[step] >= 0 ? Center(step) : target) - me;
            return d.LengthSquared() > 0.000001f ? Vector2.Normalize(d) : Vector2.Zero;
        }
    }
}
