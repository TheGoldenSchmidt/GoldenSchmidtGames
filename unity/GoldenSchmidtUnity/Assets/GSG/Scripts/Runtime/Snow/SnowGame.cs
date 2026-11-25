using System.Collections.Generic;
using System.Linq;
using UnityEngine;
using static GSG.Kit;

namespace GSG.Snow
{
    /// <summary>
    /// Schneeballschlacht in Unity: rules as the app's snowball engine (<see cref="SnowSim"/>);
    /// Unity draws the winter arena with snow walls, pines, piles and snowfall, a chase camera that
    /// turns with a swipe, balls flying in an arc, splashes and snowmen. A tap on "Werfen" throws at
    /// the nearest opponent in view (marked with a gold ring), like the app's tap throw.
    /// </summary>
    public class SnowGame : MatchGame, IOnlineMatch
    {
        const float StepTime = 0.05f;

        class View
        {
            public Seat seat; public Baller p; public Transform root; public Figure figure; public float yaw;
            public GameObject snowman; public Transform carry0, carry1, formBall;
        }

        SnowSim sim;
        readonly List<View> views = new();
        readonly Dictionary<int, Transform> ballViews = new();
        readonly List<Transform> pileViews = new();
        Transform marker;
        float acc;
        bool pendingThrow, pendingForm;
        Vector2 playerDir;
        Baller tapTarget;
        // Online: own seat (−1 = watching), overview instead of the chase camera, event mark and last ball places.
        int me;
        bool top, built;
        int lastEvent = -1;
        readonly Dictionary<int, Vector2> lastBalls = new();

        protected override string GameName => "Schneeballschlacht";
        protected override string Intro => "Du trägst höchstens zwei Schneebälle: „Formen“ tippen und kurz stehen bleiben, oder über einen Schneehaufen laufen. „Werfen“ wirft in Blickrichtung; steht ein Gegner fast genau davor, rastet der Wurf ein (goldener Ring). Wischen dreht die Kamera – laufende Gegner musst du selbst vorhalten. Jeder Treffer macht 10 % langsamer, nach drei Treffern bist du ein Schneemann. Wer zuletzt steht, gewinnt.";
        protected override string ResultText => "Nach zwei Minuten gewinnt, wer am wenigsten getroffen wurde, dann wer mehr getroffen hat.";
        protected override bool ControlsVisible => sim != null && me >= 0 && !sim.players[me].Out && (!Online || built);
        Baller Own => me >= 0 ? sim.players[me] : null;

        static Vector3 World(float x, float y, float h = 0f) => new Vector3(x - SnowSim.Size / 2f, h, SnowSim.Size / 2f - y);

        protected override void Setup()
        {
            BuildArena();
            foreach (var seat in seats)
            {
                var v = new View { seat = seat, root = new GameObject(seat.name).transform };
                v.figure = SpawnFigure(seat, v.root, 1f);
                var white = Toon(Palette.Paper, 0.8f, 0.3f);
                v.carry0 = Prim(PrimitiveType.Sphere, v.root, Palette.Paper, new Vector3(-0.22f, 2.05f, 0f), Vector3.one * 0.22f, 0.8f).transform;
                v.carry1 = Prim(PrimitiveType.Sphere, v.root, Palette.Paper, new Vector3(0.22f, 2.05f, 0f), Vector3.one * 0.22f, 0.8f).transform;
                v.formBall = Prim(PrimitiveType.Sphere, v.root, Palette.Paper, new Vector3(0f, 0.15f, 0.45f), Vector3.one * 0.3f, 0.8f).transform;
                foreach (var t in new[] { v.carry0, v.carry1, v.formBall }) t.GetComponent<Renderer>().sharedMaterial = white;
                v.snowman = Snowman(v.root);
                v.snowman.SetActive(false);
                views.Add(v);
            }
            marker = Part(null, "Ziel", Torus(0.7f, 0.07f, 40, 6), Toon(Palette.Accent, 0f, 0f, Palette.Accent * 1.6f), Vector3.zero, null, false).transform;
            marker.gameObject.SetActive(false);
            me = seats.FindIndex(s => s.isPlayer);
            top = Online && (MatchBridge.Setup.view == "top" || me < 0);
            focus = new GameObject("Kamerafokus").transform;
            // Draufsicht: the whole winter arena from above; otherwise the chase camera behind the own player.
            rig = top ? CameraRig.Create(focus, 34f, 70f, 55f, Vector3.zero) : CameraRig.Create(focus, 9.5f, 34f, 55f, Vector3.zero);
            rig.composer.TargetOffset = top ? Vector3.zero : new Vector3(0f, 1f, 0f);
            var comp = rig.composer.Composition; comp.ScreenPosition = new Vector2(0f, top ? 0.04f : 0.1f); rig.composer.Composition = comp;
            rig.recenterAfter = top ? 0f : 9999f;
            hud.AddChip("time", "120 s");
            hud.AddChip("balls", "Bälle 1/2");
            hud.AddAction("b", Hud.Icon.Grab, "Formen", Hud.Tone.Cyan);
            hud.AddAction("a", Hud.Icon.Dive, "Werfen", Hud.Tone.Gold);
            NewSim();
            if (Online) { hud.SetControlsVisible(false); MatchBridge.Register(this); }
        }

        protected override void OnBegin() { if (!Online) NewSim(); }

        void NewSim()
        {
            sim = new SnowSim(seats.Count);
            acc = 0f;
            foreach (var t in ballViews.Values) Destroy(t.gameObject);
            ballViews.Clear();
            for (int i = 0; i < views.Count; i++)
            {
                var v = views[i]; v.p = sim.players[i];
                v.root.position = World(v.p.x, v.p.y);
                v.yaw = Mathf.Atan2(v.p.fx, -v.p.fy) * Mathf.Rad2Deg;
                v.figure.gameObject.SetActive(true); v.snowman.SetActive(false);
            }
            var own = views[Mathf.Max(0, me)];
            focus.position = top ? Vector3.zero : own.root.position;
            rig.Snap(top ? 0f : own.yaw);
            Strips();
        }

        GameObject Snowman(Transform parent)
        {
            var root = new GameObject("Schneemann");
            root.transform.SetParent(parent, false);
            var white = Toon(Palette.Hex("#f4f9ff"), 1.2f, 0.3f);
            foreach (var (y, s) in new[] { (0.45f, 0.95f), (1.15f, 0.7f), (1.7f, 0.48f) })
                Prim(PrimitiveType.Sphere, root.transform, Palette.Paper, new Vector3(0f, y, 0f), Vector3.one * s, 1.2f).GetComponent<Renderer>().sharedMaterial = white;
            var nose = Part(root.transform, "Rübe", Cone(6), Toon(Palette.Warn, 0.6f), new Vector3(0f, 1.72f, 0.22f), new Vector3(0.07f, 0.3f, 0.07f));
            nose.transform.localRotation = Quaternion.Euler(90f, 0f, 0f);
            foreach (var x in new[] { -0.1f, 0.1f }) Prim(PrimitiveType.Sphere, root.transform, Palette.Ink, new Vector3(x, 1.8f, 0.2f), Vector3.one * 0.07f, 0f);
            Cyl(root.transform, Palette.Ink, new Vector3(0f, 2f, 0f), 0.2f, 0.3f, 0f);
            return root;
        }

        void BuildArena()
        {
            var world = new GameObject("Winterarena").transform;
            var snow = Palette.Hex("#eef5ff");
            Cyl(world, Palette.Hex("#dce9fb"), new Vector3(0f, -0.15f, 0f), 60f, 0.3f, 0f).name = "Schneefeld";
            Box(world, snow, new Vector3(0f, -0.05f, 0f), new Vector3(SnowSim.Size, 0.1f, SnowSim.Size), 0.6f).name = "Arena";
            var drift = Toon(Palette.Hex("#f6faff"), 0f, 0.2f);
            for (int i = 0; i < 40; i++)
            {
                float a = i * 2.39996f, r = 1.5f + (i % 9) * 1.1f;
                var p = new Vector3(Mathf.Cos(a) * r, 0f, Mathf.Sin(a) * r);
                var d = Prim(PrimitiveType.Sphere, world, snow, p, new Vector3(1.4f + (i % 3) * 0.4f, 0.18f, 1.1f), 0f);
                d.GetComponent<Renderer>().sharedMaterial = drift;
                d.GetComponent<Renderer>().shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off;
            }
            // Fence around the arena.
            var wood = Palette.Hex("#8a5a3c");
            float h = SnowSim.Size / 2f + 0.3f;
            for (float t = -h; t <= h + 0.01f; t += 2f)
                foreach (var p in new[] { new Vector3(t, 0.5f, -h), new Vector3(t, 0.5f, h), new Vector3(-h, 0.5f, t), new Vector3(h, 0.5f, t) })
                    Box(world, wood, p, new Vector3(0.18f, 1f, 0.18f), 0.8f);
            foreach (var (p, s) in new[] { (new Vector3(0f, 0.7f, -h), new Vector3(2f * h, 0.12f, 0.1f)), (new Vector3(0f, 0.7f, h), new Vector3(2f * h, 0.12f, 0.1f)), (new Vector3(-h, 0.7f, 0f), new Vector3(0.1f, 0.12f, 2f * h)), (new Vector3(h, 0.7f, 0f), new Vector3(0.1f, 0.12f, 2f * h)) })
                Box(world, wood, p, s, 0.6f);
            // Snow walls and pines from the rules.
            var wallMat = Toon(Palette.Hex("#f4f9ff"), 1.3f, 0.35f);
            foreach (var w in SnowSim.Walls)
            {
                var c = World((w.x0 + w.x1) / 2f, (w.y0 + w.y1) / 2f, 0.6f);
                var b = Box(world, Palette.Paper, c, new Vector3(w.x1 - w.x0, 1.2f, w.y1 - w.y0), 1.3f);
                b.GetComponent<Renderer>().sharedMaterial = wallMat;
                Box(world, Palette.Paper, c + Vector3.up * 0.63f, new Vector3(w.x1 - w.x0 + 0.12f, 0.08f, w.y1 - w.y0 + 0.12f), 0f);
            }
            var cone = Cone(7);
            foreach (var t in SnowSim.Trees)
            {
                var p = World(t.x, t.y);
                Cyl(world, Palette.Hex("#6b4a3a"), p + Vector3.up * 0.4f, 0.16f, 0.8f, 0.8f);
                Color[] leaves = { Palette.Hex("#245e3a"), Palette.Hex("#2f7a46"), Palette.Hex("#3f9558") };
                for (int i = 0; i < 3; i++)
                {
                    float w = 1.25f - i * 0.3f;
                    Part(world, "Tanne", cone, Toon(leaves[i], 1f, 0.15f), p + Vector3.up * (0.7f + i * 0.75f), new Vector3(w, 1.5f, w));
                    Part(world, "Schneehaube", cone, Toon(Palette.Paper, 0f, 0.2f), p + Vector3.up * (1.45f + i * 0.75f), new Vector3(w * 0.42f, 0.55f, w * 0.42f), false);
                }
            }
            var pileMat = Toon(Palette.Hex("#ffffff"), 1f, 0.35f);
            foreach (var pile in new SnowSim(1).piles)
            {
                var mound = Prim(PrimitiveType.Sphere, null, Palette.Paper, World(pile.x, pile.y, 0.05f), new Vector3(1.5f, 0.6f, 1.5f), 1f);
                mound.GetComponent<Renderer>().sharedMaterial = pileMat;
                mound.name = "Schneehaufen";
                pileViews.Add(mound.transform);
            }
            var fall = Fx.Looping("Schneefall", world, new Vector3(30f, 0.1f, 30f), Palette.Paper, 60f, 7f, 1.4f, 0.09f, false, Vector3.down);
            fall.transform.localPosition = new Vector3(0f, 12f, 0f);
            StaticBatchingUtility.Combine(world.gameObject);
        }

        // ---- play ----------------------------------------------------------------------------

        Vector2 ViewDir()
        {
            var f = Camera.main ? Camera.main.transform.forward : Vector3.forward;
            var d = new Vector2(f.x, -f.z);
            return d.sqrMagnitude > 1e-6f ? d.normalized : new Vector2(0f, -1f);
        }

        void Update()
        {
            if (sim == null) return;
            if ((phase == Phase.Play || phase == Phase.Countdown) && !top)
            {
                if (hud.Look.sqrMagnitude > 0.01f) rig.Swipe(hud.Look);
            }
            if (Online)
            {
                if (!built) return;
                var self = Own;
                tapTarget = self == null || self.Out ? null : sim.Target(self, ViewDir(), SnowSim.PlayerCone);
                if (Playing && ControlsVisible)
                {
                    var dir = rig.Relative(hud.Stick);
                    if (hud.Pressed("a"))
                    {
                        // Tap: at the opponent marked within ±11° of the view, else straight ahead (the room applies the same rule).
                        var aim = tapTarget != null ? new Vector2(tapTarget.x - self.x, tapTarget.y - self.y).normalized : ViewDir();
                        MatchBridge.Input(dir.x, -dir.z, aim.x, aim.y, now: true);
                        MatchBridge.Press("a");
                    }
                    else MatchBridge.Input(dir.x, -dir.z, 0f, 0f);
                    if (hud.Pressed("b")) { MatchBridge.Press("b"); Sfx.Play("click", 0.6f); }
                }
                Draw();
                UpdateHud();
                return;
            }
            if (phase == Phase.Play)
            {
                var d = rig.Relative(hud.Stick);
                playerDir = new Vector2(d.x, -d.z);
                if (hud.Pressed("a")) pendingThrow = true;
                if (hud.Pressed("b")) pendingForm = true;
                acc += Time.deltaTime;
                int guard = 0;
                while (acc >= StepTime && !sim.done && guard++ < 6) { acc -= StepTime; Tick(); }
                if (sim.done) Finish();
            }
            tapTarget = sim.players[0].Out ? null : sim.Target(sim.players[0], ViewDir(), SnowSim.PlayerCone);
            Draw();
            UpdateHud();
        }

        void Tick()
        {
            var inputs = new Vector2[views.Count];
            var hold = new bool[views.Count];
            inputs[0] = playerDir;
            var throws = new List<(int seat, Vector2? aim)>();
            if (pendingForm) { pendingForm = false; sim.Form(0); Sfx.Play("click", 0.6f); }
            if (pendingThrow)
            {
                pendingThrow = false;
                var me = sim.players[0];
                var aim = tapTarget != null ? new Vector2(tapTarget.x - me.x, tapTarget.y - me.y).normalized : ViewDir();
                throws.Add((0, aim));
            }
            for (int i = 1; i < views.Count; i++)
            {
                var (move, form, aim, now) = sim.Bot(i);
                inputs[i] = move; hold[i] = form;
                if (now) throws.Add((i, aim));
            }
            sim.runInput = inputs;
            foreach (var (seat, aim) in throws) if (!sim.Throw(seat, aim, seat == 0 ? SnowSim.PlayerCone : SnowSim.Assist, seat != 0) && seat == 0) Sfx.Play("blip", 0.4f, 0.7f);
            sim.Step(StepTime, inputs, hold);
            foreach (var e in sim.events) Event(e);
            sim.events.Clear();
            Strips();
        }

        void Event(SnowEvent e)
        {
            bool mine = me >= 0 && (e.a == me || e.b == me);
            switch (e.kind)
            {
                case "throw":
                    Sfx.Play("whoosh", e.a == me ? 0.8f : 0.35f, 1.4f);
                    views[e.a].figure.Shot("punch", 0.35f, 0.05f, 1.4f);
                    break;
                case "splat": Fx.Splash(World(e.x, e.y, 1f), Palette.Paper, 8); Sfx.Play("splash", 0.25f, 1.5f); break;
                case "hit":
                    Fx.Splash(World(e.x, e.y, 1.2f), Palette.Paper, 18);
                    Sfx.Play("hit", mine ? 0.9f : 0.4f, 1.2f);
                    views[e.a].figure.Shot("hitLight", 0.5f);
                    if (e.a == me) { hud.Toast($"Getroffen! {sim.players[me].hits * 10} % langsamer", Palette.Seesaw, 0.9f); Fx.Shake(0.3f); }
                    else if (me >= 0 && e.b == me) { hud.Toast("Treffer!", Palette.Accent, 0.6f); Sfx.Play("chime", 0.7f, 1.3f); }
                    break;
                case "frozen":
                    var v = views[e.a];
                    Fx.Splash(v.root.position + Vector3.up, Palette.Paper, 40);
                    Sfx.Play("crack", 0.9f);
                    v.figure.gameObject.SetActive(false); v.snowman.SetActive(true);
                    if (e.a == me) hud.Toast("Du bist ein Schneemann!", Palette.Seesaw, 1.3f);
                    else if (me >= 0 && e.b == me) { hud.Toast("Schneemann! Erwischt", Palette.Accent, 1f); Sfx.Play("fanfare", 0.6f); }
                    break;
                case "formed": if (e.a == me) { Sfx.Play("chime", 0.6f, 1.5f); Fx.Sparks(views[me].root.position + Vector3.up * 2f, Palette.Paper, 6); } break;
                case "pickup": if (e.a == me) { hud.Toast("Schneeball aufgehoben!", Palette.Paper, 0.6f); Sfx.Play("chime", 0.6f, 1.2f); } break;
            }
        }

        void Draw()
        {
            float dt = Time.deltaTime;
            foreach (var v in views)
            {
                var p = v.p;
                if (p.Out) continue;
                var target = World(p.x, p.y);
                var vel = (target - v.root.position) / Mathf.Max(dt, 1e-4f);
                v.root.position = Vector3.Lerp(v.root.position, target, 1f - Mathf.Exp(-25f * dt));
                v.yaw = Mathf.LerpAngle(v.yaw, Mathf.Atan2(p.fx, -p.fy) * Mathf.Rad2Deg, 1f - Mathf.Exp(-14f * dt));
                v.root.rotation = Quaternion.Euler(0f, v.yaw, 0f);
                float speed = new Vector2(vel.x, vel.z).magnitude;
                bool forming = p.form > 0f;
                v.figure.Loop(forming ? "crouch" : speed > 0.5f ? "jog" : "idle", 0.12f, speed > 0.5f ? Mathf.Clamp(speed / 3.5f, 0.7f, 1.3f) : 1f);
                v.figure.Tick(vel, dt);
                v.carry0.gameObject.SetActive(p.balls >= 1);
                v.carry1.gameObject.SetActive(p.balls >= 2);
                v.formBall.gameObject.SetActive(forming);
                v.formBall.localScale = Vector3.one * (0.1f + 0.3f * Mathf.Clamp01(p.form / SnowSim.FormMs));
            }
            foreach (var b in sim.balls)
            {
                if (!ballViews.TryGetValue(b.id, out var t))
                {
                    t = Prim(PrimitiveType.Sphere, null, Palette.Paper, World(b.x, b.y, 1.2f), Vector3.one * 0.4f, 0.8f).transform;
                    ballViews[b.id] = t;
                }
                float traveled = Mathf.Sqrt((b.x - b.sx) * (b.x - b.sx) + (b.y - b.sy) * (b.y - b.sy)) / SnowSim.Range;
                t.position = World(b.x, b.y, 1.2f + traveled * (1f - traveled) * 2.4f);
            }
            foreach (var id in ballViews.Keys.ToList()) if (sim.balls.All(b => b.id != id)) { Destroy(ballViews[id].gameObject); ballViews.Remove(id); }
            for (int i = 0; i < pileViews.Count; i++)
            {
                var pile = sim.piles[i];
                float k = sim.time >= pile.readyAt ? 1f : 1f - Mathf.Clamp01((pile.readyAt - sim.time) / SnowSim.PileRespawn);
                pileViews[i].localScale = new Vector3(1.5f, 0.6f, 1.5f) * Mathf.Lerp(0.25f, 1f, k);
            }
            marker.gameObject.SetActive(tapTarget != null && phase == Phase.Play);
            if (tapTarget != null) { marker.position = views[tapTarget.seat].root.position + Vector3.up * 0.05f; marker.localScale = Vector3.one * (1f + Mathf.Sin(Time.time * 6f) * 0.08f); }
            if (top) focus.position = Ease.Damp(focus.position, me >= 0 && !views[me].p.Out ? views[me].root.position * 0.2f : Vector3.zero, 3f, Time.unscaledDeltaTime);
            else focus.position = views[Mathf.Max(0, me)].root.position;
        }

        void UpdateHud()
        {
            var me = sim.players[Mathf.Max(0, this.me)];
            hud.SetChip("time", $"{Mathf.CeilToInt(Mathf.Max(0f, (SnowSim.MaxMs - sim.time) / 1000f))} s");
            hud.SetChip("balls", $"Bälle {me.balls}/{SnowSim.MaxBalls}");
            SetTimer(1f - sim.time / SnowSim.MaxMs);
            hud.SetActionEnabled("a", me.balls > 0);
            hud.SetActionEnabled("b", me.balls < SnowSim.MaxBalls);
            hud.SetCooldown("b", me.form > 0f ? 1f - me.form / SnowSim.FormMs : 0f);
            if (phase == Phase.Play || Online) hud.SetControlsVisible(ControlsVisible && phase == Phase.Play);
        }

        void Strips()
        {
            foreach (var v in views)
                Strip(v.seat, v.p.Out ? "· Schneemann" : $"· {v.p.hits}/3 · {v.p.dealt} Treffer", false, v.p.Out);
        }

        // ---- online: snapshots of the room (snowball.ts) ----------------------------------------

        [System.Serializable] class SnapPlayer { public string id; public float x, y, fx, fy, form, lastThrow, hitAt, outAt; public int balls, hits, dealt; public bool forming; }
        [System.Serializable] class SnapBall { public int id, owner; public float x, y, vx, vy, sx, sy, born; }
        [System.Serializable] class SnapPile { public float x, y, readyAt; }
        [System.Serializable] class Snap { public int time; public bool done; public SnapPlayer[] players; public SnapBall[] balls; public SnapPile[] piles; public OnlineEvent[] events; }

        public void OnSnapshot(string json)
        {
            var snap = JsonUtility.FromJson<Snap>(json);
            if (snap?.players == null || snap.players.Length != views.Count) return;
            var byId = new Dictionary<string, int>();
            for (int i = 0; i < views.Count; i++)
            {
                var s = snap.players[i];
                var p = sim.players[i];
                byId[s.id] = i;
                bool wasOut = p.Out;
                p.x = s.x; p.y = s.y; p.fx = s.fx; p.fy = s.fy; p.form = s.form; p.forming = s.forming; p.lastThrow = s.lastThrow; p.hitAt = s.hitAt; p.outAt = s.outAt;
                p.balls = s.balls; p.hits = s.hits; p.dealt = s.dealt;
                if (!built) { views[i].root.position = World(p.x, p.y); views[i].yaw = Mathf.Atan2(p.fx, -p.fy) * Mathf.Rad2Deg; }
                if (built && wasOut && !p.Out) { views[i].figure.gameObject.SetActive(true); views[i].snowman.SetActive(false); }
            }
            sim.time = snap.time; sim.done = snap.done;
            var current = new HashSet<int>();
            sim.balls = (snap.balls ?? new SnapBall[0]).Select(b => { current.Add(b.id); return new Ball { id = b.id, owner = b.owner, x = b.x, y = b.y, vx = b.vx, vy = b.vy, sx = b.sx, sy = b.sy, born = b.born }; }).ToList();
            var gone = lastBalls.Where(kv => !current.Contains(kv.Key)).Select(kv => kv.Value).ToList();
            lastBalls.Clear();
            foreach (var b in sim.balls) lastBalls[b.id] = new Vector2(b.x, b.y);
            if (snap.piles != null) for (int i = 0; i < sim.piles.Count && i < snap.piles.Length; i++) sim.piles[i].readyAt = snap.piles[i].readyAt;
            bool first = !built;
            built = true;
            if (first && me >= 0 && !top) { focus.position = views[me].root.position; rig.Snap(views[me].yaw); }
            RoomEvents(snap.events, byId, gone);
            Strips();
        }

        void RoomEvents(OnlineEvent[] events, Dictionary<string, int> byId, List<Vector2> gone)
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
                if (e.kind == "splat")
                {
                    var at = gone.Count > 0 ? gone[0] : Vector2.zero;
                    if (gone.Count > 0) gone.RemoveAt(0);
                    Event(new SnowEvent { kind = "splat", x = at.x, y = at.y });
                    continue;
                }
                if (a < 0) continue;
                var p = sim.players[a];
                Event(new SnowEvent { kind = e.kind, a = a, b = b, x = p.x, y = p.y });
            }
        }

        public void OnAim(Vector2 aim) { }
        public void OnTurn(float delta) { if (!top) rig.Swipe(new Vector2(delta * Mathf.Rad2Deg / Mathf.Max(0.01f, rig.swipeYaw), 0f)); }

        protected override List<(Seat seat, string value)> Ranking() =>
            sim.Standings().Select(p => (seats[p.seat], $"{(p.Out ? "Schneemann" : sim.winner == p.seat ? "Letzter im Schnee" : "steht noch")} · {p.dealt} Treffer")).ToList();
    }
}
