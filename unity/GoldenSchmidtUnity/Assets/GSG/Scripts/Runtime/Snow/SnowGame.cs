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
    public class SnowGame : MatchGame
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

        protected override string GameName => "Schneeballschlacht";
        protected override string Intro => "Du trägst höchstens zwei Schneebälle: „Formen“ tippen und kurz stehen bleiben, oder über einen Schneehaufen laufen. „Werfen“ trifft den nächsten Gegner im Bild (goldener Ring). Wischen dreht die Kamera. Jeder Treffer macht 10 % langsamer, nach drei Treffern bist du ein Schneemann. Wer zuletzt steht, gewinnt.";
        protected override string ResultText => "Nach zwei Minuten gewinnt, wer am wenigsten getroffen wurde, dann wer mehr getroffen hat.";
        protected override bool ControlsVisible => sim != null && !sim.players[0].Out;

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
            focus = new GameObject("Kamerafokus").transform;
            rig = CameraRig.Create(focus, 9.5f, 34f, 55f, Vector3.zero);
            rig.composer.TargetOffset = new Vector3(0f, 1f, 0f);
            var comp = rig.composer.Composition; comp.ScreenPosition = new Vector2(0f, 0.1f); rig.composer.Composition = comp;
            rig.recenterAfter = 9999f;
            hud.AddChip("time", "120 s");
            hud.AddChip("balls", "Bälle 1/2");
            hud.AddAction("b", Hud.Icon.Grab, "Formen", Hud.Tone.Cyan);
            hud.AddAction("a", Hud.Icon.Dive, "Werfen", Hud.Tone.Gold);
            NewSim();
        }

        protected override void OnBegin() => NewSim();

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
            focus.position = views[0].root.position;
            rig.Snap(views[0].yaw);
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
            if (phase == Phase.Play || phase == Phase.Countdown)
            {
                if (hud.Look.sqrMagnitude > 0.01f) rig.Swipe(hud.Look);
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
            tapTarget = sim.players[0].Out ? null : sim.Target(sim.players[0], ViewDir(), SnowSim.TapCone);
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
            foreach (var (seat, aim) in throws) if (!sim.Throw(seat, aim) && seat == 0) Sfx.Play("blip", 0.4f, 0.7f);
            sim.Step(StepTime, inputs, hold);
            foreach (var e in sim.events) Event(e);
            sim.events.Clear();
            Strips();
        }

        void Event(SnowEvent e)
        {
            bool mine = e.a == 0 || e.b == 0;
            switch (e.kind)
            {
                case "throw":
                    Sfx.Play("whoosh", e.a == 0 ? 0.8f : 0.35f, 1.4f);
                    views[e.a].figure.Shot("punch", 0.35f, 0.05f, 1.4f);
                    break;
                case "splat": Fx.Splash(World(e.x, e.y, 1f), Palette.Paper, 8); Sfx.Play("splash", 0.25f, 1.5f); break;
                case "hit":
                    Fx.Splash(World(e.x, e.y, 1.2f), Palette.Paper, 18);
                    Sfx.Play("hit", mine ? 0.9f : 0.4f, 1.2f);
                    views[e.a].figure.Shot("hitLight", 0.5f);
                    if (e.a == 0) { hud.Toast($"Getroffen! {sim.players[0].hits * 10} % langsamer", Palette.Seesaw, 0.9f); Fx.Shake(0.3f); }
                    else if (e.b == 0) { hud.Toast("Treffer!", Palette.Accent, 0.6f); Sfx.Play("chime", 0.7f, 1.3f); }
                    break;
                case "frozen":
                    var v = views[e.a];
                    Fx.Splash(v.root.position + Vector3.up, Palette.Paper, 40);
                    Sfx.Play("crack", 0.9f);
                    v.figure.gameObject.SetActive(false); v.snowman.SetActive(true);
                    if (e.a == 0) hud.Toast("Du bist ein Schneemann!", Palette.Seesaw, 1.3f);
                    else if (e.b == 0) { hud.Toast("Schneemann! Erwischt", Palette.Accent, 1f); Sfx.Play("fanfare", 0.6f); }
                    break;
                case "formed": if (e.a == 0) { Sfx.Play("chime", 0.6f, 1.5f); Fx.Sparks(views[0].root.position + Vector3.up * 2f, Palette.Paper, 6); } break;
                case "pickup": if (e.a == 0) { hud.Toast("Schneeball aufgehoben!", Palette.Paper, 0.6f); Sfx.Play("chime", 0.6f, 1.2f); } break;
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
            focus.position = views[0].root.position;
        }

        void UpdateHud()
        {
            var me = sim.players[0];
            hud.SetChip("time", $"{Mathf.CeilToInt(Mathf.Max(0f, (SnowSim.MaxMs - sim.time) / 1000f))} s");
            hud.SetChip("balls", $"Bälle {me.balls}/{SnowSim.MaxBalls}");
            SetTimer(1f - sim.time / SnowSim.MaxMs);
            hud.SetActionEnabled("a", me.balls > 0);
            hud.SetActionEnabled("b", me.balls < SnowSim.MaxBalls);
            hud.SetCooldown("b", me.form > 0f ? 1f - me.form / SnowSim.FormMs : 0f);
            if (phase == Phase.Play) hud.SetControlsVisible(ControlsVisible);
        }

        void Strips()
        {
            foreach (var v in views)
                Strip(v.seat, v.p.Out ? "· Schneemann" : $"· {v.p.hits}/3 · {v.p.dealt} Treffer", false, v.p.Out);
        }

        protected override List<(Seat seat, string value)> Ranking() =>
            sim.Standings().Select(p => (seats[p.seat], $"{(p.Out ? "Schneemann" : sim.winner == p.seat ? "Letzter im Schnee" : "steht noch")} · {p.dealt} Treffer")).ToList();
    }
}
