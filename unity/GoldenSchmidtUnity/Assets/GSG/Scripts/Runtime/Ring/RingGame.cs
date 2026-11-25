using System.Collections.Generic;
using System.Linq;
using UnityEngine;
using static GSG.Kit;

namespace GSG.Ring
{
    /// <summary>
    /// Sumo Smash and Bumper Mayhem in Unity: the rules run as the app's ring engine
    /// (<see cref="RingSim"/>, 50-ms steps, interpolated drawing); Unity adds the podium over the
    /// lake or the neon rink, figures and bumper cars, falls, effects, sound and camera.
    /// </summary>
    public class RingGame : MatchGame, IOnlineMatch
    {
        public bool bumper;
        const float StepTime = 0.05f, FigureScale = 1.1f;

        class View
        {
            public Seat seat;
            public Fighter f;
            public Transform root, model;
            public Figure figure;
            public Vector3 prev, cur;
            public bool wasOut, falling, splashed;
            public Vector3 fallFrom, fallVel;
            public float fallT, dropT = 1f, yaw, size = 1f, punch;
            public GameObject shield;
            public Renderer spark;
        }

        RingSim sim;
        RingRules rules;
        readonly List<View> views = new();
        Transform arenaScale, rim;
        Material rimMat;
        readonly List<Transform> posts = new();
        readonly Dictionary<int, Transform> itemViews = new(), slickViews = new();
        Transform wheel;
        float acc;
        bool pendingPress, shrinkWarned, suddenShown;
        Vector2 playerDir;
        // Online: the own seat (−1 = watching), the chosen view and the room's snapshot clock.
        int me;
        bool chase, built;
        float snapAt, snapInterval = 0.05f;
        int lastSnapTime, lastEvent = -1;

        protected override string GameName => bumper ? "Bumper Mayhem" : "Sumo Smash";
        protected override string Intro => bumper
            ? "Lenke mit dem Stick, dein Auto fährt von selbst. Turbo (alle 4 s) macht Rammstöße härter. Fahr durch Kisten: Gold = Riesenauto, Schwarz = Ölfleck, Türkis = Schockwelle. Ramme die anderen über den Rand: +2 pro Ring-Out. 3 Leben, ab 45 s schrumpft die Fläche."
            : "Bewege dich mit dem Stick, der Stoß (alle 2,5 s) schleudert getroffene Gegner davon. Wer vom Podest fällt, verliert eines von 3 Leben; wer den Sturz verursacht, bekommt +2. Ab 40 s schrumpft der Ring. Letzter im Ring gewinnt.";
        protected override string ResultText => "+2 für jeden verursachten Ring-Out. Nach 75 Sekunden zählen Leben, dann Ring-Outs.";
        protected override bool ControlsVisible => sim != null && me >= 0 && sim.fighters[me].alive && (!Online || built);

        protected override void Setup()
        {
            rules = bumper ? new BumperRules() : new SumoRules();
            if (bumper) BuildRink(); else BuildPodium();
            foreach (var seat in seats) views.Add(MakeView(seat));
            me = seats.FindIndex(s => s.isPlayer);
            chase = Online && me >= 0 && MatchBridge.Setup.view == "third";
            focus = new GameObject("Kamerafokus").transform;
            if (chase)
            {
                // 3rd person: close behind the own fighter; it starts behind the body, afterwards only a swipe turns it.
                rig = CameraRig.Create(focus, bumper ? 9f : 8f, bumper ? 30f : 34f, 56f, Vector3.zero);
                rig.recenterAfter = float.PositiveInfinity;
            }
            else
            {
                rig = CameraRig.Create(focus, bumper ? 24f : 23f, bumper ? 54f : 62f, 54f, Vector3.zero);
                rig.recenterAfter = 0f;
            }
            rig.composer.TargetOffset = chase ? Vector3.up * 0.8f : Vector3.zero;
            var comp = rig.composer.Composition; comp.ScreenPosition = new Vector2(0f, chase ? 0.12f : 0.06f); comp.DeadZone.Enabled = false; rig.composer.Composition = comp;
            hud.AddChip("time", "75 s");
            hud.AddAction("a", bumper ? Hud.Icon.Dive : Hud.Icon.Shove, bumper ? "Turbo" : "Stoß", Hud.Tone.Gold);
            NewSim();
            if (Online)
            {
                hud.SetControlsVisible(false);
                if (chase) { hud.ShowHint("3rd Person", "Oben wischen dreht die Kamera. Der Stick folgt der Blickrichtung."); Invoke(nameof(HideHint), 6f); }
                MatchBridge.Register(this);
            }
        }

        void HideHint() => hud.ShowHint(null, null);

        protected override void OnBegin() { if (!Online) NewSim(); }

        void NewSim()
        {
            sim = new RingSim(rules, seats.Count, Random.Range(1, 999999));
            acc = 0f; shrinkWarned = false; suddenShown = false;
            for (int i = 0; i < views.Count; i++)
            {
                var v = views[i];
                v.f = sim.fighters[i];
                v.cur = v.prev = new Vector3(v.f.x, 0f, v.f.y);
                v.falling = false; v.wasOut = false; v.root.gameObject.SetActive(true);
                v.yaw = Yaw(v.f.heading);
                v.root.SetPositionAndRotation(v.cur, Quaternion.Euler(0f, v.yaw, 0f));
            }
            foreach (var t in itemViews.Values) Destroy(t.gameObject);
            foreach (var t in slickViews.Values) Destroy(t.gameObject);
            itemViews.Clear(); slickViews.Clear();
            Strips();
        }

        static float Yaw(float heading) => Mathf.Atan2(Mathf.Cos(heading), Mathf.Sin(heading)) * Mathf.Rad2Deg;

        // ---- world ---------------------------------------------------------------------------

        void BuildPodium()
        {
            var world = new GameObject("Sumo-Insel").transform;
            Cyl(world, Palette.Hex("#3d7fc4"), new Vector3(0f, -3.1f, 0f), 80f, 0.2f, 0f).name = "See";
            Fx.Looping("Gischt", world, new Vector3(14f, 0.01f, 14f), Palette.Paper, 4f, 2f, 0.3f, 0.1f, false, Vector3.up).transform.localPosition = new Vector3(0f, -2.9f, 0f);
            arenaScale = new GameObject("Podest").transform;
            arenaScale.SetParent(world, false);
            float R = rules.radius;
            Cyl(arenaScale, Palette.Hex("#bfa483"), new Vector3(0f, -1.75f, 0f), R + 0.3f, 3.2f, 1.2f).name = "Sockel";
            Cyl(arenaScale, Palette.Hex("#d9a066"), new Vector3(0f, -0.15f, 0f), R, 0.3f, 1.2f).name = "Lehm";
            rimMat = Toon(Palette.Hex("#eadbb0"), 0f, 0.2f);
            rim = Part(arenaScale, "Strohring", Torus(R - 0.12f, 0.13f, 64, 8), rimMat, new Vector3(0f, 0.03f, 0f)).transform;
            foreach (var x in new[] { -0.8f, 0.8f }) Box(arenaScale, Palette.Paper, new Vector3(x, 0.01f, 0f), new Vector3(0.12f, 0.02f, 0.7f), 0f);
            // Shrine frame around the lake: torii in the north, lantern posts, mountains.
            var red = Palette.Hex("#d7352f");
            foreach (var x in new[] { -3.6f, 3.6f }) Cyl(world, red, new Vector3(x, 1.2f, 16f), 0.3f, 8.6f, 1f);
            Box(world, red, new Vector3(0f, 5.2f, 16f), new Vector3(9.6f, 0.5f, 0.6f));
            Box(world, Palette.Ink, new Vector3(0f, 5.6f, 16f), new Vector3(10.6f, 0.35f, 0.8f), 0f);
            Box(world, red, new Vector3(0f, 4.2f, 16f), new Vector3(8.2f, 0.3f, 0.4f));
            for (int i = 0; i < 6; i++)
            {
                float a = i / 6f * Mathf.PI * 2f + 0.3f, r = 9f;
                var p = new Vector3(Mathf.Cos(a) * r, 0f, Mathf.Sin(a) * r);
                Cyl(world, Palette.Hex("#6b4a3a"), p + new Vector3(0f, -1.2f, 0f), 0.15f, 3.8f, 0.8f);
                var lamp = Box(world, Palette.Gold, p + new Vector3(0f, 1f, 0f), new Vector3(0.5f, 0.6f, 0.5f), 0f);
                lamp.GetComponent<Renderer>().sharedMaterial = Toon(Palette.Gold, 0f, 0f, Palette.Gold * 1.6f);
            }
            var cone = Cone(7);
            for (int i = 0; i < 9; i++)
            {
                float a = i / 9f * Mathf.PI * 2f, r = 48f + (i % 3) * 8f, h = 10f + (i % 4) * 5f;
                var m = Part(world, "Berg", cone, Toon(Color.Lerp(Palette.ShadowCool, Palette.Night, (i % 3) * 0.25f), 0f, 0.1f), new Vector3(Mathf.Cos(a) * r, -3f, Mathf.Sin(a) * r), new Vector3(h * 0.9f, h, h * 0.9f));
                m.GetComponent<Renderer>().shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off;
                Part(world, "Schnee", cone, Toon(Palette.Paper, 0f, 0.1f), new Vector3(Mathf.Cos(a) * r, -3f + h * 0.72f, Mathf.Sin(a) * r), new Vector3(h * 0.25f, h * 0.28f, h * 0.25f), false);
            }
        }

        void BuildRink()
        {
            var world = new GameObject("Autoscooter").transform;
            arenaScale = new GameObject("Fläche").transform;
            arenaScale.SetParent(world, false);
            float R = rules.radius;
            Cyl(arenaScale, Palette.Hex("#2b2560"), new Vector3(0f, -0.2f, 0f), R, 0.4f, 0f).name = "Boden";
            for (int i = 1; i <= 3; i++) Part(arenaScale, "Linie", Torus(R * i / 4f, 0.025f, 64, 4), Toon(Palette.Hex("#4a3f9a"), 0f, 0f), new Vector3(0f, 0.005f, 0f), null, false);
            Part(arenaScale, "Unterseite", Lathe(new[] { new Vector2(0f, -3.2f), new Vector2(R * 0.35f, -2.8f), new Vector2(R * 0.85f, -1.4f), new Vector2(R, -0.4f) }, 64), Toon(Palette.Hex("#5a4fa0"), 1f, 0.3f), Vector3.zero);
            rimMat = Toon(Palette.Hex("#57e4cb"), 0f, 0f, Palette.Hex("#57e4cb") * 1.4f);
            rim = Part(arenaScale, "Neonrand", Torus(R, 0.11f, 72, 8), rimMat, new Vector3(0f, 0.06f, 0f), null, false).transform;
            for (int i = 0; i < 2; i++)
            {
                var post = new GameObject("Pfosten").transform;
                post.SetParent(world, false);
                Cyl(post, Palette.Pusher, new Vector3(0f, 0.7f, 0f), BumperRules.PostRadius, 1.4f, 1.2f);
                foreach (var y in new[] { 0.35f, 0.95f }) Cyl(post, Palette.Paper, new Vector3(0f, y, 0f), BumperRules.PostRadius + 0.02f, 0.18f, 0f);
                var cap = Cyl(post, Palette.Accent, new Vector3(0f, 1.48f, 0f), 0.35f, 0.16f, 0f);
                cap.GetComponent<Renderer>().sharedMaterial = Toon(Palette.Accent, 0f, 0f, Palette.Accent * 1.5f);
                posts.Add(post);
            }
            // Fairground in the dark: a slow ferris wheel and rings of bulbs far below the rink.
            wheel = new GameObject("Riesenrad").transform;
            wheel.SetParent(world, false);
            wheel.localPosition = new Vector3(0f, 6f, 26f);
            Part(wheel, "Kranz", Torus(9f, 0.22f, 64, 6), Toon(Palette.Hex("#ff86c8"), 0f, 0f, Palette.Hex("#ff86c8") * 0.9f), Vector3.zero, null, false).transform.localRotation = Quaternion.Euler(90f, 0f, 0f);
            for (int i = 0; i < 10; i++)
            {
                float a = i / 10f * 360f;
                var spoke = Box(wheel, Palette.Hex("#c9b9ff"), Vector3.zero, new Vector3(0.12f, 18f, 0.12f), 0f);
                spoke.transform.localRotation = Quaternion.Euler(0f, 0f, a);
                var g = Box(wheel, Palette.Players[i % Palette.Players.Length], Quaternion.Euler(0f, 0f, a) * new Vector3(0f, 9f, 0f), new Vector3(1.2f, 1f, 1.2f), 0f);
                g.GetComponent<Renderer>().sharedMaterial = Toon(Palette.Players[i % Palette.Players.Length], 0f, 0f, Palette.Players[i % Palette.Players.Length] * 0.6f);
            }
            var bulb = Toon(Palette.Accent, 0f, 0f, Palette.Accent * 2f);
            for (int ring = 0; ring < 2; ring++)
                for (int i = 0; i < 40; i++)
                {
                    float a = i / 40f * Mathf.PI * 2f, r = 13f + ring * 6f;
                    var b = Prim(PrimitiveType.Sphere, world, Palette.Accent, new Vector3(Mathf.Cos(a) * r, -5f - ring * 2f, Mathf.Sin(a) * r), Vector3.one * 0.35f, 0f);
                    b.GetComponent<Renderer>().sharedMaterial = bulb;
                    b.GetComponent<Renderer>().shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off;
                }
            Cyl(world, Palette.Hex("#150f33"), new Vector3(0f, -9f, 0f), 80f, 0.2f, 0f);
        }

        View MakeView(Seat seat)
        {
            var v = new View { seat = seat };
            v.root = new GameObject(seat.name).transform;
            v.model = new GameObject("Modell").transform;
            v.model.SetParent(v.root, false);
            if (bumper)
            {
                var c = seat.Color;
                Cyl(v.model, c, new Vector3(0f, 0.28f, 0f), 0.55f, 0.36f, 1.2f);
                Part(v.model, "Gummi", Torus(0.56f, 0.12f, 32, 8), Toon(Palette.Ink, 0f, 0.3f), new Vector3(0f, 0.2f, 0f));
                Box(v.model, Color.Lerp(c, Palette.Ink, 0.35f), new Vector3(0f, 0.62f, -0.3f), new Vector3(0.62f, 0.5f, 0.16f));
                Cyl(v.model, Palette.Paper, new Vector3(0f, 1.05f, -0.36f), 0.03f, 1.3f, 0f);
                var spark = Prim(PrimitiveType.Sphere, v.model, Palette.Accent, new Vector3(0f, 1.75f, -0.36f), Vector3.one * 0.16f, 0f);
                v.spark = spark.GetComponent<Renderer>();
                v.spark.sharedMaterial = Toon(Palette.Accent, 0f, 0f, Palette.Accent * 2f);
                var lamp = Box(v.model, Palette.Paper, new Vector3(0f, 0.36f, 0.55f), new Vector3(0.24f, 0.12f, 0.06f), 0f);
                lamp.GetComponent<Renderer>().sharedMaterial = Toon(Palette.Paper, 0f, 0f, Palette.Paper * 1.2f);
                var seatPoint = new GameObject("Sitz").transform;
                seatPoint.SetParent(v.model, false);
                seatPoint.localPosition = new Vector3(0f, 0.3f, -0.12f);
                v.figure = SpawnFigure(seat, seatPoint, 0.78f);
                v.figure.Loop("drive");
            }
            else
            {
                v.figure = SpawnFigure(seat, v.model, FigureScale);
            }
            // Protection after a return: a glowing ring at the feet, blinking.
            v.shield = Part(v.root, "Schutz", Torus(0.7f, 0.06f, 40, 6), Toon(Palette.Seesaw, 0f, 0f, Palette.Seesaw * 1.3f), new Vector3(0f, 0.05f, 0f), null, false);
            return v;
        }

        // ---- play ----------------------------------------------------------------------------

        void Update()
        {
            if (sim == null) return;
            if (Online)
            {
                if (!built) return;
                if (Playing && me >= 0)
                {
                    var self = sim.fighters[me];
                    var dir = rig.Relative(hud.Stick);
                    var move = self.alive && !self.isOut ? new Vector2(dir.x, dir.z) : Vector2.zero;
                    MatchBridge.Input(move.x, move.y, 0f, 0f);
                    if (hud.Pressed("a")) MatchBridge.Press("a");
                }
                if (chase) rig.Swipe(hud.Look);
                Draw(Fx.Reduced ? 1f : Mathf.Clamp01((Time.unscaledTime - snapAt) / snapInterval));
                UpdateHud();
                return;
            }
            if (phase == Phase.Play)
            {
                var own = sim.fighters[0];
                var d = rig.Relative(hud.Stick);
                playerDir = own.alive && !own.isOut ? new Vector2(d.x, d.z) : Vector2.zero;
                if (hud.Pressed("a")) pendingPress = true;
                acc += Time.deltaTime;
                int guard = 0;
                while (acc >= StepTime && !sim.done && guard++ < 6) { acc -= StepTime; Tick(); }
                if (sim.done) { Finish(); }
            }
            Draw(phase == Phase.Play ? Mathf.Clamp01(acc / StepTime) : 1f);
            UpdateHud();
        }

        void Tick()
        {
            foreach (var v in views) v.prev = v.cur;
            var inputs = new Vector2[views.Count];
            inputs[0] = playerDir;
            if (pendingPress) { pendingPress = false; if (!sim.Press(0)) Sfx.Play("blip", 0.4f, 0.7f); }
            for (int i = 1; i < views.Count; i++)
            {
                var (dir, act) = sim.BotInput(i);
                inputs[i] = dir;
                if (act) sim.Press(i);
            }
            sim.Step(StepTime, inputs);
            foreach (var v in views) v.cur = new Vector3(v.f.x, 0f, v.f.y);
            foreach (var e in sim.events) Event(e);
            sim.events.Clear();
            if (!shrinkWarned && !sim.sudden && sim.time >= rules.shrinkFrom - 1500f)
            {
                shrinkWarned = true;
                hud.Toast(bumper ? "Die Fläche schrumpft!" : "Der Ring schrumpft!", Palette.Warn, 1f);
                Sfx.Play("warn");
            }
            Strips();
        }

        void Event(RingEvent e)
        {
            View A = e.a >= 0 ? views[e.a] : null, B = e.b >= 0 ? views[e.b] : null;
            bool mine = me >= 0 && (e.a == me || e.b == me);
            switch (e.kind)
            {
                case "action":
                    if (bumper) { Sfx.Play("whoosh", mine ? 0.9f : 0.4f, 1.3f); Fx.Sparks(A.root.position + A.root.forward * -0.6f + Vector3.up * 0.3f, Palette.Warn, 10); }
                    else { Sfx.Play("whoosh", mine ? 0.9f : 0.4f); A.figure.Shot("dash", 0.32f, 0.05f, 1.4f); Fx.Dust(A.root.position, Palette.Paper, 5); }
                    break;
                case "strike":
                    A.punch = 1f; B.punch = 0.7f;
                    var at = (A.root.position + B.root.position) / 2f + Vector3.up * 0.8f;
                    Sfx.Play("hit", mine ? 1f : 0.6f);
                    Fx.Sparks(at, Palette.Accent, mine ? 16 : 10);
                    Fx.Shake(mine ? 0.5f : 0.2f);
                    if (mine) Fx.HitStop(0.06f);
                    if (!bumper) A.figure.Shot("hit", 0.5f, 0.05f, 1.2f);
                    break;
                case "bump":
                    Sfx.Play("thud", 0.5f, 1.2f);
                    break;
                case "bounce":
                    // Every contact answers: a springy wobble, a few sparks and a thud by impact.
                    float k = Mathf.Clamp01(e.v / 4f);
                    foreach (var v in new[] { A, B }) v.punch = Mathf.Max(v.punch, 0.35f + k * 0.65f);
                    Sfx.Play("thud", (mine ? 0.7f : 0.35f) * (0.5f + k), 1.35f - k * 0.4f);
                    if (bumper) Fx.Sparks((A.root.position + B.root.position) / 2f + Vector3.up * 0.4f, Palette.Seesaw, 3 + (int)(k * 8));
                    else { A.figure.Squash(); B.figure.Squash(); }
                    if (mine && k > 0.5f) Fx.Shake(0.15f * k);
                    break;
                case "out":
                    StartFall(A);
                    if (B != null) Credit(B, "+2");
                    if (me >= 0 && e.a == me) { hud.Toast(sim.fighters[me].alive ? "Runter vom Ring!" : "Ausgeschieden!", Palette.Warn, 1f); Sfx.Play("lose", 0.8f); }
                    else if (me >= 0 && e.b == me) { hud.Toast("Ring-Out! +2", Palette.Accent, 0.9f); Sfx.Play("chime"); }
                    else Sfx.Play("whoosh", 0.4f, 0.7f);
                    break;
                case "reset":
                    foreach (var v in views) v.prev = v.cur;
                    hud.Toast("Zurück auf die Startplätze!", Palette.Paper, 0.9f);
                    break;
                case "sudden":
                    foreach (var v in views) v.prev = v.cur;
                    hud.Toast("Sudden Death!", Palette.Warn, 1.2f);
                    Sfx.Play("warn");
                    break;
                case "item": Sfx.Play("blip", 0.5f, 1.4f); break;
                case "mega": Sfx.Play("rumble", mine ? 1f : 0.5f); if (mine) hud.Toast("Riesenauto!", Palette.Accent, 0.9f); Fx.Glow(A.root.position + Vector3.up, Palette.Accent, 12); break;
                case "oil": Sfx.Play("splash", mine ? 0.8f : 0.4f, 0.7f); if (mine) hud.Toast("Ölfleck gelegt!", Palette.Paper, 0.8f); break;
                case "wave":
                    Sfx.Play("whoosh", 1f, 0.6f); Fx.Shake(0.35f);
                    Fx.Splash(A.root.position + Vector3.up * 0.4f, Palette.Seesaw, 24);
                    if (mine) hud.Toast("Schockwelle!", Palette.Seesaw, 0.8f);
                    break;
                case "slip": Sfx.Play("splash", e.a == me ? 0.9f : 0.4f, 1.3f); if (me >= 0 && e.a == me) hud.Toast("Ausgerutscht!", Palette.Warn, 0.7f); break;
            }
        }

        void Credit(View v, string text)
        {
            hud.Toast(text, Palette.Accent, 0.4f);
            Fx.Sparks(v.root.position + Vector3.up * 1.8f, Palette.Accent, 8);
        }

        void StartFall(View v)
        {
            v.falling = true; v.splashed = false; v.fallT = 0f;
            v.fallFrom = v.root.position;
            var drift = (v.cur - v.prev) / StepTime;
            var outward = new Vector3(v.cur.x, 0f, v.cur.z).normalized;
            v.fallVel = drift * 0.7f + outward * 2.5f + Vector3.up * 3f;
            if (!bumper) v.figure.Shot("air", 2f, 0.1f);
        }

        void Draw(float alpha)
        {
            float now = sim.time, dt = Time.deltaTime;
            float scale = sim.radius / rules.radius;
            arenaScale.localScale = new Vector3(scale, 1f, scale);
            bool warn = !sim.sudden && sim.time > rules.shrinkFrom - 1500f && sim.time < rules.shrinkTo;
            rimMat.SetColor("_EmissionColor", warn ? Palette.Warn * (0.6f + 0.6f * Mathf.Sin(Time.time * 8f)) : (bumper ? Palette.Hex("#57e4cb") * 1.4f : Color.black));
            for (int i = 0; i < posts.Count && i < sim.obstacles.Count; i++)
            {
                var o = sim.obstacles[i];
                posts[i].position = new Vector3(o.x, 0f, o.y);
                posts[i].rotation = Quaternion.Euler(0f, -o.angle * Mathf.Rad2Deg * 3f, 0f);
            }
            if (wheel) wheel.localRotation = Quaternion.Euler(0f, 0f, Time.time * 6f);
            SyncItems();
            foreach (var v in views)
            {
                var f = v.f;
                if (!f.isOut && v.wasOut) { v.dropT = 0f; v.falling = false; v.prev = v.cur; v.root.gameObject.SetActive(true); }
                v.wasOut = f.isOut;
                if (v.falling)
                {
                    v.fallT += dt;
                    var p = v.fallFrom + v.fallVel * v.fallT + 0.5f * Physics.gravity.y * 0.9f * v.fallT * v.fallT * Vector3.up;
                    v.root.position = p;
                    v.model.localRotation = Quaternion.Euler(v.fallT * 260f, 0f, v.fallT * 140f);
                    if (!bumper && !v.splashed && p.y < -3f) { v.splashed = true; Fx.Splash(new Vector3(p.x, -3f, p.z), Palette.Paper, 26); Sfx.Play("splash", v.seat.isPlayer ? 1f : 0.5f); }
                    if (p.y < -12f) v.root.gameObject.SetActive(false);
                    continue;
                }
                if (f.isOut || !f.alive) { v.root.gameObject.SetActive(false); continue; }
                v.model.localRotation = Quaternion.identity;
                var pos = Vector3.Lerp(v.prev, v.cur, alpha);
                float dropBefore = v.dropT;
                v.dropT = Mathf.Min(1f, v.dropT + dt / 0.4f);
                pos.y += (1f - Ease.OutCubic(v.dropT)) * 4f;
                if (dropBefore < 1f && v.dropT >= 1f) { Fx.Dust(pos, Palette.Paper, 6); Sfx.Play("land", 0.5f); v.figure.Squash(); }
                v.root.position = pos;
                float want = Yaw(f.heading);
                v.yaw = bumper ? Mathf.LerpAngle(v.yaw, want, 1f - Mathf.Exp(-25f * dt)) : Mathf.LerpAngle(v.yaw, want, 1f - Mathf.Exp(-12f * dt));
                v.root.rotation = Quaternion.Euler(0f, v.yaw, 0f);
                float target = bumper && BumperRules.Big(f, now) ? BumperRules.MegaScale : 1f;
                v.size = Mathf.Lerp(v.size, target, 1f - Mathf.Exp(-8f * dt));
                // Bounce wobble: squash and stretch that rings out (cars only; figures squash themselves).
                v.punch = Mathf.Max(0f, v.punch - dt * 3f);
                float wobble = bumper && !Fx.Reduced ? Mathf.Sin(Time.time * 38f) * v.punch * 0.22f : 0f;
                v.model.localScale = new Vector3(v.size * (1f + wobble), v.size * (1f - wobble), v.size * (1f + wobble));
                bool shielded = now < f.shieldUntil;
                v.shield.SetActive(shielded && Mathf.Repeat(Time.time * 6f, 1f) > 0.3f);
                var vel = new Vector3(f.vx, 0f, f.vy);
                if (bumper)
                {
                    v.spark.enabled = Mathf.Repeat(Time.time * 9f + v.seat.slot, 1f) > (now < f.actionUntil ? 0.1f : 0.6f);
                    if (now < f.actionUntil && Random.value < 0.5f) Fx.Sparks(pos - v.root.forward * 0.7f + Vector3.up * 0.3f, Palette.Warn, 2);
                }
                else
                {
                    bool stunned = now < f.stunUntil, dashing = now < f.actionUntil;
                    float speed = vel.magnitude;
                    if (!dashing) v.figure.Loop(stunned ? "hitLight" : speed > 0.6f ? "jog" : "idle", 0.12f, stunned ? 1f : Mathf.Clamp(speed / 3f, 0.8f, 1.5f));
                    v.figure.Tick(vel, dt);
                }
            }
            if (me < 0) { focus.position = Ease.Damp(focus.position, Vector3.zero, 3f, Time.unscaledDeltaTime); return; }
            var own = views[me];
            if (chase)
            {
                // 3rd person: right behind the own fighter; back to the middle while it is out.
                var at = own.f.alive && !own.f.isOut && !own.falling ? own.root.position : Vector3.zero;
                focus.position = Ease.Damp(focus.position, at, 10f, Time.unscaledDeltaTime);
                return;
            }
            // Camera: follows the own fighter part of the way, the ring stays in view.
            var goal = own.f.alive && !own.f.isOut ? new Vector3(own.root.position.x * 0.25f, 0f, own.root.position.z * 0.25f) : Vector3.zero;
            focus.position = Ease.Damp(focus.position, goal, 3f, Time.unscaledDeltaTime);
        }

        void SyncItems()
        {
            if (!bumper) return;
            foreach (var item in sim.items)
                if (!itemViews.ContainsKey(item.id))
                {
                    var c = item.kind == "mega" ? Palette.Accent : item.kind == "oil" ? Palette.Hex("#2a2a35") : Palette.Seesaw;
                    var box = Box(null, c, new Vector3(item.x, 0.5f, item.y), Vector3.one * 0.55f, 1.4f);
                    box.GetComponent<Renderer>().sharedMaterial = Toon(c, 1.4f, 0.3f, c * (item.kind == "oil" ? 0.2f : 0.7f));
                    box.name = "Kiste " + item.kind;
                    Fx.Glow(box.transform.position, c, 8);
                    itemViews[item.id] = box.transform;
                }
            foreach (var id in itemViews.Keys.ToList())
                if (sim.items.All(i => i.id != id)) { Fx.Sparks(itemViews[id].position, Palette.Accent, 10); Destroy(itemViews[id].gameObject); itemViews.Remove(id); }
            foreach (var t in itemViews.Values)
            {
                t.rotation = Quaternion.Euler(20f, Time.time * 90f, 15f);
                t.position = new Vector3(t.position.x, 0.5f + Mathf.Sin(Time.time * 3f + t.position.x) * 0.1f, t.position.z);
            }
            foreach (var o in sim.slicks)
                if (!slickViews.ContainsKey(o.id))
                {
                    var s = Cyl(null, Palette.Hex("#1c1a24"), new Vector3(o.x, 0.012f, o.y), BumperRules.OilRadius, 0.02f, 0f);
                    s.GetComponent<Renderer>().sharedMaterial = Toon(Palette.Hex("#1c1a24"), 0f, 0.6f);
                    s.GetComponent<Renderer>().shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off;
                    s.name = "Öl";
                    slickViews[o.id] = s.transform;
                }
            foreach (var id in slickViews.Keys.ToList())
                if (sim.slicks.All(o => o.id != id)) { Destroy(slickViews[id].gameObject); slickViews.Remove(id); }
        }

        void UpdateHud()
        {
            var own = sim.fighters[Mathf.Max(0, me)];
            float cool = me < 0 ? 0f : Mathf.Clamp01((rules.actionCooldown - (sim.time - own.actionAt)) / rules.actionCooldown);
            hud.SetCooldown("a", phase == Phase.Play ? cool : 0f);
            float left = sim.sudden ? (rules.suddenMax - (sim.time - sim.suddenStart)) / 1000f : (rules.regular - sim.time) / 1000f;
            hud.SetChip("time", sim.sudden ? $"Sudden Death {Mathf.CeilToInt(Mathf.Max(0f, left))} s" : $"{Mathf.CeilToInt(Mathf.Max(0f, left))} s");
            SetTimer(sim.sudden ? left * 1000f / rules.suddenMax : left * 1000f / rules.regular);
            if (phase == Phase.Play || Online) hud.SetControlsVisible(ControlsVisible && phase == Phase.Play);
        }

        void Strips()
        {
            foreach (var v in views)
            {
                var f = v.f;
                string text = f.alive ? $"· {f.lives} {(f.lives == 1 ? "Leben" : "Leben")}" : "· raus";
                if (f.ringOuts > 0) text += $" · +{f.ringOuts * 2}";
                Strip(v.seat, text, false, !f.alive);
            }
        }

        // ---- online: snapshots of the room (ringCore.ts, sumoSmash.ts, bumperMayhem.ts) ----------

        [System.Serializable] class SnapFighter { public string id; public float x, y, vx, vy, heading, respawnAt, shieldUntil, actionAt, actionUntil, stunUntil, bigUntil; public int lives, ringOuts; public bool alive, isOut; }
        [System.Serializable] class SnapItem { public int id; public string kind; public float x, y; }
        [System.Serializable] class SnapSlick { public int id; public string owner; public float x, y, until, armedAt; }
        [System.Serializable] class SnapPost { public int id; public float x, y, r, angle; }
        [System.Serializable] class Snap { public int time; public float radius, resetAt, suddenStart; public bool sudden, done; public SnapFighter[] fighters; public SnapItem[] items; public SnapSlick[] slicks; public SnapPost[] obstacles; public OnlineEvent[] events; }

        public void OnSnapshot(string json)
        {
            var snap = JsonUtility.FromJson<Snap>(json);
            if (snap?.fighters == null || snap.fighters.Length != views.Count) return;
            var byId = new Dictionary<string, int>();
            var before = new Vector2[views.Count];
            for (int i = 0; i < views.Count; i++)
            {
                var s = snap.fighters[i];
                var f = sim.fighters[i];
                var v = views[i];
                byId[s.id] = i;
                before[i] = new Vector2(f.vx, f.vy);
                f.x = s.x; f.y = s.y; f.vx = s.vx; f.vy = s.vy; f.heading = s.heading;
                f.lives = s.lives; f.ringOuts = s.ringOuts; f.alive = s.alive; f.isOut = s.isOut;
                f.respawnAt = s.respawnAt; f.shieldUntil = s.shieldUntil; f.actionAt = s.actionAt; f.actionUntil = s.actionUntil; f.stunUntil = s.stunUntil; f.bigUntil = s.bigUntil;
                v.prev = built ? v.cur : new Vector3(s.x, 0f, s.y);
                v.cur = new Vector3(s.x, 0f, s.y);
                if (!built) { v.yaw = Yaw(s.heading); v.root.SetPositionAndRotation(v.cur, Quaternion.Euler(0f, v.yaw, 0f)); }
            }
            bool first = !built;
            sim.time = snap.time; sim.radius = snap.radius; sim.sudden = snap.sudden; sim.suddenStart = snap.suddenStart; sim.resetAt = snap.resetAt; sim.done = snap.done;
            sim.items = (snap.items ?? new SnapItem[0]).Select(i => new RingItem { id = i.id, kind = i.kind, x = i.x, y = i.y }).ToList();
            sim.slicks = (snap.slicks ?? new SnapSlick[0]).Select(o => new Slick { id = o.id, owner = byId.TryGetValue(o.owner ?? "", out var k) ? k : -1, x = o.x, y = o.y, until = o.until, armedAt = o.armedAt }).ToList();
            if (snap.obstacles != null)
            {
                sim.obstacles.Clear();
                foreach (var o in snap.obstacles) sim.obstacles.Add(new Obstacle { id = o.id, x = o.x, y = o.y, r = o.r, angle = o.angle });
            }
            if (lastSnapTime > 0 && snap.time > lastSnapTime) snapInterval = Mathf.Clamp((snap.time - lastSnapTime) / 1000f, 0.03f, 0.25f);
            lastSnapTime = snap.time;
            snapAt = Time.unscaledTime;
            built = true;
            if (first && chase && me >= 0) rig.Snap(Yaw(sim.fighters[me].heading));
            RoomEvents(snap.events, byId, before);
            if (!shrinkWarned && !sim.sudden && sim.time >= rules.shrinkFrom - 1500f && sim.time < rules.shrinkTo)
            {
                shrinkWarned = true;
                hud.Toast(bumper ? "Die Fläche schrumpft!" : "Der Ring schrumpft!", Palette.Warn, 1f);
                Sfx.Play("warn");
            }
            Strips();
        }

        /// <summary>Room events as the same sounds, toasts and effects as locally; contacts show as bounces by their speed change.</summary>
        void RoomEvents(OnlineEvent[] events, Dictionary<string, int> byId, Vector2[] before)
        {
            var struck = new HashSet<int>();
            if (events != null)
            {
                // The first snapshot only sets the mark: no replay of what happened before this device joined.
                if (lastEvent < 0) lastEvent = events.Length > 0 ? events.Max(e => e.seq) : 0;
                foreach (var e in events.OrderBy(e => e.seq))
                {
                    if (e.seq <= lastEvent) continue;
                    lastEvent = e.seq;
                    int a = e.ids != null && e.ids.Length > 0 && byId.TryGetValue(e.ids[0], out var x) ? x : -1;
                    int b = e.ids != null && e.ids.Length > 1 && byId.TryGetValue(e.ids[1], out var y) ? y : -1;
                    if (e.kind == "strike") { struck.Add(a); struck.Add(b); }
                    if (e.kind == "reset" || e.kind == "sudden") foreach (var v in views) { v.cur = new Vector3(v.f.x, 0f, v.f.y); v.prev = v.cur; }
                    if ((e.kind == "out" || e.kind == "action" || e.kind == "strike" || e.kind == "mega" || e.kind == "wave" || e.kind == "slip" || e.kind == "bump") && a < 0) continue;
                    if (e.kind == "strike" && b < 0) continue;
                    Event(new RingEvent { kind = e.kind, a = a, b = b });
                }
            }
            // Ordinary contacts carry no event: a sudden speed change next to another body reads as a bounce.
            for (int i = 0; i < views.Count; i++)
            {
                var f = sim.fighters[i];
                if (struck.Contains(i) || !f.alive || f.isOut) continue;
                float jump = (new Vector2(f.vx, f.vy) - before[i]).magnitude;
                if (jump < 1.2f) continue;
                for (int j = i + 1; j < views.Count; j++)
                {
                    var o = sim.fighters[j];
                    if (struck.Contains(j) || !o.alive || o.isOut) continue;
                    float reach = rules.BodyOf(f, sim.time) + rules.BodyOf(o, sim.time) + 0.25f;
                    if ((new Vector2(f.x - o.x, f.y - o.y)).magnitude > reach) continue;
                    Event(new RingEvent { kind = "bounce", a = i, b = j, v = jump });
                    struck.Add(i); struck.Add(j);
                    break;
                }
            }
        }

        public void OnAim(Vector2 aim) { }
        public void OnTurn(float delta) { if (chase) rig.Swipe(new Vector2(delta * Mathf.Rad2Deg / Mathf.Max(0.01f, rig.swipeYaw), 0f)); }

        protected override List<(Seat seat, string value)> Ranking() =>
            sim.Standings().Select(f => (views[f.seat].seat, f.alive ? $"{f.lives} Leben · {f.ringOuts} Ring-Outs" : $"raus · {f.ringOuts} Ring-Outs")).ToList();
    }
}
