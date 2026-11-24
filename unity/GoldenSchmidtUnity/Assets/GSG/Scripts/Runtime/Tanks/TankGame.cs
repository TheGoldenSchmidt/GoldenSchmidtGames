using System;
using System.Collections.Generic;
using System.Linq;
using UnityEngine;
using static GSG.Kit;
using NVector2 = System.Numerics.Vector2;

namespace GSG.Tanks
{
    // Room snapshot of Tank Trouble (src/unityMatch.ts → unityTankSnapshot), flat for JsonUtility.
    [Serializable] class TankSnapTank { public string id, power; public int slot, hp, respawnAt, shieldUntil, powerUntil, kills, deaths; public bool seen, gone, alive; public float x, y, angle, aim; }
    [Serializable] class TankSnapBullet { public int id, slot; public float x, y; }
    [Serializable] class TankSnapPower { public int id; public string kind; public float x, y; }
    [Serializable] class TankSnap { public int time; public bool done, overtime; public string h, v; public TankSnapTank[] tanks; public TankSnapBullet[] bullets; public TankSnapPower[] powers; }

    /// <summary>
    /// Tank Trouble in Unity. Locally (Frei ausprobieren) the C# port <see cref="TankSim"/> runs the
    /// match against bots. Online the room authority computes with tankTrouble.ts/tankView.ts and this
    /// scene only draws its snapshots: top-down overview, or in 3rd/1st person a camera behind or in
    /// the own turret with everything outside the own sight in the dark (the room only sends what the
    /// own tank can see).
    /// </summary>
    public class TankGame : MatchGame, IOnlineMatch
    {
        const float StepTime = TankSim.StepMs / 1000f, BulletHeight = 0.45f, LowWall = 0.62f, TallWall = 1.15f;
        const float Sight = 6f;
        const int Rays = 160;
        sealed class View
        {
            public Transform root, hull, turret;
            public GameObject shield;
            public readonly GameObject[] pips = new GameObject[TankSim.Hp];
        }

        TankSim sim;
        Transform world, laser;
        Camera cam;
        Material steel, brick, cracked, tracer, laserMaterial;
        readonly List<View> views = new();
        GameObject[] walls;
        readonly Dictionary<int, Transform> bullets = new(), pickups = new();
        readonly HashSet<int> activeProps = new();
        readonly List<int> staleProps = new();
        float accumulator;
        bool shotPending;
        NVector2 shotAim;

        // Online rendering.
        string view = "top";
        int me;
        bool chase, built;
        bool[] seen = Array.Empty<bool>();
        float snapAt, snapInterval = 0.1f;
        int lastSnapTime;
        NVector2 onlineAim;
        float camYaw, manualPause, sentYaw = float.NaN, lastCamPost;
        bool camFresh = true, wasAlive;
        Vector3 eye, look;
        bool eyeReady;
        Mesh dark;
        Vector3[] darkVertices;

        protected override string GameName => "Tank Trouble";
        protected override string Intro => "Fahre links und ziehe rechts zum Zielen. Lass zum Schießen los oder tippe kurz für einen Schuss in die letzte Richtung. Kugeln prallen zweimal von festen Mauern ab. Ziegelmauern zerbrechen nach zwei Treffern. Sieben Abschüsse oder die beste Bilanz nach 90 Sekunden gewinnen.";
        protected override string ResultText => "Mehr Abschüsse und weniger Verluste entscheiden. Bei Gleichstand folgt ein Stechen.";
        protected override bool ControlsVisible => !Online && sim.Tanks[0].Alive;
        bool Mine(int i) => i == me;

        protected override void Setup()
        {
            world = new GameObject("Sandstein-Labyrinth").transform;
            cam = Camera.main;
            me = seats.FindIndex(s => s.isPlayer);
            if (Online) view = MatchBridge.Setup.view ?? "top";
            chase = Online && me >= 0 && (view == "third" || view == "first");
            steel = Toon(Palette.TankWall);
            brick = Toon(Palette.TankBrick);
            cracked = Toon(Palette.TankCracked);
            tracer = Toon(Palette.TankTrace, 0f, 0f, Palette.TankTrace * 1.8f);
            laserMaterial = Toon(Palette.TankLaser, 0f, 0f, Palette.TankLaser * 1.6f);
            BuildFloor();
            sim = new TankSim(seats.Count, (uint)UnityEngine.Random.Range(1, int.MaxValue));
            seen = Enumerable.Repeat(!Online, seats.Count).ToArray();
            if (!Online) { BuildWalls(); built = true; }
            foreach (var seat in seats) views.Add(BuildTank(seat));
            focus = me >= 0 ? views[me].root : world;
            laser = Box(world, Palette.TankLaser, Vector3.zero, Vector3.one, 0f).transform;
            laser.GetComponent<Renderer>().sharedMaterial = laserMaterial;
            laser.GetComponent<Renderer>().shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off;
            if (chase) SetupChase();
            else
            {
                cam.orthographic = true;
                cam.transform.rotation = Quaternion.Euler(74f, 0f, 0f);
                cam.transform.position = -cam.transform.forward * 26f;
            }
            hud.AddChip("time", "90 s");
            hud.AddChip("score", "0 / 7");
            hud.UseAim();
            hud.AimReleased += QueueShot;
            Render(1f);
            if (Online) MatchBridge.Register(this);
            else UpdateHud();
        }

        protected override void OnBegin()
        {
            accumulator = 0f;
            shotPending = false;
            if (!Online) UpdateHud();
        }

        static Vector3 At(NVector2 p, float y = 0f) => new(p.X - TankSim.Width / 2f, y, TankSim.Height / 2f - p.Y);
        static Vector3 Heading(float angle) => new(Mathf.Cos(angle), 0f, -Mathf.Sin(angle));
        static NVector2 Input(Vector2 vector) => new(vector.x, -vector.y);
        /// <summary>World forward of a camera heading (0 = up on the overview, like the app's chase cameras).</summary>
        static Vector3 YawForward(float yaw) => new(Mathf.Sin(yaw), 0f, Mathf.Cos(yaw));

        void BuildFloor()
        {
            var deck = new GameObject("Sandstein").transform;
            deck.SetParent(world, false);
            Box(deck, Palette.TankBase, Vector3.down * 0.33f, new Vector3(TankSim.Width + 0.55f, 0.45f, TankSim.Height + 0.55f));
            for (int y = 0; y < TankSim.Rows; y++) for (int x = 0; x < TankSim.Cols; x++)
                Box(deck, (x + y) % 2 == 0 ? Palette.TankSand : Palette.TankSandDark,
                    At(new NVector2((x + 0.5f) * TankSim.Cell, (y + 0.5f) * TankSim.Cell), -0.08f),
                    new Vector3(TankSim.Cell, 0.16f, TankSim.Cell), 0.18f);
            StaticBatchingUtility.Combine(deck.gameObject);
        }

        void BuildWalls()
        {
            // In 3rd and 1st person tall walls hide what lies behind them, like in the app.
            float height = chase ? TallWall : LowWall;
            walls = new GameObject[sim.Walls.Length];
            for (int i = 0; i < walls.Length; i++)
            {
                var w = sim.Walls[i];
                if (w.Kind == 0) continue;
                var size = w.Max - w.Min;
                var model = Box(world, Palette.TankWall, At(w.Center, height / 2f), new Vector3(size.X, height, size.Y));
                model.GetComponent<Renderer>().sharedMaterial = w.Kind == 1 ? steel : w.Kind == 2 ? brick : cracked;
                if (w.Kind >= 2)
                {
                    // Three pale joints distinguish breakable brickwork from solid steel.
                    for (int j = -1; j <= 1; j++)
                    {
                        var joint = Box(model.transform, Palette.TankSand, Vector3.zero, Vector3.one, 0f);
                        bool horizontal = size.X > size.Y;
                        joint.transform.localPosition = horizontal ? new Vector3(j * 0.25f, 0.501f, 0f) : new Vector3(0f, 0.501f, j * 0.25f);
                        joint.transform.localScale = horizontal ? new Vector3(0.025f, 0.035f, 0.84f) : new Vector3(0.84f, 0.035f, 0.025f);
                    }
                }
                walls[i] = model;
            }
        }

        View BuildTank(Seat seat)
        {
            var root = new GameObject(seat.name).transform;
            root.SetParent(world, false);
            var hull = new GameObject("Fahrgestell").transform;
            hull.SetParent(root, false);
            foreach (float side in new[] { -1f, 1f })
            {
                Box(hull, Palette.Ink, new Vector3(side * 0.29f, 0.11f, 0f), new Vector3(0.17f, 0.22f, 0.86f));
                for (int i = -1; i <= 1; i++)
                    Box(hull, Palette.TankWall, new Vector3(side * 0.29f, 0.23f, i * 0.21f), new Vector3(0.16f, 0.035f, 0.08f), 0f);
            }
            Box(hull, seat.Color, new Vector3(0f, 0.23f, 0f), new Vector3(0.49f, 0.24f, 0.76f));
            var turret = new GameObject("Turm").transform;
            turret.SetParent(root, false);
            Cyl(turret, seat.Color, new Vector3(0f, 0.39f, 0f), 0.23f, 0.21f);
            Box(turret, seat.Color, new Vector3(0f, BulletHeight, 0.31f), new Vector3(0.105f, 0.105f, 0.43f));
            Cyl(turret, Palette.Ink, new Vector3(0f, 0.5f, -0.12f), 0.13f, 0.05f);
            var driver = SpawnFigure(seat, turret, 0.33f);
            driver.transform.localPosition = new Vector3(0f, 0.22f, -0.12f);
            driver.Loop("idle");
            var ring = Torus(0.49f, 0.035f, 24, 6);
            var shield = Part(root, "Schild", ring, Toon(Palette.Rune, 0f, 0f, Palette.Rune), Vector3.up * 0.05f, shadows: false);
            if (seat.isPlayer)
                Part(root, "Dein Panzer", ring, Toon(Palette.Own, 0f, 0f, Palette.Own), Vector3.up * 0.025f,
                    new Vector3(1.24f, 1f, 1.24f), false);
            var view = new View { root = root, hull = hull, turret = turret, shield = shield };
            for (int i = 0; i < view.pips.Length; i++)
                view.pips[i] = Box(root, Palette.Accent, new Vector3((i - 1) * 0.17f, 0.93f, -0.5f), new Vector3(0.12f, 0.055f, 0.095f), 0f);
            return view;
        }

        void QueueShot(Vector2 aim)
        {
            if (Online || !Playing || !sim.Tanks[0].Alive) return;
            shotAim = Input(aim);
            shotPending = true;
        }

        void Update()
        {
            if (!chase)
            {
                float width = (TankSim.Width + 0.8f) / (2f * cam.aspect * 0.92f);
                float height = (TankSim.Height + 0.8f) / (2f * 0.72f);
                cam.orthographicSize = Mathf.Max(width, height);
            }
            if (Online)
            {
                if (!built) return;
                float blend = Fx.Reduced ? 1f : Mathf.Clamp01((Time.unscaledTime - snapAt) / snapInterval);
                Render(blend);
                return;
            }
            if (!Playing)
            {
                shotPending = false;
                laser.gameObject.SetActive(false);
                return;
            }
            accumulator += Time.deltaTime;
            while (accumulator >= StepTime && !sim.Done)
            {
                accumulator -= StepTime;
                bool wasAlive = ControlsVisible;
                sim.Step(Input(hud.Stick), shotPending ? shotAim : Input(hud.Aim), shotPending);
                shotPending = false;
                foreach (var e in sim.Events) Feedback(e);
                if (wasAlive != ControlsVisible)
                {
                    hud.ReleaseAll();
                    hud.SetControlsVisible(ControlsVisible);
                }
                UpdateHud();
            }
            Render(sim.Done ? 1f : Mathf.Clamp01(accumulator / StepTime));
            if (sim.Done) Finish();
        }

        /// <summary>Own aim as a field direction while aiming (local: the Unity HUD, online: the app's aim pad).</summary>
        NVector2? OwnAim()
        {
            if (Online) return onlineAim.LengthSquared() > 0.01f ? NVector2.Normalize(onlineAim) : null;
            if (hud.Aim.sqrMagnitude > 0.1f) return Input(hud.Aim);
            return hud.Aiming ? TankSim.Direction(sim.Tanks[0].Aim) : null;
        }

        void Render(float blend)
        {
            var aim = OwnAim();
            for (int i = 0; i < views.Count; i++)
            {
                var t = sim.Tanks[i];
                var view = views[i];
                // 1st person sits in the own hatch: the own tank is not drawn.
                bool visible = t.Alive && seen[i] && !(Mine(i) && chase && this.view == "first");
                view.root.gameObject.SetActive(visible);
                if (!t.Alive || !seen[i]) continue;
                view.root.position = At(NVector2.Lerp(t.Previous, t.Position, blend));
                view.hull.rotation = Quaternion.LookRotation(Heading(t.Heading));
                float angle = Mine(i) && aim.HasValue ? MathF.Atan2(aim.Value.Y, aim.Value.X) : t.Aim;
                view.turret.rotation = Quaternion.LookRotation(Heading(angle));
                view.shield.SetActive(sim.Protected(t));
                for (int j = 0; j < view.pips.Length; j++) view.pips[j].SetActive(j < t.Life);
            }
            SyncProjectiles(blend);
            SyncPickups();
            DrawLaser(aim);
        }

        void SyncProjectiles(float blend)
        {
            activeProps.Clear();
            foreach (var b in sim.Bullets)
            {
                activeProps.Add(b.Id);
                if (!bullets.TryGetValue(b.Id, out var model))
                {
                    model = Prim(PrimitiveType.Sphere, world, Palette.TankTrace, Vector3.zero, Vector3.one * (2 * TankSim.BulletRadius), 0f).transform;
                    model.GetComponent<Renderer>().sharedMaterial = tracer;
                    model.GetComponent<Renderer>().shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off;
                    bullets.Add(b.Id, model);
                }
                model.position = At(NVector2.Lerp(b.Previous, b.Position, blend), BulletHeight);
            }
            RemoveStale(bullets);
        }

        void SyncPickups()
        {
            activeProps.Clear();
            foreach (var item in sim.Pickups)
            {
                activeProps.Add(item.id);
                if (pickups.ContainsKey(item.id)) continue;
                var color = PowerColor(item.kind);
                var model = Cyl(world, Palette.Wall, At(item.at, 0.06f), 0.32f, 0.12f);
                if (item.kind == TankSim.Power.Shield)
                    Part(model.transform, "Schild", Torus(0.63f, 0.13f, 16, 6), Toon(color, 0f, 0f, color), Vector3.up * 1.5f);
                else
                {
                    int bars = item.kind == TankSim.Power.Triple ? 3 : 1;
                    for (int i = 0; i < bars; i++)
                    {
                        var token = Box(model.transform, color, new Vector3((i - (bars - 1) / 2f) * 0.5f, 1.5f, 0f),
                            new Vector3(0.22f, 0.45f, 1.05f), 0f);
                        token.transform.localRotation = Quaternion.Euler(0f, bars == 1 ? 40f : 0f, 0f);
                    }
                }
                pickups.Add(item.id, model.transform);
            }
            RemoveStale(pickups);
        }

        void RemoveStale(Dictionary<int, Transform> props)
        {
            staleProps.Clear();
            foreach (var pair in props) if (!activeProps.Contains(pair.Key)) staleProps.Add(pair.Key);
            foreach (int id in staleProps) { Destroy(props[id].gameObject); props.Remove(id); }
        }

        void DrawLaser(NVector2? aim)
        {
            bool aiming = me >= 0 && aim.HasValue && sim.Tanks[me].Alive && seen[me] && (Online ? !sim.Done : Playing && !sim.Done && hud.Aiming);
            laser.gameObject.SetActive(aiming);
            if (!aiming) return;
            var root = views[me].root.position;
            var p = new NVector2(root.x + TankSim.Width / 2f, TankSim.Height / 2f - root.z);
            var d = aim.Value;
            float length = sim.FirstWall(p, d, 9f);
            float start = Mathf.Min(TankSim.Muzzle, length);
            laser.position = At(p + d * ((length + start) / 2f), BulletHeight);
            laser.rotation = Quaternion.LookRotation(new Vector3(d.X, 0f, -d.Y));
            laser.localScale = new Vector3(0.07f, 0.03f, Mathf.Max(0.01f, length - start));
        }

        static Color PowerColor(TankSim.Power power) => power switch
        {
            TankSim.Power.Rapid => Palette.Accent,
            TankSim.Power.Triple => Palette.Door,
            _ => Palette.Rune
        };

        void Feedback((TankSim.Effect kind, NVector2 at, int seat, int by, TankSim.Power power) e)
        {
            var point = At(e.at, BulletHeight);
            switch (e.kind)
            {
                case TankSim.Effect.Shot:
                    Fx.Sparks(point, Palette.TankTrace, 3);
                    Sfx.Play("thud", e.seat == 0 ? 0.55f : 0.2f);
                    break;
                case TankSim.Effect.Bounce:
                    Fx.Sparks(point, Palette.TankTrace, 4);
                    Sfx.Play("tick", 0.3f);
                    break;
                case TankSim.Effect.Crack:
                case TankSim.Effect.Break:
                    for (int i = 0; i < walls.Length; i++)
                    {
                        if (!walls[i] || sim.Walls[i].Center != e.at) continue;
                        ShowWall(i);
                        break;
                    }
                    Fx.Shards(point, Palette.TankBrick, e.kind == TankSim.Effect.Crack ? 4 : 12);
                    Sfx.Play("thud", 0.45f);
                    break;
                case TankSim.Effect.Block:
                    Fx.Sparks(point, Palette.Rune, 6);
                    if (e.seat == 0) hud.Toast("Schild hält!", Palette.Rune, 0.55f);
                    break;
                case TankSim.Effect.Hit:
                    Fx.Sparks(point, Palette.TankTrace, 8);
                    Sfx.Play("hit", 0.5f);
                    if (e.seat == 0) hud.Toast(e.by == 0 ? "Eigener Abpraller!" : "Treffer!", Palette.Warn, 0.65f);
                    break;
                case TankSim.Effect.Destroyed:
                    Fx.Shards(point, seats[e.seat].Color, 18);
                    Sfx.Play("thud", 0.65f);
                    if (e.seat == 0) hud.Toast("Zerstört · zurück in 2 s", Palette.Warn);
                    else if (e.by == 0) hud.Toast("Abschuss!", Palette.Accent);
                    break;
                case TankSim.Effect.Pickup:
                    Fx.Glow(point, PowerColor(e.power), 8);
                    Sfx.Play("chime", 0.5f);
                    if (e.seat == 0) hud.Toast(e.power == TankSim.Power.Rapid ? "Schnellschuss!" :
                        e.power == TankSim.Power.Triple ? "Dreifachschuss!" : "Schutzschild!", PowerColor(e.power));
                    break;
                case TankSim.Effect.Tiebreak:
                    hud.Toast("Stechen! Der nächste Abschuss der Führenden entscheidet.", Palette.Accent, 2f);
                    Sfx.Play("sting");
                    break;
            }
        }

        /// <summary>A wall after a hit: cracked brickwork or gone.</summary>
        void ShowWall(int i)
        {
            if (!walls[i]) return;
            if (sim.Walls[i].Kind == 0) walls[i].SetActive(false);
            else if (sim.Walls[i].Kind == 3) walls[i].GetComponent<Renderer>().sharedMaterial = cracked;
        }

        // ---- online: snapshots of the room ----------------------------------------------------

        public void OnSnapshot(string json)
        {
            var snap = JsonUtility.FromJson<TankSnap>(json);
            if (snap?.tanks == null || snap.h == null || snap.v == null || snap.tanks.Length != seats.Count) return;
            int offset = (TankSim.Rows + 1) * TankSim.Cols;
            for (int i = 0; i < sim.Walls.Length; i++)
            {
                int j = i < offset ? i : i - offset;
                string edges = i < offset ? snap.h : snap.v;
                int kind = j < edges.Length ? edges[j] - '0' : 0;
                var w = sim.Walls[i];
                if (w.Kind == kind) continue;
                bool hit = built && kind < w.Kind;
                w.Kind = kind;
                if (!hit) continue;
                ShowWall(i);
                Fx.Shards(At(w.Center, BulletHeight), Palette.TankBrick, kind == 0 ? 12 : 4);
            }
            if (!built) { BuildWalls(); built = true; }

            for (int i = 0; i < seats.Count; i++)
            {
                var s = snap.tanks[i];
                var t = sim.Tanks[i];
                bool before = seen[i] && t.Alive;
                var old = t.Position;
                int life = t.Life;
                t.Position = new NVector2(s.x, s.y);
                t.Previous = before && s.seen && s.alive && NVector2.Distance(old, t.Position) < 2f ? old : t.Position;
                t.Heading = s.angle;
                t.Aim = s.aim;
                t.Life = s.alive ? Math.Max(1, s.hp) : 0;
                t.Kills = s.kills;
                t.Deaths = s.deaths;
                t.RespawnAt = s.respawnAt;
                t.ShieldUntil = s.shieldUntil;
                t.PowerUntil = s.powerUntil;
                t.Bonus = s.power == "rapid" ? TankSim.Power.Rapid : s.power == "triple" ? TankSim.Power.Triple : s.power == "shield" ? TankSim.Power.Shield : TankSim.Power.None;
                if (before && s.seen && !s.alive) Fx.Shards(At(old, BulletHeight), seats[i].Color, 18);
                else if (before && s.seen && s.alive && s.hp < life) Fx.Sparks(At(t.Position, BulletHeight), Palette.TankTrace, 8);
                seen[i] = s.seen && !s.gone;
            }

            var previous = sim.Bullets.ToDictionary(b => b.Id, b => b.Position);
            sim.Bullets.Clear();
            foreach (var b in snap.bullets ?? Array.Empty<TankSnapBullet>())
            {
                var p = new NVector2(b.x, b.y);
                bool known = previous.TryGetValue(b.id, out var from);
                sim.Bullets.Add(new TankSim.Bullet { Id = b.id, Owner = b.slot, Position = p, Previous = known ? from : p });
                if (!known) Fx.Sparks(At(p, BulletHeight), Palette.TankTrace, 3);
            }
            sim.Pickups.Clear();
            foreach (var p in snap.powers ?? Array.Empty<TankSnapPower>())
                sim.Pickups.Add((p.id, p.kind == "rapid" ? TankSim.Power.Rapid : p.kind == "triple" ? TankSim.Power.Triple : TankSim.Power.Shield, new NVector2(p.x, p.y)));

            if (lastSnapTime > 0 && snap.time > lastSnapTime) snapInterval = Mathf.Clamp((snap.time - lastSnapTime) / 1000f, 0.03f, 0.25f);
            lastSnapTime = snap.time;
            snapAt = Time.unscaledTime;
            sim.SetTime(snap.time);
        }

        public void OnAim(Vector2 aim) => onlineAim = new NVector2(aim.x, aim.y);

        public void OnTurn(float delta)
        {
            camYaw += delta;
            manualPause = 1.6f;
        }

        // ---- online: 3rd and 1st person ------------------------------------------------------

        void SetupChase()
        {
            cam.orthographic = false;
            cam.fieldOfView = view == "first" ? 74f : 58f;
            cam.nearClipPlane = 0.05f;
            cam.clearFlags = CameraClearFlags.SolidColor;
            cam.backgroundColor = Palette.TankNight;
            // Fog ends the view at the sight range (like the app's Turmsicht).
            RenderSettings.fog = true;
            RenderSettings.fogMode = FogMode.Linear;
            RenderSettings.fogColor = Palette.TankNight;
            RenderSettings.fogStartDistance = view == "first" ? 4.5f : 5.5f;
            RenderSettings.fogEndDistance = view == "first" ? 9f : 11f;
            // Darkness outside the own sight: one quad per ray from the sight edge to far outside the field.
            dark = new Mesh { name = "Dunkel" };
            dark.MarkDynamic();
            darkVertices = new Vector3[Rays * 2];
            var colors = new Color[Rays * 2];
            var uv = new Vector2[Rays * 2];
            var triangles = new int[Rays * 6];
            for (int i = 0; i < Rays; i++)
            {
                colors[2 * i] = colors[2 * i + 1] = new Color(Palette.TankNight.r, Palette.TankNight.g, Palette.TankNight.b, 0.72f);
                uv[2 * i] = uv[2 * i + 1] = new Vector2(0.5f, 0.5f);
                int a = 2 * i, b = 2 * ((i + 1) % Rays);
                triangles[6 * i] = a; triangles[6 * i + 1] = a + 1; triangles[6 * i + 2] = b + 1;
                triangles[6 * i + 3] = a; triangles[6 * i + 4] = b + 1; triangles[6 * i + 5] = b;
            }
            dark.vertices = darkVertices;
            dark.colors = colors;
            dark.uv = uv;
            dark.triangles = triangles;
            dark.bounds = new Bounds(Vector3.zero, new Vector3(80f, 4f, 80f));
            var material = new Material(Resources.Load<Material>("GSG/Materials/ParticleSquare"));
            var shade = Part(world, "Dunkel", dark, material, Vector3.zero, shadows: false);
            shade.GetComponent<Renderer>().receiveShadows = false;
        }

        void LateUpdate()
        {
            if (!chase || !built || me < 0) return;
            var t = sim.Tanks[me];
            float blend = Fx.Reduced ? 1f : Mathf.Clamp01((Time.unscaledTime - snapAt) / snapInterval);
            var p = NVector2.Lerp(t.Previous, t.Position, t.Alive ? blend : 1f);
            UpdateDark(p);
            // The camera starts (and restarts after a respawn) behind the hull; afterwards only a swipe turns it.
            bool alive = t.Alive && seen[me];
            if (alive && !wasAlive) camFresh = true;
            wasAlive = alive;
            if (camFresh && alive && manualPause <= 0f) { camYaw = Mathf.Atan2(Mathf.Cos(t.Heading), -Mathf.Sin(t.Heading)); camFresh = false; }
            manualPause = Mathf.Max(0f, manualPause - Time.deltaTime);
            var forward = YawForward(camYaw);
            var target = At(p);
            Vector3 wantEye, wantLook;
            if (view == "first")
            {
                wantEye = target + Vector3.up * 0.62f + forward * 0.1f;
                wantLook = wantEye + forward * 4f + Vector3.down * 0.45f;
            }
            else
            {
                wantEye = target - forward * 2.6f + Vector3.up * 3.6f;
                wantLook = target + forward * 1.7f;
            }
            float k = !eyeReady || Fx.Reduced ? 1f : 1f - Mathf.Exp(-Time.deltaTime * (view == "first" ? 18f : 9f));
            eye = Vector3.Lerp(eye, wantEye, k);
            look = Vector3.Lerp(look, wantLook, k);
            eyeReady = true;
            cam.transform.position = eye;
            cam.transform.LookAt(look);
            // The app keeps the stick and the aim relative to this heading.
            if ((float.IsNaN(sentYaw) || Mathf.Abs(Mathf.DeltaAngle(sentYaw * Mathf.Rad2Deg, camYaw * Mathf.Rad2Deg)) > 0.2f) && Time.unscaledTime - lastCamPost > 0.03f)
            {
                sentYaw = camYaw;
                lastCamPost = Time.unscaledTime;
                MatchBridge.Camera(camYaw);
            }
        }

        /// <summary>Sight polygon of the own tank (same rays as tankView.ts): everything outside lies in the dark.</summary>
        void UpdateDark(NVector2 from)
        {
            if (dark == null) return;
            for (int i = 0; i < Rays; i++)
            {
                float a = i / (float)Rays * Mathf.PI * 2f;
                var d = new NVector2(Mathf.Cos(a), Mathf.Sin(a));
                float reach = sim.FirstWall(from, d, Sight);
                darkVertices[2 * i] = At(from + d * reach, 0.012f);
                darkVertices[2 * i + 1] = At(from + d * 40f, 0.012f);
            }
            dark.vertices = darkVertices;
        }

        // ---- local HUD and result -----------------------------------------------------------

        void UpdateHud()
        {
            int limit = sim.InOvertime ? TankSim.Regular + TankSim.Overtime : TankSim.Regular;
            int duration = sim.InOvertime ? TankSim.Overtime : TankSim.Regular;
            int remaining = Mathf.Max(0, limit - sim.Time);
            int seconds = Mathf.CeilToInt(remaining / 1000f);
            hud.SetChip("time", sim.InOvertime ? $"Stechen · {seconds} s" : $"{seconds} s");
            hud.SetChip("score", $"{sim.Tanks[0].Kills} / {TankSim.KillsToWin}");
            if (timerFill != null) SetTimer(remaining / (float)duration);
            foreach (var seat in seats)
            {
                var t = sim.Tanks[seat.index];
                Strip(seat, t.Alive ? $"· {t.Kills} · {t.Life} HP" : $"· {t.Kills} · zurück in {Mathf.CeilToInt((t.RespawnAt - sim.Time) / 1000f)} s", seat.isPlayer, !t.Alive);
            }
        }

        protected override bool SamePlace(Seat a, Seat b) => a.index != sim.Winner && b.index != sim.Winner &&
            sim.Tanks[a.index].Kills == sim.Tanks[b.index].Kills && sim.Tanks[a.index].Deaths == sim.Tanks[b.index].Deaths;
        protected override List<(Seat seat, string value)> Ranking() => seats
            .OrderByDescending(s => s.index == sim.Winner).ThenByDescending(s => sim.Tanks[s.index].Kills).ThenBy(s => sim.Tanks[s.index].Deaths)
            .Select(s => (s, $"{sim.Tanks[s.index].Kills} Abschüsse · {sim.Tanks[s.index].Deaths}× zerstört")).ToList();
    }
}
