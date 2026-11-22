using UnityEngine;

namespace GSG.Parcours
{
    /// <summary>Wind zone: drifts runners sideways while the gust is on; streaks show direction and timing.</summary>
    public class GustZone : MonoBehaviour
    {
        public Vector3 drift = new Vector3(2.6f, 0f, 0f);
        public float period = 3f, phase, on = 0.55f;
        ParticleSystem streaks;
        bool wasOn;

        void Start()
        {
            var box = GetComponent<BoxCollider>();
            streaks = Fx.Looping("Windstreifen", transform, box ? Vector3.Scale(box.size, new Vector3(0.9f, 0.5f, 0.9f)) : Vector3.one * 4f,
                Palette.WithAlpha(Palette.Paper, 0.55f), 26f, 0.7f, drift.magnitude * 2.2f, 0.08f, false, drift.normalized);
            streaks.transform.localPosition = box ? box.center : Vector3.zero;
        }

        public bool Blowing => Mathf.Repeat(Time.time / period + phase, 1f) < on;

        void Update()
        {
            bool now = Blowing;
            if (now != wasOn)
            {
                var em = streaks.emission; em.enabled = now;
                wasOn = now;
            }
        }

        void OnTriggerStay(Collider other)
        {
            if (!Blowing) return;
            var runner = other.attachedRigidbody ? other.attachedRigidbody.GetComponent<ParcoursRunner>() : null;
            if (runner) runner.AddDrift(drift);
        }
    }
}
