using System.Collections;
using System.Collections.Generic;
using System.Linq;
using UnityEngine;
using UnityEngine.SceneManagement;
using UnityEngine.UIElements;

namespace GSG.Lava
{
    /// <summary>
    /// Floor is Lava as a Unity test: the rules of shared/matches/floorIsLava.ts (three floors of
    /// 9 × 13 temple slabs, 0.8 s until a stepped slab crumbles, rune slabs return after 2.5 s, the
    /// outer ring collapses at 16 s and 23 s, +1 per opponent who falls earlier, +3 shared by the
    /// survivors, three rounds and a tiebreak) played on one phone against three bots. Holes,
    /// drops and shoves are real physics here instead of a tile grid.
    /// </summary>
    public class LavaGame : MonoBehaviour
    {
        public const int Cols = 9, Rows = 13, Floors = 3;
        const float Tile = LavaRunner.Tile, Gap = 3.2f, Slab = 0.5f;
        const float CrackTime = 0.8f, RegenTime = 2.5f, RegenShare = 0.35f, StartGrace = 0.5f, RoundMax = 30f, PauseTime = 2.6f, TiebreakMax = 25f, WinBonus = 3f, PushCredit = 1.5f;
        static readonly float[] RingAt = { 16f, 23f };
        const int Rounds = 3, Bots = 3;

        public enum State { Title, Countdown, Play, Between, Paused, Ended }
        public State state = State.Title;

        LavaTile[] tiles;
        readonly Dictionary<Collider, LavaTile> byCollider = new();
        readonly Dictionary<LavaTile, float> returnAt = new();
        readonly List<LavaRunner> runners = new();
        List<LavaRunner> active = new();
        LavaRunner player;
        Hud hud;
        CameraRig rig;
        Transform focus;
        VisualElement panel, timerFill;
        int round, rings, shownFloor = -1;
        bool tiebreak;
        float roundStart, stateUntil, lavaY, nextBot;
        State before;
        string tiebreakWinner;
        readonly List<(Dictionary<LavaRunner, float> points, List<LavaRunner> winners, bool tiebreak)> history = new();

        static float FloorY(int f) => -f * Gap;
        static Vector3 TileCenter(int c, int r, int f) => new Vector3((c - (Cols - 1) / 2f) * Tile, FloorY(f), (r - (Rows - 1) / 2f) * Tile);
        static int Ring(int c, int r) => Mathf.Min(Mathf.Min(c, r), Mathf.Min(Cols - 1 - c, Rows - 1 - r));
        static Rect Bounds => new Rect(-Cols * Tile / 2f, -Rows * Tile / 2f, Cols * Tile, Rows * Tile);
        static int FloorOf(float y) => Mathf.Clamp(Mathf.RoundToInt(-(y + 0.01f) / Gap), 0, Floors - 1);

        void Start()
        {
            AppLink.Apply();
            Sfx.Ensure();
            Fx.Ensure();
            Physics.gravity = new Vector3(0f, -22f, 0f);
            Build();
            Runners();
            focus = new GameObject("Kamerafokus").transform;
            rig = CameraRig.Create(focus, 13.5f, 58f, 50f, Vector3.zero);
            rig.composer.TargetOffset = Vector3.zero;
            var comp = rig.composer.Composition; comp.ScreenPosition = new Vector2(0f, 0.05f); rig.composer.Composition = comp;
            rig.recenterAfter = 0f;
            Hud();
            ResetBoard();
            PlaceAll(runners, 0);
            ShowTitle();
        }

        // ---- world ---------------------------------------------------------------------------

        void Build()
        {
            var root = new GameObject("Tempel").transform;
            var stone = Resources.Load<Material>("GSG/Materials/Stone");
            var rune = Resources.Load<Material>("GSG/Materials/Rune");
            var dark = Resources.Load<Material>("GSG/Materials/StoneDark");
            var floorMats = new Material[Floors];
            for (int f = 0; f < Floors; f++)
            {
                floorMats[f] = new Material(stone) { name = "Stein Etage " + (f + 1) };
                floorMats[f].SetColor("_BaseColor", Color.Lerp(Palette.Stone, Palette.StoneShadow, f * 0.22f));
            }
            tiles = new LavaTile[Cols * Rows * Floors];
            for (int f = 0; f < Floors; f++)
                for (int r = 0; r < Rows; r++)
                    for (int c = 0; c < Cols; c++)
                    {
                        var go = GameObject.CreatePrimitive(PrimitiveType.Cube);
                        go.name = $"Platte {f + 1}-{c}-{r}";
                        go.transform.SetParent(root, false);
                        var center = TileCenter(c, r, f);
                        go.transform.position = center + Vector3.down * (Slab / 2f);
                        go.transform.localScale = new Vector3(Tile - 0.07f, Slab, Tile - 0.07f);
                        go.GetComponent<Renderer>().sharedMaterial = floorMats[f];
                        var runeGo = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
                        Destroy(runeGo.GetComponent<Collider>());
                        runeGo.name = "Rune";
                        runeGo.transform.SetParent(go.transform, false);
                        runeGo.transform.localPosition = new Vector3(0f, 0.52f, 0f);
                        runeGo.transform.localScale = new Vector3(0.3f, 0.02f, 0.3f);
                        runeGo.GetComponent<Renderer>().sharedMaterial = rune;
                        runeGo.GetComponent<Renderer>().shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off;
                        int i = f * Cols * Rows + r * Cols + c;
                        var tile = new LavaTile(i, f, c, r, Ring(c, r), go, floorMats[f], runeGo.transform);
                        tiles[i] = tile;
                        byCollider[tile.collider] = tile;
                    }

            lavaY = FloorY(Floors - 1) - 2.4f;
            var lava = GameObject.CreatePrimitive(PrimitiveType.Cube);
            Destroy(lava.GetComponent<Collider>());
            lava.name = "Lava";
            lava.transform.SetParent(root, false);
            lava.transform.position = new Vector3(0f, lavaY - 0.5f, 0f);
            lava.transform.localScale = new Vector3(160f, 1f, 160f);
            lava.GetComponent<Renderer>().sharedMaterial = Resources.Load<Material>("GSG/Materials/Lava");
            lava.GetComponent<Renderer>().shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off;
            Fx.Looping("Glut", lava.transform, new Vector3(0.25f, 0.01f, 0.25f), Palette.LavaGlow, 22f, 2.6f, 2.2f, 0.12f, true, Vector3.up).transform.localPosition = new Vector3(0f, 0.55f, 0f);

            // Temple: pillars at the corners and the long sides, each carrying a fire bowl.
            float hx = Cols * Tile / 2f + 1.6f, hz = Rows * Tile / 2f + 1.6f;
            foreach (var (x, z) in new[] { (-hx, -hz), (hx, -hz), (-hx, hz), (hx, hz), (-hx, 0f), (hx, 0f), (-hx, -hz / 2f), (hx, -hz / 2f), (-hx, hz / 2f), (hx, hz / 2f) })
            {
                var pillar = GameObject.CreatePrimitive(PrimitiveType.Cube);
                pillar.name = "Säule";
                pillar.transform.SetParent(root, false);
                float top = 1.2f;
                pillar.transform.position = new Vector3(x, (lavaY + top) / 2f, z);
                pillar.transform.localScale = new Vector3(1.3f, top - lavaY, 1.3f);
                pillar.GetComponent<Renderer>().sharedMaterial = dark;
                var bowl = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
                Destroy(bowl.GetComponent<Collider>());
                bowl.transform.SetParent(root, false);
                bowl.transform.position = new Vector3(x, top + 0.2f, z);
                bowl.transform.localScale = new Vector3(1.5f, 0.2f, 1.5f);
                bowl.GetComponent<Renderer>().sharedMaterial = Resources.Load<Material>("GSG/Materials/Lava");
                Fx.Looping("Feuer", bowl.transform, new Vector3(0.6f, 0.2f, 0.6f), Palette.LavaGlow, 14f, 0.8f, 2f, 0.3f, true, Vector3.up).transform.localPosition = Vector3.up * 0.6f;
            }
        }

        void Runners()
        {
            var ids = new List<string>(Figure.BaseIds);
            string own = System.Array.IndexOf(Figure.BaseIds, AppLink.Figure) >= 0 ? AppLink.Figure : Figure.BaseIds[0];
            ids.Remove(own);
            for (int i = 0; i <= Bots; i++)
            {
                var go = new GameObject(i == 0 ? "Du" : "Bot " + i);
                var r = go.AddComponent<LavaRunner>();
                r.slot = i; r.isPlayer = i == 0;
                string figureId = i == 0 ? own : ids[(i - 1) % ids.Count];
                r.displayName = i == 0 ? "Du" : char.ToUpperInvariant(figureId[4]) + figureId.Substring(5);
                var holder = new GameObject("Halter").transform; holder.SetParent(go.transform, false);
                r.figure = Figure.Spawn(figureId, i, holder);
                r.figure.transform.SetParent(go.transform, true);
                Destroy(holder.gameObject);
                runners.Add(r);
                if (i == 0) player = r;
            }
        }

        void ResetBoard()
        {
            returnAt.Clear();
            foreach (var t in tiles) t.Reset(Random.value < RegenShare);
            rings = 0;
        }

        void PlaceAll(List<LavaRunner> who, int roundIndex)
        {
            for (int i = 0; i < who.Count; i++)
            {
                float a = i / (float)who.Count * Mathf.PI * 2f + roundIndex * 0.5f;
                var at = new Vector3(Mathf.Cos(a) * 2.6f * Tile, 0.05f, Mathf.Sin(a) * 3.6f * Tile);
                who[i].Place(at, -new Vector3(at.x, 0f, at.z).normalized, Time.time, 99f);
            }
            foreach (var r in runners) if (!who.Contains(r)) { r.alive = false; r.Out(Time.time); r.outAt = -1f; }
        }

        // ---- shell ---------------------------------------------------------------------------

        void Hud()
        {
            hud = GSG.Hud.Create();
            hud.AddRoundButton("pause", GSG.Hud.Icon.Pause, Pause);
            hud.AddChip("round", "Durchgang 1/3");
            hud.AddChip("points", "Punkte 0");
            hud.AddChip("left", "4 im Spiel");
            hud.AddAction("b", GSG.Hud.Icon.Shove, "Schubsen", GSG.Hud.Tone.Cyan);
            hud.AddAction("n", GSG.Hud.Icon.Dive, "Hechten", GSG.Hud.Tone.Pink);
            hud.AddAction("a", GSG.Hud.Icon.Jump, "Springen", GSG.Hud.Tone.Gold);
            timerFill = hud.Bar();
        }

        void ShowTitle()
        {
            state = State.Title;
            hud.SetControlsVisible(false);
            hud.SetTopVisible(false);
            panel = hud.Panel("Unity-Test · Floor is Lava", "Floor is Lava",
                "Drei Etagen über der Lava: Jede Platte zerbröselt 0,8 s nach dem ersten Schritt. Über einem Loch fällst du eine Etage tiefer – unter der untersten wartet die Lava. Ab Sekunde 16 und 23 stürzt der Rand ein. Platten mit Rune kommen zurück. Du gegen drei Bots, drei Durchgänge.",
                new List<(string, GSG.Hud.Tone, System.Action)> { ("Los geht's", GSG.Hud.Tone.Gold, Begin) }, true);
        }

        void Begin()
        {
            hud.Close(panel); panel = null;
            Sfx.Instance.StartLoops();
            hud.SetTopVisible(true);
            foreach (var r in runners) r.points = 0f;
            history.Clear(); round = 0; tiebreakWinner = null;
            StartRound(runners.ToList(), false);
        }

        void StartRound(List<LavaRunner> who, bool isTiebreak)
        {
            round++; tiebreak = isTiebreak;
            active = who;
            ResetBoard();
            shownFloor = -1;
            PlaceAll(who, round - 1);
            state = State.Countdown; stateUntil = Time.time + 1.3f;
            hud.SetControlsVisible(who.Contains(player));
            hud.Toast(isTiebreak ? "Stechrunde!" : $"Durchgang {round} von {Rounds}", Palette.Accent, 0.9f);
            Sfx.Play("sting");
            hud.SetChip("round", isTiebreak ? "Stechrunde" : $"Durchgang {round}/{Rounds}");
        }

        void Update()
        {
            if (state == State.Title || state == State.Paused) { Follow(); return; }
            float t = Time.time;
            // Presses are read per frame and consumed by the next fixed step.
            if (player.alive && state == State.Play)
            {
                var d = rig.Relative(hud.Stick);
                player.stick = new Vector2(d.x, d.z);
                if (hud.Pressed("a")) player.wantJump = true;
                if (hud.Pressed("b")) player.wantShove = true;
                if (hud.Pressed("n")) player.wantDive = true;
            }
            else player.stick = Vector2.zero;
            hud.SetCooldown("a", Mathf.Clamp01((player.jumpReady - t) / player.jumpCooldown));
            hud.SetCooldown("b", Mathf.Clamp01((player.shoveReady - t) / player.shoveCooldown));
            hud.SetCooldown("n", Mathf.Clamp01((player.diveReady - t) / player.diveCooldown));
            hud.SetChip("points", "Punkte " + Format(player.points));
            hud.SetChip("left", active.Count(r => r.alive) + " im Spiel");
            float limit = tiebreak ? TiebreakMax : RoundMax;
            timerFill.style.width = Length.Percent(state == State.Play ? Mathf.Clamp01(1f - (t - roundStart) / limit) * 100f : 100f);

            foreach (var tile in tiles)
            {
                if (tile.Tick(Time.deltaTime, Fx.Reduced) && Near(tile.floor))
                {
                    Fx.Splash(new Vector3(tile.Center.x, lavaY + 0.2f, tile.Center.z), Palette.LavaGlow, 6);
                }
                if (tile.RiseDone) tile.Settle();
            }
            if (state == State.Countdown && t >= stateUntil)
            {
                state = State.Play; roundStart = t;
                foreach (var r in active) r.invulnUntil = t + StartGrace;
                hud.Toast("Los!", Palette.Accent, 0.4f);
            }
            if (state == State.Between && t >= stateUntil) NextRound();
            Follow();
        }

        bool Near(int floor) => Mathf.Abs(floor - FocusFloor) <= 1;
        int FocusFloor => FloorOf(focus.position.y);

        void Follow()
        {
            var target = player.alive ? player : active.FirstOrDefault(r => r.alive) ?? player;
            var p = target.transform.position;
            int f = target.alive ? FloorOf(p.y) : FocusFloor;
            var goal = new Vector3(p.x * 0.55f, FloorY(f), p.z * 0.6f);
            focus.position = Ease.Damp(focus.position, goal, 4f, Time.unscaledDeltaTime);
            if (f != shownFloor)
            {
                shownFloor = f;
                // Floors above the followed runner are hidden so they never cover the action.
                foreach (var tile in tiles)
                    if (tile.state == LavaTile.State.Intact || tile.state == LavaTile.State.Cracking)
                        tile.SetVisible(tile.floor >= f);
            }
        }

        void FixedUpdate()
        {
            float t = Time.time, dt = Time.fixedDeltaTime;
            // Before the start the runners stand idle on the top floor (physics still steps).
            if (state == State.Title) { foreach (var r in runners) if (r.alive) { r.stick = Vector2.zero; r.Step(t, dt, Bounds); } return; }
            if (state != State.Play && state != State.Countdown) return;
            if (state == State.Countdown) { foreach (var r in active) { r.stick = Vector2.zero; r.Step(t, dt, Bounds); } return; }
            float roundTime = t - roundStart;
            if (t >= nextBot) { nextBot = t + 0.12f; foreach (var r in active) if (!r.isPlayer && r.alive) Bot(r, t); }
            foreach (var r in active)
            {
                var evt = r.Step(t, dt, Bounds);
                if (evt != null) Answer(r, evt);
            }
            Shoves(t);
            Steps(t);
            Timers(t, roundTime);
            foreach (var r in active)
                if (r.alive && r.transform.position.y < lavaY + 0.4f) Lava(r, t);
            int alive = active.Count(r => r.alive);
            if (alive <= 1 || roundTime >= (tiebreak ? TiebreakMax : RoundMax)) EndRound(t);
        }

        void Answer(LavaRunner r, string evt)
        {
            bool mine = r.isPlayer;
            switch (evt)
            {
                case "jump": if (mine) Sfx.Play("jump", 0.8f); r.figure?.Shot("jumpStart", 0.3f, 0.05f, 1.7f, 0.1f); break;
                case "dive": if (mine) Sfx.Play("dive"); r.figure?.Shot("dash", 0.45f, 0.05f, 1.3f); Fx.Dust(r.transform.position, Palette.Stone, 4); break;
                case "shove": if (mine || Near(FloorOf(r.transform.position.y))) Sfx.Play("shove", mine ? 1f : 0.5f); break;
                case "land": if (mine) Sfx.Play("land", 0.6f); r.figure?.Squash(); Fx.Dust(r.transform.position, Palette.Stone, 3); break;
            }
        }

        void Shoves(float t)
        {
            for (int i = 0; i < active.Count; i++)
                for (int j = i + 1; j < active.Count; j++)
                {
                    var a = active[i]; var b = active[j];
                    if (!a.alive || !b.alive || a.grounded != b.grounded) continue;
                    var pa = a.transform.position; var pb = b.transform.position;
                    if (Mathf.Abs(pa.y - pb.y) > 0.8f) continue;
                    var d = new Vector3(pb.x - pa.x, 0f, pb.z - pa.z);
                    if (d.magnitude > a.radius + b.radius + 0.12f) continue;
                    foreach (var (hitter, victim, dir) in new[] { (a, b, d.normalized), (b, a, -d.normalized) })
                    {
                        if (t >= hitter.shoveUntil || t < victim.invulnUntil || t < victim.slideUntil) continue;
                        victim.Knock(dir, hitter.displayName, t);
                        hitter.shoveUntil = t;
                        hitter.Body.linearVelocity *= 0.3f;
                        Sfx.Play("hit", hitter.isPlayer || victim.isPlayer ? 1f : 0.4f);
                        Fx.Sparks((pa + pb) / 2f + Vector3.up, Palette.Accent, 10);
                        if (hitter.isPlayer || victim.isPlayer) { Fx.Shake(0.45f); Fx.HitStop(0.05f); hud.Toast("Schubser!", Palette.Rune, 0.5f); }
                        break;
                    }
                }
        }

        LavaTile Under(LavaRunner r)
        {
            if (!r.grounded) return null;
            return Physics.Raycast(r.transform.position + Vector3.up * 0.3f, Vector3.down, out var hit, 0.7f, ~(1 << 2), QueryTriggerInteraction.Ignore) && byCollider.TryGetValue(hit.collider, out var tile) ? tile : null;
        }

        void Steps(float t)
        {
            foreach (var r in active)
            {
                if (!r.alive || t < r.invulnUntil) continue;
                var tile = Under(r);
                if (tile == null || tile.state != LavaTile.State.Intact) continue;
                tile.Crack(CrackTime);
                if (r.isPlayer) Sfx.Play("crack", 0.45f);
            }
        }

        void Timers(float t, float roundTime)
        {
            foreach (var tile in tiles)
            {
                if (tile.state == LavaTile.State.Cracking && tile.timer <= 0f)
                {
                    tile.Drop();
                    if (Near(tile.floor) && Random.value < 0.35f) Sfx.Play("sizzle", 0.35f);
                    if (tile.regen && tile.ring >= rings) returnAt[tile] = t + RegenTime;
                }
            }
            foreach (var (tile, at) in returnAt.ToList())
            {
                if (t < at) continue;
                returnAt.Remove(tile);
                if (tile.ring >= rings && (tile.state == LavaTile.State.Gone || tile.state == LavaTile.State.Falling))
                {
                    tile.Rise(0.6f);
                    tile.SetVisible(tile.floor >= shownFloor);
                    if (Near(tile.floor)) Fx.Glow(tile.Center, Palette.Rune, 5);
                }
            }
            // The edge glows 1.5 s ahead, then the whole ring falls on every floor.
            int due = RingAt.Count(x => roundTime >= x);
            float nextAt = rings < RingAt.Length ? RingAt[rings] : float.MaxValue;
            float warn = Mathf.Clamp01(1f - (nextAt - roundTime) / 1.5f);
            if (warn > 0f && due == rings) foreach (var tile in tiles) if (tile.ring == rings) tile.Warn(warn);
            if (due > rings)
            {
                rings = due;
                foreach (var tile in tiles) if (tile.ring < rings) { tile.Drop(); returnAt.Remove(tile); }
                hud.Toast("Der Rand stürzt ein!", Palette.Hot, 0.9f);
                Sfx.Play("rumble");
                Fx.Shake(0.6f);
            }
        }

        void Lava(LavaRunner r, float t)
        {
            bool pushed = r.pushedBy != null && t - r.pushedAt <= PushCredit;
            var at = r.transform.position;
            r.Out(t);
            Fx.Splash(new Vector3(at.x, lavaY + 0.3f, at.z), Palette.Lava, 24);
            Fx.Glow(new Vector3(at.x, lavaY + 0.3f, at.z), Palette.LavaGlow, 14);
            Sfx.Play(r.isPlayer ? "lose" : "sizzle", r.isPlayer ? 1f : 0.6f);
            if (r.isPlayer) { hud.Toast(pushed ? "Reingeschubst!" : "In die Lava!", Palette.Hot, 1.2f); hud.SetControlsVisible(false); hud.ReleaseAll(); Fx.Shake(0.5f); }
            else hud.Toast($"{r.displayName}: {(pushed ? "reingeschubst" : "in der Lava")}", Palette.LavaGlow, 0.7f);
        }

        void EndRound(float t)
        {
            var took = active.Where(r => r.alive || r.outAt > 0f).ToList();
            var alive = took.Where(r => r.alive).ToList();
            var pts = new Dictionary<LavaRunner, float>();
            foreach (var r in took)
            {
                float mine = r.alive ? float.MaxValue : r.outAt;
                pts[r] = took.Count(o => o != r && !o.alive && o.outAt < mine);
            }
            var winners = alive.Count > 0 ? alive : took.Where(r => Mathf.Approximately(r.outAt, took.Max(o => o.outAt))).ToList();
            if (alive.Count > 0) foreach (var w in winners) pts[w] += WinBonus / winners.Count;
            if (tiebreak) { if (winners.Count == 1) tiebreakWinner = winners[0].displayName; }
            else foreach (var (r, n) in pts) r.points = Mathf.Round((r.points + n) * 100f) / 100f;
            history.Add((pts, winners, tiebreak));
            state = State.Between; stateUntil = t + PauseTime;
            bool won = winners.Contains(player);
            hud.Toast(won ? (winners.Count == 1 ? "Durchgang gewonnen!" : "Geteilter Sieg!") : $"{string.Join(" & ", winners.Select(w => w.displayName))} gewinnt", won ? Palette.Accent : Palette.Paper, 1.6f);
            Sfx.Play(won ? "fanfare" : "chime");
            if (won) Fx.Confetti(player.transform.position + Vector3.up, 40);
            foreach (var w in winners) if (w.alive) w.figure?.Loop("cheer", 0.2f);
            hud.SetControlsVisible(false);
            hud.ReleaseAll();
        }

        void NextRound()
        {
            if (!tiebreak && round < Rounds) { StartRound(runners.ToList(), false); return; }
            float best = runners.Max(r => r.points);
            var tied = runners.Where(r => Mathf.Approximately(r.points, best)).ToList();
            if (!tiebreak && tied.Count > 1) { StartRound(tied, true); return; }
            Finish();
        }

        void Finish()
        {
            state = State.Ended;
            hud.SetControlsVisible(false);
            var order = runners.OrderByDescending(r => r.points).ThenByDescending(r => r.displayName == tiebreakWinner ? 1 : 0).ToList();
            bool first = order[0] == player;
            Sfx.Play(first ? "fanfare" : "sting");
            if (first) Fx.Confetti(focus.position + Vector3.up * 2f, 60);
            panel = hud.Panel("Ergebnis", first ? "Du hast gewonnen!" : $"Platz {order.IndexOf(player) + 1}",
                tiebreakWinner != null ? $"Die Stechrunde gewann {tiebreakWinner}." : "+1 für jede Person, die vor dir fällt, +3 für den Durchgangssieg.",
                new List<(string, GSG.Hud.Tone, System.Action)> { ("Nochmal spielen", GSG.Hud.Tone.Gold, Restart) });
            foreach (var r in order)
            {
                int wins = history.Count(h => !h.tiebreak && h.winners.Contains(r));
                hud.AddRow(panel, Palette.Player(r.slot), r.displayName, $"{Format(r.points)} Pkt · {wins} Siege");
            }
        }

        static string Format(float v) => Mathf.Approximately(v, Mathf.Round(v)) ? Mathf.RoundToInt(v).ToString() : v.ToString("0.#");

        void Pause()
        {
            if (state != State.Play && state != State.Countdown && state != State.Between) return;
            before = state; state = State.Paused;
            Time.timeScale = 0f; Fx.Paused = true;
            hud.ReleaseAll();
            hud.SetControlsVisible(false);
            BuildPause();
        }

        void BuildPause()
        {
            panel = hud.Panel("Pause", "Kurz durchatmen", tiebreak ? "Stechrunde" : $"Durchgang {round} von {Rounds}",
                new List<(string, GSG.Hud.Tone, System.Action)>
                {
                    ("Weiter", GSG.Hud.Tone.Gold, Resume),
                    ("Neu starten", GSG.Hud.Tone.Stone, Restart),
                    (Sfx.SfxOn ? "Geräusche aus" : "Geräusche an", GSG.Hud.Tone.Stone, () => { Sfx.SfxOn = !Sfx.SfxOn; Sfx.Instance.ApplyGain(); hud.Close(panel); BuildPause(); }),
                    (Sfx.MusicOn ? "Musik aus" : "Musik an", GSG.Hud.Tone.Stone, () => { Sfx.MusicOn = !Sfx.MusicOn; Sfx.Instance.ApplyGain(); hud.Close(panel); BuildPause(); })
                });
        }

        void Resume()
        {
            hud.Close(panel); panel = null;
            Time.timeScale = 1f; Fx.Paused = false;
            state = before;
            hud.SetControlsVisible(player.alive && state != State.Between);
        }

        void Restart()
        {
            Time.timeScale = 1f; Fx.Paused = false;
            hud.Fade(1f, 0.3f);
            StartCoroutine(Reload());
        }

        IEnumerator Reload()
        {
            yield return new WaitForSecondsRealtime(0.32f);
            SceneManager.LoadScene(SceneManager.GetActiveScene().buildIndex);
        }

        void OnApplicationFocus(bool focused)
        {
            if (!focused && (state == State.Play || state == State.Countdown)) Pause();
        }

        // ---- bots (port of floorIsLava.bot) ---------------------------------------------------

        int TileIndexAt(int f, float tx, float ty)
        {
            if (tx < 0f || ty < 0f || tx >= Cols || ty >= Rows) return -1;
            return f * Cols * Rows + Mathf.FloorToInt(ty) * Cols + Mathf.FloorToInt(tx);
        }

        bool Intact(int i) => i >= 0 && tiles[i].state == LavaTile.State.Intact;

        void Bot(LavaRunner me, float t)
        {
            var p = me.transform.position;
            int f = FloorOf(p.y);
            float mx = p.x / Tile + Cols / 2f, my = p.z / Tile + Rows / 2f;
            int here = TileIndexAt(f, mx, my), salt = (me.slot * 31 + round * 7) % 7, best = here, b = f * Cols * Rows;
            float score = float.NegativeInfinity;
            for (int i = b; i < b + Cols * Rows; i++)
            {
                if (tiles[i].state != LavaTile.State.Intact || i == here) continue;
                int j = i - b; float x = j % Cols + 0.5f, y = j / Cols + 0.5f, d = Vector2.Distance(new Vector2(mx, my), new Vector2(x, y));
                int crowd = active.Count(o => o != me && o.alive && FloorOf(o.transform.position.y) == f && Vector2.Distance(new Vector2(o.transform.position.x / Tile + Cols / 2f, o.transform.position.z / Tile + Rows / 2f), new Vector2(x, y)) < 1.2f);
                float value = -d + tiles[i].ring * 0.6f - crowd * 2f + ((i * 7 + salt) % 5) * 0.05f;
                if (d < 3.2f && value > score) { best = i; score = value; }
            }
            int bj = best - b;
            float tx = bj % Cols + 0.5f, ty = bj / Cols + 0.5f, dx = tx - mx, dy = ty - my, dist = Mathf.Max(1e-3f, Mathf.Sqrt(dx * dx + dy * dy));
            bool crumbling = here >= 0 && tiles[here].state == LavaTile.State.Cracking && tiles[here].timer < 0.25f;
            bool gapAhead = !Intact(TileIndexAt(f, Mathf.Clamp(mx + dx / dist * 0.7f, 0f, Cols - 0.01f), Mathf.Clamp(my + dy / dist * 0.7f, 0f, Rows - 0.01f)));
            LavaRunner victim = null;
            foreach (var o in active)
            {
                if (o == me || !o.alive || FloorOf(o.transform.position.y) != f) continue;
                var rel = (o.transform.position - p) / Tile; rel.y = 0f;
                if (rel.magnitude < 1.1f && Vector3.Dot(rel.normalized, me.facing) > 0.7f) { victim = o; break; }
            }
            bool shove = victim != null && t >= me.shoveReady && me.grounded && ((me.slot * 13 + Mathf.FloorToInt(t / 0.4f)) % 3 == 0);
            var aim = shove ? new Vector2(victim.transform.position.x - p.x, victim.transform.position.z - p.z).normalized : new Vector2(dx / dist, dy / dist);
            bool escape = me.grounded && (crumbling || (gapAhead && dist > 0.8f));
            bool jump = escape && t >= me.jumpReady;
            bool dive = escape && !jump && t >= me.diveReady && t >= me.proneUntil;
            me.stick = aim;
            if (jump) me.wantJump = true;
            if (shove && !dive) me.wantShove = true;
            if (dive) me.wantDive = true;
        }
    }
}
