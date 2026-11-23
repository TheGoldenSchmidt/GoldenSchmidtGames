using System.Collections.Generic;
using System.IO;
using System.Linq;
using GSG.Parcours;
using UnityEditor;
using UnityEditor.Animations;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.Rendering;
using UnityEngine.Rendering.Universal;
using UnityEngine.UIElements;

namespace GSG.EditorTools
{
    /// <summary>
    /// Reproducible project setup (menu "GSG" or batch): palette materials, UI panel settings,
    /// the six approved base humans as prefabs with remapped clips and an animator, both test
    /// scenes, project and WebGL settings, and the two separate WebGL builds into the app's
    /// public/unity folder.
    /// </summary>
    public static class GSGSetup
    {
        const string Root = "Assets/GSG";
        const string Res = Root + "/Resources/GSG";
        public const string ParcoursScene = Root + "/Scenes/ParcoursProbe.unity";
        public const string LavaScene = Root + "/Scenes/FloorIsLava.unity";
        public const string RollScene = Root + "/Scenes/RollItUp.unity";
        public const string StartScene = Root + "/Scenes/Start.unity";
        static string GameScene(string name) => $"{Root}/Scenes/{name}.unity";
        /// <summary>Match games built by <see cref="BuildMatchScenes"/> (scene name = GameSwitch entry).</summary>
        static readonly string[] MatchScenes = { "SumoSmash", "BumperMayhem", "BombArena", "Schneeballschlacht", "TowerTumble", "TowerSurvival", "Tuerenlotto", "Kreiselkurs" };

        [MenuItem("GSG/1 Alles einrichten")]
        public static void All()
        {
            Materials();
            Panel();
            Figures();
            Project();
            BuildParcoursScene();
            BuildLavaScene();
            BuildRollItUpScene();
            BuildStartScene();
            BuildMatchScenes();
            Project();
            AssetDatabase.SaveAssets();
            Debug.Log("[GSG] Einrichtung fertig.");
        }

        // ---- materials ---------------------------------------------------------------------

        static Color CourseShadow => new Color(0.52f, 0.46f, 0.82f);
        static Color TempleShadow => new Color(0.6f, 0.36f, 0.42f);

        static Material Asset(string name, string shader)
        {
            var path = $"{Res}/Materials/{name}.mat";
            var m = AssetDatabase.LoadAssetAtPath<Material>(path);
            var s = Shader.Find(shader);
            if (!s) throw new System.Exception("Shader fehlt: " + shader);
            if (!m) { m = new Material(s); AssetDatabase.CreateAsset(m, path); }
            m.shader = s;
            m.enableInstancing = true;
            EditorUtility.SetDirty(m);
            return m;
        }

        static Material Toon(string name, Color color, float edge = 1.4f, int pattern = 0, Color? patternColor = null, float scale = 1f, float rim = 0.22f, Color? shadow = null)
        {
            var m = Asset(name, "GSG/Toon");
            m.SetColor("_BaseColor", color);
            m.SetColor("_ShadowTint", shadow ?? CourseShadow);
            m.SetFloat("_EdgeWidth", edge);
            m.SetColor("_EdgeColor", Palette.Ink);
            m.SetFloat("_Pattern", pattern);
            m.SetColor("_PatternColor", patternColor ?? new Color(0f, 0f, 0f, 0f));
            m.SetFloat("_PatternScale", scale);
            m.SetFloat("_RimPower", rim);
            m.SetColor("_EmissionColor", Color.black);
            m.SetFloat("_OutfitOn", 0f);
            return m;
        }

        static Color Darker(Color c, float k) => new Color(c.r * k, c.g * k, c.b * k, 0.14f);

        [MenuItem("GSG/2 Materialien")]
        public static void Materials()
        {
            Directory.CreateDirectory($"{Res}/Materials");
            // Course looks (colours of the online parcours) with subtle patterns that read speed and grip.
            Toon("Floor", Palette.Floor, 1.4f, 1, Darker(Palette.Floor, 0.8f), 2f);
            Toon("Wall", Palette.Wall);
            Toon("Door", Palette.Door, 1.6f, 3, Darker(Palette.Door, 0.85f), 0.6f);
            Toon("Pusher", Palette.Pusher, 1.6f, 3, new Color(1f, 0.97f, 0.9f, 0.35f), 0.5f);
            Toon("Belt", Palette.Belt, 1.2f, 2, Palette.WithAlpha(Palette.Accent, 0.55f), 1.4f);
            Toon("Step", Palette.Step);
            Toon("Seesaw", Palette.Seesaw, 1.4f, 3, Darker(Palette.Seesaw, 0.75f), 0.8f);
            Toon("Tile", Palette.Tile);
            Toon("Roller", Palette.Roller, 0f, 0, null, 1f, 0.3f);
            Toon("Ledge", Palette.Ledge, 1.4f, 1, Darker(Palette.Ledge, 0.85f), 1f);
            Toon("Finish", Palette.Finish, 1.2f, 1, Palette.WithAlpha(Palette.Ink, 0.85f), 1f);
            Toon("FinishBanner", Palette.Finish, 1.2f, 1, Palette.WithAlpha(Palette.Ink, 0.9f), 0.4f);
            Toon("Trap", Palette.Trap, 1.4f, 3, Darker(Palette.Trap, 0.8f), 0.45f);
            Toon("Hold", Palette.Hold, 1.4f, 1, Darker(Palette.Hold, 0.85f), 0.85f);
            Toon("BarLow", Palette.BarLow, 1.4f, 3, new Color(1f, 1f, 1f, 0.3f), 0.5f);
            Toon("BarHigh", Palette.BarHigh, 1.4f, 3, Palette.WithAlpha(Palette.Ink, 0.25f), 0.5f);
            Toon("Flag", Palette.Paper, 0f);
            Toon("Ink", Palette.Ink, 0f, 0, null, 1f, 0.1f);
            Toon("Depth", Palette.Night, 0f, 1, new Color(0.15f, 0.13f, 0.42f, 1f), 12f, 0f);
            foreach (var (name, c) in new[] { ("WallDeco", Palette.Wall), ("DoorDeco", Palette.Door), ("SeesawDeco", Palette.Seesaw), ("HoldDeco", Palette.Hold), ("LedgeDeco", Palette.Ledge) })
                Toon(name, c, 0f, 3, Darker(c, 0.8f), 2.5f, 0.3f);

            // Temple of Floor is Lava.
            Toon("Stone", Palette.Stone, 1.6f, 0, null, 1f, 0.18f, TempleShadow).SetColor("_EdgeColor", new Color(0.42f, 0.24f, 0.16f));
            Toon("StoneDark", Color.Lerp(Palette.Stone, Palette.StoneShadow, 0.55f), 0f, 3, Darker(Palette.StoneShadow, 0.8f), 1.2f, 0.12f, TempleShadow);
            Toon("Rune", Palette.Rune, 0f, 0, null, 1f, 0f, TempleShadow).SetColor("_EmissionColor", Palette.Rune * 1.4f);

            var goo = Asset("Goo", "GSG/Glow");
            goo.SetColor("_HotColor", new Color(0.75f, 2.6f, 0.45f));
            goo.SetColor("_CrustColor", new Color(0.12f, 0.42f, 0.1f));
            goo.SetFloat("_Scale", 2.2f); goo.SetVector("_Flow", new Vector4(0.18f, 0.08f, 0f, 0f)); goo.SetFloat("_Contrast", 1.4f);
            var lava = Asset("Lava", "GSG/Glow");
            lava.SetColor("_HotColor", new Color(4.2f, 1.5f, 0.32f));
            lava.SetColor("_CrustColor", new Color(0.4f, 0.05f, 0.02f));
            lava.SetFloat("_Scale", 3.2f); lava.SetVector("_Flow", new Vector4(0.1f, 0.05f, 0f, 0f)); lava.SetFloat("_Contrast", 1.9f);

            var sky = Asset("Sky", "GSG/Sky");
            sky.SetColor("_Top", Palette.SkyTop); sky.SetColor("_Horizon", Palette.SkyHorizon); sky.SetColor("_Bottom", Palette.SkyBottom);
            sky.SetColor("_SunColor", Palette.Sun); sky.SetFloat("_SunSize", 28f);
            // Roll It Up!: the violet evening gradient of the web Bauschale (src/three/rollingTray.ts).
            var roll = Asset("RollSky", "GSG/Sky");
            roll.SetColor("_Top", Palette.Hex("#4a47a6")); roll.SetColor("_Horizon", Palette.Hex("#d9b8ee"));
            roll.SetColor("_Bottom", Palette.Hex("#7f9be8")); roll.SetColor("_SunColor", Palette.Sun); roll.SetFloat("_SunSize", 18f);
            var night = Asset("NightSky", "GSG/Sky");
            night.SetColor("_Top", Palette.Hex("#0d0b2e")); night.SetColor("_Horizon", Palette.Hex("#5a3a9a"));
            night.SetColor("_Bottom", Palette.Hex("#140f3a")); night.SetColor("_SunColor", Palette.Hex("#ff86c8")); night.SetFloat("_SunSize", 6f);
            var temple = Asset("TempleSky", "GSG/Sky");
            temple.SetColor("_Top", new Color(0.09f, 0.03f, 0.04f)); temple.SetColor("_Horizon", new Color(0.55f, 0.16f, 0.07f));
            temple.SetColor("_Bottom", new Color(0.3f, 0.06f, 0.02f)); temple.SetColor("_SunColor", Palette.LavaGlow); temple.SetFloat("_SunSize", 6f);

            var soft = Asset("ParticleSoft", "GSG/Particle"); soft.SetFloat("_Square", 0f); soft.SetFloat("_Softness", 0.3f); soft.SetFloat("_Boost", 1f);
            var square = Asset("ParticleSquare", "GSG/Particle"); square.SetFloat("_Square", 1f); square.SetFloat("_Softness", 0.04f); square.SetFloat("_Boost", 1f);
            var glow = Asset("ParticleGlow", "GSG/Particle"); glow.SetFloat("_Square", 0f); glow.SetFloat("_Softness", 0.45f); glow.SetFloat("_Boost", 2.6f);
            var outline = Asset("Outline", "GSG/Outline"); outline.SetColor("_OutlineColor", Palette.Ink); outline.SetFloat("_OutlineWidth", 0.012f);
            AssetDatabase.SaveAssets();
        }

        // ---- UI ----------------------------------------------------------------------------

        [MenuItem("GSG/3 UI-Panel")]
        public static void Panel()
        {
            var path = $"{Res}/UI/Panel.asset";
            var panel = AssetDatabase.LoadAssetAtPath<PanelSettings>(path);
            if (!panel) { panel = ScriptableObject.CreateInstance<PanelSettings>(); AssetDatabase.CreateAsset(panel, path); }
            panel.themeStyleSheet = AssetDatabase.LoadAssetAtPath<ThemeStyleSheet>($"{Res}/UI/Theme.tss");
            panel.scaleMode = PanelScaleMode.ScaleWithScreenSize;
            panel.referenceResolution = new Vector2Int(420, 860);
            panel.screenMatchMode = PanelScreenMatchMode.MatchWidthOrHeight;
            panel.match = 0.5f;
            panel.sortingOrder = 10;
            EditorUtility.SetDirty(panel);
            AssetDatabase.SaveAssets();
        }

        // ---- figures -----------------------------------------------------------------------

        struct Human { public string id, body, skin, hair; public bool beard; public Color hairColor; }

        static readonly Human[] Humans =
        {
            new Human { id = "rig_jonas", body = "m", skin = "light", hair = "simpleparted", hairColor = Palette.Hex("#6b4423") },
            new Human { id = "rig_amara", body = "f", skin = "dark", hair = "buns", hairColor = Palette.Hex("#2b1d16") },
            new Human { id = "rig_malik", body = "m", skin = "dark", hair = "buzzed", beard = true, hairColor = Palette.Hex("#1f1714") },
            new Human { id = "rig_lena", body = "f", skin = "light", hair = "long", hairColor = Palette.Hex("#e0b85c") },
            new Human { id = "rig_erik", body = "m", skin = "light", hair = "buzzed", beard = true, hairColor = Palette.Hex("#b4532a") },
            new Human { id = "rig_zoe", body = "f", skin = "dark", hair = "buzzedfemale", hairColor = Palette.Hex("#e07a24") }
        };

        [MenuItem("GSG/4 Figuren")]
        public static void Figures()
        {
            var clips = Clips();
            var controller = Controller(clips);
            var tex = $"{Root}/Models/tex/";
            Texture2D T(string n) => AssetDatabase.LoadAssetAtPath<Texture2D>(tex + n);
            var outline = AssetDatabase.LoadAssetAtPath<Material>($"{Res}/Materials/Outline.mat");
            foreach (var h in Humans)
            {
                var body = Toon($"Figur_{h.body}_{h.skin}", Color.white, 0f, 0, null, 1f, 0.18f);
                body.SetTexture("_BaseMap", T($"body_{h.body}_{h.skin}.jpg"));
                body.SetTexture("_OutfitMap", T($"outfit_{h.body}.png"));
                body.SetFloat("_OutfitOn", 1f);
                var eyes = Toon("Figur_Augen", Color.white, 0f, 0, null, 1f, 0.1f);
                eyes.SetTexture("_BaseMap", T("eye.jpg"));
                var hair = Toon($"Figur_Haar_{h.id}", h.hairColor, 0f, 0, null, 1f, 0.15f);
                hair.SetTexture("_BaseMap", T(h.body == "m" ? "hair_1.jpg" : "hair_2.jpg"));

                var source = AssetDatabase.LoadAssetAtPath<GameObject>($"{Root}/Models/body_{h.body}.glb");
                var root = new GameObject(h.id);
                var visual = new GameObject("Visual").transform;
                visual.SetParent(root.transform, false);
                var model = (GameObject)Object.Instantiate(source, visual);
                model.name = "Modell";
                var armature = model.transform.Find("Armature");
                foreach (var r in model.GetComponentsInChildren<SkinnedMeshRenderer>())
                {
                    var n = r.sharedMaterial ? r.sharedMaterial.name : "";
                    var main = n.StartsWith("MI_Superhero") ? body : n == "MI_Eyes" ? eyes : hair;
                    r.sharedMaterials = n == "MI_Eyes" ? new[] { main } : new[] { main, outline };
                    r.shadowCastingMode = ShadowCastingMode.On;
                    r.updateWhenOffscreen = true;
                }
                foreach (var style in new[] { h.hair, h.beard ? "beard" : null })
                {
                    if (style == null) continue;
                    var hairSource = AssetDatabase.LoadAssetAtPath<GameObject>($"{Root}/Models/hair_{style}.glb");
                    var copy = (GameObject)Object.Instantiate(hairSource);
                    foreach (var smr in copy.GetComponentsInChildren<SkinnedMeshRenderer>())
                    {
                        Rebind(smr, armature);
                        smr.transform.SetParent(armature, false);
                        smr.sharedMaterials = new[] { hair, outline };
                        smr.updateWhenOffscreen = true;
                    }
                    Object.DestroyImmediate(copy);
                }
                // The clips of anims.glb address the bones as "Node-0/root/…" (its unnamed armature node):
                // an identity "Node-0" level under the body's Armature lets them play unchanged.
                var node = new GameObject("Node-0").transform;
                node.SetParent(armature, false);
                armature.Find("root").SetParent(node, false);
                var animator = armature.gameObject.AddComponent<Animator>();
                animator.runtimeAnimatorController = controller;
                animator.applyRootMotion = false;
                animator.cullingMode = AnimatorCullingMode.AlwaysAnimate;
                // Standing height of the parcours capsule (1.6 m); the source models are 1.92 m tall.
                var bounds = model.GetComponentsInChildren<SkinnedMeshRenderer>().OrderByDescending(r => r.bounds.size.y).First().bounds;
                float scale = 1.6f / Mathf.Max(0.5f, bounds.size.y);
                model.transform.localScale = Vector3.one * scale;
                var figure = root.AddComponent<Figure>();
                figure.animator = animator;
                figure.visual = visual;
                PrefabUtility.SaveAsPrefabAsset(root, $"{Res}/Figures/{h.id}.prefab");
                Object.DestroyImmediate(root);
            }
            AssetDatabase.SaveAssets();
            // Second pass: make sure every saved prefab references the (re)built controller.
            foreach (var h in Humans)
            {
                var path = $"{Res}/Figures/{h.id}.prefab";
                using var scope = new PrefabUtility.EditPrefabContentsScope(path);
                foreach (var a in scope.prefabContentsRoot.GetComponentsInChildren<Animator>()) a.runtimeAnimatorController = controller;
            }
            AssetDatabase.SaveAssets();
        }

        static void Rebind(SkinnedMeshRenderer smr, Transform armature)
        {
            var map = armature.GetComponentsInChildren<Transform>().GroupBy(t => t.name).ToDictionary(g => g.Key, g => g.First());
            smr.bones = smr.bones.Select(b => b && map.TryGetValue(b.name, out var t) ? t : b).ToArray();
            if (smr.rootBone && map.TryGetValue(smr.rootBone.name, out var root)) smr.rootBone = root;
        }

        /// <summary>The clips imported by glTFast from anims.glb (sub-assets, nothing duplicated into the project).</summary>
        static Dictionary<string, AnimationClip> Clips() =>
            AssetDatabase.LoadAllAssetsAtPath($"{Root}/Models/anims.glb").OfType<AnimationClip>().ToDictionary(c => c.name, c => c);

        static AnimatorController Controller(Dictionary<string, AnimationClip> clips)
        {
            var path = $"{Root}/Figures/Figur.controller";
            var controller = AssetDatabase.LoadAssetAtPath<AnimatorController>(path) ?? AnimatorController.CreateAnimatorControllerAtPath(path);
            var sm = controller.layers[0].stateMachine;
            foreach (var s in sm.states.ToArray()) sm.RemoveState(s.state);
            foreach (var (name, clip) in clips)
            {
                var state = sm.AddState(name);
                state.motion = clip;
                if (name == "idle") sm.defaultState = state;
            }
            // Hanging: the first frame of the climb clip held still.
            if (clips.TryGetValue("climb", out var climb))
            {
                var hang = sm.AddState("hang");
                hang.motion = climb;
                hang.speed = 0f;
            }
            EditorUtility.SetDirty(controller);
            AssetDatabase.SaveAssets();
            return controller;
        }

        // ---- project settings --------------------------------------------------------------

        [MenuItem("GSG/5 Projekt & WebGL")]
        public static void Project()
        {
            PlayerSettings.companyName = "GoldenSchmidtGames";
            PlayerSettings.productName = "GSG Unity-Test";
            PlayerSettings.runInBackground = true;
            PlayerSettings.colorSpace = ColorSpace.Linear;
            PlayerSettings.WebGL.compressionFormat = WebGLCompressionFormat.Gzip;
            PlayerSettings.WebGL.decompressionFallback = true;
            PlayerSettings.WebGL.nameFilesAsHashes = true;
            PlayerSettings.WebGL.dataCaching = true;
            PlayerSettings.WebGL.exceptionSupport = WebGLExceptionSupport.None;
            PlayerSettings.WebGL.template = "PROJECT:GSG";
            PlayerSettings.WebGL.showDiagnostics = false;
            PlayerSettings.SetIl2CppCodeGeneration(UnityEditor.Build.NamedBuildTarget.WebGL, UnityEditor.Build.Il2CppCodeGeneration.OptimizeSize);
            // Load time on phones: smaller engine code, no splash screen (optional for Unity Personal since Unity 6).
            PlayerSettings.SetManagedStrippingLevel(UnityEditor.Build.NamedBuildTarget.WebGL, ManagedStrippingLevel.High);
            PlayerSettings.stripEngineCode = true;
            PlayerSettings.SplashScreen.show = false;
            PlayerSettings.SplashScreen.showUnityLogo = false;
            SetWebGLCodeOptimization("DiskSizeLTO");

            // Phone-sized quality tier for the web, with shadows and HDR for the toon bands and bloom.
            var names = QualitySettings.names;
            int mobile = System.Array.FindIndex(names, n => n.ToLowerInvariant().Contains("mobile"));
            if (mobile < 0) mobile = 0;
            QualitySettings.SetQualityLevel(mobile, true);
            foreach (var target in new[] { "WebGL", "Standalone", "Android", "iPhone" })
                SetDefaultQuality(target, mobile);
            if (GraphicsSettings.currentRenderPipeline is UniversalRenderPipelineAsset urp)
            {
                urp.supportsHDR = true;
                urp.shadowDistance = 55f;
                urp.shadowCascadeCount = 1;
                urp.mainLightShadowmapResolution = 2048;
                urp.renderScale = 1f;
                urp.msaaSampleCount = 2;
                EditorUtility.SetDirty(urp);
                SetPrivate(urp, "m_MainLightShadowsSupported", true);
                SetPrivate(urp, "m_SoftShadowsSupported", true);
            }
            // One shared WebGL build: the start scene (index 0) loads the game named in ?spiel=.
            EditorBuildSettings.scenes = new[] { StartScene, ParcoursScene, LavaScene, RollScene }.Concat(MatchScenes.Select(GameScene))
                .Where(File.Exists).Select(path => new EditorBuildSettingsScene(path, true)).ToArray();
            AssetDatabase.SaveAssets();
        }

        /// <summary>WebGL "Code Optimization" (UnityEditor.WebGL.UserBuildSettings), set by reflection: the type lives in the WebGL module.</summary>
        static void SetWebGLCodeOptimization(string value)
        {
            var settings = System.AppDomain.CurrentDomain.GetAssemblies().Select(a => a.GetType("UnityEditor.WebGL.UserBuildSettings")).FirstOrDefault(t => t != null);
            var property = settings?.GetProperty("codeOptimization", System.Reflection.BindingFlags.Public | System.Reflection.BindingFlags.Static);
            if (property == null) { Debug.LogWarning("[GSG] WebGL-Codeoptimierung nicht gefunden."); return; }
            property.SetValue(null, System.Enum.Parse(property.PropertyType, value));
            Debug.Log("[GSG] WebGL-Codeoptimierung: " + property.GetValue(null));
        }

        static void SetPrivate(Object target, string field, bool value)
        {
            var so = new SerializedObject(target);
            var p = so.FindProperty(field);
            if (p != null) { p.boolValue = value; so.ApplyModifiedPropertiesWithoutUndo(); }
        }

        static void SetDefaultQuality(string platform, int level)
        {
            var settings = AssetDatabase.LoadAllAssetsAtPath("ProjectSettings/QualitySettings.asset").FirstOrDefault();
            if (!settings) return;
            var so = new SerializedObject(settings);
            var defaults = so.FindProperty("m_PerPlatformDefaultQuality");
            if (defaults == null) return;
            for (int i = 0; i < defaults.arraySize; i++)
            {
                var e = defaults.GetArrayElementAtIndex(i);
                if (e.FindPropertyRelative("first").stringValue == platform) e.FindPropertyRelative("second").intValue = level;
            }
            so.ApplyModifiedPropertiesWithoutUndo();
        }

        // ---- scenes ------------------------------------------------------------------------

        static Material M(string n) => AssetDatabase.LoadAssetAtPath<Material>($"{Res}/Materials/{n}.mat");

        /// <summary>Camera with post-processing, warm key light, palette sky/ambient/fog and a global volume.</summary>
        static void Frame(string sky, Color key, float intensity, Vector3 euler, Color ambientSky, Color ambientEquator, Color ambientGround, Color fog, float fogStart, float fogEnd, float bloom, bool temple, string profileName = null)
        {
            var camGo = new GameObject("Main Camera") { tag = "MainCamera" };
            var cam = camGo.AddComponent<Camera>();
            cam.clearFlags = CameraClearFlags.Skybox;
            cam.fieldOfView = 55f; cam.nearClipPlane = 0.2f; cam.farClipPlane = 400f;
            camGo.AddComponent<AudioListener>();
            var data = camGo.AddComponent<UniversalAdditionalCameraData>();
            data.renderPostProcessing = true;
            data.antialiasing = AntialiasingMode.FastApproximateAntialiasing;
            camGo.transform.position = new Vector3(0f, 4f, -8f);

            var lightGo = new GameObject("Sonne");
            var light = lightGo.AddComponent<Light>();
            light.type = LightType.Directional;
            light.color = key; light.intensity = intensity;
            light.shadows = LightShadows.Soft; light.shadowStrength = 0.85f;
            lightGo.transform.rotation = Quaternion.Euler(euler);

            var look = new GameObject("Licht & Himmel").AddComponent<SceneLook>();
            look.sky = M(sky);
            look.ambientSky = ambientSky; look.ambientEquator = ambientEquator; look.ambientGround = ambientGround;
            look.fog = fog; look.fogStart = fogStart; look.fogEnd = fogEnd;
            look.Apply();

            var profilePath = $"{Root}/Scenes/{profileName ?? (temple ? "Tempel" : "Parcours")}-Volume.asset";
            AssetDatabase.DeleteAsset(profilePath);
            var profile = ScriptableObject.CreateInstance<VolumeProfile>();
            AssetDatabase.CreateAsset(profile, profilePath);
            var tone = profile.Add<Tonemapping>(true); tone.mode.Override(TonemappingMode.Neutral);
            var b = profile.Add<Bloom>(true); b.intensity.Override(bloom); b.threshold.Override(1.05f); b.scatter.Override(0.6f);
            var v = profile.Add<Vignette>(true); v.intensity.Override(0.22f); v.color.Override(temple ? new Color(0.2f, 0.03f, 0.02f) : Palette.Night);
            var ca = profile.Add<ColorAdjustments>(true); ca.saturation.Override(10f); ca.contrast.Override(6f);
            foreach (var c in profile.components) AssetDatabase.AddObjectToAsset(c, profile);
            var volume = new GameObject("Nachbearbeitung").AddComponent<Volume>();
            volume.isGlobal = true; volume.sharedProfile = profile;
            EditorUtility.SetDirty(profile);
        }

        [MenuItem("GSG/6 Szene Parcours")]
        public static void BuildParcoursScene()
        {
            var scene = EditorSceneManager.NewScene(NewSceneSetup.EmptyScene, NewSceneMode.Single);
            Frame("Sky", Palette.Sun, 1.25f, new Vector3(42f, -35f, 0f), new Color(0.56f, 0.55f, 0.88f), new Color(0.8f, 0.64f, 0.74f), new Color(0.23f, 0.17f, 0.31f),
                new Color(0.62f, 0.45f, 0.66f), 80f, 260f, 0.4f, false);
            var level = new GameObject("Parcours").transform;
            var result = ParcoursLevel.Build(level);
            var game = new GameObject("Spiel").AddComponent<ParcoursGame>();
            game.checkpoints = result.checkpoints.ToArray();
            game.goo = result.goo.ToArray();
            game.start = result.start;
            game.stations = ParcoursLevel.Stations.Select(s => new ParcoursGame.Station { name = s.name, hint = s.hint }).ToArray();
            MarkStatic(level);
            EditorSceneManager.SaveScene(scene, ParcoursScene);
        }

        [MenuItem("GSG/7 Szene Floor is Lava")]
        public static void BuildLavaScene()
        {
            var scene = EditorSceneManager.NewScene(NewSceneSetup.EmptyScene, NewSceneMode.Single);
            Frame("TempleSky", new Color(1f, 0.86f, 0.7f), 1.1f, new Vector3(55f, -30f, 0f), new Color(0.55f, 0.3f, 0.32f), new Color(0.62f, 0.32f, 0.22f), new Color(0.75f, 0.22f, 0.06f),
                new Color(0.35f, 0.08f, 0.04f), 30f, 90f, 0.6f, true);
            var gameType = System.Type.GetType("GSG.Lava.LavaGame, GSG.Runtime");
            if (gameType != null) new GameObject("Spiel").AddComponent(gameType);
            EditorSceneManager.SaveScene(scene, LavaScene);
        }

        [MenuItem("GSG/8 Szene Roll It Up")]
        public static void BuildRollItUpScene()
        {
            var scene = EditorSceneManager.NewScene(NewSceneSetup.EmptyScene, NewSceneMode.Single);
            Frame("RollSky", new Color(1f, 0.93f, 0.82f), 1.2f, new Vector3(50f, -35f, 0f), new Color(0.62f, 0.64f, 0.95f), new Color(0.86f, 0.76f, 0.86f), new Color(0.32f, 0.3f, 0.4f),
                new Color(0.72f, 0.66f, 0.9f), 60f, 160f, 0.35f, false, "Bauschale");
            // The board itself is built at runtime from the app's board message (or the demo data in the editor).
            var gameType = System.Type.GetType("GSG.RollItUp.RollGame, GSG.Runtime");
            if (gameType != null) new GameObject("Spiel").AddComponent(gameType);
            EditorSceneManager.SaveScene(scene, RollScene);
        }

        [MenuItem("GSG/9 Startszene")]
        public static void BuildStartScene()
        {
            var scene = EditorSceneManager.NewScene(NewSceneSetup.EmptyScene, NewSceneMode.Single);
            var camGo = new GameObject("Main Camera") { tag = "MainCamera" };
            var cam = camGo.AddComponent<Camera>();
            cam.clearFlags = CameraClearFlags.SolidColor; cam.backgroundColor = Palette.Night;
            camGo.AddComponent<AudioListener>();
            new GameObject("Spielwahl").AddComponent<GameSwitch>();
            EditorSceneManager.SaveScene(scene, StartScene);
        }

        [MenuItem("GSG/10 Szenen der Match-Spiele")]
        public static void BuildMatchScenes()
        {
            foreach (var name in MatchScenes)
            {
                var scene = EditorSceneManager.NewScene(NewSceneSetup.EmptyScene, NewSceneMode.Single);
                switch (name)
                {
                    case "SumoSmash":
                        Frame("Sky", Palette.Sun, 1.25f, new Vector3(45f, -40f, 0f), new Color(0.56f, 0.55f, 0.88f), new Color(0.8f, 0.64f, 0.74f), new Color(0.23f, 0.17f, 0.31f),
                            new Color(0.62f, 0.45f, 0.66f), 40f, 140f, 0.4f, false, "Sumo");
                        new GameObject("Spiel").AddComponent<GSG.Ring.RingGame>().bumper = false;
                        break;
                    case "BumperMayhem":
                        Frame("NightSky", new Color(0.85f, 0.8f, 1f), 1.05f, new Vector3(55f, -30f, 0f), new Color(0.45f, 0.42f, 0.85f), new Color(0.55f, 0.4f, 0.7f), new Color(0.2f, 0.12f, 0.3f),
                            new Color(0.12f, 0.08f, 0.3f), 30f, 90f, 0.9f, false, "Bumper");
                        new GameObject("Spiel").AddComponent<GSG.Ring.RingGame>().bumper = true;
                        break;
                    case "BombArena":
                        Frame("Sky", new Color(1f, 0.92f, 0.85f), 1.15f, new Vector3(60f, -25f, 0f), new Color(0.5f, 0.5f, 0.85f), new Color(0.72f, 0.6f, 0.75f), new Color(0.2f, 0.16f, 0.3f),
                            new Color(0.35f, 0.3f, 0.6f), 40f, 120f, 0.7f, false, "Bomben");
                        new GameObject("Spiel").AddComponent<GSG.Bombs.BombGame>();
                        break;
                    case "Schneeballschlacht":
                        Frame("RollSky", new Color(1f, 0.95f, 0.9f), 1.15f, new Vector3(40f, -50f, 0f), new Color(0.7f, 0.75f, 0.98f), new Color(0.86f, 0.86f, 0.96f), new Color(0.55f, 0.6f, 0.75f),
                            new Color(0.82f, 0.85f, 0.97f), 25f, 70f, 0.3f, false, "Schnee");
                        new GameObject("Spiel").AddComponent<GSG.Snow.SnowGame>();
                        break;
                    case "TowerTumble":
                    case "TowerSurvival":
                        Frame("Sky", Palette.Sun, 1.2f, new Vector3(35f, -30f, 0f), new Color(0.56f, 0.55f, 0.88f), new Color(0.8f, 0.64f, 0.74f), new Color(0.23f, 0.17f, 0.31f),
                            new Color(0.62f, 0.45f, 0.66f), 60f, 200f, 0.4f, false, "Turm");
                        new GameObject("Spiel").AddComponent<GSG.Tower.TowerGame>().survival = name == "TowerSurvival";
                        break;
                    case "Tuerenlotto":
                    case "Kreiselkurs":
                        var runType = System.Type.GetType("GSG.Parcours.RunGame, GSG.Runtime");
                        if (runType == null) continue;
                        Frame("Sky", Palette.Sun, 1.25f, new Vector3(42f, -35f, 0f), new Color(0.56f, 0.55f, 0.88f), new Color(0.8f, 0.64f, 0.74f), new Color(0.23f, 0.17f, 0.31f),
                            new Color(0.62f, 0.45f, 0.66f), 80f, 260f, 0.4f, false, "Lauf");
                        var run = new GameObject("Spiel").AddComponent(runType);
                        runType.GetField("course").SetValue(run, name == "Tuerenlotto" ? "tuerenlotto" : "kreiselkurs");
                        break;
                }
                EditorSceneManager.SaveScene(scene, GameScene(name));
            }
        }

        /// <summary>Static batching for everything that never moves (no rigid body or behaviour on it or above it).</summary>
        static void MarkStatic(Transform root)
        {
            foreach (var t in root.GetComponentsInChildren<Transform>(true))
            {
                if (t.GetComponentInParent<Rigidbody>() || t.GetComponentInParent<MonoBehaviour>()) continue;
                GameObjectUtility.SetStaticEditorFlags(t.gameObject, StaticEditorFlags.BatchingStatic | StaticEditorFlags.OccluderStatic | StaticEditorFlags.OccludeeStatic);
            }
        }
    }
}
