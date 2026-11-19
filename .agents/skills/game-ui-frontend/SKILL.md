---
name: game-ui-frontend
description: Design browser-game HUDs, menus, overlays and responsive layouts that protect the playfield.
---

# Game UI Frontend

## Project integration

Apply [AGENTS.md](../../../AGENTS.md), [designregeln.md](../../../designregeln.md) and `frontend-design:frontend-design`. Project scope is smartphones; upstream desktop examples do not override it. Rich’s experiments have only the design exception defined there.

Keep React, TypeScript, Vite, CSS variables and imperative Three.js. No dependency or React Three Fiber migration required. Preserve DOM board/card/dice interfaces; canvas/WebGL defaults apply to suitable scenes. Text-heavy UI belongs in DOM. Modal gating affects camera/UI input, not authoritative multiplayer simulation.

Source: [OpenAI game-studio](https://github.com/openai/plugins/tree/cd0fccd4ed62dded584c16246685b232d7bfe7f6/plugins/game-studio/skills/game-ui-frontend), revision `cd0fccd4ed62dded584c16246685b232d7bfe7f6`, retrieved 2026-11-08. Local edition/reference texts condensed and platform scope adapted; playtest checklist retained.

## Design and hierarchy

Define fantasy, materials, typography, palette, motion, player verbs and viewpoint before coding. Reuse project variables/components. Critical game information first, tools second; rare settings, maps, notes and long instructions behind drawers/dialogs. Thematic menus, clear hierarchy and state/input feedback; readable material backing and contrast over motion.

## Playfield and input

- Keep central/lower-middle playfield clear; initial scene playable within seconds.
- Default: one compact persistent objective/status cluster, at most one small secondary cluster, one transient prompt. Do not expand everything initially.
- Mobile: contextual chips/narrow stacks before large panels. If a future task permits desktop, normally ≤20–25% persistent HUD coverage unless denser UI requested.
- Gate camera drag/look beneath dialogs and pointer-driven UI; manage pointer capture/lock and menu states explicitly.
- Prefer DOM controls/text when clearer/cheaper. Existing card/board layouts are not forced into a 3D HUD budget.
- Adapt layout/input to authorized viewports; game-state feedback remains obvious.

## Motion and anti-patterns

Few meaningful transitions for state changes, reward, danger/onboarding. No constant micro-animation; reduced motion for nonessential effects, no competition with camera movement.

Avoid dashboard composition, unthemed placeholders/arbitrary fonts, dense overlays, permanent long control/lore panels, equal-weight edge cards and header/body/footer stacks obscuring play. Never keep camera input active beneath modals.

## Prompt and review

Specify fantasy, viewpoint/camera mode, player verbs, HUD/menu layers, motion, platforms, playfield budget, disclosure and anti-patterns. Name this skill in implementation prompts.

[Prompt recipe](references/frontend-prompts.md), [HUD patterns](references/three-hud-layout-patterns.md), [playtest checklist](references/playtest-checklist.md). Select relevant checks, capture findings and identify simulation/renderer/frontend/assets ownership.

Optional upstream context: [web-game-foundations](https://github.com/openai/plugins/blob/cd0fccd4ed62dded584c16246685b232d7bfe7f6/plugins/game-studio/skills/web-game-foundations/SKILL.md); [React Three Fiber](https://github.com/openai/plugins/blob/cd0fccd4ed62dded584c16246685b232d7bfe7f6/plugins/game-studio/skills/react-three-fiber-game/SKILL.md) only if explicitly selected later. Neither replaces project architecture.
