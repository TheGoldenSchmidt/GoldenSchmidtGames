using System.Collections.Generic;
using System.Linq;
using UnityEngine;
using static GSG.Kit;

namespace GSG.Bombs
{
    /// <summary>
    /// Bomb Arena in Unity: the rules run as the app's bomb engine (<see cref="BombSim"/>, 50-ms
    /// steps); Unity draws the bomb factory with steel walls, crates that burst into shards,
    /// fizzing bombs, flame crosses with glow and camera shake, power-up tokens and the closing
    /// walls that drop from above.
    /// </summary>
    public class BombGame : MatchGame, IOnlineMatch
    {
        const float C = 1.2f, StepTime = 0.05f;

        class View { public Seat seat; public Bomber b; public Transform root; public Figure figure; public float yaw; public bool wasAlive = true; public float deadT = -1f; }

        BombSim sim;
        readonly List<View> views = new();
        readonly Dictionary<int, GameObject> blocks = new();
        readonly Dictionary<int, (Transform t, float dropT)> closing = new();
        readonly Dictionary<int, Transform> bombViews = new();
        readonly List<Transform> flamePool = new();
        readonly Dictionary<(int, int), Transform> powerViews = new();
        Transform world;
        Material crateMat, flameMat, flameCore, bombMat, sparkMat, wallMat;
        float acc;
        bool pendingPress;
        Vector2 playerDir;
        int shownRound;
        // Online: own seat (−1 = watching) and what the last snapshot showed (for effects from changes).
        int me;
        bool built;
        int lastEvent = -1;
        readonly HashSet<int> boomGroups = new();

        protected override string GameName => "Bomb Arena";
        protected override string Intro => "Lauf durch die Bombenfabrik und lege Bomben: Nach 2 s explodieren sie kreuzförmig, sprengen Kisten und zünden andere Bomben. Kisten lassen Extras fallen (Reichweite, Extra-Bombe, Tempo, Kick). 2 Leben pro Durchgang, K.o. +2, Durchgangssieg +3. Ab 25 s schließt sich die Arena.";
        protected override string ResultText => "K.o. eines Gegners +2, Durchgangssieg +3 (bei Gleichstand geteilt). Zwei Durchgänge, bei Gleichstand Sudden Death.";
        protected override bool ControlsVisible => sim != null && me >= 0 && sim.bombers[me].alive && (!Online || built);

        public static Vector3 World(float x, float y) => new Vector3((x - (BombSim.Cols - 1) / 2f) * C, 0f, ((BombSim.Rows - 1) / 2f - y) * C);

        protected override void Setup()
        {
            crateMat = Resources.Load<Material>("GSG/Materials/LedgeDeco");
            wallMat = Resources.Load<Material>("GSG/Materials/WallDeco");
            flameMat = Toon(Palette.Warn, 0f, 0f, Palette.Warn * 2.2f);
            flameCore = Toon(Palette.Accent, 0f, 0f, Palette.Accent * 2.6f);
            bombMat = Toon(Palette.Ink, 1f, 0.5f);
            sparkMat = Toon(Palette.Accent, 0f, 0f, Palette.Accent * 3f);
            BuildFactory();
            foreach (var seat in seats)
            {
                var v = new View { seat = seat, root = new GameObject(seat.name).transform };
                v.figure = SpawnFigure(seat, v.root, 0.95f);
                views.Add(v);
            }
            focus = new GameObject("Kamerafokus").transform;
            rig = CameraRig.Create(focus, 28f, 66f, 56f, Vector3.zero);
            rig.composer.TargetOffset = Vector3.zero;
            var comp = rig.composer.Composition; comp.ScreenPosition = new Vector2(0f, 0.04f); comp.DeadZone.Enabled = false; rig.composer.Composition = comp;
            rig.recenterAfter = 0f;
            hud.AddChip("round", "Durchgang 1/2");
            hud.AddChip("time", "40 s");
            hud.AddAction("a", Hud.Icon.Grab, "Bombe", Hud.Tone.Gold);
            me = seats.FindIndex(s => s.isPlayer);
            NewSim();
            if (Online) { hud.SetControlsVisible(false); MatchBridge.Register(this); }
        }

        protected override void OnBegin() { if (!Online) NewSim(); }

        void NewSim()
        {
            sim = new BombSim(seats.Count, Random.Range(1, 999999));
            acc = 0f; shownRound = 0;
            for (int i = 0; i < views.Count; i++) { views[i].b = sim.bombers[i]; views[i].wasAlive = true; views[i].deadT = -1f; views[i].root.gameObject.SetActive(true); }
            Cells();
            sim.events.Clear();
            Strips();
        }

        // ---- world ---------------------------------------------------------------------------

        void BuildFactory()
        {
            world = new GameObject("Bombenfabrik").transform;
            var floor = new GameObject("Boden").transform;
            floor.SetParent(world, false);
            for (int y = 0; y < BombSim.Rows; y++)
                for (int x = 0; x < BombSim.Cols; x++)
                {
                    var c = (x + y) % 2 == 0 ? Palette.Hex("#3a3f66") : Palette.Hex("#454b7a");
                    Box(floor, c, World(x, y) + Vector3.down * 0.06f, new Vector3(C, 0.12f, C), 0.8f);
                }
            Box(floor, Palette.Hex("#23264a"), new Vector3(0f, -0.4f, 0f), new Vector3(BombSim.Cols * C + 3f, 0.6f, BombSim.Rows * C + 3f), 0f);
            // Factory hall: conveyor rails and hazard posts around the arena.
            var stripe = Resources.Load<Material>("GSG/Materials/Trap");
            for (int i = -1; i <= 1; i += 2)
            {
                var rail = Box(world, Palette.Belt, new Vector3(i * (BombSim.Cols * C / 2f + 1.2f), 0.2f, 0f), new Vector3(0.8f, 0.4f, BombSim.Rows * C + 2f), 1f);
                rail.GetComponent<Renderer>().sharedMaterial = Resources.Load<Material>("GSG/Materials/Belt");
            }
            for (int i = 0; i < 4; i++)
            {
                var p = new Vector3((i % 2 == 0 ? -1 : 1) * (BombSim.Cols * C / 2f + 1.4f), 1.2f, (i < 2 ? -1 : 1) * (BombSim.Rows * C / 2f + 1.4f));
                var post = Box(world, Palette.Trap, p, new Vector3(0.7f, 2.4f, 0.7f), 1.2f);
                if (stripe) post.GetComponent<Renderer>().sharedMaterial = stripe;
                var lamp = Prim(PrimitiveType.Sphere, world, Palette.Warn, p + Vector3.up * 1.5f, Vector3.one * 0.5f, 0f);
                lamp.GetComponent<Renderer>().sharedMaterial = Toon(Palette.Warn, 0f, 0f, Palette.Warn * 2f);
            }
            StaticBatchingUtility.Combine(floor.gameObject);
            for (int i = 0; i < 40; i++)
            {
                var f = Box(world, Palette.Warn, Vector3.down * 50f, new Vector3(C * 0.92f, 0.5f, C * 0.92f), 0f);
                f.GetComponent<Renderer>().sharedMaterial = flameMat;
                f.GetComponent<Renderer>().shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off;
                f.SetActive(false);
                flamePool.Add(f.transform);
            }
        }

        /// <summary>Walls, crates and closing blocks from the cell string (rebuilt at round start, crates removed as they burst).</summary>
        void Cells()
        {
            foreach (var go in blocks.Values) Destroy(go);
            blocks.Clear();
            foreach (var c in closing.Values) Destroy(c.t.gameObject);
            closing.Clear();
            for (int y = 0; y < BombSim.Rows; y++)
                for (int x = 0; x < BombSim.Cols; x++)
                {
                    char c = sim.At(x, y);
                    if (c == '1')
                    {
                        bool border = x == 0 || y == 0 || x == BombSim.Cols - 1 || y == BombSim.Rows - 1;
                        var w = Box(world, border ? Palette.Wall : Palette.Hold, World(x, y) + Vector3.up * 0.55f, new Vector3(C, 1.1f, C), 1.2f);
                        if (border && wallMat) w.GetComponent<Renderer>().sharedMaterial = wallMat;
                        blocks[y * BombSim.Cols + x] = w;
                    }
                    else if (c == '2')
                    {
                        var k = Box(world, Palette.Ledge, World(x, y) + Vector3.up * 0.45f, new Vector3(C * 0.86f, 0.9f, C * 0.86f), 1.4f);
                        if (crateMat) k.GetComponent<Renderer>().sharedMaterial = crateMat;
                        blocks[y * BombSim.Cols + x] = k;
                    }
                }
        }

        // ---- play ----------------------------------------------------------------------------

        void Update()
        {
            if (sim == null) return;
            if (Online)
            {
                if (!built) return;
                if (Playing && ControlsVisible)
                {
                    var dir = rig.Relative(hud.Stick);
                    MatchBridge.Input(dir.x, -dir.z, 0f, 0f);
                    if (hud.Pressed("a")) MatchBridge.Press("a");
                }
                Draw();
                UpdateHud();
                return;
            }
            if (phase == Phase.Play)
            {
                var d = rig.Relative(hud.Stick);
                playerDir = new Vector2(d.x, -d.z);
                if (hud.Pressed("a")) pendingPress = true;
                acc += Time.deltaTime;
                int guard = 0;
                while (acc >= StepTime && !sim.done && guard++ < 6) { acc -= StepTime; Tick(); }
                if (sim.done) Finish();
            }
            Draw();
            UpdateHud();
        }

        void Tick()
        {
            var inputs = new Vector2[views.Count];
            inputs[0] = playerDir;
            if (pendingPress) { pendingPress = false; if (!sim.Press(0)) Sfx.Play("blip", 0.4f, 0.7f); }
            for (int i = 1; i < views.Count; i++)
            {
                var (dir, bomb) = sim.Bot(i);
                inputs[i] = dir;
                if (bomb) sim.Press(i);
            }
            sim.Step(StepTime, inputs);
            foreach (var e in sim.events) Event(e);
            sim.events.Clear();
            Strips();
        }

        void Event(BombEvent e)
        {
            bool mine = me >= 0 && (e.a == me || e.b == me);
            switch (e.kind)
            {
                case "round":
                    Cells();
                    foreach (var v in views) { v.deadT = -1f; v.wasAlive = v.b.alive; v.root.gameObject.SetActive(v.b.alive); v.figure.SetVisible(true); }
                    hud.Toast(sim.sudden ? "Sudden Death!" : $"Durchgang {sim.round} von {BombSim.RoundsTotal}", sim.sudden ? Palette.Warn : Palette.Accent, 1f);
                    Sfx.Play("sting");
                    break;
                case "bomb": Sfx.Play("click", e.a == me ? 0.9f : 0.4f, 0.8f); break;
                case "boom":
                    var at = World(e.x, e.y) + Vector3.up * 0.5f;
                    Sfx.Play("break", 0.9f, Random.Range(0.75f, 0.95f));
                    Fx.Sparks(at, Palette.Accent, 16);
                    Fx.Glow(at, Palette.Warn, 10);
                    Fx.Shake(e.a == me ? 0.35f : 0.2f);
                    break;
                case "crate":
                    int key = e.y * BombSim.Cols + e.x;
                    if (blocks.TryGetValue(key, out var crate)) { Fx.Shards(crate.transform.position, Palette.Ledge, 14); Destroy(crate); blocks.Remove(key); }
                    break;
                case "wall":
                    var block = Box(world, Palette.Pusher, World(e.x, e.y) + Vector3.up * 7f, new Vector3(C, 1.1f, C), 1.4f);
                    closing[e.y * BombSim.Cols + e.x] = (block.transform, 0f);
                    break;
                case "shrink": hud.Toast("Die Arena schließt sich!", Palette.Warn, 1.2f); Sfx.Play("warn"); break;
                case "hit":
                    views[e.a].figure.Shot("hit", 0.6f, 0.05f, 1.2f);
                    if (e.a == me) { hud.Toast("Getroffen!", Palette.Warn, 0.8f); Sfx.Play("hit"); Fx.HitStop(0.06f); }
                    break;
                case "out":
                    var view = views[e.a];
                    view.deadT = 0f;
                    view.figure.Loop("death", 0.1f);
                    Sfx.Play("lose", e.a == me ? 0.9f : 0.4f);
                    if (e.a == me) hud.Toast("K.o.!", Palette.Warn, 1f);
                    else if (me >= 0 && e.b == me) { hud.Toast("K.o.! +2", Palette.Accent, 0.9f); Sfx.Play("chime"); }
                    break;
                case "kick": Sfx.Play("shove", e.a == me ? 0.8f : 0.4f, 1.2f); break;
                case "result":
                    bool won = me >= 0 && e.a == me;
                    hud.Toast(e.a >= 0 ? (won ? "Durchgang gewonnen!" : $"{seats[e.a].name} gewinnt den Durchgang") : e.b > 1 ? "Geteilter Sieg" : "Niemand übrig", won ? Palette.Accent : Palette.Paper, 1.6f);
                    if (won) { Sfx.Play("fanfare"); Fx.Confetti(views[me].root.position + Vector3.up * 2f, 40); }
                    break;
                default:
                    if (e.kind.StartsWith("power:"))
                    {
                        string kind = e.kind.Substring(6);
                        Sfx.Play("chime", e.a == me ? 0.8f : 0.3f, 1.3f);
                        Fx.Glow(World(e.x, e.y) + Vector3.up, PowerColor(kind), 10);
                        if (e.a == me) hud.Toast(kind == "range" ? "Mehr Reichweite!" : kind == "bomb" ? "Extra-Bombe!" : kind == "speed" ? "Schneller!" : "Bombenkick!", PowerColor(kind), 0.8f);
                    }
                    break;
            }
        }

        static Color PowerColor(string kind) => kind switch { "range" => Palette.Warn, "bomb" => Palette.Hold, "speed" => Palette.Seesaw, _ => Palette.Goo };

        void Draw()
        {
            float dt = Time.deltaTime, now = sim.time;
            foreach (var v in views)
            {
                var b = v.b;
                if (!b.alive)
                {
                    if (v.deadT >= 0f) { v.deadT += dt; if (v.deadT > 1.6f) v.root.gameObject.SetActive(false); }
                    else v.root.gameObject.SetActive(false);
                    continue;
                }
                v.root.gameObject.SetActive(true);
                var from = World(b.cx, b.cy); var to = World(b.tx, b.ty);
                var pos = Vector3.Lerp(from, to, b.progress);
                var vel = (pos - v.root.position) / Mathf.Max(dt, 1e-4f);
                v.root.position = Vector3.Lerp(v.root.position, pos, 1f - Mathf.Exp(-30f * dt));
                var d = BombSim.Dir4[b.dir];
                v.yaw = Mathf.LerpAngle(v.yaw, Mathf.Atan2(d.dx, -d.dy) * Mathf.Rad2Deg, 1f - Mathf.Exp(-16f * dt));
                v.root.rotation = Quaternion.Euler(0f, v.yaw, 0f);
                bool moving = b.tx != b.cx || b.ty != b.cy;
                v.figure.Loop(moving ? "jog" : "idle", 0.1f, moving ? 1.2f + b.speed * 0.15f : 1f);
                v.figure.SetVisible(now >= b.invulnUntil || Mathf.Repeat(Time.time * 8f, 1f) > 0.35f);
                v.figure.Tick(vel, dt);
            }
            // Bombs: fizz, swell towards the blast, slide when kicked.
            foreach (var bomb in sim.bombs)
            {
                if (!bombViews.TryGetValue(bomb.id, out var t))
                {
                    t = new GameObject("Bombe").transform;
                    var ball = Prim(PrimitiveType.Sphere, t, Palette.Ink, new Vector3(0f, 0.42f, 0f), Vector3.one * 0.8f, 1f);
                    ball.GetComponent<Renderer>().sharedMaterial = bombMat;
                    Cyl(t, Palette.Paper, new Vector3(0f, 0.9f, 0f), 0.06f, 0.25f, 0f);
                    var spark = Prim(PrimitiveType.Sphere, t, Palette.Accent, new Vector3(0f, 1.05f, 0f), Vector3.one * 0.18f, 0f);
                    spark.GetComponent<Renderer>().sharedMaterial = sparkMat;
                    t.position = World(bomb.x, bomb.y);
                    bombViews[bomb.id] = t;
                }
                t.position = Vector3.Lerp(t.position, World(bomb.x, bomb.y), 1f - Mathf.Exp(-20f * dt));
                float left = Mathf.Clamp01((bomb.at - now) / BombSim.Fuse);
                float pulse = 1f + (1f - left) * 0.18f + Mathf.Sin(Time.time * (8f + (1f - left) * 22f)) * 0.05f * (1f - left);
                t.localScale = Vector3.one * (Fx.Reduced ? 1f : pulse);
                t.GetChild(2).localScale = Vector3.one * (0.14f + Random.value * 0.1f);
                if (Random.value < 0.25f) Fx.Sparks(t.position + Vector3.up * 1.05f, Palette.Accent, 1);
            }
            foreach (var id in bombViews.Keys.ToList()) if (sim.bombs.All(b => b.id != id)) { Destroy(bombViews[id].gameObject); bombViews.Remove(id); }
            // Flames from the pool.
            int n = 0;
            foreach (var f in sim.flames)
            {
                if (n >= flamePool.Count) break;
                var t = flamePool[n++];
                t.gameObject.SetActive(true);
                float k = Mathf.Clamp01((f.until - now) / BombSim.FlameMs);
                t.position = World(f.x, f.y) + Vector3.up * 0.3f;
                t.localScale = new Vector3(C * (f.center ? 0.98f : 0.86f), (0.35f + 0.5f * k) * (f.center ? 1.4f : 1f), C * (f.center ? 0.98f : 0.86f)) * (0.85f + Random.value * 0.15f);
                t.GetComponent<Renderer>().sharedMaterial = f.center ? flameCore : flameMat;
            }
            for (; n < flamePool.Count; n++) if (flamePool[n].gameObject.activeSelf) flamePool[n].gameObject.SetActive(false);
            // Power-up tokens.
            foreach (var p in sim.items)
                if (!powerViews.ContainsKey((p.x, p.y)))
                {
                    var t = new GameObject("Extra " + p.kind).transform;
                    var col = PowerColor(p.kind);
                    var disc = Cyl(t, col, Vector3.zero, 0.38f, 0.1f, 1f);
                    disc.transform.localRotation = Quaternion.Euler(90f, 0f, 0f);
                    disc.GetComponent<Renderer>().sharedMaterial = Toon(col, 1f, 0.3f, col * 0.7f);
                    var icon = p.kind switch
                    {
                        "range" => Part(t, "Flamme", Cone(6), Toon(Palette.Accent, 0f, 0f, Palette.Accent), new Vector3(0f, -0.16f, -0.08f), new Vector3(0.18f, 0.34f, 0.18f)),
                        "bomb" => Prim(PrimitiveType.Sphere, t, Palette.Ink, new Vector3(0f, 0f, -0.08f), Vector3.one * 0.32f, 0f),
                        "speed" => Box(t, Palette.Paper, new Vector3(0f, 0f, -0.08f), new Vector3(0.36f, 0.1f, 0.06f), 0f),
                        _ => Box(t, Palette.Paper, new Vector3(0f, 0f, -0.08f), new Vector3(0.22f, 0.22f, 0.06f), 0f)
                    };
                    t.position = World(p.x, p.y) + Vector3.up * 0.7f;
                    powerViews[(p.x, p.y)] = t;
                    Fx.Glow(t.position, col, 8);
                }
            foreach (var key in powerViews.Keys.ToList()) if (!sim.items.Any(p => (p.x, p.y) == key)) { Destroy(powerViews[key].gameObject); powerViews.Remove(key); }
            foreach (var t in powerViews.Values)
            {
                t.rotation = Quaternion.Euler(0f, Time.time * 120f, 0f);
                t.position = new Vector3(t.position.x, 0.7f + Mathf.Sin(Time.time * 3f + t.position.x) * 0.1f, t.position.z);
            }
            // Closing walls drop in with a thud.
            foreach (var key in closing.Keys.ToList())
            {
                var (t, k) = closing[key];
                if (k >= 1f) continue;
                k = Mathf.Min(1f, k + dt / 0.25f);
                var target = World(key % BombSim.Cols, key / BombSim.Cols) + Vector3.up * 0.55f;
                t.position = Vector3.Lerp(target + Vector3.up * 6.5f, target, k * k);
                if (k >= 1f) { Fx.Dust(target, Palette.Paper, 4); if (Random.value < 0.3f) Sfx.Play("thud", 0.4f, 0.9f); }
                closing[key] = (t, k);
            }
            var own = me >= 0 ? views[me] : null;
            var goal = own != null && own.b.alive ? new Vector3(own.root.position.x * 0.15f, 0f, own.root.position.z * 0.15f) : Vector3.zero;
            focus.position = Ease.Damp(focus.position, goal, 3f, Time.unscaledDeltaTime);
        }

        void UpdateHud()
        {
            var own = sim.bombers[Mathf.Max(0, me)];
            int mine = sim.bombs.Count(b => b.owner == me);
            hud.SetActionEnabled("a", own.alive && mine < own.maxBombs);
            hud.SetChip("round", sim.sudden ? "Sudden Death" : $"Durchgang {Mathf.Max(1, sim.round)}/{BombSim.RoundsTotal}");
            float limit = sim.sudden ? BombSim.SuddenMax : BombSim.RoundMax;
            float left = sim.phase == "play" ? (limit - (sim.time - sim.roundStart)) / 1000f : limit / 1000f;
            hud.SetChip("time", $"{Mathf.CeilToInt(Mathf.Max(0f, left))} s");
            SetTimer(left * 1000f / limit);
            if (phase == Phase.Play || Online) hud.SetControlsVisible(ControlsVisible && phase == Phase.Play);
        }

        void Strips()
        {
            foreach (var v in views)
            {
                var b = v.b;
                float p = sim.points[v.seat.index];
                string pts = p % 1f == 0f ? ((int)p).ToString() : p.ToString("0.#");
                Strip(v.seat, b.alive ? $"· {pts} P · {b.lives} Leben" : $"· {pts} P · raus", false, !b.alive);
            }
        }

        // ---- online: snapshots of the room (bombArena.ts) ---------------------------------------

        [System.Serializable] class SnapBomber { public string id; public int cx, cy, tx, ty, dir, lives, maxBombs, range, speed; public float progress, invulnUntil; public bool alive, kick; }
        [System.Serializable] class SnapBomb { public int id, x, y, owner, range; public float at; public bool sliding; }
        [System.Serializable] class SnapFlame { public int x, y, group, owner; public float until; public bool center; }
        [System.Serializable] class SnapItem { public int x, y; public string kind; }
        [System.Serializable] class Snap { public int time, round, shrunk, suddenWinner; public float roundStart; public string phase, cells; public bool sudden, done; public SnapBomber[] bombers; public SnapBomb[] bombs; public SnapFlame[] flames; public SnapItem[] items; public float[] points; public OnlineEvent[] events; }

        public void OnSnapshot(string json)
        {
            var snap = JsonUtility.FromJson<Snap>(json);
            if (snap?.bombers == null || snap.bombers.Length != views.Count || snap.cells == null || snap.cells.Length != sim.cells.Length) return;
            var byId = new Dictionary<string, int>();
            bool newRound = built && snap.round != sim.round;
            // Changed cells: a crate bursts, a closing wall drops in.
            if (built && !newRound)
                for (int i = 0; i < sim.cells.Length; i++)
                {
                    char was = sim.cells[i], now = snap.cells[i];
                    if (was == now) continue;
                    if (was == '2' && now == '0') Event(new BombEvent { kind = "crate", x = i % BombSim.Cols, y = i / BombSim.Cols });
                    else if (now == '1') Event(new BombEvent { kind = "wall", x = i % BombSim.Cols, y = i / BombSim.Cols });
                }
            sim.cells = snap.cells.ToCharArray();
            var removedItems = sim.items.Where(o => !(snap.items ?? new SnapItem[0]).Any(n => n.x == o.x && n.y == o.y)).ToList();
            for (int i = 0; i < views.Count; i++)
            {
                var s = snap.bombers[i];
                var b = sim.bombers[i];
                byId[s.id] = i;
                b.cx = s.cx; b.cy = s.cy; b.tx = s.tx; b.ty = s.ty; b.progress = s.progress; b.dir = s.dir; b.lives = s.lives; b.alive = s.alive;
                b.invulnUntil = s.invulnUntil; b.maxBombs = s.maxBombs; b.range = s.range; b.speed = s.speed; b.kick = s.kick;
            }
            sim.time = snap.time; sim.round = snap.round; sim.phase = snap.phase; sim.sudden = snap.sudden; sim.roundStart = snap.roundStart; sim.shrunk = snap.shrunk; sim.done = snap.done;
            sim.suddenWinner = snap.suddenWinner;
            if (snap.points != null) for (int i = 0; i < views.Count && i < snap.points.Length; i++) sim.points[i] = snap.points[i];
            sim.bombs = (snap.bombs ?? new SnapBomb[0]).Select(b => new Bomb { id = b.id, x = b.x, y = b.y, owner = b.owner, range = b.range, at = b.at, sliding = b.sliding }).ToList();
            sim.flames = (snap.flames ?? new SnapFlame[0]).Select(f => new Flame { x = f.x, y = f.y, group = f.group, owner = f.owner, until = f.until, center = f.center }).ToList();
            sim.items = (snap.items ?? new SnapItem[0]).Select(o => new Power { x = o.x, y = o.y, kind = o.kind }).ToList();
            bool first = !built;
            built = true;
            if (first || newRound) { boomGroups.Clear(); foreach (var f in sim.flames) boomGroups.Add(f.group); Cells(); }
            // A new blast group with its centre: the explosion.
            foreach (var f in sim.flames)
                if (f.center && boomGroups.Add(f.group)) Event(new BombEvent { kind = "boom", a = f.owner, x = f.x, y = f.y });
            RoomEvents(snap.events, byId, removedItems);
            Strips();
        }

        void RoomEvents(OnlineEvent[] events, Dictionary<string, int> byId, List<Power> removedItems)
        {
            if (events == null) return;
            // The first snapshot only sets the mark: no replay of what happened before this device joined.
            if (lastEvent < 0) { lastEvent = events.Length > 0 ? events.Max(e => e.seq) : 0; return; }
            foreach (var e in events.OrderBy(e => e.seq))
            {
                if (e.seq <= lastEvent) continue;
                lastEvent = e.seq;
                int a = e.ids != null && e.ids.Length > 0 && byId.TryGetValue(e.ids[0], out var x) ? x : -1;
                int b = e.ids != null && e.ids.Length > 1 && byId.TryGetValue(e.ids[1], out var y) ? y : -1;
                switch (e.kind)
                {
                    case "round": Event(new BombEvent { kind = "round" }); break;
                    case "result": Event(new BombEvent { kind = "result", a = e.ids != null && e.ids.Length == 1 ? a : -1, b = e.ids?.Length ?? 0 }); break;
                    case "power":
                        if (a < 0) break;
                        var (cx, cy) = sim.bombers[a].Cell;
                        var item = removedItems.FirstOrDefault(o => o.x == cx && o.y == cy) ?? removedItems.FirstOrDefault();
                        Event(new BombEvent { kind = "power:" + (item?.kind ?? "range"), a = a, x = item?.x ?? cx, y = item?.y ?? cy });
                        break;
                    case "hit": case "out": case "kick": case "bomb":
                        if (a >= 0) Event(new BombEvent { kind = e.kind, a = a, b = b });
                        break;
                    case "shrink": Event(new BombEvent { kind = "shrink" }); break;
                }
            }
        }

        public void OnAim(Vector2 aim) { }
        public void OnTurn(float delta) { }

        protected override List<(Seat seat, string value)> Ranking() =>
            sim.Standings().Select(i =>
            {
                int wins = sim.history.Count(h => !h.sudden && h.winners.Contains(i));
                string pts = sim.points[i] % 1f == 0f ? ((int)sim.points[i]).ToString() : sim.points[i].ToString("0.#");
                return (seats[i], sim.suddenWinner == i ? $"{pts} P · Sudden Death gewonnen" : $"{pts} P · {wins} Siege");
            }).ToList();
    }
}
