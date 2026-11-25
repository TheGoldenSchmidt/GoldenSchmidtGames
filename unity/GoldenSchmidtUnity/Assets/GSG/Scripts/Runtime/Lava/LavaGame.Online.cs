using System.Collections;
using System.Collections.Generic;
using System.Linq;
using UnityEngine;
using UnityEngine.UIElements;

namespace GSG.Lava
{
    /// <summary>
    /// Online: the scene draws the room's Floor is Lava (shared/matches/floorIsLava.ts computes, see
    /// unityLavaSnapshot in src/unityMatch.ts). Tiles follow the snapshot's digit string (cracking,
    /// falling, rune slabs rising), runners are placed from it with their jump, dive and drop arcs;
    /// Unity's own HUD sends the stick, jump ("a"), shove ("b") and dive (command 1) back to the room.
    /// "third" follows the own runner from behind, "top" keeps the angled view over the floor.
    /// </summary>
    public partial class LavaGame : IOnlineMatch
    {
        // Times of floorIsLava.ts (ms) for the arcs and the cooldown rings.
        const float DropMs = 450f, JumpMs = 550f, DiveMs = 480f, JumpCooldownMs = 3000f, ShoveCooldownMs = 2500f, DiveCooldownMs = 3500f;
        const float JumpHeight = 1f, DiveHeight = 0.35f, FallGravity = 26f;

        [System.Serializable]
        class SnapRunner
        {
            public string id;
            public float x, y, vx, vy, fx, fy, dropUntil, airUntil, shoveUntil, slideUntil, diveUntil, proneUntil, jumpReady, shoveReady, diveReady, invulnUntil;
            /// <summary>Height above the own floor in metres (only from a simulating host, see `physical`).</summary>
            public float h;
            public int floor;
            public bool alive;
        }
        [System.Serializable]
        class Snap
        {
            public float time, roundStart;
            public int round, rings, tiebreakWinner;
            public string phase, tiles, regen;
            public bool done, tiebreak;
            /// <summary>Pilot "Host rechnet": heights come from the host's physics (`h`) instead of the jump and drop timers.</summary>
            public bool physical;
            public SnapRunner[] runners;
            public float[] points;
            public OnlineEvent[] events;
        }

        /// <summary>Drawing state per seat: field positions of the last two snapshots and the fall into the lava.</summary>
        class Remote { public Vector2 prev, cur; public bool falling, wasAir; public float fallV; }

        bool online, chase, started, built;
        List<Seat> seats;
        Snap snap;
        Remote[] remotes;
        char[] shown;
        int me = -1, lastRound = -1, lastEvent = -1;
        float snapAt, snapInterval = 0.05f, snapTime, prevSnapTime;

        void StartOnline()
        {
            online = true;
            AppLink.Apply();
            Sfx.Ensure();
            Fx.Ensure();
            Physics.gravity = new Vector3(0f, -22f, 0f);
            Build();
            seats = Seat.FromSetup(MatchBridge.Setup);
            me = seats.FindIndex(s => s.isPlayer);
            remotes = new Remote[seats.Count];
            for (int i = 0; i < seats.Count; i++)
            {
                var seat = seats[i];
                var go = new GameObject(seat.isPlayer ? "Du" : string.IsNullOrEmpty(seat.name) ? "Mitspieler " + (i + 1) : seat.name);
                var r = go.AddComponent<LavaRunner>();
                r.slot = seat.slot; r.isPlayer = seat.isPlayer; r.displayName = seat.isPlayer ? "Du" : go.name;
                var holder = new GameObject("Halter").transform; holder.SetParent(go.transform, false);
                r.figure = Figure.Spawn(seat.figureId, seat.slot, holder);
                r.figure.transform.SetParent(go.transform, true);
                Destroy(holder.gameObject);
                r.Remote();
                r.alive = false;
                r.figure.SetVisible(false);
                runners.Add(r);
                remotes[i] = new Remote();
                if (seat.isPlayer) player = r;
            }
            active = runners.ToList();
            chase = me >= 0 && MatchBridge.Setup.view == "third";
            focus = new GameObject("Kamerafokus").transform;
            if (chase)
            {
                // 3rd person: behind the own runner and steep enough to see the slabs ahead; it starts behind
                // the body each round, afterwards only a swipe turns it.
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
            // Online the room keeps running: no pause; the app's menu (give up) stays top right.
            hud = GSG.Hud.Create();
            hud.AddChip("round", "Durchgang 1/3");
            hud.AddChip("points", me >= 0 ? "Punkte 0" : "Zuschauen");
            hud.AddChip("left", seats.Count + " im Spiel");
            hud.AddAction("b", GSG.Hud.Icon.Shove, "Schubsen", GSG.Hud.Tone.Cyan);
            hud.AddAction("n", GSG.Hud.Icon.Dive, "Hechten", GSG.Hud.Tone.Pink);
            hud.AddAction("a", GSG.Hud.Icon.Jump, "Springen", GSG.Hud.Tone.Gold);
            timerFill = hud.Bar();
            hud.SetControlsVisible(false);
            hud.SetTopVisible(true);
            foreach (var t in tiles) t.Reset(false);
            if (chase) { hud.ShowHint("3rd Person", "Oben wischen dreht die Kamera. Der Stick folgt der Blickrichtung."); Invoke(nameof(HideHint), 6f); }
            Sfx.Instance.StartLoops();
            state = State.Countdown;
            MatchBridge.Register(this);
            StartCoroutine(OnlineCountdown(MatchBridge.Setup.startIn / 1000f));
        }

        void HideHint() => hud.ShowHint(null, null);

        /// <summary>The room's start signal (3-2-1 like the local games; late joiners start at once).</summary>
        IEnumerator OnlineCountdown(float seconds)
        {
            float start = Time.realtimeSinceStartup + seconds;
            for (int n = 3; n >= 1; n--)
            {
                float at = start - n * 0.8f;
                if (Time.realtimeSinceStartup > at) continue;
                yield return new WaitForSecondsRealtime(at - Time.realtimeSinceStartup);
                hud.Toast(n.ToString(), Palette.Paper, 0.45f);
                Sfx.Play("tick");
            }
            if (Time.realtimeSinceStartup < start) yield return new WaitForSecondsRealtime(start - Time.realtimeSinceStartup);
            if (seconds > -1f) { hud.Toast("Los!", Palette.Accent, 0.5f); Sfx.Play("sting"); }
            started = true;
            state = State.Play;
        }

        // ---- snapshots -----------------------------------------------------------------------

        public void OnSnapshot(string json)
        {
            // The simulating host draws its own physics; the room only echoes its reports.
            if (hostMode) return;
            var next = JsonUtility.FromJson<Snap>(json);
            if (next?.runners == null || next.runners.Length != runners.Count || next.tiles == null || next.tiles.Length != tiles.Length) return;
            bool newRound = next.round != lastRound;
            if (built && next.time > snapTime) snapInterval = Mathf.Clamp((next.time - snapTime) / 1000f, 0.03f, 0.25f);
            prevSnapTime = built && !newRound ? snapTime : next.time;
            snapTime = next.time;
            snapAt = Time.unscaledTime;
            snap = next;
            lastRound = next.round;
            rings = next.rings; round = next.round; tiebreak = next.tiebreak;
            for (int i = 0; i < runners.Count; i++)
            {
                var s = next.runners[i]; var m = remotes[i]; var r = runners[i];
                var at = new Vector2(s.x, s.y);
                m.prev = built && !newRound ? m.cur : at;
                m.cur = at;
                if (newRound) { m.falling = false; m.wasAir = false; }
                // Just fell: the figure drops into the lava before it disappears.
                if (!newRound && !s.alive && r.alive && !m.falling) { m.falling = true; m.fallV = 2.5f; }
                if (newRound && s.alive) Show(r, s);
            }
            ApplyTiles(newRound);
            built = true;
            // Every round starts with the runners facing the middle: the camera turns behind the own one.
            if (newRound && chase) { var own = next.runners[me]; rig.Snap(Mathf.Atan2(own.fx, own.fy) * Mathf.Rad2Deg); }
            RoomEvents();
        }

        void Show(LavaRunner r, SnapRunner s)
        {
            r.alive = true;
            r.facing = new Vector3(s.fx, 0f, s.fy);
            r.transform.position = World(new Vector2(s.x, s.y), FloorY(s.floor));
            r.figure?.SetVisible(true);
            r.figure?.EndShot();
            r.figure?.Loop("idle", 0f);
        }

        void Hide(LavaRunner r)
        {
            r.alive = false;
            r.figure?.SetVisible(false);
        }

        static Vector3 World(Vector2 field, float y) => new Vector3((field.x - Cols / 2f) * Tile, y, (field.y - Rows / 2f) * Tile);

        /// <summary>Tiles from the room's digit string: 0 gone, 1 intact, 2 cracking, 3 gone but returning.</summary>
        void ApplyTiles(bool reset)
        {
            if (reset || shown == null)
            {
                for (int i = 0; i < tiles.Length; i++)
                {
                    tiles[i].Reset(snap.regen != null && i < snap.regen.Length && snap.regen[i] == '1');
                    char c = snap.tiles[i];
                    if (c == '0' || c == '3') tiles[i].Vanish();
                    else if (c == '2') tiles[i].Crack(CrackTime);
                }
                shown = snap.tiles.ToCharArray();
                shownFloor = -1;
                return;
            }
            var own = me >= 0 && runners[me].alive ? runners[me].transform.position : Vector3.one * 999f;
            for (int i = 0; i < tiles.Length; i++)
            {
                char was = shown[i], now = snap.tiles[i];
                if (was == now) continue;
                shown[i] = now;
                var tile = tiles[i];
                if (now == '2')
                {
                    tile.Crack(CrackTime);
                    var d = tile.Center - own; d.y = 0f;
                    if (d.magnitude < Tile * 0.8f && Mathf.Abs(tile.Center.y - own.y) < 1f) Sfx.Play("crack", 0.45f);
                }
                else if (now == '0' || now == '3')
                {
                    if (tile.state == LavaTile.State.Gone || tile.state == LavaTile.State.Falling) continue;
                    tile.Drop();
                    if (Near(tile.floor) && Random.value < 0.35f) Sfx.Play("sizzle", 0.35f);
                }
                else if (now == '1' && (was == '0' || was == '3'))
                {
                    tile.Rise(0.6f);
                    tile.SetVisible(tile.floor >= shownFloor);
                    if (Near(tile.floor)) Fx.Glow(tile.Center, Palette.Rune, 5);
                }
            }
        }

        LavaRunner RunnerOf(OnlineEvent e, int k)
        {
            if (e.ids == null || e.ids.Length <= k) return null;
            int i = seats.FindIndex(s => MatchBridge.Setup.players[s.index].id == e.ids[k]);
            return i >= 0 ? runners[i] : null;
        }

        /// <summary>Room events as the same sounds, toasts and effects as the local test.</summary>
        void RoomEvents()
        {
            if (snap.events == null) return;
            // The first snapshot only sets the mark: no replay of what happened before this device joined.
            if (lastEvent < 0) { lastEvent = snap.events.Length > 0 ? snap.events.Max(e => e.seq) : 0; return; }
            foreach (var e in snap.events.OrderBy(e => e.seq))
            {
                if (e.seq <= lastEvent) continue;
                lastEvent = e.seq;
                var a = RunnerOf(e, 0); var b = RunnerOf(e, 1);
                switch (e.kind)
                {
                    case "round":
                        hud.Toast(e.text, Palette.Accent, 0.9f);
                        Sfx.Play("sting");
                        break;
                    case "result":
                    {
                        var winners = (e.ids ?? new string[0]).Select(id => RunnerOf(new OnlineEvent { ids = new[] { id } }, 0)).Where(w => w != null).ToList();
                        bool won = player != null && winners.Contains(player);
                        hud.Toast(won ? (winners.Count == 1 ? "Durchgang gewonnen!" : "Geteilter Sieg!") : winners.Count > 0 ? $"{string.Join(" & ", winners.Select(w => w.displayName))} gewinnt" : e.text, won ? Palette.Accent : Palette.Paper, 1.6f);
                        Sfx.Play(won ? "fanfare" : "chime");
                        if (won) Fx.Confetti(player.transform.position + Vector3.up, 40);
                        foreach (var w in winners) if (w.alive) w.figure?.Loop("cheer", 0.2f);
                        hud.ReleaseAll();
                        break;
                    }
                    case "out":
                        if (a == null) break;
                        bool pushed = b != null;
                        if (a.isPlayer) { hud.Toast(pushed ? "Reingeschubst!" : "In die Lava!", Palette.Hot, 1.2f); hud.ReleaseAll(); Fx.Shake(0.5f); Sfx.Play("lose"); }
                        else { hud.Toast($"{a.displayName}: {(pushed ? "reingeschubst" : "in der Lava")}", Palette.LavaGlow, 0.7f); Sfx.Play("sizzle", 0.6f); }
                        break;
                    case "shove":
                    {
                        // ids: victim, hitter.
                        if (a == null || b == null) break;
                        bool mine = a.isPlayer || b.isPlayer;
                        a.figure?.Shot("hit", 0.4f, 0.04f, 1.3f);
                        Sfx.Play("hit", mine ? 1f : 0.4f);
                        Fx.Sparks((a.transform.position + b.transform.position) / 2f + Vector3.up, Palette.Accent, 10);
                        if (mine) { Fx.Shake(0.45f); Fx.HitStop(0.05f); hud.Toast("Schubser!", Palette.Rune, 0.5f); }
                        break;
                    }
                    case "shrink":
                        hud.Toast("Der Rand stürzt ein!", Palette.Hot, 0.9f);
                        Sfx.Play("rumble");
                        Fx.Shake(0.6f);
                        break;
                    case "jump": if (a != null) Answer(a, "jump"); break;
                    case "dive": if (a != null) Answer(a, "dive"); break;
                    case "dash": if (a != null) Answer(a, "shove"); break;
                }
            }
        }

        public void OnAim(Vector2 aim) { }
        public void OnTurn(float delta) { if (chase) rig.Swipe(new Vector2(delta * Mathf.Rad2Deg / Mathf.Max(0.01f, rig.swipeYaw), 0f)); }

        // ---- frame ---------------------------------------------------------------------------

        /// <summary>Height over the runner's floor: the drop from the floor above, the dive and the jump arc.</summary>
        float Height(SnapRunner s, float now)
        {
            float y = FloorY(s.floor);
            if (snap != null && snap.physical) return y + s.h;
            if (now < s.dropUntil)
            {
                float k = Mathf.Clamp01(1f - (s.dropUntil - now) / DropMs);
                return Mathf.Lerp(FloorY(Mathf.Max(0, s.floor - 1)), y, k * k);
            }
            if (now < s.diveUntil) { float k = Mathf.Clamp01(1f - (s.diveUntil - now) / DiveMs); return y + 4f * DiveHeight * k * (1f - k); }
            if (now < s.airUntil) { float k = Mathf.Clamp01(1f - (s.airUntil - now) / JumpMs); return y + 4f * JumpHeight * k * (1f - k); }
            return y;
        }

        void UpdateOnline()
        {
            if (!built) { FollowOnline(); return; }
            float alpha = Fx.Reduced ? 1f : Mathf.Clamp01((Time.unscaledTime - snapAt) / snapInterval);
            float now = Mathf.Lerp(prevSnapTime, snapTime, alpha);
            var mine = me >= 0 ? snap.runners[me] : null;
            bool canAct = started && mine != null && mine.alive && snap.phase == "play" && !snap.done;
            if (canAct)
            {
                var d = rig.Relative(hud.Stick);
                bool jump = hud.Pressed("a"), shove = hud.Pressed("b"), dive = hud.Pressed("n");
                // A press carries the stick of the same moment (the dive takes its direction from it).
                MatchBridge.Input(d.x, d.z, 0f, 0f, false, false, jump || shove || dive);
                if (jump) MatchBridge.Press("a");
                if (shove) MatchBridge.Press("b");
                if (dive) MatchBridge.Command(1);
            }
            else if (me >= 0) MatchBridge.Input(0f, 0f, 0f, 0f);
            hud.SetControlsVisible(canAct);
            if (chase) rig.Swipe(hud.Look);

            float t = Time.time;
            for (int i = 0; i < runners.Count; i++)
            {
                var r = runners[i]; var s = snap.runners[i]; var m = remotes[i];
                if (m.falling)
                {
                    m.fallV -= FallGravity * Time.deltaTime;
                    var p = r.transform.position + Vector3.up * (m.fallV * Time.deltaTime);
                    r.transform.position = p;
                    r.grounded = false;
                    if (p.y <= lavaY + 0.3f)
                    {
                        m.falling = false;
                        Fx.Splash(new Vector3(p.x, lavaY + 0.3f, p.z), Palette.Lava, 24);
                        Fx.Glow(new Vector3(p.x, lavaY + 0.3f, p.z), Palette.LavaGlow, 14);
                        Hide(r);
                    }
                    continue;
                }
                if (!s.alive) { if (r.alive) Hide(r); continue; }
                if (!r.alive) Show(r, s);
                r.transform.position = World(Vector2.Lerp(m.prev, m.cur, alpha), Height(s, now));
                r.facing = new Vector3(s.fx, 0f, s.fy);
                r.remoteVelocity = new Vector3(s.vx, 0f, s.vy) * Tile;
                bool air = now < s.airUntil || now < s.dropUntil;
                r.grounded = !air;
                if (m.wasAir && !air) Answer(r, "land");
                m.wasAir = air;
                // The animation reads the room's timers on the local clock.
                r.diveUntil = t + (s.diveUntil - now) / 1000f;
                r.proneUntil = t + (s.proneUntil - now) / 1000f;
                r.shoveUntil = t + (s.shoveUntil - now) / 1000f;
            }

            foreach (var tile in tiles)
            {
                if (tile.Tick(Time.deltaTime, Fx.Reduced) && Near(tile.floor)) Fx.Splash(new Vector3(tile.Center.x, lavaY + 0.2f, tile.Center.z), Palette.LavaGlow, 6);
                if (tile.RiseDone)
                {
                    tile.Settle();
                    // Stepped on (or fallen again) while it was still rising.
                    char c = shown[tile.index];
                    if (c == '2') tile.Crack(CrackTime);
                    else if (c == '0' || c == '3') tile.Drop();
                }
            }
            // The edge glows 1.5 s ahead, then the room lets the whole ring fall on every floor.
            if (snap.phase == "play" && snap.rings < RingAt.Length)
            {
                float warn = Mathf.Clamp01(1f - (RingAt[snap.rings] * 1000f - (now - snap.roundStart)) / 1500f);
                if (warn > 0f) foreach (var tile in tiles) if (tile.ring == snap.rings) tile.Warn(warn);
            }

            if (mine != null)
            {
                hud.SetCooldown("a", Mathf.Clamp01((mine.jumpReady - now) / JumpCooldownMs));
                hud.SetCooldown("b", Mathf.Clamp01((mine.shoveReady - now) / ShoveCooldownMs));
                hud.SetCooldown("n", Mathf.Clamp01((mine.diveReady - now) / DiveCooldownMs));
                if (snap.points != null && me < snap.points.Length) hud.SetChip("points", "Punkte " + Format(snap.points[me]));
            }
            hud.SetChip("round", snap.tiebreak ? "Stechrunde" : $"Durchgang {Mathf.Max(1, snap.round)}/{Rounds}");
            hud.SetChip("left", snap.runners.Count(s => s.alive) + " im Spiel");
            float limit = (snap.tiebreak ? TiebreakMax : RoundMax) * 1000f;
            timerFill.style.width = Length.Percent(snap.phase == "play" ? Mathf.Clamp01(1f - (now - snap.roundStart) / limit) * 100f : 100f);
            FollowOnline();
        }

        void FollowOnline()
        {
            LavaRunner target = player != null && player.alive ? player : runners.FirstOrDefault(r => r.alive);
            if (target == null) return;
            var p = target.transform.position;
            int f = FloorOf(p.y);
            // 3rd person stays right behind the own runner, after a fall behind one still in the round.
            if (chase) focus.position = Ease.Damp(focus.position, p, target == player ? 10f : 4f, Time.unscaledDeltaTime);
            else focus.position = Ease.Damp(focus.position, new Vector3(p.x * 0.55f, FloorY(f), p.z * 0.6f), 4f, Time.unscaledDeltaTime);
            if (f != shownFloor)
            {
                shownFloor = f;
                // Floors above the followed runner are hidden so they never cover the action.
                foreach (var tile in tiles)
                    if (tile.state == LavaTile.State.Intact || tile.state == LavaTile.State.Cracking)
                        tile.SetVisible(tile.floor >= f);
            }
        }
    }
}
