# Frontend prompt recipe

Use with `game-ui-frontend`; project instructions determine platforms.

```text
Design and implement <HUD, menu, overlay>.
Fantasy/materials: <genre, world, materials>
Viewpoint/camera: <top-down, side, third-person, orbit, etc.>
Player verbs: <move, jump, aim, inspect, etc.>
Surfaces: <status, objective, controls, pause, settings, result>
Typography/palette: <project choices>
Motion: <restrained; stronger for state changes>
Platforms/input: <authorized viewports/controls>

Keep central/lower-middle playfield clear. Start with one compact objective/status cluster, at most one small secondary cluster and a transient hint. Collapse maps, notes, long controls/settings. Use DOM overlays/theme variables. Gate camera input beneath dialogs, make pointer/menu states explicit, respect reduced motion.
Avoid dashboards, arbitrary fonts, permanent long panels, equal-weight edge boxes and constant decoration.
```

Menus: name title/pause/settings/result surfaces and connect them to the world. Exploration: initial scene playable within seconds. 3D: specify camera handoff/existing engine; no implied stack migration.
