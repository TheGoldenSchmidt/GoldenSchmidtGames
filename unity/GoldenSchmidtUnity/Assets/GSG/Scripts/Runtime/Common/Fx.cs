using System.Collections;
using Unity.Cinemachine;
using UnityEngine;

namespace GSG
{
    /// <summary>
    /// Pooled event effects (one ParticleSystem per recipe, fired with Emit), camera impulses and
    /// hit-stop. Every colour comes from <see cref="Palette"/>; nothing is instantiated per event.
    /// </summary>
    public class Fx : MonoBehaviour
    {
        public static Fx Instance { get; private set; }
        /// <summary>Reduced motion: no shake, no hit-stop, fewer particles (same game result).</summary>
        public static bool Reduced;

        ParticleSystem dust, sparks, confetti, shards, splash, glow;
        CinemachineImpulseSource impulse;
        Coroutine stop;

        public static Fx Ensure()
        {
            if (Instance) return Instance;
            Instance = new GameObject("Fx").AddComponent<Fx>();
            return Instance;
        }

        void Awake()
        {
            Instance = this;
            var soft = Resources.Load<Material>("GSG/Materials/ParticleSoft");
            var square = Resources.Load<Material>("GSG/Materials/ParticleSquare");
            var bright = Resources.Load<Material>("GSG/Materials/ParticleGlow");
            dust = Make("Dust", soft, 0.25f, 0.45f, 0.5f, 1.6f, 0.18f, 0.42f, -0.2f);
            sparks = Make("Sparks", bright, 0.25f, 0.6f, 3f, 7f, 0.06f, 0.16f, 1.2f);
            confetti = Make("Confetti", square, 1.1f, 1.8f, 5f, 11f, 0.12f, 0.24f, 1.4f, true);
            shards = Make("Shards", square, 0.6f, 1.2f, 3f, 7f, 0.12f, 0.3f, 2.2f, true);
            splash = Make("Splash", soft, 0.35f, 0.7f, 3f, 6f, 0.14f, 0.3f, 2.4f);
            glow = Make("Glow", bright, 0.4f, 0.9f, 0.6f, 2.2f, 0.18f, 0.4f, -0.4f);
            var cone = confetti.shape; cone.shapeType = ParticleSystemShapeType.Cone; cone.angle = 28f; cone.radius = 0.3f;
            cone.rotation = new Vector3(-90f, 0f, 0f);
            var up = splash.shape; up.shapeType = ParticleSystemShapeType.Cone; up.angle = 35f; up.radius = 0.25f; up.rotation = new Vector3(-90f, 0f, 0f);
            var rise = glow.shape; rise.shapeType = ParticleSystemShapeType.Cone; rise.angle = 20f; rise.radius = 0.4f; rise.rotation = new Vector3(-90f, 0f, 0f);
            impulse = gameObject.AddComponent<CinemachineImpulseSource>();
            impulse.ImpulseDefinition.ImpulseShape = CinemachineImpulseDefinition.ImpulseShapes.Bump;
            impulse.ImpulseDefinition.ImpulseDuration = 0.22f;
        }

        ParticleSystem Make(string name, Material material, float life0, float life1, float speed0, float speed1, float size0, float size1, float gravity, bool spin = false)
        {
            var go = new GameObject(name);
            go.transform.SetParent(transform, false);
            var ps = go.AddComponent<ParticleSystem>();
            ps.Stop(true, ParticleSystemStopBehavior.StopEmittingAndClear);
            var main = ps.main;
            main.loop = false; main.playOnAwake = false; main.duration = 1f;
            main.startLifetime = new ParticleSystem.MinMaxCurve(life0, life1);
            main.startSpeed = new ParticleSystem.MinMaxCurve(speed0, speed1);
            main.startSize = new ParticleSystem.MinMaxCurve(size0, size1);
            main.gravityModifier = gravity;
            main.simulationSpace = ParticleSystemSimulationSpace.World;
            main.maxParticles = 400;
            if (spin) main.startRotation = new ParticleSystem.MinMaxCurve(0f, Mathf.PI * 2f);
            var emission = ps.emission; emission.rateOverTime = 0f;
            var shape = ps.shape; shape.shapeType = ParticleSystemShapeType.Sphere; shape.radius = 0.2f;
            var size = ps.sizeOverLifetime; size.enabled = true;
            size.size = new ParticleSystem.MinMaxCurve(1f, new AnimationCurve(new Keyframe(0f, 0.6f), new Keyframe(0.15f, 1f), new Keyframe(1f, 0f)));
            var color = ps.colorOverLifetime; color.enabled = true;
            var fade = new Gradient();
            fade.SetKeys(new[] { new GradientColorKey(Color.white, 0f), new GradientColorKey(Color.white, 1f) },
                new[] { new GradientAlphaKey(1f, 0f), new GradientAlphaKey(1f, 0.6f), new GradientAlphaKey(0f, 1f) });
            color.color = fade;
            if (spin) { var rot = ps.rotationOverLifetime; rot.enabled = true; rot.z = new ParticleSystem.MinMaxCurve(-6f, 6f); }
            var r = go.GetComponent<ParticleSystemRenderer>();
            r.sharedMaterial = material;
            r.renderMode = ParticleSystemRenderMode.Billboard;
            r.shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off;
            r.receiveShadows = false;
            ps.Play();
            return ps;
        }

        static void Emit(ParticleSystem ps, Vector3 at, Color color, int count)
        {
            if (!ps) return;
            if (Reduced) count = Mathf.Max(1, count / 3);
            ps.transform.position = at;
            var p = new ParticleSystem.EmitParams { position = at, applyShapeToPosition = true, startColor = color };
            ps.Emit(p, count);
        }

        public static void Dust(Vector3 at, Color color, int count = 6) => Emit(Instance?.dust, at, color, count);
        public static void Sparks(Vector3 at, Color color, int count = 12) => Emit(Instance?.sparks, at, color, count);
        public static void Shards(Vector3 at, Color color, int count = 14) => Emit(Instance?.shards, at, color, count);
        public static void Splash(Vector3 at, Color color, int count = 18) => Emit(Instance?.splash, at, color, count);
        public static void Glow(Vector3 at, Color color, int count = 8) => Emit(Instance?.glow, at, color, count);

        public static void Confetti(Vector3 at, int count = 45)
        {
            if (!Instance) return;
            var colors = new[] { Palette.Accent, Palette.Door, Palette.Seesaw, Palette.Hold, Palette.Floor };
            for (int i = 0; i < colors.Length; i++) Emit(Instance.confetti, at, colors[i], Mathf.Max(1, count / colors.Length));
        }

        /// <summary>Screen shake through Cinemachine Impulse (never moves the camera directly).</summary>
        public static void Shake(float force)
        {
            if (!Instance || Reduced) return;
            Instance.impulse.GenerateImpulseWithForce(force);
        }

        /// <summary>Hit-stop: a short freeze on unscaled time, through one place so effects never fight.</summary>
        public static void HitStop(float seconds)
        {
            if (!Instance || Reduced || Time.timeScale < 0.5f) return;
            if (Instance.stop != null) Instance.StopCoroutine(Instance.stop);
            Instance.stop = Instance.StartCoroutine(Instance.Freeze(seconds));
        }

        IEnumerator Freeze(float seconds)
        {
            Time.timeScale = 0.05f;
            yield return new WaitForSecondsRealtime(seconds);
            if (!Paused) Time.timeScale = 1f;
            stop = null;
        }

        /// <summary>Set by the game shells while a pause menu is open.</summary>
        public static bool Paused;

        /// <summary>A looping emitter that tells the player something (lava embers, wind streaks).</summary>
        public static ParticleSystem Looping(string name, Transform parent, Vector3 boxSize, Color color, float rate, float life, float speed, float size, bool glowing, Vector3 direction)
        {
            var go = new GameObject(name);
            go.transform.SetParent(parent, false);
            var ps = go.AddComponent<ParticleSystem>();
            ps.Stop(true, ParticleSystemStopBehavior.StopEmittingAndClear);
            var main = ps.main;
            main.loop = true; main.playOnAwake = true;
            main.startLifetime = new ParticleSystem.MinMaxCurve(life * 0.7f, life);
            main.startSpeed = 0f;
            main.startSize = new ParticleSystem.MinMaxCurve(size * 0.6f, size);
            main.startColor = color;
            main.simulationSpace = ParticleSystemSimulationSpace.World;
            main.maxParticles = 200;
            var emission = ps.emission; emission.rateOverTime = Reduced ? rate * 0.3f : rate;
            var shape = ps.shape; shape.shapeType = ParticleSystemShapeType.Box; shape.scale = boxSize;
            var velocity = ps.velocityOverLifetime; velocity.enabled = true; velocity.space = ParticleSystemSimulationSpace.World;
            velocity.x = new ParticleSystem.MinMaxCurve(direction.x * speed * 0.8f, direction.x * speed * 1.2f);
            velocity.y = new ParticleSystem.MinMaxCurve(direction.y * speed * 0.8f, direction.y * speed * 1.2f);
            velocity.z = new ParticleSystem.MinMaxCurve(direction.z * speed * 0.8f, direction.z * speed * 1.2f);
            var fade = ps.colorOverLifetime; fade.enabled = true;
            var g = new Gradient();
            g.SetKeys(new[] { new GradientColorKey(Color.white, 0f), new GradientColorKey(Color.white, 1f) },
                new[] { new GradientAlphaKey(0f, 0f), new GradientAlphaKey(1f, 0.2f), new GradientAlphaKey(0f, 1f) });
            fade.color = g;
            var r = go.GetComponent<ParticleSystemRenderer>();
            r.sharedMaterial = Resources.Load<Material>(glowing ? "GSG/Materials/ParticleGlow" : "GSG/Materials/ParticleSoft");
            r.renderMode = direction.sqrMagnitude > 0.5f && !glowing ? ParticleSystemRenderMode.Stretch : ParticleSystemRenderMode.Billboard;
            r.velocityScale = 0.12f; r.lengthScale = 2f;
            r.shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off;
            ps.Play();
            return ps;
        }
    }
}
