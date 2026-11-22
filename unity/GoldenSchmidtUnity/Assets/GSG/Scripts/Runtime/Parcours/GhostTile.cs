using System.Collections;
using UnityEngine;

namespace GSG.Parcours
{
    /// <summary>
    /// Secret floor (ghost path tiles, lane floors): looks like any tile; a carrying one turns
    /// green when stepped on, the others crack and fall away under the runner.
    /// </summary>
    public class GhostTile : MonoBehaviour
    {
        public bool carries;
        public bool lookLikeFloor;
        bool known;
        Renderer look;

        void Awake() { look = GetComponent<Renderer>(); }

        void OnCollisionEnter(Collision c)
        {
            if (known || !c.rigidbody || !c.rigidbody.GetComponent<ParcoursRunner>()) return;
            if (c.rigidbody.position.y < GetComponent<Collider>().bounds.max.y - 0.15f) return; // only from above
            known = true;
            if (carries)
            {
                look.material.SetColor("_BaseColor", Palette.TileSafe);
                Sfx.Play("blip");
                Fx.Glow(transform.position + Vector3.up * 0.3f, Palette.TileSafe, 6);
            }
            else StartCoroutine(Fall());
        }

        IEnumerator Fall()
        {
            look.material.SetColor("_BaseColor", Palette.Warn);
            Sfx.Play("crack");
            Hud.Instance?.Toast(lookLikeFloor ? "Falltür!" : "Geisterplatte!", Palette.Warn, 0.8f);
            yield return new WaitForSeconds(0.12f);
            GetComponent<Collider>().enabled = false;
            Fx.Shards(transform.position, Palette.Tile, 10);
            var start = transform.position;
            var spin = Random.Range(-90f, 90f);
            yield return GSG.Ease.Tween(0.9f, k =>
            {
                transform.position = start + Vector3.down * (k * k * 6f);
                transform.rotation = Quaternion.Euler(spin * k, 0f, spin * 0.6f * k);
            }, x => x, false);
            look.enabled = false;
        }
    }
}
