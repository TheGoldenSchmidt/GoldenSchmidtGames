using System;
using System.Collections;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.InputSystem;
using UnityEngine.InputSystem.EnhancedTouch;
using UnityEngine.UIElements;
using ETouch = UnityEngine.InputSystem.EnhancedTouch.Touch;
using TouchPhase = UnityEngine.InputSystem.TouchPhase;

namespace GSG
{
    /// <summary>
    /// UI Toolkit HUD and touch input of both games (touch first, several fingers at once):
    /// a floating stick in the lower left, action buttons in the lower right, camera swipe in the
    /// rest of the screen, and taps on menu buttons. Every finger is hit-tested against the panel,
    /// so the drawn controls and the touch areas are always the same.
    /// </summary>
    [DefaultExecutionOrder(-100)]
    public class Hud : MonoBehaviour
    {
        public static Hud Instance { get; private set; }

        public Vector2 Stick { get; private set; }
        public Vector2 Look { get; private set; }
        public Vector2 Aim { get; private set; }
        public bool Aiming { get; private set; }
        public event Action<Vector2> AimReleased;
        public bool AnyFingerDown => fingers.Count > 0;
        public float LastTouchTime { get; private set; } = -99f;

        public VisualElement Root { get; private set; }
        public bool InputEnabled = true;

        public enum Tone { Gold, Pink, Cyan, Stone }
        public enum Icon { Jump, Dive, Duck, Grab, Shove, Pause, Play, Left, Right, Turn, Aim }

        class Finger
        {
            public string role;
            public VisualElement element;
            public Vector2 origin, last;
            public float start, travel;
        }

        /// <summary>A short tap on the 3D world (not on a control): screen position in pixels.</summary>
        public event Action<Vector2> WorldTap;

        readonly Dictionary<int, Finger> fingers = new();
        readonly HashSet<string> held = new(), pressedNow = new();
        readonly Dictionary<VisualElement, Action> taps = new();
        readonly Dictionary<string, VisualElement> actions = new();
        readonly Dictionary<string, Label> chips = new();
        readonly Dictionary<string, (VisualElement chip, VisualElement dot, Label text)> players = new();
        VisualElement zone, aimZone, aimHint, stickBase, stickKnob, actionBox, leftBox, top, strip, hint, toastBox, fade, overlayLayer;
        Label hintTitle, hintText, toast;
        Coroutine toastRoutine, fadeRoutine;
        Font title, text;
        const float StickRadius = 52f;

        public static Hud Create(string name = "Hud")
        {
            var go = new GameObject(name);
            go.SetActive(false);
            var doc = go.AddComponent<UIDocument>();
            doc.panelSettings = Resources.Load<PanelSettings>("GSG/UI/Panel");
            var hud = go.AddComponent<Hud>();
            go.SetActive(true);
            return hud;
        }

        void Awake() { Instance = this; }

        void OnEnable()
        {
            EnhancedTouchSupport.Enable();
            var doc = GetComponent<UIDocument>();
            Root = doc.rootVisualElement;
            Root.styleSheets.Add(Resources.Load<StyleSheet>("GSG/UI/Hud"));
            title = Resources.Load<Font>("GSG/Fonts/LilitaOne-Regular");
            text = Resources.Load<Font>("GSG/Fonts/Lexend-SemiBold");
            Root.AddToClassList("gsg-root");
            if (text) Root.style.unityFont = text;
            Root.pickingMode = PickingMode.Ignore;
            Build();
        }

        void OnDisable() { EnhancedTouchSupport.Disable(); }

        T Add<T>(VisualElement parent, T child, params string[] classes) where T : VisualElement
        {
            foreach (var c in classes) child.AddToClassList(c);
            parent.Add(child);
            return child;
        }

        Label Text(VisualElement parent, string value, string cls, bool heading = false)
        {
            var l = Add(parent, new Label(value), cls);
            l.pickingMode = PickingMode.Ignore;
            if (heading && title) l.style.unityFont = title;
            return l;
        }

        void Build()
        {
            zone = Add(Root, new VisualElement { name = "stick-zone" }, "gsg-zone");
            stickBase = Add(Root, new VisualElement { name = "stick-base" }, "gsg-stick-base");
            stickKnob = Add(stickBase, new VisualElement(), "gsg-stick-knob");
            stickBase.pickingMode = PickingMode.Ignore; stickKnob.pickingMode = PickingMode.Ignore;
            actionBox = Add(Root, new VisualElement { name = "actions" }, "gsg-actions");
            actionBox.pickingMode = PickingMode.Ignore;
            leftBox = Add(Root, new VisualElement { name = "actions-left" }, "gsg-actions", "gsg-actions--left");
            leftBox.pickingMode = PickingMode.Ignore;
            top = Add(Root, new VisualElement(), "gsg-top");
            top.pickingMode = PickingMode.Ignore;
            strip = Add(Root, new VisualElement(), "gsg-strip");
            strip.pickingMode = PickingMode.Ignore;
            hint = Add(Root, new VisualElement(), "gsg-hint", "is-hidden");
            hint.pickingMode = PickingMode.Ignore;
            var box = Add(hint, new VisualElement(), "gsg-hint__box");
            box.pickingMode = PickingMode.Ignore;
            hintTitle = Text(box, "", "gsg-hint__title", true);
            hintText = Text(box, "", "gsg-hint__text");
            toastBox = Add(Root, new VisualElement(), "gsg-toast");
            toastBox.pickingMode = PickingMode.Ignore;
            toast = Text(toastBox, "", "gsg-toast__text", true);
            toast.style.opacity = 0f;
            overlayLayer = Add(Root, new VisualElement(), "gsg-root");
            overlayLayer.pickingMode = PickingMode.Ignore;
            fade = Add(Root, new VisualElement(), "gsg-fade");
            fade.pickingMode = PickingMode.Ignore;
            RestStick();
        }

        // ---- building blocks ---------------------------------------------------------------

        /// <summary>An action button in the lower right, or with <paramref name="left"/> in the lower left (games without a stick).</summary>
        public void AddAction(string id, Icon icon, string label, Tone tone, bool left = false)
        {
            var b = Add(left ? leftBox : actionBox, new VisualElement { name = "btn-" + id }, "gsg-action", "gsg-action--" + tone.ToString().ToLowerInvariant());
            var cool = Add(b, new VisualElement(), "gsg-action__cool");
            cool.pickingMode = PickingMode.Ignore;
            var glyph = Add(b, new VisualElement(), "gsg-action__icon");
            glyph.pickingMode = PickingMode.Ignore;
            glyph.generateVisualContent += ctx => DrawIcon(ctx, icon, glyph.contentRect);
            Text(b, label, "gsg-action__label");
            actions[id] = b;
        }

        public void AddRoundButton(string name, Icon icon, Action onTap)
        {
            var b = Add(top, new VisualElement { name = name }, "gsg-round");
            var glyph = Add(b, new VisualElement(), "gsg-action__icon");
            glyph.style.width = 22; glyph.style.height = 22;
            glyph.pickingMode = PickingMode.Ignore;
            glyph.generateVisualContent += ctx => DrawIcon(ctx, icon, glyph.contentRect, Palette.Paper);
            Tap(b, onTap);
        }

        public void AddChip(string id, string value)
        {
            var c = Add(top, new VisualElement(), "gsg-chip");
            c.pickingMode = PickingMode.Ignore;
            chips[id] = Text(c, value, "gsg-chip__text");
        }

        public void SetChip(string id, string value)
        {
            if (chips.TryGetValue(id, out var l) && l.text != value) l.text = value;
        }

        public void SetChipColor(string id, Color color)
        {
            if (chips.TryGetValue(id, out var l)) l.parent.style.borderBottomColor = color;
        }

        public void ShowHint(string heading, string body)
        {
            hintTitle.text = heading; hintText.text = body;
            hint.EnableInClassList("is-hidden", string.IsNullOrEmpty(heading));
        }

        public void SetControlsVisible(bool visible)
        {
            zone.EnableInClassList("is-hidden", !visible);
            stickBase.EnableInClassList("is-hidden", !visible);
            actionBox.EnableInClassList("is-hidden", !visible);
            leftBox.EnableInClassList("is-hidden", !visible);
            aimZone?.EnableInClassList("is-hidden", !visible);
            if (!stickUsed) { zone.EnableInClassList("is-hidden", true); stickBase.EnableInClassList("is-hidden", true); }
        }

        bool stickUsed = true;
        /// <summary>Games steered only with buttons hide the stick and its touch zone for good.</summary>
        public void UseStick(bool on) { stickUsed = on; zone.EnableInClassList("is-hidden", !on); stickBase.EnableInClassList("is-hidden", !on); }

        public void UseAim()
        {
            aimZone = new VisualElement { name = "aim-zone" };
            aimZone.AddToClassList("gsg-zone");
            aimZone.style.left = StyleKeyword.Auto;
            aimZone.style.right = 0f;
            aimZone.style.width = Length.Percent(48f);
            Root.Insert(Root.IndexOf(zone) + 1, aimZone);

            aimHint = Add(actionBox, new VisualElement(), "gsg-action", "gsg-action--aim");
            aimHint.pickingMode = PickingMode.Ignore;
            var glyph = Add(aimHint, new VisualElement(), "gsg-action__icon");
            glyph.pickingMode = PickingMode.Ignore;
            glyph.generateVisualContent += ctx => DrawIcon(ctx, Icon.Aim, glyph.contentRect, Palette.Paper);
            Text(aimHint, "Zielen", "gsg-action__label").style.color = Palette.Paper;
        }

        public void SetTopVisible(bool visible) { top.EnableInClassList("is-hidden", !visible); strip.EnableInClassList("is-hidden", !visible); }

        /// <summary>A player chip in the strip under the top row: colour dot, text; active = gold border, dim = out.</summary>
        public void SetPlayer(string id, Color color, string value, bool active, bool dim)
        {
            if (!players.TryGetValue(id, out var p))
            {
                var chip = Add(strip, new VisualElement(), "gsg-player");
                chip.pickingMode = PickingMode.Ignore;
                var dot = Add(chip, new VisualElement(), "gsg-player__dot");
                dot.pickingMode = PickingMode.Ignore;
                p = (chip, dot, Text(chip, "", "gsg-player__text"));
                players[id] = p;
            }
            p.dot.style.backgroundColor = color;
            if (p.text.text != value) p.text.text = value;
            p.chip.EnableInClassList("is-active", active);
            p.chip.EnableInClassList("is-dim", dim);
        }

        /// <summary>Cooldown overlay: 1 = just used, 0 = ready.</summary>
        public void SetCooldown(string id, float remaining)
        {
            if (!actions.TryGetValue(id, out var b)) return;
            b[0].style.height = Length.Percent(Mathf.Clamp01(remaining) * 100f);
        }

        public void SetActionEnabled(string id, bool on)
        {
            if (actions.TryGetValue(id, out var b)) b.EnableInClassList("is-off", !on);
        }

        public void Tap(VisualElement element, Action onTap)
        {
            element.pickingMode = PickingMode.Position;
            taps[element] = onTap;
        }

        /// <summary>A centred paper panel; returns the overlay (remove it with <see cref="Close"/>).</summary>
        public VisualElement Panel(string kicker, string heading, string body, IList<(string label, Tone tone, Action action)> buttons, bool clear = false)
        {
            var overlay = Add(overlayLayer, new VisualElement(), "gsg-overlay");
            if (clear) overlay.AddToClassList("gsg-overlay--clear");
            overlay.pickingMode = PickingMode.Position;
            var panel = Add(overlay, new VisualElement(), "gsg-panel");
            panel.pickingMode = PickingMode.Ignore;
            if (!string.IsNullOrEmpty(kicker)) Text(panel, kicker.ToUpperInvariant(), "gsg-panel__kicker");
            Text(panel, heading, "gsg-panel__title", true);
            if (!string.IsNullOrEmpty(body)) Text(panel, body, "gsg-panel__text");
            var rows = Add(panel, new VisualElement { name = "rows" }, "gsg-panel__rows");
            rows.pickingMode = PickingMode.Ignore;
            var group = Add(panel, new VisualElement(), "gsg-buttons");
            group.pickingMode = PickingMode.Ignore;
            foreach (var (label, tone, action) in buttons)
            {
                var b = Add(group, new VisualElement(), "gsg-button", tone == Tone.Gold ? "gsg-button--gold" : "gsg-button--stone");
                Text(b, label, "gsg-button__text", true);
                Tap(b, () => { Sfx.Play("click"); action?.Invoke(); });
            }
            StartCoroutine(Ease.Tween(0.28f, k => { panel.style.scale = new Scale(Vector3.one * Mathf.LerpUnclamped(0.85f, 1f, k)); overlay.style.opacity = Mathf.Clamp01(k * 1.5f); }, Ease.OutBack));
            return overlay;
        }

        public void AddRow(VisualElement overlay, Color dot, string name, string value)
        {
            var rows = overlay.Q("rows");
            var row = Add(rows, new VisualElement(), "gsg-row");
            row.pickingMode = PickingMode.Ignore;
            var d = Add(row, new VisualElement(), "gsg-row__dot");
            d.style.backgroundColor = dot; d.pickingMode = PickingMode.Ignore;
            Text(row, name, "gsg-row__name");
            Text(row, value, "gsg-row__value");
        }

        public void Close(VisualElement overlay)
        {
            if (overlay == null) return;
            foreach (var e in overlay.Query<VisualElement>().ToList()) taps.Remove(e);
            overlay.RemoveFromHierarchy();
        }

        public bool HasOverlay => overlayLayer.childCount > 0;

        public void Toast(string message, Color color, float seconds = 1.3f)
        {
            if (toastRoutine != null) StopCoroutine(toastRoutine);
            toastRoutine = StartCoroutine(ToastRoutine(message, color, seconds));
        }

        IEnumerator ToastRoutine(string message, Color color, float seconds)
        {
            toast.text = message; toast.style.color = color;
            yield return Ease.Tween(0.32f, k => { toast.style.opacity = Mathf.Clamp01(k * 2f); toast.style.scale = new Scale(Vector3.one * Mathf.LerpUnclamped(0.4f, 1f, k)); }, Ease.OutBack);
            yield return new WaitForSecondsRealtime(seconds);
            yield return Ease.Tween(0.22f, k => { toast.style.opacity = 1f - k; toast.style.translate = new Translate(0, -18f * k); }, Ease.OutCubic);
            toast.style.translate = new Translate(0, 0);
            toastRoutine = null;
        }

        public void Fade(float to, float seconds = 0.3f)
        {
            if (fadeRoutine != null) StopCoroutine(fadeRoutine);
            float from = fade.resolvedStyle.opacity;
            fadeRoutine = StartCoroutine(Ease.Tween(seconds, k => fade.style.opacity = Mathf.Lerp(from, to, k), Ease.OutCubic));
        }

        /// <summary>A thin progress bar at the very top (round timer).</summary>
        public VisualElement Bar()
        {
            var bar = Add(Root, new VisualElement(), "gsg-bar");
            bar.pickingMode = PickingMode.Ignore;
            var fill = Add(bar, new VisualElement(), "gsg-bar__fill");
            fill.pickingMode = PickingMode.Ignore;
            return fill;
        }

        // ---- input -------------------------------------------------------------------------

        /// <summary>?debug=1: log every finger (position, hit element, role) to the browser console.</summary>
        public static bool DebugInput;

        public bool Held(string id) => InputEnabled && (held.Contains(id) || simHeld.Contains(id));
        public bool Pressed(string id) => InputEnabled && pressedNow.Contains(id);

        readonly HashSet<int> seen = new();
        readonly HashSet<string> simHeld = new();
        string simPress;
        Vector2? simStick;

        /// <summary>Automated checks (editor play mode): drive the stick and buttons without touches.</summary>
        public void Simulate(Vector2? stick, string press = null, params string[] hold)
        {
            simStick = stick;
            simPress = press;
            simHeld.Clear();
            foreach (var h in hold) simHeld.Add(h);
        }

        void Update()
        {
            pressedNow.Clear();
            Look = Vector2.zero;
            if (simPress != null) { pressedNow.Add(simPress); simPress = null; }
            if (simStick.HasValue) Stick = simStick.Value;
            if (Root?.panel == null) return;
            seen.Clear();
            foreach (var t in ETouch.activeTouches)
            {
                seen.Add(t.touchId);
                LastTouchTime = Time.unscaledTime;
                bool ending = t.phase == TouchPhase.Ended || t.phase == TouchPhase.Canceled;
                if (!fingers.ContainsKey(t.touchId))
                {
                    // A quick tap can begin and end between two frames: still count it.
                    Begin(t.touchId, ending ? t.startScreenPosition : t.screenPosition);
                    if (ending) End(t.touchId, t.screenPosition, t.phase == TouchPhase.Canceled);
                }
                else if (ending) End(t.touchId, t.screenPosition, t.phase == TouchPhase.Canceled);
                else Move(t.touchId, t.screenPosition);
            }
            // Mouse only when no touch happened recently (browsers emulate mouse after touches).
            var mouse = Mouse.current;
            if (mouse != null && Time.unscaledTime - LastTouchTime > 1f)
            {
                const int id = -1;
                var p = mouse.position.ReadValue();
                if (mouse.leftButton.isPressed) { seen.Add(id); if (!fingers.ContainsKey(id)) Begin(id, p); else Move(id, p); }
                else if (fingers.ContainsKey(id)) { End(id, p); }
            }
            if (fingers.Count > 0)
            {
                var stale = new List<int>();
                foreach (var id in fingers.Keys) if (!seen.Contains(id)) stale.Add(id);
                foreach (var id in stale) End(id, default, canceled: true);
            }
            if (!InputEnabled) { Stick = Vector2.zero; }
        }

        Vector2 ToPanel(Vector2 screen) => RuntimePanelUtils.ScreenToPanel(Root.panel, new Vector2(screen.x, Screen.height - screen.y));

        void Begin(int id, Vector2 screen)
        {
            var p = ToPanel(screen);
            var f = new Finger { origin = p, last = p, role = "look", start = Time.unscaledTime };
            var picked = Root.panel.Pick(p);
            for (var e = picked; e != null; e = e.parent)
            {
                if (taps.ContainsKey(e)) { f.role = "tap"; f.element = e; e.AddToClassList("is-pressed"); break; }
                if (e.name != null && e.name.StartsWith("btn-") && InputEnabled)
                {
                    f.role = e.name.Substring(4); f.element = e;
                    if (!e.ClassListContains("is-off")) { held.Add(f.role); pressedNow.Add(f.role); }
                    e.AddToClassList("is-pressed");
                    break;
                }
                if (e == zone && InputEnabled) { f.role = "stick"; ShowStick(p); break; }
                if (e == aimZone && InputEnabled && !HasOverlay)
                {
                    f.role = Aiming ? "none" : "aim";
                    if (!Aiming) { Aiming = true; aimHint.AddToClassList("is-pressed"); }
                    break;
                }
                // Overlays and panels marked gsg-block swallow touches that hit no button.
                if (e.ClassListContains("gsg-overlay") || e.ClassListContains("gsg-block")) { f.role = "none"; break; }
            }
            if (f.role == "look" && (!InputEnabled || HasOverlay)) f.role = "none";
            fingers[id] = f;
            if (DebugInput) Debug.Log($"[GSG] Finger {id} an {screen} → Panel {p} (Bildschirm {Screen.width}×{Screen.height}) trifft '{picked?.name}' [{string.Join(" ", picked?.GetClasses() ?? new string[0])}] → {f.role}");
        }

        void Move(int id, Vector2 screen)
        {
            var f = fingers[id];
            var p = ToPanel(screen);
            if (f.role == "stick")
            {
                var d = p - f.origin;
                if (d.magnitude > StickRadius * 1.25f) f.origin = p - d.normalized * StickRadius * 1.25f;
                d = p - f.origin;
                var k = Vector2.ClampMagnitude(d / StickRadius, 1f);
                Stick = new Vector2(k.x, -k.y);
                PlaceStick(f.origin, Vector2.ClampMagnitude(d, StickRadius));
            }
            else if (f.role == "aim") Aim = AimDirection(p - f.origin);
            else if (f.role == "look") Look += p - f.last;
            f.travel += (p - f.last).magnitude;
            f.last = p;
        }

        static Vector2 AimDirection(Vector2 delta) => delta.sqrMagnitude >= 12f * 12f
            ? new Vector2(delta.x, -delta.y).normalized : Vector2.zero;

        void End(int id, Vector2 screen, bool canceled = false)
        {
            var f = fingers[id];
            fingers.Remove(id);
            if (f.element != null) f.element.RemoveFromClassList("is-pressed");
            if (f.role == "stick") { Stick = Vector2.zero; RestStick(); }
            else if (f.role == "aim")
            {
                Aiming = false;
                Aim = Vector2.zero;
                aimHint.RemoveFromClassList("is-pressed");
                if (!canceled && InputEnabled) AimReleased?.Invoke(AimDirection(ToPanel(screen) - f.origin));
            }
            else if (f.role == "tap")
            {
                if (canceled) return;
                var p = ToPanel(screen);
                if (f.element.worldBound.Contains(p) && taps.TryGetValue(f.element, out var a)) a?.Invoke();
            }
            else if (f.role == "look")
            {
                if (!canceled && f.travel < 12f && Time.unscaledTime - f.start < 0.45f) WorldTap?.Invoke(screen);
            }
            else if (f.role != "none") held.Remove(f.role);
        }

        /// <summary>Forgets the tap handlers of an element and its children (before rebuilding it).</summary>
        public void Untap(VisualElement element)
        {
            foreach (var e in element.Query<VisualElement>().ToList()) taps.Remove(e);
        }

        public void ReleaseAll()
        {
            foreach (var f in fingers.Values) f.element?.RemoveFromClassList("is-pressed");
            fingers.Clear(); held.Clear(); Stick = Vector2.zero; RestStick();
            Aiming = false; Aim = Vector2.zero;
            aimHint?.RemoveFromClassList("is-pressed");
        }

        void ShowStick(Vector2 at)
        {
            stickBase.style.opacity = 1f;
            PlaceStick(at, Vector2.zero);
        }

        void PlaceStick(Vector2 center, Vector2 knob)
        {
            stickBase.style.left = center.x - 64f; stickBase.style.top = center.y - 64f;
            stickKnob.style.left = 64f - 29f - 3f + knob.x; stickKnob.style.top = 64f - 29f - 3f + knob.y;
        }

        void RestStick()
        {
            if (stickBase == null) return;
            stickBase.style.opacity = 0.55f;
            stickBase.style.left = StyleKeyword.Auto; stickBase.style.top = StyleKeyword.Auto;
            stickBase.style.position = Position.Absolute;
            stickBase.style.left = 34f; stickBase.style.bottom = 40f; stickBase.style.top = StyleKeyword.Auto;
            stickKnob.style.left = 32f; stickKnob.style.top = 32f;
        }

        // ---- icons ---------------------------------------------------------------------------

        static void DrawIcon(MeshGenerationContext ctx, Icon icon, Rect r, Color? tint = null)
        {
            var p = ctx.painter2D;
            var c = tint ?? Palette.Ink;
            p.strokeColor = c; p.fillColor = c; p.lineWidth = Mathf.Max(3f, r.width * 0.12f);
            p.lineCap = LineCap.Round; p.lineJoin = LineJoin.Round;
            float w = r.width, h = r.height, x = r.x, y = r.y;
            Vector2 P(float u, float v) => new Vector2(x + u * w, y + v * h);
            void Arrow(Vector2 from, Vector2 to, float head)
            {
                p.BeginPath(); p.MoveTo(from); p.LineTo(to); p.Stroke();
                var d = (to - from).normalized; var n = new Vector2(-d.y, d.x);
                p.BeginPath(); p.MoveTo(to - d * head + n * head * 0.8f); p.LineTo(to); p.LineTo(to - d * head - n * head * 0.8f); p.Stroke();
            }
            switch (icon)
            {
                case Icon.Jump:
                    p.BeginPath(); p.MoveTo(P(0.2f, 0.08f)); p.LineTo(P(0.8f, 0.08f)); p.Stroke();
                    Arrow(P(0.5f, 0.95f), P(0.5f, 0.28f), h * 0.3f); break;
                case Icon.Dive:
                    Arrow(P(0.15f, 0.85f), P(0.85f, 0.25f), h * 0.32f); break;
                case Icon.Duck:
                    p.BeginPath(); p.MoveTo(P(0.2f, 0.92f)); p.LineTo(P(0.8f, 0.92f)); p.Stroke();
                    Arrow(P(0.5f, 0.05f), P(0.5f, 0.72f), h * 0.3f); break;
                case Icon.Grab:
                    p.BeginPath(); p.Arc(P(0.5f, 0.5f), Mathf.Min(w, h) * 0.38f, 0f, 360f); p.Stroke();
                    p.BeginPath(); p.Arc(P(0.5f, 0.5f), Mathf.Min(w, h) * 0.14f, 0f, 360f); p.Fill(); break;
                case Icon.Aim:
                    p.BeginPath(); p.Arc(P(0.5f, 0.5f), Mathf.Min(w, h) * 0.3f, 0f, 360f); p.Stroke();
                    p.BeginPath(); p.MoveTo(P(0.5f, 0.04f)); p.LineTo(P(0.5f, 0.96f)); p.Stroke();
                    p.BeginPath(); p.MoveTo(P(0.11f, 0.5f)); p.LineTo(P(0.89f, 0.5f)); p.Stroke(); break;
                case Icon.Shove:
                    p.BeginPath(); p.MoveTo(P(0.18f, 0.15f)); p.LineTo(P(0.5f, 0.5f)); p.LineTo(P(0.18f, 0.85f)); p.Stroke();
                    p.BeginPath(); p.MoveTo(P(0.5f, 0.15f)); p.LineTo(P(0.82f, 0.5f)); p.LineTo(P(0.5f, 0.85f)); p.Stroke(); break;
                case Icon.Pause:
                    p.BeginPath(); p.MoveTo(P(0.3f, 0.12f)); p.LineTo(P(0.3f, 0.88f)); p.Stroke();
                    p.BeginPath(); p.MoveTo(P(0.7f, 0.12f)); p.LineTo(P(0.7f, 0.88f)); p.Stroke(); break;
                case Icon.Left:
                    Arrow(P(0.85f, 0.5f), P(0.15f, 0.5f), h * 0.34f); break;
                case Icon.Right:
                    Arrow(P(0.15f, 0.5f), P(0.85f, 0.5f), h * 0.34f); break;
                case Icon.Turn:
                {
                    var mid = P(0.5f, 0.55f); float R = Mathf.Min(w, h) * 0.36f;
                    p.BeginPath(); p.Arc(mid, R, -60f, 200f); p.Stroke();
                    var tip = mid + new Vector2(Mathf.Cos(-60f * Mathf.Deg2Rad), Mathf.Sin(-60f * Mathf.Deg2Rad)) * R;
                    p.BeginPath(); p.MoveTo(tip + new Vector2(-R * 0.55f, -R * 0.1f)); p.LineTo(tip); p.LineTo(tip + new Vector2(R * 0.05f, R * 0.55f)); p.Stroke();
                    break;
                }
                case Icon.Play:
                    p.BeginPath(); p.MoveTo(P(0.25f, 0.1f)); p.LineTo(P(0.85f, 0.5f)); p.LineTo(P(0.25f, 0.9f)); p.ClosePath(); p.Fill(); break;
            }
        }
    }
}
