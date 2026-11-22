using UnityEngine;

namespace GSG.Parcours
{
    /// <summary>Glowing goo that rises and falls; touching it returns the runner to the station start.</summary>
    public class GooTide : MonoBehaviour
    {
        public float low = -1f, high = 0.4f, period = 7f, phase;
        public float x0 = -6f, x1 = 6f, z0, z1;
        ParticleSystem bubbles;
        bool rising;

        public float Level => Mathf.Lerp(low, high, 0.5f + 0.5f * Mathf.Sin(2f * Mathf.PI * Time.time / period + phase));

        void Start()
        {
            bubbles = Fx.Looping("Blasen", transform, new Vector3(x1 - x0, 0.1f, z1 - z0), Palette.WithAlpha(Palette.Goo, 0.8f), 18f, 0.9f, 0.8f, 0.16f, true, Vector3.up);
        }

        void Update()
        {
            var p = transform.position;
            float level = Level;
            transform.position = new Vector3(p.x, level, p.z);
            bool up = Mathf.Cos(2f * Mathf.PI * Time.time / period + phase) > 0f;
            if (up && !rising && Hud.Instance && IsNear()) Hud.Instance.Toast("Der Glibber steigt!", Palette.Goo, 0.7f);
            rising = up;
        }

        bool IsNear()
        {
            var r = FindAnyObjectByType<ParcoursRunner>();
            return r && r.transform.position.z > z0 - 4f && r.transform.position.z < z1 + 2f;
        }

        /// <summary>Whether the feet at a point are in the goo.</summary>
        public bool Covers(Vector3 feet) => feet.x > x0 && feet.x < x1 && feet.z > z0 && feet.z < z1 && feet.y < Level;
    }
}
