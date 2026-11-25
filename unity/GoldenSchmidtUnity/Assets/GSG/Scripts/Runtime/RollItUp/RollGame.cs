using System.Collections;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.InputSystem;
using ETouch = UnityEngine.InputSystem.EnhancedTouch.Touch;

namespace GSG.RollItUp
{
    /// <summary>
    /// Roll It Up! board in Unity (developer test). The app keeps the rules, bots and minigames
    /// (shared/party.ts through the room authority) and sends a flat snapshot after every change;
    /// this scene draws the Bauschale, walks the figures field by field on the room's timestamps,
    /// rolls the dice to the authoritative result and sends the viewer's decisions back.
    /// </summary>
    public class RollGame : MonoBehaviour
    {
        const float FigureScale = 0.72f;

        class Token
        {
            public RollPlayer player;
            public Figure figure;
            public Transform t;
            public int field = -1;
            public Vector3 pos, glideFrom;
            public float glideT = 1f, yaw;
            public double landedDepart = -1;
            public int coins = int.MinValue, supplies = -1;
        }

        RollField[] fields;
        RollWorld world;
        RollUi ui;
        Hud hud;
        CameraRig rig;
        Transform focus, tokenRoot;
        RollState state, pending;
        double clockOffset;
        bool overview, visible = true, demo;
        float zoom = 1f, lastPinch = -1f;
        int infoField = -1, stepCount;
        string lastDiceKey = "", lastActive = "";
        int lastPhaseId = -1;
        readonly Dictionary<string, Token> tokens = new();
        readonly List<Transform> dice = new();
        float diceStart = -99f;
        int[] diceValues = new int[0];
        RollDemo demoData;
        int demoIndex;
        Camera view;

        void Start()
        {
            AppLink.Apply();
            Sfx.Ensure();
            Fx.Ensure();
            Sfx.SfxOn = PlayerPrefs.GetInt("gsg.roll.sound", 1) == 1;
            world = new RollWorld();
            tokenRoot = new GameObject("Figuren").transform;
            // Kept as a reference: Camera.main is null while the camera is switched off (board hidden).
            view = Camera.main;
            focus = new GameObject("Kamerafokus").transform;
            focus.position = new Vector3(0f, 1f, 0f);
            rig = CameraRig.Create(focus, 30f, 58f, 45f, Vector3.zero);
            rig.composer.TargetOffset = Vector3.zero;
            var comp = rig.composer.Composition; comp.ScreenPosition = new Vector2(0f, 0.06f); comp.DeadZone.Enabled = false; rig.composer.Composition = comp;
            rig.composer.Damping = new Vector2(0.25f, 0.25f);
            var tracker = rig.orbit.TrackerSettings; tracker.PositionDamping = new Vector3(0.15f, 0.2f, 0.15f); rig.orbit.TrackerSettings = tracker;
            rig.recenterAfter = 2.5f;
            hud = Hud.Create();
            hud.SetControlsVisible(false);
            hud.SetTopVisible(false);
            hud.WorldTap += OnWorldTap;
            ui = new RollUi(hud, this);
            var bridge = new GameObject("Bridge").AddComponent<RollBridge>();
            bridge.game = this;
            demo = Application.isEditor || AppLink.Param("demo") == "1";
            if (demo) StartCoroutine(Demo());
        }

        // ---- messages from the app ---------------------------------------------------------

        public void OnBoard(RollBoardMessage board)
        {
            if (fields != null || board?.fields == null || board.fields.Length == 0) return;
            fields = board.fields;
            world.Build(fields, board.board, board.tunnels);
            ui.boardName = world.Grinder ? "Grinder" : "Bauschale";
            foreach (var f in fields)
                if (f.type == "station") ui.Marker("station-" + f.id, world.stationProps[f.id].position + Vector3.up * 2f, f.station, $"{f.price} Münzen", "", false);
            var jay = System.Array.Find(fields, f => f.type == "jayspot");
            if (jay != null) ui.Marker("goal", world.spots[jay.id] + Vector3.up * 2.4f, "Jayspot", "", "goal");
            if (pending != null) { var p = pending; pending = null; OnState(p); }
        }

        public void OnState(RollState s)
        {
            if (s == null) return;
            clockOffset = s.serverNow - Time.realtimeSinceStartupAsDouble * 1000.0;
            if (fields == null) { pending = s; return; }
            var before = state;
            state = s;
            Fx.Reduced = s.reduced || AppLink.ReducedMotion;
            foreach (var p in s.players) Ensure(p);
            Reactions(before, s);
            ui.Render(s);
            Highlights();
            lastPhaseId = s.phaseId;
        }

        public void OnVisible(bool on)
        {
            if (visible == on) return;
            visible = on;
            ui.SetVisible(on);
            if (view) view.enabled = on;
            Application.targetFrameRate = on ? 60 : 4;
            AudioListener.pause = !on;
            if (on) rig.cam.PreviousStateIsValid = false;
        }

        double Now => Time.realtimeSinceStartupAsDouble * 1000.0 + clockOffset;

        // ---- figures -------------------------------------------------------------------------

        void Ensure(RollPlayer p)
        {
            if (!tokens.TryGetValue(p.id, out var t))
            {
                t = new Token();
                var holder = new GameObject("Spieler " + p.name).transform;
                holder.SetParent(tokenRoot, false);
                t.t = holder;
                t.figure = Figure.Spawn(p.characterId, p.slot, holder);
                t.figure.transform.localScale = Vector3.one * FigureScale;
                tokens[p.id] = t;
            }
            t.player = p;
            if (t.field < 0) { t.field = p.position; t.pos = Place(p.id, p.position); t.t.position = t.pos; t.glideT = 1f; }
            else if (t.field != p.position && !(state.moving && p.active))
            {
                // Position changes that are not a walked step (travel, events) glide over in an arc.
                t.glideFrom = t.t.position; t.glideT = 0f; t.field = p.position;
            }
        }

        /// <summary>A field's stand point for one player; players sharing a field stand in a small circle.</summary>
        Vector3 Place(string id, int field)
        {
            var spot = world.spots[Mathf.Clamp(field, 0, world.spots.Length - 1)];
            if (state == null) return spot;
            var here = new List<RollPlayer>();
            foreach (var p in state.players)
            {
                int at = p.active && state.moving ? state.moveFrom : p.position;
                if (at == field) here.Add(p);
            }
            if (here.Count <= 1) return spot;
            int index = Mathf.Max(0, here.FindIndex(p => p.id == id));
            float a = index * Mathf.PI * 2f / here.Count + 0.6f;
            return spot + new Vector3(Mathf.Cos(a), 0f, Mathf.Sin(a)) * 0.42f;
        }

        void Reactions(RollState before, RollState s)
        {
            var active = s.Active;
            // New turn: greet the player whose turn it is.
            if (s.active != lastActive)
            {
                lastActive = s.active;
                if (overview && s.canAct) SetOverview(false);
                if (s.canAct) { Sfx.Play("chime", 0.8f, 1.1f); hud.Toast("Du bist dran!", Palette.Accent, 1.1f); }
                else Sfx.Play("blip", 0.5f);
            }
            // Dice: roll to the room's result.
            if (!string.IsNullOrEmpty(s.diceKey) && s.diceKey != lastDiceKey && s.dice != null && s.dice.Length > 0)
            {
                lastDiceKey = s.diceKey;
                RollDice(s.dice);
                stepCount = 0;
            }
            if (before == null) { foreach (var p in s.players) Remember(p); return; }
            foreach (var p in s.players)
            {
                var t = tokens[p.id];
                var head = t.t.position + Vector3.up * 1.6f;
                if (t.coins != int.MinValue && p.coins != t.coins)
                {
                    int d = p.coins - t.coins;
                    ui.Float(head, (d > 0 ? "+" : "−") + Mathf.Abs(d), d > 0 ? Palette.Accent : Palette.Hex("#ff7d8a"));
                    if (d > 0) { Sfx.Play("chime", 0.6f, 1.2f); Fx.Sparks(head - Vector3.up * 0.6f, Palette.Accent, 10); }
                    else { Sfx.Play("lose", 0.5f); Fx.Shards(head - Vector3.up * 0.6f, Palette.Hex("#c33d4c"), 8); t.figure.Shot("hitLight", 0.6f); }
                }
                int have = p.supplies?.Length ?? 0;
                if (t.supplies >= 0 && have > t.supplies)
                {
                    var name = NewSupply(before.Player(p.id), p);
                    Sfx.Play("fanfare", 0.8f);
                    Fx.Confetti(t.t.position + Vector3.up * 1.2f, 40);
                    t.figure.Shot("cheer", 1.4f);
                    hud.Toast(p.me ? $"{name} gesammelt!" : $"{p.name} kauft {name}", Palette.Accent, 1.2f);
                }
                Remember(p);
            }
            if (s.phaseId != lastPhaseId && s.phase == "summary" && active != null && tokens.TryGetValue(active.id, out var at))
            {
                if (s.summaryType == "event" || s.summaryType == "gift") Sfx.Play("sting", 0.6f);
                if (s.summaryType == "coin") at.figure.Shot("cheer", 1.1f);
            }
            if (s.phase == "finished" && active != null && tokens.TryGetValue(active.id, out var winner))
            {
                winner.figure.Loop("dance");
                Fx.Confetti(winner.t.position + Vector3.up * 1.5f, 80);
                Sfx.Play("fanfare");
            }
        }

        string NewSupply(RollPlayer before, RollPlayer now)
        {
            if (now.supplies == null) return "Utensil";
            foreach (var f in now.supplies)
                if (before?.supplies == null || System.Array.IndexOf(before.supplies, f) < 0)
                    return fields[f].station;
            return "Utensil";
        }

        void Remember(RollPlayer p)
        {
            var t = tokens[p.id];
            t.coins = p.coins;
            t.supplies = p.supplies?.Length ?? 0;
        }

        void Highlights()
        {
            var s = state;
            if (s.phase == "path" && s.canAct && s.paths != null && s.paths.Length > 0)
                world.ShowRoute(s.paths[Mathf.Clamp(ui.selectedPath, 0, s.paths.Length - 1)].route);
            else world.ShowRoute(s.route, true);
            world.ShowObjective(s.moving ? -1 : s.objectiveField);
            var me = s.Me;
            foreach (var f in fields)
                if (f.type == "station")
                {
                    bool owned = me?.supplies != null && System.Array.IndexOf(me.supplies, f.id) >= 0;
                    bool show = overview || f.id == s.objectiveField;
                    ui.Marker("station-" + f.id, world.spots[f.id] * 0.76f + Vector3.up * 2.6f, f.station, owned ? "gesammelt" : $"{f.price} Münzen", owned ? "done" : f.id == s.objectiveField ? "goal" : "", show);
                }
            var jay = System.Array.Find(fields, f => f.type == "jayspot");
            if (jay != null) ui.Marker("goal", world.spots[jay.id] + Vector3.up * 2.4f, "Jayspot", me != null && (me.supplies?.Length ?? 0) >= 6 ? "Weg frei" : "Alle 6 Utensilien", "goal");
        }

        public void OnPathPreview() { if (state != null) Highlights(); }

        public void ToggleOverview() => SetOverview(!overview);

        void SetOverview(bool on)
        {
            overview = on;
            zoom = 1f;
            ui.SetOverview(on);
            if (state != null) Highlights();
        }

        public void ToggleSound()
        {
            Sfx.SfxOn = !Sfx.SfxOn;
            PlayerPrefs.SetInt("gsg.roll.sound", Sfx.SfxOn ? 1 : 0);
            PlayerPrefs.Save();
            if (Sfx.SfxOn) Sfx.Play("click");
        }

        // ---- field info ------------------------------------------------------------------------

        void OnWorldTap(Vector2 screen)
        {
            var cam = view;
            if (!cam || fields == null) return;
            if (Physics.Raycast(cam.ScreenPointToRay(screen), out var hit, 200f) && world.fieldColliders.TryGetValue(hit.collider, out var id))
            {
                var f = fields[id];
                infoField = id;
                world.ShowSelection(id);
                var here = new List<string>();
                if (state != null) foreach (var p in state.players) if (p.position == id) here.Add(p.me ? "du" : p.name);
                string who = here.Count > 0 ? " Hier: " + string.Join(", ", here) + "." : "";
                ui.ShowInfo($"Feld {id} · {f.name}", f.help + who);
                Sfx.Play("blip", 0.6f, 1.2f);
            }
            else ui.HideInfo();
        }

        public void OnInfoClosed() { infoField = -1; world.ShowSelection(-1); }

        // ---- dice ------------------------------------------------------------------------------

        static readonly Vector3[] Faces = { Vector3.zero, Vector3.up, Vector3.right, Vector3.forward, Vector3.back, Vector3.left, Vector3.down };

        Transform MakeDie()
        {
            var die = Kit.Box(null, Palette.Paper, Vector3.zero, Vector3.one, 1.6f).transform;
            die.name = "Würfel";
            var ink = Kit.Toon(Palette.Ink, 0f, 0f);
            for (int v = 1; v <= 6; v++)
            {
                var n = Faces[v];
                var u = Mathf.Abs(n.y) > 0.5f ? Vector3.right : Vector3.up;
                var w = Vector3.Cross(n, u);
                foreach (var (a, b) in Pips(v))
                {
                    var pip = GameObject.CreatePrimitive(PrimitiveType.Sphere);
                    Destroy(pip.GetComponent<Collider>());
                    pip.transform.SetParent(die, false);
                    pip.transform.localPosition = n * 0.5f + (u * a + w * b) * 0.25f;
                    pip.transform.localRotation = Quaternion.LookRotation(n, u);
                    pip.transform.localScale = new Vector3(0.18f, 0.18f, 0.05f);
                    pip.GetComponent<Renderer>().sharedMaterial = ink;
                    pip.GetComponent<Renderer>().shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off;
                }
            }
            die.localScale = Vector3.one * 0.55f;
            die.gameObject.SetActive(false);
            return die;
        }

        static IEnumerable<(float, float)> Pips(int v)
        {
            if (v % 2 == 1) yield return (0f, 0f);
            if (v >= 2) { yield return (-1f, -1f); yield return (1f, 1f); }
            if (v >= 4) { yield return (-1f, 1f); yield return (1f, -1f); }
            if (v == 6) { yield return (-1f, 0f); yield return (1f, 0f); }
        }

        void RollDice(int[] values)
        {
            while (dice.Count < values.Length) dice.Add(MakeDie());
            diceValues = values;
            diceStart = Time.time;
            for (int i = 0; i < dice.Count; i++) dice[i].gameObject.SetActive(i < values.Length);
            Sfx.Play("whoosh", 0.7f, 1.3f);
        }

        void UpdateDice()
        {
            bool show = state != null && (state.moving || (state.phase == "path" && diceValues.Length > 0)) && Time.time - diceStart < 30f;
            var active = state != null && tokens.TryGetValue(state.active, out var t) ? t : null;
            var cam = view;
            for (int i = 0; i < dice.Count; i++)
            {
                var d = dice[i];
                bool on = show && i < diceValues.Length && active != null;
                if (d.gameObject.activeSelf != on) d.gameObject.SetActive(on);
                if (!on) continue;
                float k = Mathf.Clamp01((Time.time - diceStart) / 0.6f);
                var right = cam ? cam.transform.right : Vector3.right;
                float side = (i - (diceValues.Length - 1) / 2f) * 0.75f;
                var basePos = active.t.position + Vector3.up * 2.05f + right * side;
                float drop = Fx.Reduced ? 0f : (1f - Ease.OutBack(k)) * 1.4f;
                d.position = basePos + Vector3.up * (drop + (k >= 1f && !Fx.Reduced ? Mathf.Sin(Time.time * 2.4f + i) * 0.06f : 0f));
                var toCam = cam ? (cam.transform.position - d.position).normalized : Vector3.back;
                var target = Quaternion.FromToRotation(Faces[Mathf.Clamp(diceValues[i], 1, 6)], toCam);
                var spin = Quaternion.Euler((1f - k) * 900f * (i % 2 == 0 ? 1f : -1f), (1f - k) * 620f, (1f - k) * 380f);
                d.rotation = Fx.Reduced ? target : target * spin;
            }
            if (show && Time.time - diceStart >= 0.6f && Time.time - Time.deltaTime - diceStart < 0.6f)
            {
                Sfx.Play("thud", 0.7f, 1.2f);
                if (active != null) Fx.Sparks(active.t.position + Vector3.up * 2f, Palette.Accent, 8);
            }
        }

        // ---- per frame -------------------------------------------------------------------------

        void Update()
        {
            if (fields == null || state == null) return;
            double now = Now;
            float dt = Time.deltaTime;
            foreach (var t in tokens.Values) Move(t, now, dt);
            UpdateDice();
            FollowCamera(dt);
            Inputs();
            world.Animate(Time.time, Fx.Reduced);
            var a = state.Active;
            if (a != null && tokens.TryGetValue(a.id, out var at))
                ui.Marker("active", at.t.position + Vector3.up * (state.moving ? 2.95f : 1.55f), a.me ? "Du" : a.name, "", "active");
            ui.Tick(now, view);
        }

        void Move(Token t, double now, float dt)
        {
            var p = t.player;
            Vector3 target;
            bool hopping = false;
            Vector3 travel = Vector3.zero;
            if (state.moving && p.active && state.moveFrom >= 0 && state.moveTo >= 0)
            {
                var from = Place(p.id, state.moveFrom);
                var to = world.spots[state.moveTo];
                double span = System.Math.Max(1.0, state.arriveAt - state.departAt);
                float k = (float)((now - state.departAt) / span);
                travel = to - from;
                if (k <= 0f) target = from;
                else if (k < 1f)
                {
                    float e = Ease.InOutSine(k);
                    target = Vector3.Lerp(from, to, e) + Vector3.up * Mathf.Sin(k * Mathf.PI) * (Fx.Reduced ? 0.1f : 0.55f);
                    hopping = true;
                }
                else
                {
                    target = to;
                    if (t.landedDepart != state.departAt)
                    {
                        t.landedDepart = state.departAt;
                        stepCount++;
                        Sfx.Play("tick", 0.7f, 0.9f + Mathf.Min(stepCount, 12) * 0.05f);
                        Fx.Dust(to, Palette.Paper, 4);
                        t.figure.Squash();
                    }
                }
                t.field = state.moveTo;
            }
            else if (t.glideT < 1f)
            {
                t.glideT = Mathf.Min(1f, t.glideT + dt / 0.55f);
                var to = Place(p.id, p.position);
                target = Vector3.Lerp(t.glideFrom, to, Ease.OutCubic(t.glideT)) + Vector3.up * Mathf.Sin(t.glideT * Mathf.PI) * 1.2f;
                travel = to - t.glideFrom;
                hopping = true;
                if (t.glideT >= 1f) { Fx.Dust(to, Palette.Paper, 6); Sfx.Play("land", 0.5f); t.figure.Squash(); }
            }
            else target = Place(p.id, p.position);

            var velocity = (target - t.t.position) / Mathf.Max(dt, 1e-4f);
            t.t.position = hopping ? target : Ease.Damp(t.t.position, target, 14f, dt);
            float wantYaw;
            var cam = view;
            if (travel.sqrMagnitude > 0.01f && (hopping || state.moving && p.active)) wantYaw = Mathf.Atan2(travel.x, travel.z) * Mathf.Rad2Deg;
            else if (cam) { var d = cam.transform.position - t.t.position; wantYaw = Mathf.Atan2(d.x, d.z) * Mathf.Rad2Deg; }
            else wantYaw = 180f;
            t.yaw = Mathf.LerpAngle(t.yaw, wantYaw, 1f - Mathf.Exp(-10f * dt));
            t.t.rotation = Quaternion.Euler(0f, t.yaw, 0f);
            if (state.phase != "finished") t.figure.Loop(hopping ? "jog" : "idle", 0.12f, hopping ? 1.3f : 1f);
            t.figure.Tick(velocity, dt);
        }

        void FollowCamera(float dt)
        {
            var s = state;
            var active = s.Active != null && tokens.TryGetValue(s.Active.id, out var t) ? t : null;
            Vector3 want; float radius, pitch;
            if (overview || active == null) { want = new Vector3(0f, 0.6f, -1.5f); radius = 46f; pitch = 70f; rig.homeYaw = 0f; }
            else
            {
                var pos = active.t.position;
                want = pos + Vector3.up * 0.6f;
                radius = 11.5f; pitch = 58f;
                if (s.phase == "path" && s.canAct && s.paths != null && s.paths.Length > 0)
                {
                    // Show the previewed route: centre between the figure and its end, a bit wider.
                    var route = s.paths[Mathf.Clamp(ui.selectedPath, 0, s.paths.Length - 1)].route;
                    if (route != null && route.Length > 1) want = Vector3.Lerp(pos, world.spots[route[route.Length - 1]], 0.5f) + Vector3.up * 0.6f;
                    radius = 18f; pitch = 64f;
                }
                var flat = new Vector2(pos.x, pos.z);
                if (flat.magnitude > 2f) rig.homeYaw = Mathf.Atan2(-pos.x, -pos.z) * Mathf.Rad2Deg;
            }
            focus.position = Ease.Damp(focus.position, want, 4.5f, dt);
            rig.orbit.Radius = Mathf.Lerp(rig.orbit.Radius, radius * zoom, 1f - Mathf.Exp(-4f * dt));
            var v = rig.orbit.VerticalAxis; v.Center = pitch; rig.orbit.VerticalAxis = v;
        }

        void Inputs()
        {
            var touches = ETouch.activeTouches;
            if (touches.Count >= 2)
            {
                float d = Vector2.Distance(touches[0].screenPosition, touches[1].screenPosition);
                if (lastPinch > 0f) zoom = Mathf.Clamp(zoom * lastPinch / Mathf.Max(d, 1f), 0.45f, 1.8f);
                lastPinch = d;
                return;
            }
            lastPinch = -1f;
            if (hud.Look.sqrMagnitude > 0.01f) rig.Swipe(hud.Look);
            var mouse = Mouse.current;
            if (mouse != null)
            {
                float wheel = mouse.scroll.ReadValue().y;
                if (Mathf.Abs(wheel) > 0.01f) zoom = Mathf.Clamp(zoom * (wheel > 0 ? 0.9f : 1.1f), 0.45f, 1.8f);
            }
        }

        // ---- editor and ?demo=1 preview ------------------------------------------------------

        [System.Serializable] class RollDemo { public RollBoardMessage board; public RollState[] states; }

        /// <summary>Board of the editor/demo preview: "grinder" (or ?demo=1&amp;brett=grinder) shows RollDemoGrinder.</summary>
        public static string DemoBoard;

        IEnumerator Demo()
        {
            yield return new WaitForSecondsRealtime(0.8f);
            if (RollBridge.Connected) yield break;
            var board = string.IsNullOrEmpty(DemoBoard) ? AppLink.Param("brett") : DemoBoard;
            var asset = Resources.Load<TextAsset>(board == "grinder" ? "GSG/RollDemoGrinder" : "GSG/RollDemo");
            if (!asset) yield break;
            demoData = JsonUtility.FromJson<RollDemo>(asset.text);
            OnBoard(demoData.board);
            demoIndex = 0;
            ShowDemo();
        }

        void ShowDemo()
        {
            var s = demoData.states[demoIndex % demoData.states.Length];
            var copy = JsonUtility.FromJson<RollState>(JsonUtility.ToJson(s));
            double now = Time.realtimeSinceStartupAsDouble * 1000.0;
            if (copy.moving) { double span = copy.arriveAt - copy.departAt; copy.departAt = now + 300; copy.arriveAt = copy.departAt + span; }
            copy.serverNow = now;
            OnState(copy);
        }

        /// <summary>Editor/demo only: an action advances to the next prepared state.</summary>
        public void DemoAdvance()
        {
            if (demoData == null) return;
            demoIndex++;
            ShowDemo();
        }

        public bool IsDemo => demoData != null;
    }
}
