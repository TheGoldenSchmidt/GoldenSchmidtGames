using System;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.UIElements;

namespace GSG.RollItUp
{
    /// <summary>
    /// Board HUD of Roll It Up! in Unity (UI Toolkit on top of <see cref="Hud"/>): header with
    /// round, coins, set progress and objective, the player order, the decision card at the
    /// bottom (one gold main action per phase) and labels that follow figures and stations.
    /// Texts follow the web board (src/components/RollItUpBoard.tsx).
    /// </summary>
    public class RollUi
    {
        readonly Hud hud;
        readonly RollGame game;
        readonly VisualElement root, top, roster, dots, card, cardContent, tools, info, labels, floats, face;
        readonly Label round, coins, setCount, objective, cardTitle, timer, infoTitle, infoText, overviewText;
        readonly Font title;
        readonly List<Label> dotLabels = new();
        public int selectedPath, replace;
        int sentPhase = -1, lastPhase = -1;
        float infoUntil;
        RollState state;

        class Tag { public VisualElement element; public Label text, sub; public Vector3 world; public bool on; }
        readonly Dictionary<string, Tag> markers = new();

        class Floater { public Label label; public Vector3 world; public float start; }
        readonly List<Floater> floaters = new();

        public RollUi(Hud hud, RollGame game)
        {
            this.hud = hud; this.game = game;
            root = hud.Root;
            root.styleSheets.Add(Resources.Load<StyleSheet>("GSG/UI/Roll"));
            title = Resources.Load<Font>("GSG/Fonts/LilitaOne-Regular");

            labels = Add(root, new VisualElement(), "roll-labels");
            labels.pickingMode = PickingMode.Ignore;
            floats = Add(root, new VisualElement(), "roll-labels");
            floats.pickingMode = PickingMode.Ignore;

            top = Add(root, new VisualElement(), "roll-top");
            top.pickingMode = PickingMode.Ignore;
            var bar = Add(top, new VisualElement(), "roll-bar");
            bar.pickingMode = PickingMode.Ignore;
            IconButton(bar, DrawMenu, () => RollBridge.Panel("menu"));
            var head = Add(bar, new VisualElement(), "roll-title");
            head.pickingMode = PickingMode.Ignore;
            Text(head, "Roll It Up!", "roll-title__name", true);
            round = Text(head, "Runde 1 · Bauschale", "roll-title__sub");
            IconButton(bar, (ctx, r) => DrawSound(ctx, r, Sfx.SfxOn), () => { game.ToggleSound(); bar.MarkDirtyRepaint(); foreach (var e in bar.Query<VisualElement>(className: "roll-icon-btn__glyph").ToList()) e.MarkDirtyRepaint(); });
            var coinBox = Add(bar, new VisualElement(), "roll-glass");
            coinBox.pickingMode = PickingMode.Ignore;
            Add(coinBox, new VisualElement(), "roll-coin").pickingMode = PickingMode.Ignore;
            coins = Text(coinBox, "0", "roll-glass__value", true);

            var row = Add(top, new VisualElement(), "roll-row");
            row.pickingMode = PickingMode.Ignore;
            var set = Add(row, new VisualElement(), "roll-glass");
            Text(set, "Set", "roll-glass__label");
            dots = Add(set, new VisualElement(), "roll-dots");
            dots.pickingMode = PickingMode.Ignore;
            for (int i = 0; i < 6; i++) Add(dots, new VisualElement(), "roll-dot").pickingMode = PickingMode.Ignore;
            setCount = Text(set, "0/6", "roll-glass__value", true);
            hud.Tap(set, () => { Sfx.Play("click"); RollBridge.Panel("collection"); });
            var goal = Add(row, new VisualElement(), "roll-glass", "roll-objective");
            objective = Text(goal, "", "roll-objective__text");
            hud.Tap(goal, () => { Sfx.Play("click"); RollBridge.Panel("collection"); });

            roster = Add(top, new VisualElement(), "roll-roster");
            roster.pickingMode = PickingMode.Ignore;

            info = Add(root, new VisualElement(), "roll-info", "is-hidden", "gsg-block");
            infoTitle = Text(info, "", "roll-info__title", true);
            infoText = Text(info, "", "roll-info__text");
            hud.Tap(info, HideInfo);

            tools = Add(root, new VisualElement(), "roll-tools");
            tools.pickingMode = PickingMode.Ignore;
            var overview = Add(tools, new VisualElement(), "roll-tool");
            overviewText = Text(overview, "Ganze Schale", "roll-tool__text");
            hud.Tap(overview, () => { Sfx.Play("click"); game.ToggleOverview(); });

            card = Add(root, new VisualElement(), "roll-card", "gsg-block");
            var cardHead = Add(card, new VisualElement(), "roll-card__head");
            cardHead.pickingMode = PickingMode.Ignore;
            face = Add(cardHead, new VisualElement(), "roll-card__face");
            face.pickingMode = PickingMode.Ignore;
            cardTitle = Text(cardHead, "Die Bauschale wird vorbereitet …", "roll-card__title", true);
            timer = Text(cardHead, "", "roll-timer");
            timer.style.display = DisplayStyle.None;
            cardContent = Add(card, new VisualElement());
            cardContent.pickingMode = PickingMode.Ignore;
            // Tools and field info sit just above the card, whatever its height.
            card.RegisterCallback<GeometryChangedEvent>(_ => Reflow());
        }

        void Reflow()
        {
            float h = card.resolvedStyle.display == DisplayStyle.None ? 0f : card.layout.height;
            tools.style.bottom = h + 18f;
            info.style.bottom = h + 66f;
        }

        // ---- building blocks ---------------------------------------------------------------

        static T Add<T>(VisualElement parent, T child, params string[] classes) where T : VisualElement
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

        void IconButton(VisualElement parent, Action<MeshGenerationContext, Rect> draw, Action onTap)
        {
            var b = Add(parent, new VisualElement(), "roll-icon-btn");
            var glyph = Add(b, new VisualElement(), "roll-icon-btn__glyph");
            glyph.pickingMode = PickingMode.Ignore;
            glyph.generateVisualContent += ctx => draw(ctx, glyph.contentRect);
            hud.Tap(b, () => { Sfx.Play("click"); onTap(); });
        }

        VisualElement Button(VisualElement parent, string label, string tone, bool enabled, Action onTap, string small = null)
        {
            var b = Add(parent, new VisualElement(), "roll-btn", "roll-btn--" + tone);
            Text(b, label, "roll-btn__text", true);
            if (!string.IsNullOrEmpty(small)) Text(b, small, "roll-btn__small");
            bool off = !enabled || Locked;
            b.EnableInClassList("is-off", off);
            hud.Tap(b, () =>
            {
                if (off) { Sfx.Play("blip", 0.5f, 0.7f); return; }
                Sfx.Play("click");
                onTap();
            });
            return b;
        }

        VisualElement Option(VisualElement parent, string heading, string sub, string price, bool enabled, bool selected, Action onTap)
        {
            var b = Add(parent, new VisualElement(), "roll-btn", "roll-btn--paper");
            if (selected) b.AddToClassList("is-selected");
            var main = Add(b, new VisualElement(), "roll-option__main");
            main.pickingMode = PickingMode.Ignore;
            Text(main, heading, "roll-option__title", true);
            if (!string.IsNullOrEmpty(sub)) Text(main, sub, "roll-option__sub");
            if (!string.IsNullOrEmpty(price)) Text(b, price, "roll-option__price", true);
            bool off = !enabled || Locked;
            b.EnableInClassList("is-off", off);
            hud.Tap(b, () =>
            {
                if (off) { Sfx.Play("blip", 0.5f, 0.7f); return; }
                Sfx.Play("click");
                onTap();
            });
            return b;
        }

        /// <summary>After a decision is sent, the card waits for the room's answer (no double sends).</summary>
        bool Locked => state == null || state.busy || !state.connected || sentPhase == state.phaseId;

        void Send(RollAction action)
        {
            sentPhase = state.phaseId;
            RollBridge.Send(action);
            Rebuild();
        }

        // ---- state -------------------------------------------------------------------------

        public void Render(RollState s)
        {
            bool phaseChanged = state == null || s.phaseId != lastPhase;
            if (phaseChanged) { selectedPath = 0; replace = 0; }
            if (!string.IsNullOrEmpty(s.error) || s.phaseId != lastPhase) sentPhase = -1;
            lastPhase = s.phaseId;
            state = s;
            var me = s.Me;
            round.text = $"Runde {s.round} · Bauschale";
            coins.text = me != null ? me.coins.ToString() : "0";
            int have = me?.supplies?.Length ?? 0;
            for (int i = 0; i < dots.childCount; i++) dots[i].EnableInClassList("is-on", i < have);
            setCount.text = $"{have}/6";
            objective.text = s.objectiveText + "  ›";

            roster.Clear();
            if (s.order != null)
                foreach (var id in s.order)
                {
                    var p = s.Player(id);
                    if (p == null) continue;
                    var chip = Add(roster, new VisualElement(), "roll-player");
                    chip.pickingMode = PickingMode.Ignore;
                    chip.EnableInClassList("is-active", p.active);
                    var dot = Add(chip, new VisualElement(), "roll-player__dot");
                    dot.style.backgroundColor = Palette.Player(p.slot);
                    dot.pickingMode = PickingMode.Ignore;
                    Text(chip, $"{p.name}{(p.me ? " · du" : "")}  {p.supplies?.Length ?? 0}/6 · {p.coins}{(p.shield ? " · Schild" : "")}", "roll-player__text");
                }
            Rebuild();
        }

        public void SetOverview(bool on) => overviewText.text = on ? "Zur Figur" : "Ganze Schale";

        public void SetVisible(bool on) => root.EnableInClassList("roll-hidden-all", !on);

        void Rebuild()
        {
            hud.Untap(cardContent);
            cardContent.Clear();
            var s = state;
            if (s == null) return;
            var active = s.Active;
            face.style.backgroundColor = active != null ? Palette.Player(active.slot) : Palette.Paper;
            string heading = s.headline, text = s.status;
            Action<VisualElement> body = null;

            if (s.canAct && !s.moving)
            {
                switch (s.phase)
                {
                    case "turn":
                        body = c =>
                        {
                            var split = Add(c, new VisualElement(), "roll-split");
                            split.pickingMode = PickingMode.Ignore;
                            var roll = Button(split, "Würfeln & losziehen", "gold", true, () => Send(new RollAction { type = "roll" }));
                            roll.style.flexGrow = 2.2f;
                            Button(split, "Items", "stone", true, () => RollBridge.Panel("inventory"), $"{s.Me?.items?.Length ?? 0}/3");
                        };
                        break;
                    case "path":
                        heading = "Welchen Weg nimmst du?";
                        text = $"Noch {s.steps} {(s.steps == 1 ? "Schritt" : "Schritte")}. Wähle den Weg, dann bestätige.";
                        body = c =>
                        {
                            for (int i = 0; i < (s.paths?.Length ?? 0); i++)
                            {
                                int index = i;
                                var p = s.paths[i];
                                Option(c, (selectedPath == i ? "» " : "") + p.title, p.detail, null, true, selectedPath == i, () => { selectedPath = index; game.OnPathPreview(); Rebuild(); });
                            }
                            var chosen = s.paths != null && s.paths.Length > 0 ? s.paths[Mathf.Clamp(selectedPath, 0, s.paths.Length - 1)] : null;
                            Button(c, "Gewählten Weg nehmen", "gold", chosen != null, () => Send(new RollAction { type = "path", destination = chosen.field }));
                        };
                        break;
                    case "supply":
                        heading = $"{s.supplyName} für dein Set?";
                        text = $"Fehlt noch in deinem Set · {s.supplyPrice} Münzen";
                        body = c =>
                        {
                            var split = Add(c, new VisualElement(), "roll-split");
                            split.pickingMode = PickingMode.Ignore;
                            Button(split, $"{s.supplyName} kaufen", "gold", s.supplyAffordable, () => Send(new RollAction { type = "supply", buy = true }));
                            Button(split, "Ohne Kauf weiter", "stone", true, () => Send(new RollAction { type = "supply", buy = false }));
                        };
                        break;
                    case "shop":
                        heading = "Der Shop";
                        text = "Ein Item pro Besuch.";
                        body = c =>
                        {
                            if (s.needsReplace) ReplacePicker(c, s);
                            foreach (var item in s.shop ?? new RollItem[0])
                            {
                                var id = item.id;
                                string sub = item.affordable ? item.description : $"{item.description} · noch {Mathf.Max(0, item.price - (s.Me?.coins ?? 0))} Münzen nötig";
                                Option(c, item.name, sub, $"{item.price}", item.affordable, false, () => Send(new RollAction { type = "shop", item = id, replace = replace }));
                            }
                            Button(c, "Ohne Einkauf weiter", "stone", true, () => Send(new RollAction { type = "shop", item = "" }));
                        };
                        break;
                    case "gift":
                        heading = $"{s.giftName} für dich!";
                        text = s.giftDescription;
                        body = c =>
                        {
                            if (s.needsReplace) ReplacePicker(c, s);
                            var split = Add(c, new VisualElement(), "roll-split");
                            split.pickingMode = PickingMode.Ignore;
                            Button(split, "Annehmen", "gold", true, () => Send(new RollAction { type = "gift", accept = true, replace = replace }));
                            Button(split, "Liegen lassen", "stone", true, () => Send(new RollAction { type = "gift", accept = false }));
                        };
                        break;
                    case "summary":
                        heading = string.IsNullOrEmpty(s.summary) ? "Gelandet" : s.summary;
                        text = "";
                        body = c => Button(c, "Nächster Zug", "gold", true, () => Send(new RollAction { type = "next" }));
                        break;
                }
            }
            else if (!s.canAct && !s.moving && s.phase != "summary") text = s.status + " Du kannst dir die Schale ansehen.";
            if (s.moving && s.dice != null && s.dice.Length > 0)
                text = $"Wurf {string.Join(" + ", s.dice)}{(s.boost > 0 ? $" + {s.boost}" : "")} · {s.status}";

            cardTitle.text = heading;
            if (!string.IsNullOrEmpty(text)) Text(cardContent, text, "roll-card__text");
            if (!s.connected) Text(cardContent, "Verbindung wird wiederhergestellt …", "roll-card__error");
            else if (s.busy || sentPhase == s.phaseId) Text(cardContent, "Zug wird bestätigt …", "roll-card__text");
            if (!string.IsNullOrEmpty(s.error)) Text(cardContent, s.error, "roll-card__error");
            if (body != null)
            {
                var box = Add(cardContent, new VisualElement(), "roll-buttons");
                box.pickingMode = PickingMode.Ignore;
                body(box);
            }
        }

        void ReplacePicker(VisualElement c, RollState s)
        {
            var own = s.ownItems ?? new string[0];
            if (own.Length == 0) return;
            replace = Mathf.Clamp(replace, 0, own.Length - 1);
            Button(c, $"Ersetzt: {own[replace]}", "stone", true, () => { replace = (replace + 1) % own.Length; Rebuild(); }, "tippen zum Wechseln");
        }

        // ---- per frame ---------------------------------------------------------------------

        public void Tick(double now, Camera cam)
        {
            if (state != null && state.deadline > 0 && !state.moving)
            {
                int seconds = Mathf.Max(0, Mathf.CeilToInt((float)((state.deadline - now) / 1000.0)));
                timer.style.display = DisplayStyle.Flex;
                timer.text = seconds + " s";
                timer.EnableInClassList("is-urgent", seconds <= 5);
            }
            else timer.style.display = DisplayStyle.None;
            if (infoUntil > 0f && Time.unscaledTime > infoUntil) HideInfo();

            if (!cam || root.panel == null) return;
            // Labels only between the header and the decision card, never under them.
            float minY = top.layout.yMax + 34f, maxY = card.resolvedStyle.display == DisplayStyle.None ? root.layout.height : card.layout.y - 4f;
            foreach (var m in markers.Values)
            {
                var screen = cam.WorldToScreenPoint(m.world);
                bool show = m.on && screen.z > 0.5f;
                Vector2 p = default;
                if (show)
                {
                    p = RuntimePanelUtils.ScreenToPanel(root.panel, new Vector2(screen.x, Screen.height - screen.y));
                    show = p.y > minY && p.y < maxY && p.x > 10f && p.x < root.layout.width - 10f;
                }
                m.element.EnableInClassList("is-hidden", !show);
                if (!show) continue;
                m.element.style.left = p.x; m.element.style.top = p.y;
            }
            for (int i = floaters.Count - 1; i >= 0; i--)
            {
                var f = floaters[i];
                float k = (Time.unscaledTime - f.start) / 1.3f;
                if (k >= 1f) { f.label.RemoveFromHierarchy(); floaters.RemoveAt(i); continue; }
                var screen = cam.WorldToScreenPoint(f.world);
                var p = RuntimePanelUtils.ScreenToPanel(root.panel, new Vector2(screen.x, Screen.height - screen.y));
                f.label.style.left = p.x; f.label.style.top = p.y - 46f * Ease.OutCubic(k);
                f.label.style.opacity = k < 0.7f ? 1f : 1f - (k - 0.7f) / 0.3f;
                f.label.style.scale = new Scale(Vector3.one * Mathf.LerpUnclamped(0.6f, 1f, Ease.OutBack(Mathf.Clamp01(k * 4f))));
            }
        }

        /// <summary>A label over a world point (figures, stations, Jayspot); hidden when <paramref name="on"/> is false.</summary>
        public void Marker(string key, Vector3 world, string text, string sub, string kind, bool on = true)
        {
            if (!markers.TryGetValue(key, out var m))
            {
                m = new Tag();
                m.element = Add(labels, new VisualElement(), "roll-label");
                m.element.pickingMode = PickingMode.Ignore;
                var box = Add(m.element, new VisualElement(), "roll-label__box");
                box.pickingMode = PickingMode.Ignore;
                m.text = Text(box, "", "roll-label__text", true);
                m.sub = Text(box, "", "roll-label__sub");
                markers[key] = m;
            }
            m.world = world; m.on = on;
            if (m.text.text != text) m.text.text = text;
            if (m.sub.text != (sub ?? "")) m.sub.text = sub ?? "";
            m.sub.style.display = string.IsNullOrEmpty(sub) ? DisplayStyle.None : DisplayStyle.Flex;
            foreach (var k in new[] { "active", "goal", "done" }) m.element.EnableInClassList("roll-label--" + k, kind == k);
        }

        public void Float(Vector3 world, string text, Color color)
        {
            var l = Text(floats, text, "roll-float", true);
            l.style.color = color;
            l.style.left = -999f;
            floaters.Add(new Floater { label = l, world = world, start = Time.unscaledTime });
        }

        public void ShowInfo(string heading, string body)
        {
            infoTitle.text = heading; infoText.text = body;
            info.RemoveFromClassList("is-hidden");
            infoUntil = Time.unscaledTime + 5f;
        }

        public void HideInfo()
        {
            info.AddToClassList("is-hidden");
            infoUntil = 0f;
            game.OnInfoClosed();
        }

        // ---- icons ---------------------------------------------------------------------------

        static void DrawMenu(MeshGenerationContext ctx, Rect r)
        {
            var p = ctx.painter2D;
            p.strokeColor = Palette.Paper; p.lineWidth = 3f; p.lineCap = LineCap.Round;
            foreach (var y in new[] { 0.2f, 0.5f, 0.8f })
            {
                p.BeginPath(); p.MoveTo(new Vector2(r.x + r.width * 0.1f, r.y + r.height * y)); p.LineTo(new Vector2(r.x + r.width * 0.9f, r.y + r.height * y)); p.Stroke();
            }
        }

        static void DrawSound(MeshGenerationContext ctx, Rect r, bool on)
        {
            var p = ctx.painter2D;
            p.strokeColor = Palette.Paper; p.fillColor = Palette.Paper; p.lineWidth = 2.5f; p.lineCap = LineCap.Round; p.lineJoin = LineJoin.Round;
            Vector2 P(float u, float v) => new Vector2(r.x + u * r.width, r.y + v * r.height);
            p.BeginPath(); p.MoveTo(P(0.05f, 0.35f)); p.LineTo(P(0.28f, 0.35f)); p.LineTo(P(0.55f, 0.1f)); p.LineTo(P(0.55f, 0.9f)); p.LineTo(P(0.28f, 0.65f)); p.LineTo(P(0.05f, 0.65f)); p.ClosePath(); p.Fill();
            if (on)
            {
                p.BeginPath(); p.Arc(P(0.55f, 0.5f), r.width * 0.22f, -50f, 50f); p.Stroke();
                p.BeginPath(); p.Arc(P(0.55f, 0.5f), r.width * 0.4f, -50f, 50f); p.Stroke();
            }
            else
            {
                p.BeginPath(); p.MoveTo(P(0.7f, 0.32f)); p.LineTo(P(0.98f, 0.68f)); p.Stroke();
                p.BeginPath(); p.MoveTo(P(0.98f, 0.32f)); p.LineTo(P(0.7f, 0.68f)); p.Stroke();
            }
        }
    }
}
