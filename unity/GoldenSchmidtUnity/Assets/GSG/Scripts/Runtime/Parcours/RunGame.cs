using System.Collections;
using System.Collections.Generic;
using System.Linq;
using UnityEngine;

namespace GSG.Parcours
{
    /// <summary>
    /// A run of the online parcours (Türenlotto, Kreiselkurs, …) in Unity: the course is built from
    /// the app's course data (<see cref="CourseBuilder"/>), you race three bots with the probe
    /// level's runner and obstacles. Rules of shared/matches/parcours.ts: own checkpoint per runner,
    /// back to it after a fall, finishing order, the race ends 20 s after the first finisher or
    /// after the time limit; unfinished runners rank by distance. Bots follow parcoursBot: shared
    /// knowledge of tried doors and lanes, jumps over low bars and gaps, ducks under high bars,
    /// waits for moving islands. Online (<see cref="ParcoursOnline"/>) the scene only draws the room's run.
    /// </summary>
    public class RunGame : MatchGame, IRaceHost, IOnlineMatch
    {
        public string course = "tuerenlotto";
        const float FinishGrace = 20f, RespawnDelay = 1.1f;

        class Racer
        {
            public Seat seat; public ParcoursRunner runner;
            public int cp, falls, place = -1;
            public float best, finishAt = -1f, nextThink, laneOffset;
            public bool respawning;
        }

        CourseData data;
        CourseBuilder.Built built;
        readonly List<Racer> racers = new();
        readonly List<Racer> order = new();
        float firstFinish = -1f;
        bool ended;
        ParcoursOnline online;

        protected override string GameName => data != null ? data.name : "Parcours";
        protected override string Intro => course switch
        {
            "tuerenlotto" => "Türenlotto: Nur manche Türen brechen auf, hinter anderen wartet eine Sackgasse oder eine Falltür. Schieber, ein Graben und ein Drehbalken liegen dazwischen. Springen, Hechten, Ducken und Festhalten wie im Probelevel. Wer zuerst im Ziel ist, gewinnt – 20 s nach dem Ersten ist Zielschluss.",
            "kreiselkurs" => "Kreiselkurs: Drehbalken aller Art (unten springen, oben ducken, Kreuz), fahrende Inseln über dem Abgrund, zwei Wippen und ein Rührwerk am Ende. Nach einem Sturz geht es am letzten Kontrollpunkt weiter. 20 s nach dem Ersten ist Zielschluss.",
            _ => "Lauf durch den Parcours gegen drei Bots. Nach einem Sturz geht es am letzten Kontrollpunkt weiter."
        };
        protected override string Kicker => "Unity-Test · Parcours-Lauf gegen 3 Bots";
        protected override string ResultText => "Zielreihenfolge zählt; wer nicht ankommt, wird nach der erreichten Strecke gewertet.";
        protected override bool ControlsVisible => online != null ? online.CanAct(Playing) : racers.Count > 0 && racers[0].finishAt < 0f && !ended;

        Vector3 StartSpot(int slot) => new Vector3(-3f + slot * 2f, 0.05f, 0f);

        protected override void Setup()
        {
            Physics.gravity = new Vector3(0f, -20f, 0f);
            data = CourseData.Load(course);
            var root = new GameObject("Strecke " + data.name).transform;
            built = CourseBuilder.Build(data, root);
            if (Online) { SetupOnline(); return; }
            foreach (var seat in seats)
            {
                var go = new GameObject(seat.name);
                go.transform.position = StartSpot(seat.slot);
                var runner = go.AddComponent<ParcoursRunner>();
                runner.game = this;
                runner.bot = !seat.isPlayer;
                var holder = new GameObject("Figur").transform;
                holder.SetParent(go.transform, false);
                runner.Attach(Figure.Spawn(seat.figureId, seat.slot, holder));
                runner.figure.transform.SetParent(go.transform, true);
                Destroy(holder.gameObject);
                uint h = (uint)(seat.slot * 2654435761u);
                racers.Add(new Racer { seat = seat, runner = runner, laneOffset = Mathf.Clamp(((int)(h % 7u) - 3) * 0.9f, -3.5f, 3.5f) });
            }
            var me = racers[0].runner;
            rig = CameraRig.Create(me.transform, 7.4f, 19f, 55f, new Vector3(0f, 1.1f, 0f));
            me.rig = rig;
            focus = me.transform;
            AddHud();
            ResetRace();
        }

        void AddHud()
        {
            hud.AddChip("time", "120 s");
            hud.AddChip("place", "Platz –");
            hud.AddAction("grab", Hud.Icon.Grab, "Festhalten", Hud.Tone.Cyan);
            hud.AddAction("duck", Hud.Icon.Duck, "Ducken", Hud.Tone.Cyan);
            hud.AddAction("b", Hud.Icon.Dive, "Hechten", Hud.Tone.Pink);
            hud.AddAction("a", Hud.Icon.Jump, "Springen", Hud.Tone.Gold);
        }

        protected override void OnBegin() { if (online == null) ResetRace(); }

        void ResetRace()
        {
            order.Clear(); firstFinish = -1f; ended = false;
            foreach (var r in racers)
            {
                r.cp = 0; r.falls = 0; r.place = -1; r.best = 0f; r.finishAt = -1f; r.respawning = false;
                r.runner.Respawn(StartSpot(r.seat.slot), 0f);
                r.runner.Freeze();
            }
            rig.Snap(0f);
            Strips();
        }

        protected override void OnPlay()
        {
            foreach (var r in racers) r.runner.Release();
        }

        // ---- online --------------------------------------------------------------------------

        void SetupOnline()
        {
            foreach (var (s, i) in data.sweepers.Select((s, i) => (s, i))) built.sweepers[i].from = s.from / 1000f;
            online = new ParcoursOnline(seats, built, hud, false, (seat, parent) => SpawnFigure(seat, parent, 1f));
            var own = online.Own ? online.Own : online.racers[0];
            rig = CameraRig.Create(own.transform, 7.4f, 19f, 55f, new Vector3(0f, 1.1f, 0f));
            online.rig = rig;
            focus = own.transform;
            AddHud();
            hud.SetControlsVisible(false);
            hud.ShowHint("3rd Person", "Oben wischen dreht die Kamera. Der Stick folgt der Blickrichtung.");
            Invoke(nameof(HideHint), 6f);
            MatchBridge.Register(this);
        }

        void HideHint() => hud.ShowHint(null, null);

        public void OnSnapshot(string json) => online.Apply(json);
        public void OnAim(Vector2 aim) { }
        public void OnTurn(float delta) => rig.Swipe(new Vector2(delta * Mathf.Rad2Deg / Mathf.Max(0.01f, rig.swipeYaw), 0f));

        void UpdateOnline()
        {
            online.Frame(Playing);
            rig.Swipe(hud.Look);
            hud.SetControlsVisible(ControlsVisible);
            var snap = online.Snap;
            if (snap == null) return;
            float t = online.Now, limit = data.limitMs;
            float left = snap.firstFinish >= 0f ? Mathf.Min(limit - t, snap.firstFinish + FinishGrace * 1000f - t) : limit - t;
            hud.SetChip("time", $"{Mathf.CeilToInt(Mathf.Max(0f, left) / 1000f)} s");
            SetTimer(snap.firstFinish >= 0f ? left / (FinishGrace * 1000f) : left / limit);
            if (online.me >= 0) hud.SetChip("place", $"Platz {online.PlaceOf(online.me)}/{online.racers.Count}");
            if (Time.frameCount % 20 != 0) return;
            var order = snap.order ?? new int[0];
            for (int i = 0; i < online.racers.Count; i++)
            {
                int place = System.Array.IndexOf(order, i) + 1;
                Strip(seats[i], place > 0 ? $"· Ziel {place}." : $"· {Mathf.RoundToInt(snap.racers[i].best)} m", place == 1, false);
            }
        }

        void OnDestroy() { online?.Dispose(); }

        Racer Of(ParcoursRunner runner) => racers.FirstOrDefault(r => r.runner == runner);

        // ---- race host -----------------------------------------------------------------------

        public void Reached(Checkpoint cp, ParcoursRunner runner)
        {
            var r = Of(runner);
            if (r == null || phase != Phase.Play || cp.index <= r.cp) return;
            r.cp = cp.index;
            if (r.seat.isPlayer) { cp.Light(); Sfx.Play("chime"); hud.Toast("Kontrollpunkt!", Palette.Accent, 0.6f); }
        }

        public void CheckFall(ParcoursRunner runner)
        {
            var r = Of(runner);
            if (r == null || r.respawning || r.finishAt >= 0f) return;
            var cp = data.checkpoints[Mathf.Clamp(r.cp, 0, data.checkpoints.Length - 1)];
            if (runner.transform.position.y < cp.y - 6f) StartCoroutine(Respawn(r));
        }

        IEnumerator Respawn(Racer r)
        {
            r.respawning = true;
            r.falls++;
            if (r.seat.isPlayer) { hud.Toast("Abgestürzt!", Palette.Warn, 0.6f); Sfx.Play("lose", 0.5f); hud.Fade(1f, 0.25f); }
            yield return new WaitForSeconds(r.seat.isPlayer ? 0.35f : RespawnDelay);
            var cp = data.checkpoints[Mathf.Clamp(r.cp, 0, data.checkpoints.Length - 1)];
            r.runner.Respawn(new Vector3(Mathf.Clamp(cp.x + (r.seat.slot - 1.5f) * 1.2f, -data.width / 2f + 0.6f, data.width / 2f - 0.6f), cp.y + 0.05f, cp.z), 0f);
            if (r.seat.isPlayer) { rig.Snap(0f); hud.Fade(0f, 0.3f); }
            yield return new WaitForSeconds(0.2f);
            r.respawning = false;
        }

        public void Finish(Vector3 at, ParcoursRunner runner)
        {
            var r = Of(runner);
            if (r == null || r.finishAt >= 0f || phase != Phase.Play) return;
            r.finishAt = PlayTime; r.best = data.finishZ;
            order.Add(r); r.place = order.Count;
            runner.Celebrate();
            if (firstFinish < 0f) firstFinish = Time.time;
            Fx.Confetti(at + Vector3.up * 0.5f, r.seat.isPlayer ? 60 : 20);
            if (r.seat.isPlayer) { Sfx.Play("fanfare"); hud.Toast(r.place == 1 ? "Erster im Ziel!" : $"Im Ziel – Platz {r.place}!", Palette.Accent, 1.4f); hud.SetControlsVisible(false); }
            else { Sfx.Play("chime", 0.5f); if (order.Count == 1) hud.Toast($"{r.seat.name} ist im Ziel – noch 20 s!", Palette.Paper, 1.2f); }
            Strips();
        }

        // ---- frame ---------------------------------------------------------------------------

        void Update()
        {
            if (online != null) { UpdateOnline(); return; }
            if (phase != Phase.Play || ended) return;
            float t = Time.time;
            foreach (var r in racers)
            {
                r.best = Mathf.Max(r.best, Mathf.Min(data.finishZ, r.runner.transform.position.z));
                if (r.runner.bot && r.finishAt < 0f && t >= r.nextThink) { r.nextThink = t + 0.08f; Think(r, t); }
            }
            float limit = data.limitMs / 1000f;
            float left = firstFinish >= 0f ? Mathf.Min(limit - PlayTime, FinishGrace - (t - firstFinish)) : limit - PlayTime;
            hud.SetChip("time", $"{Mathf.CeilToInt(Mathf.Max(0f, left))} s");
            SetTimer(firstFinish >= 0f ? left / FinishGrace : left / limit);
            var standing = racers.OrderByDescending(x => x.finishAt >= 0f ? 1 : 0).ThenBy(x => x.place < 0 ? 99 : x.place).ThenByDescending(x => x.best).ToList();
            hud.SetChip("place", $"Platz {standing.IndexOf(racers[0]) + 1}/{racers.Count}");
            if (Time.frameCount % 20 == 0) Strips();
            if (left <= 0f || racers.All(r => r.finishAt >= 0f)) { ended = true; foreach (var r in racers) r.runner.Freeze(); Finish(); }
        }

        void Strips()
        {
            foreach (var r in racers)
                Strip(r.seat, r.finishAt >= 0f ? $"· Ziel {r.place}." : $"· {Mathf.RoundToInt(r.best)} m", r.finishAt >= 0f && r.place == 1, false);
        }

        protected override List<(Seat seat, string value)> Ranking() =>
            racers.OrderByDescending(r => r.finishAt >= 0f ? 1 : 0).ThenBy(r => r.place < 0 ? 99 : r.place).ThenByDescending(r => r.best)
                .Select(r => (r.seat, r.finishAt >= 0f ? $"im Ziel als {r.place}. · {r.finishAt:0.0} s" : $"{Mathf.RoundToInt(r.best)} m · {r.falls}× gefallen")).ToList();

        // ---- bots (after parcoursBot in shared/matches/parcours.ts) ----------------------------

        static int Hash(int a, int b) { uint h = (uint)(a * 73856093) ^ (uint)(b * 19349663); h ^= h >> 13; h *= 0x5bd1e995u; h ^= h >> 15; return (int)(h % 1000u); }

        bool Solid(CourseBox b) => b.tile < 0 || !built.tiles.TryGetValue(b.tile, out var t) || !(t.Known && !t.carries);

        /// <summary>A box that carries at (x, z) near height y at time t (moving boxes where they will be).</summary>
        bool Carried(float x, float z, float y, float t)
        {
            foreach (var b in data.boxes)
            {
                if (b.look == "wall" || b.door >= 0 || !Solid(b)) continue;
                float ox = b.moveAxis == "x" ? b.Offset(t) : 0f, oz = b.moveAxis == "z" ? b.Offset(t) : 0f;
                if (x >= b.x0 + ox + 0.15f && x <= b.x1 + ox - 0.15f && z >= b.z0 + oz && z <= b.z1 + oz && b.y1 <= y + 0.6f && b.y1 >= y - 1.2f) return true;
            }
            return false;
        }

        (bool jump, bool duck) SweeperDanger(Vector3 p, float t)
        {
            bool jump = false, duck = false;
            foreach (var s in data.sweepers)
            {
                if (Mathf.Abs(p.z - s.z) > s.length + 0.8f || Mathf.Abs(p.x - s.x) > s.length + 0.8f) continue;
                for (int k = 1; k <= 8; k++)
                {
                    float a = s.phase + s.speed * (t + k * 0.05f), dx = Mathf.Cos(a), dz = Mathf.Sin(a);
                    float rx = p.x - s.x, rz = p.z - s.z, along = dx * rx + dz * rz, across = Mathf.Abs(dx * rz - dz * rx);
                    if (Mathf.Abs(along) > s.length + 0.4f || across > 0.75f) continue;
                    bool low = s.y1 <= 0.8f;
                    if (low && k >= 3 && k <= 6) jump = true;
                    if (!low) duck = true;
                }
            }
            return (jump, duck);
        }

        void Think(Racer r, float t)
        {
            var run = r.runner;
            if (r.respawning) { run.botMove = Vector3.zero; return; }
            var p = run.transform.position;
            int salt = Hash(r.seat.slot, Mathf.FloorToInt(t / 1.6f));
            float tx = r.laneOffset, mz = 1f;
            // Doors ahead: an opened one, otherwise a guess among the untried ones.
            var row = data.doorRows.FirstOrDefault(dr => dr.z > p.z - 0.5f && dr.z - p.z < 7f);
            if (row != null)
            {
                int open = System.Array.FindIndex(row.doors, d => built.doors[d].Open);
                var untried = Enumerable.Range(0, row.doors.Length).Where(i => !built.doors[row.doors[i]].Tried).ToList();
                tx = row.xs[open >= 0 ? open : untried.Count > 0 ? untried[salt % untried.Count] : 0];
            }
            // Lanes: back out of a dead end, otherwise prefer lanes known to lead on.
            var lanes = data.laneRows.FirstOrDefault(lr => lr.exitZ + 0.5f > p.z - 0.3f && lr.z - p.z < 7f);
            if (lanes != null)
            {
                float pitch = Mathf.Abs(lanes.xs[1] - lanes.xs[0]);
                int here = System.Array.FindIndex(lanes.xs, x => Mathf.Abs(x - p.x) < pitch / 2f);
                if (here >= 0 && p.z > lanes.z + 0.2f && p.z < lanes.exitZ + 0.3f)
                {
                    tx = lanes.xs[here];
                    if (built.doors[lanes.exits[here]].Tried && !built.doors[lanes.exits[here]].Open) mz = -1f;
                }
                else
                {
                    int Worth(int i)
                    {
                        var floor = built.tiles[lanes.floors[i]]; var front = built.doors[lanes.fronts[i]]; var exit = built.doors[lanes.exits[i]];
                        if ((floor.Known && !floor.carries) || (front.Tried && !front.Open) || (exit.Tried && !exit.Open)) return 0;
                        return exit.Open ? 3 : front.Open ? 2 : 1;
                    }
                    int bestWorth = Enumerable.Range(0, lanes.xs.Length).Max(Worth);
                    var picks = Enumerable.Range(0, lanes.xs.Length).Where(i => Worth(i) == bestWorth).ToList();
                    tx = lanes.xs[picks[salt % picks.Count]];
                }
            }
            // Seesaws: stay in the middle.
            if (data.boxes.Any(b => b.seesaw >= 0 && p.z > b.z0 - 1f && p.z < b.z1)) tx = 0f;
            // Moving island ahead across a gap: wait at the edge until it will be in front, then aim where it will be.
            var island = data.boxes.FirstOrDefault(b => b.Moves && b.moveAxis == "x" && b.look != "pusher" && b.z0 > p.z && b.z0 - p.z < 2.6f);
            bool waiting = false;
            if (island != null && run.Grounded)
            {
                float soon = island.CenterX(t + 0.5f), half = (island.x1 - island.x0) / 2f;
                if (Mathf.Abs(p.x - soon) < half - 0.5f) tx = soon; else { tx = p.x; mz = 0f; waiting = true; }
            }
            var onIsland = data.boxes.FirstOrDefault(b => b.Moves && b.moveAxis == "x" && b.look != "pusher" && p.z >= b.z0 && p.z <= b.z1);
            if (onIsland != null) tx = Mathf.Clamp(tx, onIsland.CenterX(t) - 0.8f, onIsland.CenterX(t) + 0.8f);
            // Pushers: wait until the sweep has passed the lane.
            var pusher = data.boxes.FirstOrDefault(b => b.Moves && b.look == "pusher" && b.z0 > p.z - 0.3f && b.z0 - p.z < 1.6f);
            if (pusher != null && Mathf.Abs(pusher.CenterX(t + 0.4f) - p.x) < 2f) { mz = 0f; waiting = true; }
            float dxs = Mathf.Clamp(tx - p.x, -1f, 1f);
            run.botMove = new Vector3(dxs, 0f, mz).normalized * (mz == 0f && Mathf.Abs(dxs) < 0.05f ? 0f : 1f);
            // Jumps: low bars, and the floor ending ahead (gap, trench, onto an island).
            var (jumpBar, duckBar) = SweeperDanger(p, t);
            run.botDuck = duckBar;
            bool gap = mz > 0f && !waiting && run.Grounded && !Carried(p.x, p.z + 0.9f, p.y, t) && (Carried(p.x, p.z + 2.6f, p.y, t + 0.4f) || Carried(p.x, p.z + 3.6f, p.y, t + 0.5f));
            if ((jumpBar || gap) && run.Grounded && !duckBar) run.BotJump();
            // A long gap needs the dive at the top of the jump.
            if (!run.Grounded && mz > 0f && run.Velocity.y < 1f && run.Velocity.y > -2f && !Carried(p.x, p.z + 1.6f, p.y - 0.5f, t) && Carried(p.x, p.z + 3.2f, p.y - 0.5f, t + 0.3f)) run.BotDive();
        }
    }
}
