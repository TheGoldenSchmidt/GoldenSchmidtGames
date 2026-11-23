using System.Collections.Generic;
using System.Linq;
using UnityEngine;
using static GSG.Kit;

namespace GSG.Tower
{
    /// <summary>
    /// Tower Tumble in Unity: the race of shared/matches/towerTumble.ts (TW) – everyone builds at
    /// once on an own narrow pedestal with the same sequence of four-cell pieces; the falling piece
    /// is steered in half-cell steps, turned and dropped fast; once it touches the tower it becomes a
    /// rigid body. Here the physics is Unity's 2D physics (Box2D, built for stable stacking) instead
    /// of the app's physics2d; the stones are still drawn as 3D cubes. First tower that stays above the finish line for 2 s wins, after 2 minutes the
    /// height decides. With <see cref="survival"/>: no finish line, three lost stones and you are out.
    /// </summary>
    public class TowerGame : MatchGame
    {
        public bool survival;
        // TW constants (cells are 1 × 1, pedestal top at y = 0).
        const float BaseHalf = 2.5f, BaseDepth = 1.2f, LaneHalf = 6f, Goal = 16f, HoldMs = 2000f, Fall = 2.2f, FastFall = 12f, Move = 16f, SpawnGap = 7f,
            SpawnDelay = 300f, LostY = -6f, Gravity = 18f, Friction = 0.9f, SettleSpeed = 0.5f, Regular = 120000f, SurvivalMs = 180000f, SpeedUp = 1.8f, Cell = 0.5f, Spacing = 18f;
        const int Lives = 3;

        static readonly string[] Kinds = { "I", "O", "T", "L", "J", "S", "Z" };
        static readonly Dictionary<string, (int x, int y)[]> Grid = new()
        {
            ["I"] = new[] { (0, 0), (1, 0), (2, 0), (3, 0) }, ["O"] = new[] { (0, 0), (1, 0), (0, 1), (1, 1) }, ["T"] = new[] { (0, 0), (1, 0), (2, 0), (1, 1) },
            ["L"] = new[] { (0, 0), (1, 0), (2, 0), (2, 1) }, ["J"] = new[] { (0, 0), (1, 0), (2, 0), (0, 1) }, ["S"] = new[] { (0, 0), (1, 0), (1, 1), (2, 1) }, ["Z"] = new[] { (1, 0), (2, 0), (0, 1), (1, 1) }
        };
        static readonly Dictionary<string, ((int, int) a, (int, int) b)[]> Runs = new()
        {
            ["I"] = new[] { ((0, 0), (3, 0)) }, ["O"] = new[] { ((0, 0), (1, 1)) }, ["T"] = new[] { ((0, 0), (2, 0)), ((1, 1), (1, 1)) }, ["L"] = new[] { ((0, 0), (2, 0)), ((2, 1), (2, 1)) },
            ["J"] = new[] { ((0, 0), (2, 0)), ((0, 1), (0, 1)) }, ["S"] = new[] { ((0, 0), (1, 0)), ((1, 1), (2, 1)) }, ["Z"] = new[] { ((1, 0), (2, 0)), ((0, 1), (1, 1)) }
        };
        static readonly Dictionary<string, Color> KindColor = new()
        {
            ["I"] = Palette.Seesaw, ["O"] = Palette.Accent, ["T"] = Palette.Hold, ["L"] = Palette.Ledge, ["J"] = Palette.Hex("#398fe2"), ["S"] = Palette.Goo, ["Z"] = Palette.Door
        };

        struct Fixture { public float x, y, hw, hh; }
        class Shape { public Vector2[] cells; public Fixture[] fixtures; }
        static readonly Dictionary<string, Shape> shapes = new();

        static (int, int) Turn(int x, int y, int r) { for (int i = 0; i < r; i++) (x, y) = (y, -x); return (x, y); }

        static Shape ShapeOf(string kind, int r)
        {
            int q = ((r % 4) + 4) % 4; string key = kind + q;
            if (shapes.TryGetValue(key, out var found)) return found;
            var raw = Grid[kind].Select(c => Turn(c.x, c.y, q)).ToArray();
            float mx = raw.Average(c => (float)c.Item1), my = raw.Average(c => (float)c.Item2);
            var cells = raw.Select(c => new Vector2(c.Item1 - mx, c.Item2 - my)).ToArray();
            var fixtures = Runs[kind].Select(run =>
            {
                var (x0, y0) = Turn(run.a.Item1, run.a.Item2, q); var (x1, y1) = Turn(run.b.Item1, run.b.Item2, q);
                return new Fixture { x = (x0 + x1) / 2f - mx, y = (y0 + y1) / 2f - my, hw = Mathf.Abs(x1 - x0) / 2f + Cell, hh = Mathf.Abs(y1 - y0) / 2f + Cell };
            }).ToArray();
            found = new Shape { cells = cells, fixtures = fixtures };
            shapes[key] = found;
            return found;
        }

        static float SnapX(string kind, int r, float x)
        {
            float off = ShapeOf(kind, r).cells[0].x - 0.5f;
            return Mathf.Round((x + off) * 2f) / 2f - off;
        }

        class Piece { public int n, r; public string k; public float x, y, tx; public Transform view; }
        class Body { public string k; public int r; public Rigidbody2D rb; public Transform t; }

        class TowerState
        {
            public Seat seat;
            public float origin;
            public readonly List<Body> bodies = new();
            public Piece piece;
            public float spawnAt, height, best, holdSince = -1f, finishedAt = -1f, outAt = -1f;
            public int next, placed, lost;
            public bool fast;
            public float nextBot, repeatAt;
            public Transform goalGlow;
            public bool Out => outAt >= 0f;
        }

        readonly List<TowerState> towers = new();
        readonly List<string> sequence = new();
        System.Random rng;
        PhysicsMaterial2D grip;
        float time;
        bool done;
        int winner = -1;

        protected override string GameName => survival ? "Tower Tumble – Survival" : "Tower Tumble";
        protected override string Intro => survival
            ? "Alle bauen gleichzeitig mit denselben Steinen. „Links“/„Rechts“ schieben (halten: weiter), „Drehen“ dreht, „Fallen“ halten lässt schnell fallen. Sobald ein Stein aufsetzt, gilt echte Physik. Fällt dein dritter Stein vom Turm, bist du raus; die Steine werden immer schneller."
            : "Alle bauen gleichzeitig mit denselben Steinen. „Links“/„Rechts“ schieben den Stein (halten: weiter), „Drehen“ dreht, „Fallen“ halten lässt ihn schnell fallen. Sobald ein Stein aufsetzt, gilt echte Physik: Steine kippen, rutschen und stürzen ab. Wer zuerst 2 Sekunden über der Ziellinie steht, gewinnt.";
        protected override string ResultText => survival ? "Wer zuletzt noch baut, gewinnt; nach drei Minuten der höchste Turm." : "Nach zwei Minuten entscheidet die Höhe.";
        protected override bool ControlsVisible => towers.Count > 0 && !towers[0].Out && !done;

        protected override void Setup()
        {
            // Feedback: PhysX made placed stones jump. Box2D (Unity 2D physics) stacks calmly.
            Physics2D.gravity = new Vector2(0f, -Gravity);
            Physics2D.velocityIterations = 12;
            Physics2D.positionIterations = 6;
            Time.fixedDeltaTime = 1f / 60f;
            grip = new PhysicsMaterial2D("Stein") { friction = Friction, bounciness = 0f };
            for (int i = 0; i < seats.Count; i++) towers.Add(BuildTower(seats[i], i == 0 ? 0f : (i % 2 == 1 ? 1 : -1) * Spacing * ((i + 1) / 2)));
            BuildBackdrop();
            focus = new GameObject("Kamerafokus").transform;
            focus.position = new Vector3(0f, 5f, 0f);
            rig = CameraRig.Create(focus, 27f, 8f, 50f, Vector3.zero);
            rig.composer.TargetOffset = Vector3.zero;
            var comp = rig.composer.Composition; comp.ScreenPosition = new Vector2(0f, -0.14f); comp.DeadZone.Enabled = false; rig.composer.Composition = comp;
            rig.recenterAfter = 0f;
            hud.UseStick(false);
            hud.AddAction("left", Hud.Icon.Left, "Links", Hud.Tone.Stone, true);
            hud.AddAction("right", Hud.Icon.Right, "Rechts", Hud.Tone.Stone, true);
            hud.AddAction("down", Hud.Icon.Duck, "Fallen", Hud.Tone.Cyan);
            hud.AddAction("turn", Hud.Icon.Turn, "Drehen", Hud.Tone.Gold);
            hud.AddChip("time", survival ? "180 s" : "120 s");
            hud.AddChip("height", "0,0 m");
            NewMatch();
        }

        protected override void OnBegin() => NewMatch();

        void NewMatch()
        {
            rng = new System.Random(Random.Range(1, 999999));
            sequence.Clear(); time = 0f; done = false; winner = -1;
            foreach (var t in towers)
            {
                foreach (var b in t.bodies) Destroy(b.t.gameObject);
                t.bodies.Clear();
                if (t.piece != null) Destroy(t.piece.view.gameObject);
                t.piece = null; t.spawnAt = 0f; t.height = t.best = 0f; t.holdSince = t.finishedAt = t.outAt = -1f; t.next = t.placed = t.lost = 0;
            }
            Strips();
        }

        // ---- world ---------------------------------------------------------------------------

        TowerState BuildTower(Seat seat, float origin)
        {
            var t = new TowerState { seat = seat, origin = origin };
            var root = new GameObject("Turm " + seat.name).transform;
            root.position = new Vector3(origin, 0f, 0f);
            var pedestal = Box(root, Palette.Stone, new Vector3(0f, -BaseDepth / 2f, 0f), new Vector3(BaseHalf * 2f, BaseDepth, 1.4f), 1.4f);
            var col = pedestal.AddComponent<BoxCollider2D>(); col.sharedMaterial = grip; col.size = Vector2.one;
            Box(root, seat.Color, new Vector3(0f, -0.05f, 0f), new Vector3(BaseHalf * 2f + 0.1f, 0.1f, 1.45f), 0f);
            Part(root, "Säule", Lathe(new[] { new Vector2(0.4f, -14f), new Vector2(1.6f, -12f), new Vector2(BaseHalf * 0.9f, -1.2f), new Vector2(BaseHalf * 1.02f, -BaseDepth) }, 24), Toon(Palette.StoneShadow, 1f, 0.15f), Vector3.zero);
            if (!survival)
            {
                var line = Box(root, Palette.Accent, new Vector3(0f, Goal, 0f), new Vector3(LaneHalf * 2f, 0.08f, 0.08f), 0f);
                line.GetComponent<Renderer>().sharedMaterial = Toon(Palette.Accent, 0f, 0f, Palette.Accent * 1.6f);
                foreach (var x in new[] { -LaneHalf, LaneHalf })
                {
                    var flag = Box(root, Palette.Accent, new Vector3(x, Goal + 0.5f, 0f), new Vector3(0.6f, 0.4f, 0.05f), 0f);
                    flag.GetComponent<Renderer>().sharedMaterial = Toon(Palette.Accent, 0f, 0f, Palette.Accent);
                }
                t.goalGlow = line.transform;
            }
            // Name plate on the pedestal.
            Box(root, Palette.Ink, new Vector3(0f, -BaseDepth / 2f, 0.72f), new Vector3(BaseHalf * 1.2f, 0.5f, 0.02f), 0f);
            return t;
        }

        void BuildBackdrop()
        {
            var world = new GameObject("Kulisse").transform;
            var cone = Cone(6);
            for (int i = 0; i < 14; i++)
            {
                float x = -70f + i * 11f, h = 12f + (i * 7) % 15;
                var m = Part(world, "Hügel", cone, Toon(Color.Lerp(Palette.ShadowCool, Palette.Night, (i % 3) * 0.2f), 0f, 0.1f), new Vector3(x, -16f, 40f + (i % 3) * 8f), new Vector3(h * 1.4f, h, h));
                m.GetComponent<Renderer>().shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off;
            }
            Cyl(world, Palette.Hex("#3d7fc4"), new Vector3(0f, -15f, 10f), 120f, 0.2f, 0f);
            Fx.Looping("Funken", world, new Vector3(40f, 30f, 2f), Palette.Accent, 6f, 4f, 0.3f, 0.08f, true, Vector3.up).transform.localPosition = new Vector3(0f, 10f, 6f);
        }

        // ---- pieces ----------------------------------------------------------------------------

        string KindAt(int index)
        {
            while (sequence.Count <= index)
            {
                var bag = Kinds.ToList();
                for (int i = bag.Count - 1; i > 0; i--) { int j = rng.Next(i + 1); (bag[i], bag[j]) = (bag[j], bag[i]); }
                sequence.AddRange(bag);
            }
            return sequence[index];
        }

        Transform MakeView(string kind, int r, Transform parent)
        {
            var root = new GameObject("Stein " + kind).transform;
            root.SetParent(parent, false);
            var mat = Toon(KindColor[kind], 1.5f, 0.25f);
            foreach (var c in ShapeOf(kind, r).cells)
            {
                var cube = Box(root, KindColor[kind], new Vector3(c.x, c.y, 0f), new Vector3(0.97f, 0.97f, 1f), 1.5f);
                cube.GetComponent<Renderer>().sharedMaterial = mat;
            }
            return root;
        }

        float TopOf(TowerState t) => t.bodies.Count == 0 ? 0f : t.bodies.Max(b => BodyTop(b));

        float BodyTop(Body b)
        {
            float top = float.MinValue;
            foreach (var c in ShapeOf(b.k, b.r).cells)
                foreach (var d in new[] { new Vector2(-Cell, -Cell), new Vector2(Cell, -Cell), new Vector2(Cell, Cell), new Vector2(-Cell, Cell) })
                    top = Mathf.Max(top, b.t.TransformPoint(new Vector3(c.x + d.x, c.y + d.y, 0f)).y);
            return top;
        }

        void Spawn(TowerState t)
        {
            string k = KindAt(t.next);
            float x = SnapX(k, 0, 0f);
            t.piece = new Piece { n = t.next, k = k, r = 0, x = x, tx = x, y = TopOf(t) + SpawnGap };
            t.piece.view = MakeView(k, 0, null);
            t.next++;
            if (t.seat.isPlayer) Sfx.Play("blip", 0.4f, 1.2f);
        }

        /// <summary>Whether the falling piece at (x, y) with rotation r would overlap the pedestal or a placed stone.</summary>
        bool Blocked(TowerState t, string k, int r, float x, float y)
        {
            foreach (var f in ShapeOf(k, r).fixtures)
            {
                var center = new Vector2(t.origin + x + f.x, y + f.y);
                if (Physics2D.OverlapBox(center, new Vector2(f.hw * 2f - 0.04f, f.hh * 2f - 0.04f), 0f) != null) return true;
            }
            return false;
        }

        float FallSpeed => survival ? Fall * (1f + (SpeedUp - 1f) * Mathf.Min(1f, time / SurvivalMs)) : Fall;

        void Steer(TowerState t, float h)
        {
            var p = t.piece;
            if (p.tx != p.x)
            {
                float nx = p.x + Mathf.Clamp(p.tx - p.x, -Move * h, Move * h);
                if (!Blocked(t, p.k, p.r, nx, p.y)) p.x = nx; else p.tx = p.x;
            }
            float speed = t.fast ? FastFall : FallSpeed, ny = p.y - speed * h;
            if (!Blocked(t, p.k, p.r, p.x, ny))
            {
                p.y = ny;
                if (p.y < LostY) { Destroy(p.view.gameObject); t.piece = null; Lose(t); t.spawnAt = time + SpawnDelay; }
                return;
            }
            float free = p.y, hit = ny;
            for (int i = 0; i < 8; i++) { float mid = (free + hit) / 2f; if (Blocked(t, p.k, p.r, p.x, mid)) hit = mid; else free = mid; }
            Place(t, p, free, speed);
        }

        void Place(TowerState t, Piece p, float y, float speed)
        {
            var go = p.view.gameObject;
            // A hair above the contact: the stone settles under gravity instead of being pushed out of an overlap.
            go.transform.position = new Vector3(t.origin + p.x, y + 0.02f, 0f);
            foreach (var f in ShapeOf(p.k, p.r).fixtures)
            {
                var box = go.AddComponent<BoxCollider2D>();
                box.offset = new Vector2(f.x, f.y); box.size = new Vector2(f.hw * 2f, f.hh * 2f); box.sharedMaterial = grip;
            }
            var rb = go.AddComponent<Rigidbody2D>();
            rb.useAutoMass = false;
            rb.mass = 4f;
            rb.interpolation = RigidbodyInterpolation2D.Interpolate;
            rb.collisionDetectionMode = CollisionDetectionMode2D.Continuous;
            rb.linearVelocity = new Vector2(0f, -Mathf.Min(speed, 4f));
            t.bodies.Add(new Body { k = p.k, r = p.r, rb = rb, t = go.transform });
            t.piece = null; t.placed++; t.spawnAt = time + SpawnDelay;
            if (t.seat.isPlayer) { Sfx.Play("thud", 0.7f); Fx.Dust(go.transform.position + Vector3.down * 0.5f, Palette.Paper, 5); }
        }

        void Lose(TowerState t)
        {
            t.lost++;
            if (t.seat.isPlayer) { hud.Toast(survival ? $"Stein verloren! {t.lost}/{Lives}" : "Stein verloren!", Palette.Warn, 0.8f); Sfx.Play("lose", 0.6f); }
        }

        void TurnPiece(TowerState t)
        {
            var p = t.piece; if (p == null) return;
            int r = (p.r + 1) % 4;
            foreach (var dx in new[] { 0f, 0.5f, -0.5f, 1f, -1f })
            {
                float x = SnapX(p.k, r, p.x + dx);
                if (Blocked(t, p.k, r, x, p.y)) continue;
                p.r = r; p.x = x; p.tx = SnapX(p.k, r, p.tx + dx);
                var pos = p.view.position; Destroy(p.view.gameObject); p.view = MakeView(p.k, r, null); p.view.position = pos;
                if (t.seat.isPlayer) Sfx.Play("click", 0.7f, 1.3f);
                return;
            }
        }

        void Nudge(TowerState t, int dir)
        {
            var p = t.piece; if (p == null) return;
            p.tx = SnapX(p.k, p.r, Mathf.Clamp(p.tx + dir * Cell, -LaneHalf, LaneHalf));
        }

        // ---- play ----------------------------------------------------------------------------

        void Update()
        {
            if (phase == Phase.Play && !done)
            {
                var me = towers[0];
                if (!me.Out)
                {
                    if (hud.Pressed("left")) { Nudge(me, -1); me.repeatAt = Time.time + 0.28f; }
                    if (hud.Pressed("right")) { Nudge(me, 1); me.repeatAt = Time.time + 0.28f; }
                    if ((hud.Held("left") || hud.Held("right")) && Time.time >= me.repeatAt) { Nudge(me, hud.Held("left") ? -1 : 1); me.repeatAt = Time.time + 0.09f; }
                    if (hud.Pressed("turn")) TurnPiece(me);
                    me.fast = hud.Held("down");
                }
            }
            Draw();
            UpdateHud();
            if (done && phase == Phase.Play) Finish();
        }

        void FixedUpdate()
        {
            if (phase != Phase.Play || done) return;
            float dt = Time.fixedDeltaTime;
            time += dt * 1000f;
            foreach (var t in towers)
            {
                if (t.Out) continue;
                if (!t.seat.isPlayer && time >= t.nextBot) Bot(t);
                if (t.piece == null && time >= t.spawnAt) Spawn(t);
                if (t.piece != null) Steer(t, dt);
            }
            foreach (var t in towers)
            {
                for (int i = t.bodies.Count - 1; i >= 0; i--)
                    if (t.bodies[i].t.position.y < LostY) { Destroy(t.bodies[i].t.gameObject); t.bodies.RemoveAt(i); Lose(t); }
                Measure(t);
                if (survival && !t.Out && t.lost >= Lives)
                {
                    t.outAt = time;
                    if (t.piece != null) { Destroy(t.piece.view.gameObject); t.piece = null; }
                    if (t.seat.isPlayer) hud.Toast("Drei Steine verloren – raus!", Palette.Warn, 1.2f);
                }
            }
            if (survival)
            {
                var building = towers.Where(t => !t.Out).ToList();
                if (building.Count <= 1) { winner = building.Count == 1 ? towers.IndexOf(building[0]) : -1; done = true; }
                else if (time >= SurvivalMs) done = true;
                return;
            }
            var finished = towers.Where(t => t.finishedAt >= 0f).ToList();
            if (finished.Count > 0) { winner = finished.Count == 1 ? towers.IndexOf(finished[0]) : -1; done = true; }
            else if (time >= Regular) done = true;
        }

        void Measure(TowerState t)
        {
            float h = 0f;
            foreach (var b in t.bodies)
                if (b.rb.linearVelocity.magnitude < SettleSpeed && Mathf.Abs(b.rb.angularVelocity) * Mathf.Deg2Rad < SettleSpeed) h = Mathf.Max(h, BodyTop(b));
            t.height = h; t.best = Mathf.Max(t.best, h);
            if (survival) return;
            if (t.height >= Goal)
            {
                if (t.holdSince < 0f) { t.holdSince = time; if (t.seat.isPlayer) { hud.Toast("Über der Ziellinie – halten!", Palette.Accent, 1f); Sfx.Play("chime"); } }
                else if (time - t.holdSince >= HoldMs && t.finishedAt < 0f) t.finishedAt = time;
            }
            else if (t.holdSince >= 0f) { t.holdSince = -1f; if (t.seat.isPlayer) hud.Toast("Wieder unter der Linie", Palette.Warn, 0.8f); }
        }

        void Draw()
        {
            foreach (var t in towers)
            {
                if (t.piece != null) t.piece.view.position = Vector3.Lerp(t.piece.view.position, new Vector3(t.origin + t.piece.x, t.piece.y, 0f), 1f - Mathf.Exp(-30f * Time.deltaTime));
                if (t.goalGlow) t.goalGlow.localScale = new Vector3(LaneHalf * 2f, t.holdSince >= 0f ? 0.2f : 0.08f, t.holdSince >= 0f ? 0.2f : 0.08f);
            }
            var me = towers[0];
            float top = me.piece != null ? me.piece.y : me.height + SpawnGap;
            var goal = new Vector3(0f, Mathf.Max(5f, (me.height + top) / 2f + 1f), 0f);
            focus.position = Ease.Damp(focus.position, goal, 2.5f, Time.unscaledDeltaTime);
        }

        void UpdateHud()
        {
            var me = towers[0];
            float limit = survival ? SurvivalMs : Regular;
            hud.SetChip("time", $"{Mathf.CeilToInt(Mathf.Max(0f, (limit - time) / 1000f))} s");
            hud.SetChip("height", survival ? $"{M(me.height)} m · {me.lost}/{Lives}" : $"{M(me.height)} / {Goal:0} m");
            SetTimer(1f - time / limit);
            if (phase == Phase.Play) hud.SetControlsVisible(ControlsVisible);
            if (Time.frameCount % 15 == 0) Strips();
        }

        static string M(float v) => v.ToString("0.0", System.Globalization.CultureInfo.InvariantCulture).Replace('.', ',');

        void Strips()
        {
            foreach (var t in towers)
            {
                string text = survival ? (t.Out ? "· raus" : $"· {M(t.height)} m · {t.lost}/{Lives}") : t.finishedAt >= 0f ? "· im Ziel" : $"· {M(t.height)} m";
                Strip(t.seat, text, t.holdSince >= 0f, t.Out);
            }
        }

        protected override List<(Seat seat, string value)> Ranking()
        {
            IEnumerable<TowerState> order = survival
                ? towers.OrderByDescending(t => t.Out ? 0 : 1).ThenByDescending(t => t.Out ? t.outAt : 0f).ThenByDescending(t => t.height).ThenBy(t => t.lost)
                : towers.OrderByDescending(t => t.finishedAt >= 0f ? 1 : 0).ThenBy(t => t.finishedAt >= 0f ? t.finishedAt : 0f).ThenByDescending(t => t.height);
            return order.Select(t => (t.seat, survival ? $"{(t.Out ? "raus" : "baut noch")} · {M(t.best)} m · {t.lost}/{Lives} verloren" : $"{(t.finishedAt >= 0f ? "im Ziel" : $"{M(t.height)} m")} · {t.placed} Steine · {t.lost} verloren")).ToList();
        }

        // ---- bots (towerTumble.ts botPlan) -----------------------------------------------------

        Dictionary<int, float> Surface(TowerState t)
        {
            var cols = new Dictionary<int, float>();
            for (int c = (int)(-BaseHalf * 2f); c < (int)(BaseHalf * 2f); c++) cols[c] = 0f;
            foreach (var b in t.bodies)
            {
                float a = b.t.eulerAngles.z * Mathf.Deg2Rad, co = Mathf.Cos(a), si = Mathf.Sin(a);
                float x = b.t.position.x - t.origin, y = b.t.position.y;
                foreach (var cell in ShapeOf(b.k, b.r).cells)
                {
                    float wx = x + co * cell.x - si * cell.y, wy = y + si * cell.x + co * cell.y, top = wy + Cell;
                    for (int c = Mathf.FloorToInt((wx - Cell) * 2f + 0.01f); c < Mathf.CeilToInt((wx + Cell) * 2f - 0.01f); c++)
                        cols[c] = Mathf.Max(cols.TryGetValue(c, out var v) ? v : float.MinValue, top);
                }
            }
            return cols;
        }

        static float Support(Dictionary<int, float> cols, float from, float to)
        {
            float support = float.MinValue;
            for (int c = Mathf.RoundToInt(from * 2f); c < Mathf.RoundToInt(to * 2f); c++) support = Mathf.Max(support, cols.TryGetValue(c, out var v) ? v : float.MinValue);
            return support;
        }

        (int r, float x) Plan(TowerState t, Piece piece, int salt)
        {
            var cols = Surface(t);
            (int r, float x, float score) best = (piece.r, piece.x, float.MaxValue);
            for (int r = 0; r < 4; r++)
            {
                var cells = ShapeOf(piece.k, r).cells;
                for (float x = -BaseHalf; x <= BaseHalf; x += 0.5f)
                {
                    float px = SnapX(piece.k, r, x), land = float.MinValue;
                    foreach (var c in cells) land = Mathf.Max(land, Support(cols, px + c.x - Cell, px + c.x + Cell) - (c.y - Cell));
                    if (land < -1000f) continue;
                    float unsupported = 0f;
                    foreach (var c in cells)
                    {
                        float support = Support(cols, px + c.x - Cell, px + c.x + Cell), gap = land + c.y - Cell - support;
                        if (gap > 0.25f) unsupported += support < -1000f ? 4f : gap;
                    }
                    float top = land + cells.Max(c => c.y + Cell);
                    float overhang = cells.Sum(c => Mathf.Max(0f, Mathf.Abs(px + c.x) + Cell - BaseHalf + 0.25f));
                    float jitter = ((salt + r * 7 + Mathf.RoundToInt(px * 2f)) % 10 + 10) % 10 * 0.01f;
                    float score = survival ? top * 0.6f + unsupported * 8f + overhang * 6f + Mathf.Abs(px) * 0.5f + jitter : top + unsupported * 1.5f + Mathf.Abs(px) * 0.15f + jitter;
                    if (score < best.score) best = (r, px, score);
                }
            }
            return (best.r, best.x);
        }

        static int Hash(int a, int b) { uint h = (uint)(a * 73856093) ^ (uint)(b * 19349663); h ^= h >> 13; h *= 0x5bd1e995u; h ^= h >> 15; return (int)(h % 1000u); }

        void Bot(TowerState t)
        {
            t.nextBot = time + 100f;
            var p = t.piece;
            if (p == null) return;
            int seat = towers.IndexOf(t);
            var plan = Plan(t, p, Hash(seat, p.n));
            bool aligned = p.r == plan.r && Mathf.Abs(p.x - plan.x) < 0.01f;
            if (p.r != plan.r && Hash(seat, Mathf.FloorToInt(time / 300f)) % 2 == 0) TurnPiece(t);
            t.fast = !survival && aligned && p.y < Mathf.Max(0f, t.height) + SpawnGap - 1.5f;
            if (Mathf.Abs(p.tx - plan.x) >= 0.01f) Nudge(t, p.tx < plan.x ? 1 : -1);
        }
    }
}
