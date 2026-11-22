using UnityEngine;

namespace GSG.Lava
{
    /// <summary>
    /// One temple slab: intact, cracking (glows hot and shakes for 0.8 s after the first step),
    /// falling into the lava, gone, or rising again (slabs with a rune come back after 2.5 s).
    /// </summary>
    public class LavaTile
    {
        public enum State { Intact, Cracking, Falling, Gone, Rising }

        public readonly int index, floor, col, row, ring;
        public readonly Transform transform;
        public readonly BoxCollider collider;
        public readonly Renderer renderer;
        public readonly Transform rune;
        public State state;
        public bool regen;
        public float timer;
        readonly Vector3 home, size;
        readonly Material normal;
        Material hot;
        float spin;

        public LavaTile(int index, int floor, int col, int row, int ring, GameObject go, Material normal, Transform rune)
        {
            this.index = index; this.floor = floor; this.col = col; this.row = row; this.ring = ring;
            transform = go.transform;
            collider = go.GetComponent<BoxCollider>();
            renderer = go.GetComponent<Renderer>();
            this.normal = normal;
            this.rune = rune;
            home = transform.position;
            size = transform.localScale;
        }

        public bool Solid => state == State.Intact || state == State.Cracking;

        public void Reset(bool withRune)
        {
            state = State.Intact; regen = withRune; timer = 0f;
            transform.SetPositionAndRotation(home, Quaternion.identity);
            transform.localScale = size;
            collider.enabled = true;
            SetVisible(true);
            renderer.sharedMaterial = normal;
            if (rune) rune.gameObject.SetActive(withRune);
        }

        public void Crack(float seconds)
        {
            if (state != State.Intact) return;
            state = State.Cracking; timer = seconds;
            if (hot == null) hot = new Material(normal);
            renderer.sharedMaterial = hot;
        }

        /// <summary>The slab falls (no way back unless it carries a rune and its ring still stands).</summary>
        public void Drop()
        {
            if (state == State.Falling || state == State.Gone) return;
            state = State.Falling; timer = 0.9f;
            collider.enabled = false;
            spin = Random.Range(-70f, 70f);
            if (rune) rune.gameObject.SetActive(false);
        }

        public void Rise(float seconds)
        {
            state = State.Rising; timer = seconds;
            renderer.enabled = true;
            renderer.sharedMaterial = normal;
            transform.SetPositionAndRotation(home + Vector3.down * 1.6f, Quaternion.identity);
            transform.localScale = size * 0.6f;
        }

        /// <summary>Animation and timers; returns true when a falling slab reached the lava this frame.</summary>
        public bool Tick(float dt, bool reduced)
        {
            switch (state)
            {
                case State.Cracking:
                {
                    timer -= dt;
                    float k = 1f - Mathf.Clamp01(timer / 0.8f);
                    hot.SetColor("_BaseColor", Color.Lerp(Palette.Stone, Palette.Hot, k * 0.85f));
                    hot.SetColor("_EmissionColor", Palette.Hot * (k * k * 1.6f));
                    float shake = reduced ? 0f : k * 0.05f;
                    transform.position = home + new Vector3(Random.Range(-shake, shake), 0f, Random.Range(-shake, shake));
                    break;
                }
                case State.Falling:
                {
                    timer -= dt;
                    float k = 1f - Mathf.Clamp01(timer / 0.9f);
                    transform.position = home + Vector3.down * (k * k * 9f);
                    transform.rotation = Quaternion.Euler(spin * k, 0f, spin * 0.7f * k);
                    if (timer <= 0f) { state = State.Gone; renderer.enabled = false; return true; }
                    break;
                }
                case State.Rising:
                {
                    timer -= dt;
                    float k = Ease.OutBack(1f - Mathf.Clamp01(timer / 0.6f));
                    transform.position = Vector3.LerpUnclamped(home + Vector3.down * 1.6f, home, k);
                    transform.localScale = size * Mathf.LerpUnclamped(0.6f, 1f, k);
                    break;
                }
            }
            return false;
        }

        public bool RiseDone => state == State.Rising && timer <= 0f;

        public void Settle()
        {
            state = State.Intact; collider.enabled = true;
            transform.SetPositionAndRotation(home, Quaternion.identity);
            transform.localScale = size;
            if (rune) rune.gameObject.SetActive(regen);
        }

        public void Warn(float k)
        {
            if (state != State.Intact) return;
            if (hot == null) hot = new Material(normal);
            renderer.sharedMaterial = k > 0f ? hot : normal;
            hot.SetColor("_BaseColor", Color.Lerp(Palette.Stone, Palette.Hot, k * 0.5f));
            hot.SetColor("_EmissionColor", Palette.Hot * (0.4f + 0.4f * Mathf.Sin(Time.time * 14f)) * k);
        }

        public Vector3 Center => home;

        /// <summary>Hides a slab (and its rune) on floors above the followed runner.</summary>
        public void SetVisible(bool on)
        {
            renderer.enabled = on;
            if (rune) rune.GetComponent<Renderer>().enabled = on;
        }
    }
}
