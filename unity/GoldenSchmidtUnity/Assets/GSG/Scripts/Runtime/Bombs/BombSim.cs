using System.Collections.Generic;
using System.Linq;
using UnityEngine;

namespace GSG.Bombs
{
    /// <summary>
    /// Port of shared/matches/bombArena.ts (BA): 11 × 15 cells, 2-s fuses, cross flames with
    /// chain reactions, crates with power-ups, kick, the closing spiral from second 25, two lives
    /// per round, K.o. +2, round win +3, two rounds and sudden death on a tie. Grid x right, y down;
    /// time in ms, 50-ms steps.
    /// </summary>
    public class Bomber
    {
        public int seat, cx, cy, tx, ty, dir = 2, lives, maxBombs = 1, range = 2, speed;
        public float progress, invulnUntil, knockedAt = -1f;
        public bool alive, kick;
        public readonly List<int> hitGroups = new();
        public (int x, int y) Cell => progress < 0.5f ? (cx, cy) : (tx, ty);
    }

    public class Bomb { public int id, x, y, owner, range, group = -1; public float at; public List<int> passFor = new(); public bool sliding; public int sdx, sdy; public float next; }
    public class Flame { public int x, y, group, owner; public float until; public bool center; }
    public class Power { public int x, y; public string kind; }
    public struct BombEvent { public string kind; public int a, b, x, y; }

    public class BombSim
    {
        public const int Cols = 11, Rows = 15;
        public const float Fuse = 2000f, FlameMs = 500f, MoveMs = 260f, MinMoveMs = 160f, SpeedStep = 30f, InvulnMs = 1500f, RoundMax = 40000f, ShrinkAfter = 25000f,
            ShrinkEvery = 350f, Pause = 2800f, Knockout = 2f, RoundWin = 3f, DropChance = 0.32f, CrateFill = 0.62f, SuddenMax = 30000f, SuddenShrink = 8000f, KickStepMs = 90f;
        public const int Lives = 2, Range = 2, RoundsTotal = 2;
        public static readonly (int dx, int dy)[] Dir4 = { (0, -1), (1, 0), (0, 1), (-1, 0) };
        static readonly (int x, int y)[] Spawns = { (1, 1), (9, 13), (9, 1), (1, 13), (1, 7), (9, 7) };
        static readonly List<(int x, int y)> SpiralOrder = Spiral();

        public float time, roundStart;
        public int round, nextId = 1, shrunk;
        public string phase = "play";
        public bool sudden, done;
        public char[] cells;
        public readonly List<Bomber> bombers = new();
        public List<Bomb> bombs = new();
        public List<Flame> flames = new();
        public List<Power> items = new();
        public float[] points, roundPoints;
        public int suddenWinner = -1;
        public readonly List<(List<int> winners, bool sudden)> history = new();
        public readonly List<BombEvent> events = new();
        readonly System.Random rng;
        readonly int count;

        public BombSim(int count, int seed)
        {
            this.count = count;
            rng = new System.Random(seed);
            points = new float[count]; roundPoints = new float[count];
            for (int i = 0; i < count; i++) bombers.Add(new Bomber { seat = i });
            StartRound(false, Enumerable.Range(0, count).ToList());
        }

        float Random() => (float)rng.NextDouble();
        void Emit(string kind, int a = -1, int b = -1, int x = -1, int y = -1) => events.Add(new BombEvent { kind = kind, a = a, b = b, x = x, y = y });
        public char At(int x, int y) => x < 0 || y < 0 || x >= Cols || y >= Rows ? '1' : cells[y * Cols + x];
        void Set(int x, int y, char v) => cells[y * Cols + x] = v;

        static List<(int, int)> Spiral()
        {
            var o = new List<(int, int)>();
            int x0 = 1, y0 = 1, x1 = Cols - 2, y1 = Rows - 2;
            while (x0 <= x1 && y0 <= y1)
            {
                for (int x = x0; x <= x1; x++) o.Add((x, y0));
                for (int y = y0 + 1; y <= y1; y++) o.Add((x1, y));
                if (y0 < y1) for (int x = x1 - 1; x >= x0; x--) o.Add((x, y1));
                if (x0 < x1) for (int y = y1 - 1; y > y0; y--) o.Add((x0, y));
                x0++; y0++; x1--; y1--;
            }
            return o;
        }

        char[] BuildArena(bool crates)
        {
            var c = new char[Cols * Rows];
            for (int y = 0; y < Rows; y++)
                for (int x = 0; x < Cols; x++)
                {
                    bool border = x == 0 || y == 0 || x == Cols - 1 || y == Rows - 1, pillar = x % 2 == 0 && y % 2 == 0;
                    bool safe = Spawns.Any(s => Mathf.Abs(s.x - x) + Mathf.Abs(s.y - y) <= 1 || (s.x == x && Mathf.Abs(s.y - y) <= 2) || (s.y == y && Mathf.Abs(s.x - x) <= 2));
                    c[y * Cols + x] = border || pillar ? '1' : crates && !safe && Random() < CrateFill ? '2' : '0';
                }
            return c;
        }

        void StartRound(bool isSudden, List<int> ids)
        {
            round++; sudden = isSudden; phase = "play"; roundStart = time; shrunk = 0;
            cells = BuildArena(!isSudden); bombs = new(); flames = new(); items = new(); roundPoints = new float[count];
            for (int i = 0; i < count; i++)
            {
                var (x, y) = Spawns[i % Spawns.Length];
                var b = bombers[i];
                b.cx = b.tx = x; b.cy = b.ty = y; b.progress = 0f; b.dir = 2; b.lives = isSudden ? 1 : Lives; b.alive = ids.Contains(i);
                b.invulnUntil = time + 800f; b.maxBombs = 1; b.range = Range; b.speed = 0; b.kick = false; b.hitGroups.Clear(); b.knockedAt = -1f;
            }
            Emit("round");
        }

        void Award(int seat, float p) { points[seat] = Mathf.Round((points[seat] + p) * 100f) / 100f; roundPoints[seat] = Mathf.Round((roundPoints[seat] + p) * 100f) / 100f; }

        void EndRound()
        {
            var alive = bombers.Where(b => b.alive).ToList();
            var winners = new List<int>();
            if (alive.Count == 1) winners.Add(alive[0].seat);
            else if (alive.Count > 1) { int best = alive.Max(b => b.lives); winners = alive.Where(b => b.lives == best).Select(b => b.seat).ToList(); }
            if (sudden) { if (winners.Count == 1) suddenWinner = winners[0]; }
            else foreach (var w in winners) Award(w, RoundWin / winners.Count);
            history.Add((winners, sudden));
            phase = "pause"; roundStart = time;
            Emit("result", winners.Count == 1 ? winners[0] : -1, winners.Count);
        }

        bool Occupied(int x, int y, Bomber except) => bombers.Any(o => o != except && o.alive && ((o.cx == x && o.cy == y) || (o.tx == x && o.ty == y)));

        void Hit(Bomber b, int by)
        {
            b.lives--;
            if (b.lives > 0)
            {
                float Danger(int x, int y) => Mathf.Min(99f, Mathf.Min(bombs.Count > 0 ? bombs.Min(o => Mathf.Abs(o.x - x) + Mathf.Abs(o.y - y)) : 99, flames.Count > 0 ? flames.Min(f => Mathf.Abs(f.x - x) + Mathf.Abs(f.y - y)) : 99));
                var options = Spawns.Where(s => At(s.x, s.y) == '0' && !Occupied(s.x, s.y, b)).ToList();
                var (x, y) = options.Count > 0 ? options.OrderByDescending(s => Danger(s.x, s.y)).First() : (b.cx, b.cy);
                b.cx = b.tx = x; b.cy = b.ty = y; b.progress = 0f; b.invulnUntil = time + InvulnMs;
                Emit("hit", b.seat);
                return;
            }
            b.alive = false; b.knockedAt = time;
            if (by >= 0 && by != b.seat && !sudden) Award(by, Knockout);
            Emit("out", b.seat, by >= 0 && by != b.seat ? by : -1);
        }

        void Explode(Bomb first)
        {
            int group = first.group >= 0 ? first.group : nextId++;
            var queue = new List<Bomb> { first };
            first.group = group;
            var broken = new List<(int, int)>();
            while (queue.Count > 0)
            {
                var bomb = queue[0]; queue.RemoveAt(0);
                bombs.Remove(bomb);
                flames.Add(new Flame { x = bomb.x, y = bomb.y, until = time + FlameMs, group = group, owner = bomb.owner, center = true });
                Emit("boom", bomb.owner, -1, bomb.x, bomb.y);
                foreach (var (dx, dy) in Dir4)
                    for (int k = 1; k <= bomb.range; k++)
                    {
                        int x = bomb.x + dx * k, y = bomb.y + dy * k; char c = At(x, y);
                        if (c == '1' || c == '3') break;
                        flames.Add(new Flame { x = x, y = y, until = time + FlameMs, group = group, owner = bomb.owner });
                        if (c == '2') { broken.Add((x, y)); break; }
                        var other = bombs.FirstOrDefault(o => o.x == x && o.y == y && !queue.Contains(o));
                        if (other != null) { other.group = group; queue.Add(other); break; }
                    }
            }
            foreach (var (x, y) in broken)
                if (At(x, y) == '2')
                {
                    Set(x, y, '0');
                    Emit("crate", -1, -1, x, y);
                    if (Random() < DropChance) { string[] kinds = { "range", "bomb", "speed", "kick" }; items.Add(new Power { x = x, y = y, kind = kinds[Mathf.Min(3, (int)(Random() * 4f))] }); }
                }
        }

        void Move(Bomber b, Vector2 input, float dt)
        {
            float moveMs = Mathf.Max(MinMoveMs, MoveMs - b.speed * SpeedStep);
            int wanted = input.magnitude < 0.35f ? -1 : Mathf.Abs(input.x) > Mathf.Abs(input.y) ? (input.x > 0f ? 1 : 3) : (input.y > 0f ? 2 : 0);
            bool Free(int x, int y) => At(x, y) == '0' && !bombs.Any(o => o.x == x && o.y == y && !o.passFor.Contains(b.seat)) && !Occupied(x, y, b);
            float budget = dt * 1000f / moveMs;
            for (int guard = 0; guard < 3 && budget > 1e-6f; guard++)
            {
                bool moving = b.tx != b.cx || b.ty != b.cy;
                if (moving && wanted >= 0 && wanted == (b.dir + 2) % 4)
                {
                    (b.cx, b.tx) = (b.tx, b.cx); (b.cy, b.ty) = (b.ty, b.cy); b.progress = 1f - b.progress; b.dir = wanted;
                }
                if (b.tx != b.cx || b.ty != b.cy)
                {
                    float step = Mathf.Min(budget, 1f - b.progress);
                    b.progress += step; budget -= step;
                    if (b.progress >= 1f - 1e-6f)
                    {
                        b.cx = b.tx; b.cy = b.ty; b.progress = 0f;
                        var item = items.FirstOrDefault(i => i.x == b.cx && i.y == b.cy);
                        if (item != null)
                        {
                            items.Remove(item);
                            if (item.kind == "range") b.range++; else if (item.kind == "bomb") b.maxBombs++; else if (item.kind == "speed") b.speed = Mathf.Min(3, b.speed + 1); else b.kick = true;
                            Emit("power:" + item.kind, b.seat, -1, b.cx, b.cy);
                        }
                    }
                    continue;
                }
                if (wanted < 0) break;
                b.dir = wanted;
                int nx = b.cx + Dir4[wanted].dx, ny = b.cy + Dir4[wanted].dy;
                if (Free(nx, ny)) { b.tx = nx; b.ty = ny; continue; }
                var bomb = bombs.FirstOrDefault(o => o.x == nx && o.y == ny);
                if (bomb != null && b.kick && !bomb.sliding) { bomb.sliding = true; bomb.sdx = Dir4[wanted].dx; bomb.sdy = Dir4[wanted].dy; bomb.next = time + KickStepMs; Emit("kick", b.seat); }
                break;
            }
            foreach (var bomb in bombs)
                if (bomb.passFor.Contains(b.seat)) { var (x, y) = b.Cell; if (x != bomb.x || y != bomb.y) bomb.passFor.Remove(b.seat); }
        }

        public void Step(float dt, Vector2[] inputs)
        {
            time += dt * 1000f;
            if (phase == "pause")
            {
                if (time - roundStart < Pause) return;
                var active = Enumerable.Range(0, count).ToList();
                if (round < RoundsTotal && active.Count > 1) { StartRound(false, active); return; }
                float best = active.Max(i => points[i]);
                var tied = active.Where(i => points[i] == best).ToList();
                if (!sudden && tied.Count > 1) { StartRound(true, tied); return; }
                phase = "done"; done = true; return;
            }
            if (phase != "play") return;
            float roundTime = time - roundStart;
            foreach (var b in bombers) if (b.alive) Move(b, inputs[b.seat], dt);
            foreach (var bomb in bombs)
                if (bomb.sliding && time >= bomb.next)
                {
                    int nx = bomb.x + bomb.sdx, ny = bomb.y + bomb.sdy;
                    bool blocked = At(nx, ny) != '0' || bombs.Any(o => o.x == nx && o.y == ny) || items.Any(i => i.x == nx && i.y == ny) || bombers.Any(b => b.alive && b.Cell == (nx, ny));
                    if (blocked) bomb.sliding = false; else { bomb.x = nx; bomb.y = ny; bomb.next = time + KickStepMs; }
                }
            for (int guard = 0; guard < 20; guard++) { var due = bombs.FirstOrDefault(b => b.at <= time); if (due == null) break; Explode(due); }
            flames.RemoveAll(f => f.until <= time);
            foreach (var b in bombers)
            {
                if (!b.alive || time < b.invulnUntil) continue;
                var (x, y) = b.Cell;
                var flame = flames.FirstOrDefault(f => f.x == x && f.y == y && !b.hitGroups.Contains(f.group));
                if (flame != null) { b.hitGroups.Add(flame.group); Hit(b, flame.owner); }
            }
            float closeAfter = sudden ? SuddenShrink : ShrinkAfter;
            int target = roundTime < closeAfter ? 0 : Mathf.Min(SpiralOrder.Count - 9, Mathf.FloorToInt((roundTime - closeAfter) / ShrinkEvery) + 1);
            while (shrunk < target)
            {
                var (x, y) = SpiralOrder[shrunk++];
                Set(x, y, '3');
                bombs.RemoveAll(b => b.x == x && b.y == y); items.RemoveAll(i => i.x == x && i.y == y);
                Emit("wall", -1, -1, x, y);
                foreach (var b in bombers) if (b.alive && b.Cell == (x, y)) { b.invulnUntil = 0f; Hit(b, -1); }
                if (shrunk == 1) Emit("shrink");
            }
            int left = bombers.Count(b => b.alive);
            if (left <= 1 || roundTime >= (sudden ? SuddenMax : RoundMax)) EndRound();
        }

        public bool Press(int seat)
        {
            var b = bombers[seat];
            if (phase != "play" || !b.alive) return false;
            var (x, y) = b.Cell;
            if (bombs.Any(o => o.x == x && o.y == y) || bombs.Count(o => o.owner == seat) >= b.maxBombs) return false;
            var here = bombers.Where(o => o.alive && o.Cell == (x, y)).Select(o => o.seat).ToList();
            bombs.Add(new Bomb { id = nextId++, x = x, y = y, owner = seat, at = time + Fuse, range = b.range, passFor = here });
            Emit("bomb", seat, -1, x, y);
            return true;
        }

        public List<int> Standings() => Enumerable.Range(0, count).OrderByDescending(i => points[i]).ThenByDescending(i => suddenWinner == i ? 1 : 0).ToList();

        static int Hash(int seat, int slot)
        {
            uint h = (uint)(seat * 73856093) ^ (uint)(slot * 19349663);
            h ^= h >> 13; h *= 0x5bd1e995u; h ^= h >> 15;
            return (int)(h % 1000u);
        }

        /// <summary>Port of the bot: flee danger, bomb crates and opponents with an escape, walk to targets.</summary>
        public (Vector2 dir, bool bomb) Bot(int seat)
        {
            var me = bombers[seat];
            if (phase != "play" || !me.alive) return (Vector2.zero, false);
            var (x, y) = me.Cell;
            var danger = new HashSet<int>();
            void Mark(int bx, int by, int range)
            {
                danger.Add(by * Cols + bx);
                foreach (var (dx, dy) in Dir4)
                    for (int k = 1; k <= range; k++) { int cx = bx + dx * k, cy = by + dy * k; if (At(cx, cy) != '0') break; danger.Add(cy * Cols + cx); }
            }
            foreach (var f in flames) danger.Add(f.y * Cols + f.x);
            foreach (var bomb in bombs) Mark(bomb.x, bomb.y, bomb.range);
            int Walk(int fx, int fy, System.Func<int, int, bool> goal)
            {
                var from = new Dictionary<int, int> { [fy * Cols + fx] = -1 };
                var queue = new Queue<(int, int)>(); queue.Enqueue((fx, fy));
                while (queue.Count > 0)
                {
                    var (cx, cy) = queue.Dequeue();
                    if (goal(cx, cy))
                    {
                        int start = fy * Cols + fx, k = cy * Cols + cx;
                        if (k == start) return -1;
                        while (from[k] != start) k = from[k];
                        for (int d = 0; d < 4; d++) if (fx + Dir4[d].dx == k % Cols && fy + Dir4[d].dy == k / Cols) return d;
                        return -2;
                    }
                    foreach (var (dx, dy) in Dir4)
                    {
                        int nx = cx + dx, ny = cy + dy, k = ny * Cols + nx;
                        if (from.ContainsKey(k) || At(nx, ny) != '0' || bombs.Any(o => o.x == nx && o.y == ny) || flames.Any(f => f.x == nx && f.y == ny)) continue;
                        from[k] = cy * Cols + cx; queue.Enqueue((nx, ny));
                    }
                }
                return -2;
            }
            Vector2 Go(int d) => d >= 0 ? new Vector2(Dir4[d].dx, Dir4[d].dy) : Vector2.zero;
            if (danger.Contains(y * Cols + x)) return (Go(Walk(x, y, (cx, cy) => !danger.Contains(cy * Cols + cx))), false);
            if (me.tx != me.cx || me.ty != me.cy) return (Go(me.dir), false);
            bool enemyNear = bombers.Any(o => o.alive && o != me && Mathf.Abs(o.Cell.x - x) + Mathf.Abs(o.Cell.y - y) <= 2);
            bool crateNear = Dir4.Any(d => At(x + d.dx, y + d.dy) == '2');
            int mine = bombs.Count(o => o.owner == seat);
            if ((enemyNear || crateNear) && mine < me.maxBombs && Hash(seat, Mathf.FloorToInt(time / 600f)) % 3 != 0)
            {
                var escape = new HashSet<int>(danger);
                foreach (var (dx, dy) in Dir4) for (int k = 0; k <= me.range; k++) { int cx = x + dx * k, cy = y + dy * k; if (At(cx, cy) != '0') break; escape.Add(cy * Cols + cx); }
                if (Walk(x, y, (cx, cy) => !escape.Contains(cy * Cols + cx)) >= 0) return (Vector2.zero, true);
            }
            bool Target(int cx, int cy) => items.Any(i => i.x == cx && i.y == cy) || Dir4.Any(d => At(cx + d.dx, cy + d.dy) == '2') || bombers.Any(o => o.alive && o != me && o.Cell == (cx, cy));
            int dir = Walk(x, y, (cx, cy) => (cx != x || cy != y) && Target(cx, cy) && !danger.Contains(cy * Cols + cx));
            return dir >= 0 && !danger.Contains((y + Dir4[dir].dy) * Cols + x + Dir4[dir].dx) ? (Go(dir), false) : (Vector2.zero, false);
        }
    }
}
