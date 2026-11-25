using System.Collections;
using UnityEngine;

namespace GSG.Parcours
{
    /// <summary>
    /// Door panel: a real door bursts into shards when a runner runs into it, a fake one stays
    /// shut, wobbles and turns dark (like a tried door in the online parcours).
    /// </summary>
    public class BreakDoor : MonoBehaviour
    {
        public bool real;
        bool done;
        /// <summary>Someone ran into it; <see cref="Open"/> = it burst (a real door).</summary>
        public bool Tried => done;
        public bool Open => done && real;
        Renderer look;

        void Awake() { look = GetComponent<Renderer>(); }

        void OnCollisionEnter(Collision c)
        {
            if (done || !c.rigidbody) return;
            var runner = c.rigidbody.GetComponent<ParcoursRunner>();
            if (!runner) return;
            var v = c.relativeVelocity; v.y = 0f;
            if (v.magnitude < 1.2f && !runner.IsDiving) return;
            done = true;
            if (real) StartCoroutine(Burst(runner.Heading, !runner.bot));
            else if (runner.bot) { look.material.SetColor("_BaseColor", Palette.DoorSolid); StartCoroutine(Wobble()); runner.Bounce(-runner.Heading * 3.5f); }
            else
            {
                look.material.SetColor("_BaseColor", Palette.DoorSolid);
                Sfx.Play("thud");
                Fx.Dust(c.GetContact(0).point, Palette.DoorSolid, 5);
                StartCoroutine(Wobble());
                runner.Bounce(-runner.Heading * 3.5f);
            }
        }

        /// <summary>
        /// Online: the room's public door state ('1' broken open, '2' tried and solid). <paramref name="loud"/>
        /// near the own racer; <paramref name="instant"/> for doors opened before this device joined.
        /// </summary>
        public void Show(char state, Vector3 heading, bool loud, bool instant)
        {
            if (done || (state != '1' && state != '2')) return;
            done = true;
            real = state == '1';
            if (real && instant) { GetComponent<Collider>().enabled = false; look.enabled = false; return; }
            if (real) { StartCoroutine(Burst(heading, loud)); return; }
            look.material.SetColor("_BaseColor", Palette.DoorSolid);
            if (instant) return;
            if (loud) { Sfx.Play("thud"); Fx.Dust(transform.position, Palette.DoorSolid, 5); }
            StartCoroutine(Wobble());
        }

        IEnumerator Burst(Vector3 heading, bool loud)
        {
            GetComponent<Collider>().enabled = false;
            Sfx.Play("break", loud ? 1f : 0.45f);
            if (loud) { Fx.Shake(0.5f); Fx.HitStop(0.06f); }
            var b = look.bounds;
            Fx.Shards(b.center, Palette.Door, 18);
            Fx.Sparks(b.center, Palette.Accent, 8);
            // Real shards: a few small rigid bodies tumbling away in the runner's direction.
            var shards = new GameObject("Scherben").transform;
            for (int i = 0; i < 8; i++)
            {
                var s = GameObject.CreatePrimitive(PrimitiveType.Cube);
                s.transform.SetParent(shards, true);
                s.transform.position = b.center + new Vector3(Random.Range(-b.extents.x, b.extents.x), Random.Range(-b.extents.y, b.extents.y) * 0.8f, 0f);
                s.transform.localScale = new Vector3(Random.Range(0.25f, 0.5f), Random.Range(0.3f, 0.7f), 0.18f);
                s.GetComponent<Renderer>().sharedMaterial = look.sharedMaterial;
                var rb = s.AddComponent<Rigidbody>();
                rb.mass = 0.4f;
                rb.AddForce((heading * Random.Range(4f, 7f) + Vector3.up * Random.Range(1f, 3f)), ForceMode.VelocityChange);
                rb.AddTorque(Random.insideUnitSphere * 8f, ForceMode.VelocityChange);
            }
            look.enabled = false;
            yield return new WaitForSeconds(2.2f);
            foreach (Transform s in shards) { var col = s.GetComponent<Collider>(); if (col) col.enabled = false; }
            yield return GSG.Ease.Tween(0.4f, k => { foreach (Transform s in shards) s.localScale *= 0.9f; }, GSG.Ease.OutCubic, false);
            Destroy(shards.gameObject);
        }

        IEnumerator Wobble()
        {
            var baseScale = transform.localScale;
            yield return GSG.Ease.Tween(0.35f, k => transform.localScale = baseScale + new Vector3(0f, 0f, 0.12f) * Mathf.Sin(k * Mathf.PI * 3f) * (1f - k), x => x, false);
            transform.localScale = baseScale;
        }
    }
}
