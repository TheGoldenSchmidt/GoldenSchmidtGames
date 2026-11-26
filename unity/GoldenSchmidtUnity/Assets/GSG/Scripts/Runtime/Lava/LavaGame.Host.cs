using System.Collections;
using System.Collections.Generic;
using System.Linq;
using UnityEngine;

namespace GSG.Lava
{
    /// <summary>
    /// Pilot "Unity · Host rechnet": on the host's phone this scene simulates the room's Floor is Lava
    /// with its own physics, exactly like the local test. The own runner follows Unity's HUD at once,
    /// the other phones' runners follow their inputs relayed by the room ("inputs"), the room's bots
    /// use the bot logic of this scene. 25 times a second the state goes back to the room in the
    /// format of unityLavaSnapshot (src/unityMatch.ts) plus the physical height `h`, so every other
    /// phone draws it with the online renderer (LavaGame.Online.cs). The room checks every report.
    /// </summary>
    public partial class LavaGame : IOnlineInputs
    {
        [System.Serializable] class HostInput { public string id; public float x, y; public int ca, cb, cn; public bool gone; }
        [System.Serializable] class HostInputs { public float time; public HostInput[] players; }
        [System.Serializable] class HostMessage { public string type; public Snap snap; }

        // 25 reports a second; the room relays each at once.
        const float ReportEvery = 0.04f;
        bool hostMode, spectator;
        float beganAt = -1f, nextReport;
        int tiebreakSeat = -1, eventSeq;
        readonly List<OnlineEvent> hostEvents = new();
        readonly Dictionary<string, Vector3Int> counters = new();
        readonly HashSet<string> left = new();
        Snap resumeSnap;

        void StartHost()
        {
            hostMode = true;
            AppLink.Apply();
            Sfx.Ensure();
            Fx.Ensure();
            Physics.gravity = new Vector3(0f, -22f, 0f);
            Build();
            var setup = MatchBridge.Setup;
            seats = Seat.FromSetup(setup);
            foreach (var p in setup.players)
            {
                var go = new GameObject(string.IsNullOrEmpty(p.name) ? "Mitspieler" : p.name);
                var r = go.AddComponent<LavaRunner>();
                r.slot = p.slot; r.id = p.id; r.isPlayer = p.id == setup.viewer; r.isBot = p.bot;
                r.displayName = r.isPlayer ? "Du" : go.name;
                var holder = new GameObject("Halter").transform; holder.SetParent(go.transform, false);
                r.figure = Figure.Spawn(p.figure, p.slot, holder);
                r.figure.transform.SetParent(go.transform, true);
                Destroy(holder.gameObject);
                runners.Add(r);
            }
            player = runners.FirstOrDefault(r => r.isPlayer);
            // Watching (e.g. a duel of others): the camera follows the runners, the HUD drives nobody.
            spectator = player == null;
            if (spectator) player = runners[0];
            me = spectator ? -1 : runners.IndexOf(player);
            active = runners.ToList();
            chase = !spectator && setup.view == "third";
            focus = new GameObject("Kamerafokus").transform;
            if (chase)
            {
                rig = CameraRig.Create(focus, 9.5f, 50f, 56f, Vector3.zero);
                rig.recenterAfter = float.PositiveInfinity;
                rig.composer.TargetOffset = Vector3.up * 0.8f;
                var comp = rig.composer.Composition; comp.ScreenPosition = new Vector2(0f, 0.12f); comp.DeadZone.Enabled = false; rig.composer.Composition = comp;
            }
            else
            {
                rig = CameraRig.Create(focus, 13.5f, 58f, 50f, Vector3.zero);
                rig.composer.TargetOffset = Vector3.zero;
                var comp = rig.composer.Composition; comp.ScreenPosition = new Vector2(0f, 0.05f); rig.composer.Composition = comp;
                rig.recenterAfter = 0f;
            }
            Hud();
            ResetBoard();
            PlaceAll(runners, 0);
            hud.SetControlsVisible(false);
            hud.SetTopVisible(true);
            if (!string.IsNullOrEmpty(setup.resume)) resumeSnap = JsonUtility.FromJson<Snap>(setup.resume);
            MatchBridge.Register(this);
            StartCoroutine(HostStart(setup.startIn / 1000f));
        }

        /// <summary>After the room's countdown the simulation starts (a reloaded host continues with points and round).</summary>
        IEnumerator HostStart(float seconds)
        {
            if (seconds > 0f) yield return new WaitForSecondsRealtime(seconds);
            if (resumeSnap == null) { beganAt = Time.time; Begin(); yield break; }
            Sfx.Instance.StartLoops();
            for (int i = 0; i < runners.Count && resumeSnap.points != null && i < resumeSnap.points.Length; i++) runners[i].points = resumeSnap.points[i];
            history.Clear(); tiebreakWinner = null; tiebreakSeat = -1;
            round = Mathf.Max(0, resumeSnap.phase == "play" ? resumeSnap.round - 1 : resumeSnap.round);
            beganAt = Time.time - resumeSnap.time / 1000f;
            resumeSnap = null;
            if (round >= Rounds) NextRound(); else StartRound(Present(runners), false);
        }

        /// <summary>Runners still in the room: players who left for good sit out the next rounds.</summary>
        List<LavaRunner> Present(IEnumerable<LavaRunner> who) => who.Where(r => !left.Contains(r.id ?? "")).ToList();

        /// <summary>Everyone's inputs as the room holds them (stick as a field direction, cumulative tap counters).</summary>
        public void OnInputs(string json)
        {
            if (!hostMode) return;
            var inputs = JsonUtility.FromJson<HostInputs>(json);
            if (inputs?.players == null) return;
            foreach (var p in inputs.players)
            {
                var r = p == null ? null : runners.FirstOrDefault(x => x.id == p.id);
                if (r == null || r.isPlayer || r.isBot) continue;
                if (p.gone) { left.Add(r.id); if (r.alive) Lava(r, Time.time); continue; }
                bool live = state == State.Play && r.alive;
                r.stick = live ? Vector2.ClampMagnitude(new Vector2(p.x, p.y), 1f) : Vector2.zero;
                if (counters.TryGetValue(r.id, out var c) && live)
                {
                    if (p.ca > c.x) r.wantJump = true;
                    if (p.cb > c.y) r.wantShove = true;
                    if (p.cn > c.z) r.wantDive = true;
                }
                counters[r.id] = new Vector3Int(p.ca, p.cb, p.cn);
            }
        }

        void HostTick()
        {
            if (chase) rig.Swipe(hud.Look);
            if (beganAt < 0f || Time.unscaledTime < nextReport || state == State.Ended) return;
            nextReport = Time.unscaledTime + ReportEvery;
            Report("hostsnap");
        }

        void FinishHost()
        {
            state = State.Ended;
            hud.SetControlsVisible(false);
            Report("hostdone");
        }

        /// <summary>An event for the other phones (sounds, toasts and effects of the online renderer).</summary>
        void HostEvent(string kind, string text, params LavaRunner[] who)
        {
            if (!hostMode) return;
            hostEvents.Add(new OnlineEvent { seq = ++eventSeq, kind = kind, text = text, ids = who.Where(w => w != null).Select(w => w.id).ToArray() });
            if (hostEvents.Count > 8) hostEvents.RemoveAt(0);
        }

        /// <summary>The state of this simulation (times in ms on this scene's clock; tiles 0 gone, 1 intact, 2 cracking, 3 gone but returning).</summary>
        void Report(string type)
        {
            float t = Time.time;
            float Ms(float at) => (at - beganAt) * 1000f;
            var tilesText = new System.Text.StringBuilder(tiles.Length);
            var regenText = new System.Text.StringBuilder(tiles.Length);
            foreach (var tile in tiles)
            {
                tilesText.Append(tile.state switch
                {
                    LavaTile.State.Intact or LavaTile.State.Rising => '1',
                    LavaTile.State.Cracking => '2',
                    _ => returnAt.ContainsKey(tile) ? '3' : '0'
                });
                regenText.Append(tile.regen ? '1' : '0');
            }
            var snapshot = new Snap
            {
                time = Ms(t), done = state == State.Ended, round = round, phase = state == State.Ended ? "done" : state == State.Between ? "pause" : "play",
                tiebreak = tiebreak, roundStart = Ms(roundStart), rings = rings, tiles = tilesText.ToString(), regen = regenText.ToString(),
                tiebreakWinner = tiebreakSeat, physical = true, points = runners.Select(r => r.points).ToArray(), events = hostEvents.ToArray(),
                runners = runners.Select(r =>
                {
                    var p = r.transform.position;
                    int f = FloorOf(p.y);
                    var v = r.alive && r.Body && !r.Body.isKinematic ? r.Body.linearVelocity : Vector3.zero;
                    return new SnapRunner
                    {
                        id = r.id, x = p.x / Tile + Cols / 2f, y = p.z / Tile + Rows / 2f, vx = v.x / Tile, vy = v.z / Tile, fx = r.facing.x, fy = r.facing.z,
                        floor = f, alive = r.alive, h = p.y - FloorY(f), dropUntil = 0f, airUntil = r.grounded ? 0f : Ms(t) + 100f,
                        shoveUntil = Ms(r.shoveUntil), slideUntil = Ms(r.slideUntil), diveUntil = Ms(r.diveUntil), proneUntil = Ms(r.proneUntil),
                        jumpReady = Ms(r.jumpReady), shoveReady = Ms(r.shoveReady), diveReady = Ms(r.diveReady), invulnUntil = Ms(r.invulnUntil)
                    };
                }).ToArray()
            };
            MatchBridge.Post(JsonUtility.ToJson(new HostMessage { type = type, snap = snapshot }));
        }
    }
}
