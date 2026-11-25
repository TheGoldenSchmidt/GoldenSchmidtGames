using System.Collections.Generic;
using System.Linq;
using UnityEngine;

namespace GSG.Parcours
{
    /// <summary>
    /// Standhaft, the final: stay on the trapdoor square while two bars sweep across it; the last one
    /// standing wins. Locally against bots with <see cref="ParcoursRunner"/> physics; online
    /// (<see cref="ParcoursOnline"/>) the scene draws the room's final in 3rd person or from above.
    /// </summary>
    [DefaultExecutionOrder(-20)]
    public class StandhaftGame : MatchGame, IRaceHost, IOnlineMatch
    {
        const float BarReach = 0.48f;
        CourseData course;
        readonly List<ParcoursRunner> runners = new();
        readonly List<Blinker> plates = new();
        readonly List<Transform> bars = new();
        readonly Dictionary<ParcoursRunner, float> fellAt = new();
        float[] contactStart, lastContact, hitUntil;
        float[] grabbedAt, grabReady;
        ParcoursRunner[] grabbed;
        float elapsed, nextThink;
        Vector3 center;
        ParcoursOnline online;
        bool chase, watching;

        protected override string GameName => "Standhaft";
        protected override string Intro => "Spring über den rosa Balken und duck dich unter dem gelben. Orange Klappen öffnen sich gleich. Wer zuletzt auf der Plattform steht, gewinnt. Nach 90 Sekunden teilen sich alle Übrigen den Sieg.";
        protected override string ResultText => "Wer später gestürzt ist, platziert sich höher.";
        protected override bool ControlsVisible => online != null ? online.CanAct(Playing) : !fellAt.ContainsKey(runners[0]);

        protected override void Setup()
        {
            course = CourseData.Load("standhaft");
            center = new Vector3(0f, 0f, course.checkpoints[0].z);
            ParcoursLevel.Root = new GameObject("Klappenarena").transform;
            foreach (var plate in course.boxes) BuildPlate(plate);
            foreach (var bar in course.sweepers)
            {
                var model = ParcoursLevel.Bar(bar.x, bar.z, 0f, bar.y0, bar.y1, bar.length, bar.speed, bar.phase);
                model.enabled = false;
                foreach (var collider in model.GetComponentsInChildren<Collider>()) collider.enabled = false;
                bars.Add(model.transform);
            }
            // The open plates reveal their own deep support structure, entirely below the fall line.
            Kit.Box(ParcoursLevel.Root, Palette.Ink, center + Vector3.down * 7.3f, new Vector3(13.2f, 0.6f, 13.2f));
            for (int i = 0; i < course.boxes.Length; i++)
            {
                var b = course.boxes[i];
                Kit.Box(ParcoursLevel.Root, Palette.ShadowCool, new Vector3((b.x0 + b.x1) / 2, -6.85f, (b.z0 + b.z1) / 2),
                    new Vector3(0.24f, 0.5f, 0.24f));
            }

            focus = new GameObject("Arenamitte").transform;
            focus.position = center;
            if (Online) { SetupOnline(); return; }
            Overview();
            Runners();
        }

        /// <summary>The square from above (local test and the online "top" view).</summary>
        void Overview()
        {
            rig = CameraRig.Create(focus, 25f, 66f, 52f, Vector3.zero);
            rig.recenterAfter = float.PositiveInfinity;
            rig.swipePitch = 0f;
            rig.composer.TargetOffset = Vector3.zero;
            var composition = rig.composer.Composition;
            composition.DeadZone.Enabled = false;
            composition.ScreenPosition = new Vector2(0f, -0.04f);
            rig.composer.Composition = composition;
        }

        void Runners()
        {
            foreach (var seat in seats)
            {
                var runner = new GameObject(seat.name).AddComponent<ParcoursRunner>();
                runner.game = this;
                runner.bot = !seat.isPlayer;
                runner.RequireFreshGrab = true;
                if (seat.isPlayer) runner.rig = rig;
                runner.Attach(SpawnFigure(seat, runner.transform, 1f));
                if (seat.isPlayer)
                {
                    var marker = Kit.Prim(PrimitiveType.Cylinder, runner.transform, Palette.Own, Vector3.up * 0.025f,
                        new Vector3(0.9f, 0.02f, 0.9f), 0f);
                    marker.GetComponent<Renderer>().shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off;
                }
                runners.Add(runner);
            }
            hud.AddChip("time", "90 s");
            hud.AddChip("standing", "4 im Spiel");
            hud.AddAction("grab", Hud.Icon.Grab, "Festhalten", Hud.Tone.Cyan);
            hud.AddAction("duck", Hud.Icon.Duck, "Ducken", Hud.Tone.Cyan);
            hud.AddAction("b", Hud.Icon.Dive, "Hechten", Hud.Tone.Pink);
            hud.AddAction("a", Hud.Icon.Jump, "Springen", Hud.Tone.Gold);
            OnBegin();
        }

        void BuildPlate(CourseBox b)
        {
            var plate = new GameObject("Fallklappe");
            plate.SetActive(false);
            plate.transform.SetParent(ParcoursLevel.Root, false);
            var size = new Vector3(b.x1 - b.x0, b.y1 - b.y0, b.z1 - b.z0);
            plate.transform.localPosition = new Vector3(b.x0, (b.y0 + b.y1) / 2, (b.z0 + b.z1) / 2);
            var floor = plate.AddComponent<BoxCollider>();
            floor.size = size;
            floor.center = Vector3.right * (size.x / 2);
            // The hinge moves only the visual, leaving the deck collider in its original position.
            var hinge = new GameObject("Scharnier").transform;
            hinge.SetParent(plate.transform, false);
            ParcoursLevel.Box("Platte", 0, size.x, -size.y / 2, size.y / 2, -size.z / 2, size.z / 2, "Trap", hinge, false);
            var blink = plate.AddComponent<Blinker>();
            blink.hinge = hinge;
            blink.Clock = () => elapsed;
            blink.startsAt = b.blinkFrom / 1000f;
            blink.period = b.blinkPeriod / 1000f;
            blink.phase = b.blinkPhase;
            blink.open = b.blinkOpen;
            plate.SetActive(true);
            plates.Add(blink);
        }

        protected override void OnBegin()
        {
            if (online != null) return;
            elapsed = nextThink = 0f;
            fellAt.Clear();
            contactStart = Enumerable.Repeat(-1f, runners.Count).ToArray();
            lastContact = new float[runners.Count];
            hitUntil = new float[runners.Count];
            grabbed = new ParcoursRunner[runners.Count];
            grabbedAt = new float[runners.Count];
            grabReady = new float[runners.Count];
            for (int i = 0; i < runners.Count; i++)
            {
                float a = 0.5f + i * Mathf.PI / 3f;
                var offset = new Vector3(Mathf.Cos(a) * 3.5f, 0.05f, Mathf.Sin(a) * 3.5f);
                runners[i].Respawn(center + offset, Mathf.Atan2(-offset.x, -offset.z) * Mathf.Rad2Deg);
                runners[i].Freeze();
            }
            SetBars();
            UpdateHud();
        }

        protected override void OnPlay()
        {
            foreach (var runner in runners) runner.Release();
        }

        static float Angle(CourseSweeper bar, float t) => bar.phase + bar.speed * Mathf.Max(0f, t - bar.from / 1000f);

        void SetBars()
        {
            for (int i = 0; i < bars.Count; i++)
                bars[i].rotation = Quaternion.Euler(0f, -Angle(course.sweepers[i], elapsed) * Mathf.Rad2Deg, 0f);
        }

        // ---- online --------------------------------------------------------------------------

        void SetupOnline()
        {
            online = new ParcoursOnline(seats, null, hud, true, (seat, parent) => SpawnFigure(seat, parent, 1f));
            chase = online.Own && MatchBridge.Setup.view == "third";
            if (online.Own)
            {
                var marker = Kit.Prim(PrimitiveType.Cylinder, online.Own.transform, Palette.Own, Vector3.up * 0.025f, new Vector3(0.9f, 0.02f, 0.9f), 0f);
                marker.GetComponent<Renderer>().shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off;
            }
            if (!chase) Overview();
            else
            {
                // 3rd person: behind the own racer, high enough to see the plates and both bars coming.
                rig = CameraRig.Create(online.Own.transform, 8.5f, 30f, 56f, new Vector3(0f, 1.1f, 0f));
                rig.recenterAfter = float.PositiveInfinity;
                hud.ShowHint("3rd Person", "Oben wischen dreht die Kamera. Der Stick folgt der Blickrichtung.");
                Invoke(nameof(HideHint), 6f);
            }
            online.rig = rig;
            hud.AddChip("time", "90 s");
            hud.AddChip("standing", seats.Count + " im Spiel");
            hud.AddAction("grab", Hud.Icon.Grab, "Festhalten", Hud.Tone.Cyan);
            hud.AddAction("duck", Hud.Icon.Duck, "Ducken", Hud.Tone.Cyan);
            hud.AddAction("b", Hud.Icon.Dive, "Hechten", Hud.Tone.Pink);
            hud.AddAction("a", Hud.Icon.Jump, "Springen", Hud.Tone.Gold);
            hud.SetControlsVisible(false);
            SetBars();
            MatchBridge.Register(this);
        }

        void HideHint() => hud.ShowHint(null, null);

        public void OnSnapshot(string json)
        {
            bool first = online.Snap == null;
            online.Apply(json);
            // The racers start facing the middle: the camera starts behind the own one.
            if (first && chase && online.Mine != null) rig.Snap(online.Mine.face * Mathf.Rad2Deg);
        }

        public void OnAim(Vector2 aim) { }
        public void OnTurn(float delta) => rig.Swipe(new Vector2(delta * Mathf.Rad2Deg / Mathf.Max(0.01f, rig.swipeYaw), 0f));

        void UpdateOnline()
        {
            if (online.Snap != null) elapsed = Mathf.Min(course.limitMs / 1000f, online.Now / 1000f);
            online.Frame(Playing);
            SetBars();
            hud.SetControlsVisible(ControlsVisible);
            // After the own fall the 3rd-person camera rises over the square to watch the rest.
            if (chase && !watching && online.Mine?.pose == "out") { watching = true; rig.cam.Target.TrackingTarget = focus; rig.composer.TargetOffset = Vector3.zero; }
            if (watching)
            {
                rig.orbit.Radius = Mathf.Lerp(rig.orbit.Radius, 24f, 1f - Mathf.Exp(-2f * Time.deltaTime));
                var v = rig.orbit.VerticalAxis; v.Center = 62f; rig.orbit.VerticalAxis = v;
                rig.recenterAfter = 0.5f;
                rig.Swipe(hud.Look);
            }
            else if (chase) rig.Swipe(hud.Look);
            else
            {
                float radius = Mathf.Max(23f, (ControlsVisible ? 7.4f : 9.8f) / (0.47f * Camera.main.aspect));
                rig.orbit.Radius = Mathf.Lerp(rig.orbit.Radius, radius, 1f - Mathf.Exp(-3f * Time.deltaTime));
                if (!ControlsVisible) rig.Swipe(hud.Look);
            }
            var snap = online.Snap;
            if (snap == null || Time.frameCount % 6 != 0) return;
            float limit = course.limitMs / 1000f;
            hud.SetChip("time", $"{Mathf.CeilToInt(limit - elapsed)} s");
            hud.SetChip("standing", $"{snap.racers.Count(r => r.pose != "out")} im Spiel");
            if (timerFill != null) SetTimer(1f - elapsed / limit);
            for (int i = 0; i < seats.Count; i++)
            {
                bool outOfPlay = snap.racers[i].pose == "out";
                Strip(seats[i], outOfPlay ? "raus" : "steht", seats[i].isPlayer, outOfPlay);
            }
        }

        void OnDestroy() { online?.Dispose(); }

        void Update()
        {
            if (online != null) { UpdateOnline(); return; }
            // Frame the square at rest while playing (like the app's arena shot); spectators can turn
            // the camera, so then the diagonal has to fit on narrow or short phones as well.
            if (rig)
            {
                float radius = Mathf.Max(23f, (ControlsVisible ? 7.4f : 9.8f) / (0.47f * Camera.main.aspect));
                rig.orbit.Radius = Playing ? Mathf.Lerp(rig.orbit.Radius, radius, 1f - Mathf.Exp(-3f * Time.deltaTime)) : radius;
            }
            if (!Playing) return;
            if (!ControlsVisible) rig.Swipe(hud.Look);
            SetBars();
        }

        void FixedUpdate()
        {
            if (!Playing || online != null) return;
            elapsed = Mathf.Min(course.limitMs / 1000f, PlayTime);
            foreach (var plate in plates) plate.SyncCollider(elapsed);
            for (int i = 0; i < runners.Count; i++)
            {
                var runner = runners[i];
                if (fellAt.ContainsKey(runner)) continue;
                CheckFall(runner);
                if (fellAt.ContainsKey(runner)) continue;
                Sweep(i);
                if (runner.bot && elapsed >= nextThink) Think(runner);
            }
            HoldRunners();
            if (elapsed >= nextThink)
            {
                nextThink = elapsed + 0.05f;
                UpdateHud();
            }
            if (runners.Count - fellAt.Count > 1 && elapsed < course.limitMs / 1000f) return;
            foreach (var runner in runners)
                if (!fellAt.ContainsKey(runner)) runner.Celebrate();
            base.Finish();
        }

        void HoldRunners()
        {
            foreach (var runner in runners) runner.RunScale = 1f;
            for (int i = 0; i < runners.Count; i++)
            {
                var runner = runners[i];
                var target = grabbed[i];
                bool holding = runner.GrabHeld && runner.pose == ParcoursRunner.Pose.Run && !fellAt.ContainsKey(runner);
                if (target)
                {
                    var d = target.transform.position - runner.transform.position;
                    d.y = 0f;
                    float distance = d.magnitude;
                    if (!holding || fellAt.ContainsKey(target) || distance > 1.6f || elapsed - grabbedAt[i] > 2f)
                    {
                        grabbed[i] = null;
                        grabReady[i] = elapsed + 1.5f;
                        continue;
                    }
                    runner.RunScale *= 0.6f;
                    target.RunScale = Mathf.Min(target.RunScale, 0.45f);
                    if (distance <= 1.1f || target.pose == ParcoursRunner.Pose.Hang) continue;
                    var pull = d * ((distance - 1.1f) / distance);
                    runner.Shift(pull * 0.25f);
                    target.Shift(-pull * 0.75f);
                }
                else if (holding && runner.Grounded && elapsed >= grabReady[i])
                {
                    foreach (var candidate in runners)
                    {
                        if (candidate == runner || fellAt.ContainsKey(candidate)) continue;
                        var d = candidate.transform.position - runner.transform.position;
                        if (Mathf.Abs(d.y) >= 1f) continue;
                        d.y = 0f;
                        if (d.sqrMagnitude > 1.05f * 1.05f || Vector3.Dot(d, runner.Heading) <= 0f) continue;
                        grabbed[i] = candidate;
                        grabbedAt[i] = elapsed;
                        if (i == 0) hud.Toast("Erwischt!", Palette.Paper, 0.65f);
                        break;
                    }
                }
            }
        }

        void Sweep(int index)
        {
            var runner = runners[index];
            if (runner.pose == ParcoursRunner.Pose.Hang || runner.pose == ParcoursRunner.Pose.Climb) return;
            foreach (var bar in course.sweepers)
            {
                var p = runner.transform.position;
                float height = runner.Ducking && runner.Grounded ? runner.duckHeight : runner.height;
                if (p.y >= bar.y1 || p.y + height <= bar.y0) continue;
                var (along, axis, away) = BarContact(p, bar, elapsed);
                if (away.sqrMagnitude > BarReach * BarReach) continue;
                float omega = elapsed >= bar.from / 1000f ? bar.speed : 0f;
                var tangent = new Vector3(-axis.z, 0f, axis.x);
                float edge = Mathf.Clamp(along, -bar.length, bar.length);
                Vector3 velocity = tangent * (edge * omega);
                bool moving = velocity.sqrMagnitude > 0.09f;
                var push = moving && Mathf.Abs(along) <= bar.length ? velocity.normalized
                    : away.sqrMagnitude > 0.000001f ? away.normalized : tangent;
                runner.SeparateFromBar(push * (BarReach + 0.01f) - away);
                if (!moving) continue;
                if (contactStart[index] < 0f || elapsed - lastContact[index] > 0.25f) contactStart[index] = elapsed;
                lastContact[index] = elapsed;
                if (elapsed < hitUntil[index] || elapsed - contactStart[index] < 0.14f) continue;
                var radial = new Vector3(p.x - bar.x, 0f, p.z - bar.z).normalized;
                runner.Knock(push * Mathf.Max(8.5f * course.knock, velocity.magnitude * 1.3f)
                    + radial * (3f * course.knock) + Vector3.up * (4.5f * Mathf.Max(0.6f, course.knock)), 0.65f);
                hitUntil[index] = elapsed + runner.hitGuard;
                contactStart[index] = -1f;
                return;
            }
        }

        static (float along, Vector3 axis, Vector3 away) BarContact(Vector3 point, CourseSweeper bar, float t)
        {
            float a = Angle(bar, t);
            var axis = new Vector3(Mathf.Cos(a), 0f, Mathf.Sin(a));
            var offset = new Vector3(point.x - bar.x, 0f, point.z - bar.z);
            float along = Vector3.Dot(offset, axis);
            return (along, axis, offset - axis * Mathf.Clamp(along, -bar.length, bar.length));
        }

        void Think(ParcoursRunner runner)
        {
            var p = runner.transform.position;
            var target = p;
            float best = float.NegativeInfinity;
            for (int i = 0; i < plates.Count; i++)
            {
                var plate = plates[i];
                if (plate.IsOpenAt(elapsed) || plate.IsOpenAt(elapsed + 1.2f) || plate.WarningAt(elapsed) > 0f) continue;
                var b = course.boxes[i];
                var tile = new Vector3((b.x0 + b.x1) / 2, p.y, (b.z0 + b.z1) / 2);
                float score = -Vector3.Distance(tile, p) * 0.6f - Vector3.Distance(tile, center) * 0.3f;
                if (score <= best) continue;
                best = score;
                target = tile;
            }
            var move = target - p;
            runner.botMove = move.sqrMagnitude > 0.09f ? move.normalized : Vector3.zero;
            bool jump = false;
            runner.botDuck = false;
            foreach (var bar in course.sweepers)
            {
                if (BarContact(p, bar, elapsed + 0.25f).away.sqrMagnitude > 1.21f) continue;
                if (bar.y1 <= 0.8f) jump = true;
                else runner.botDuck = true;
            }
            if (jump && runner.Grounded) runner.BotJump();
        }

        public void CheckFall(ParcoursRunner runner)
        {
            if (!Playing || runner.transform.position.y >= course.killY || fellAt.ContainsKey(runner)) return;
            fellAt.Add(runner, elapsed);
            runner.gameObject.SetActive(false);
            if (runner != runners[0]) return;
            hud.ReleaseAll();
            hud.SetControlsVisible(false);
            hud.Toast("Ausgeschieden", Palette.Warn);
            Sfx.Play("lose");
        }

        public void Reached(Checkpoint cp, ParcoursRunner runner) { }
        public void Finish(Vector3 at, ParcoursRunner runner) { }

        float Placement(Seat seat) => fellAt.TryGetValue(runners[seat.slot], out float t) ? t : float.PositiveInfinity;
        protected override bool SamePlace(Seat a, Seat b) => Placement(a) == Placement(b);
        protected override List<(Seat seat, string value)> Ranking() => seats.OrderByDescending(Placement).Select(seat =>
            (seat, fellAt.TryGetValue(runners[seat.slot], out float t) ? $"{Mathf.RoundToInt(t)} s gestanden" : "Steht noch")).ToList();

        void UpdateHud()
        {
            float limit = course.limitMs / 1000f;
            hud.SetChip("time", $"{Mathf.CeilToInt(limit - elapsed)} s");
            hud.SetChip("standing", $"{runners.Count - fellAt.Count} im Spiel");
            if (timerFill != null) SetTimer(1f - elapsed / limit);
            foreach (var seat in seats)
            {
                bool outOfPlay = fellAt.ContainsKey(runners[seat.slot]);
                Strip(seat, outOfPlay ? "raus" : "steht", seat.isPlayer, outOfPlay);
            }
        }
    }
}
