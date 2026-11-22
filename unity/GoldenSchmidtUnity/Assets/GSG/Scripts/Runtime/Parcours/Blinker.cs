using UnityEngine;

namespace GSG.Parcours
{
    /// <summary>
    /// Periodically vanishing box: trapdoor plates swing open on a hinge, climbing holds sink
    /// away. A warning glow and shake start <see cref="warn"/> seconds before it opens.
    /// </summary>
    public class Blinker : MonoBehaviour
    {
        public enum Kind { Trapdoor, Hold }
        public Kind kind = Kind.Trapdoor;
        public float period = 4f, phase, open = 0.3f, warn = 0.9f;
        public Transform hinge;   // trapdoor: pivot at one edge; hold: the moving visual

        Collider solid;
        Renderer look;
        Vector3 rest;
        bool wasOpen, warned;
        Color baseColor;

        void Awake()
        {
            solid = GetComponent<Collider>();
            look = GetComponentInChildren<Renderer>();
            if (!hinge) hinge = transform;
            rest = hinge.localPosition;
            baseColor = look.sharedMaterial.GetColor("_BaseColor");
        }

        void Update()
        {
            float cycle = Mathf.Repeat(Time.time / period + phase, 1f);
            bool isOpen = cycle < open;
            float untilOpen = (1f - cycle) * period;
            float warnK = !isOpen && untilOpen < warn ? 1f - untilOpen / warn : 0f;
            solid.enabled = !isOpen;
            if (isOpen != wasOpen)
            {
                if (isOpen) { Sfx.Play(kind == Kind.Trapdoor ? "thud" : "whoosh", 0.5f); Fx.Dust(transform.position, baseColor, 4); }
                wasOpen = isOpen;
                warned = false;
            }
            if (warnK > 0f && !warned) { warned = true; if (IsNear()) Sfx.Play("warn", 0.35f); }

            // Warning colour and a small shake; opening animates on the hinge (or sinks the hold).
            var mat = look.material;
            mat.SetColor("_BaseColor", Color.Lerp(baseColor, Palette.Warn, warnK));
            mat.SetColor("_EmissionColor", Palette.Warn * (warnK * 0.6f));
            float shake = GSG.Fx.Reduced ? 0f : warnK * 0.03f * Mathf.Sin(Time.time * 60f);
            float openK = isOpen ? Mathf.Clamp01(Mathf.Min(cycle, open - cycle) / Mathf.Min(0.12f, open * 0.5f)) : 0f;
            if (kind == Kind.Trapdoor)
            {
                hinge.localRotation = Quaternion.Euler(0f, 0f, -88f * GSG.Ease.OutCubic(openK));
                hinge.localPosition = rest + new Vector3(shake, 0f, 0f);
            }
            else
            {
                hinge.localPosition = rest + new Vector3(shake, -2.2f * GSG.Ease.OutCubic(openK), 0f);
                look.enabled = openK < 0.98f;
            }
        }

        bool IsNear()
        {
            var cam = Camera.main;
            return cam && (cam.transform.position - transform.position).sqrMagnitude < 30f * 30f;
        }
    }
}
