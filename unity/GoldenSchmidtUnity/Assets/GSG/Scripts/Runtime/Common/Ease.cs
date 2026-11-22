using System;
using System.Collections;
using UnityEngine;

namespace GSG
{
    /// <summary>Easing curves and a coroutine tween; unscaled time by default so menus survive pause and hit-stop.</summary>
    public static class Ease
    {
        public static float OutCubic(float t) { t = 1f - Mathf.Clamp01(t); return 1f - t * t * t; }

        public static float OutBack(float t)
        {
            const float c1 = 1.70158f, c3 = c1 + 1f;
            t = Mathf.Clamp01(t) - 1f;
            return 1f + c3 * t * t * t + c1 * t * t;
        }

        public static float OutElastic(float t)
        {
            t = Mathf.Clamp01(t);
            if (t <= 0f || t >= 1f) return t;
            return Mathf.Pow(2f, -10f * t) * Mathf.Sin((t * 10f - 0.75f) * (2f * Mathf.PI / 3f)) + 1f;
        }

        public static float InOutSine(float t) => -(Mathf.Cos(Mathf.PI * Mathf.Clamp01(t)) - 1f) / 2f;

        public static IEnumerator Tween(float duration, Action<float> apply, Func<float, float> ease, bool unscaled = true)
        {
            for (float t = 0f; t < 1f; t += (unscaled ? Time.unscaledDeltaTime : Time.deltaTime) / Mathf.Max(duration, 1e-4f))
            {
                apply(ease(t));
                yield return null;
            }
            apply(1f);
        }

        /// <summary>Smooth exponential approach that does not depend on the frame rate.</summary>
        public static float Damp(float current, float target, float sharpness, float dt) => Mathf.Lerp(current, target, 1f - Mathf.Exp(-sharpness * dt));

        public static Vector3 Damp(Vector3 current, Vector3 target, float sharpness, float dt) => Vector3.Lerp(current, target, 1f - Mathf.Exp(-sharpness * dt));
    }
}
