using UnityEngine;

namespace GSG.Parcours
{
    /// <summary>Respawn line at a station start; its flags light up when reached.</summary>
    public class Checkpoint : MonoBehaviour
    {
        public int index;
        public Renderer[] flags;
        bool lit;

        void OnTriggerEnter(Collider other)
        {
            var runner = other.attachedRigidbody ? other.attachedRigidbody.GetComponent<ParcoursRunner>() : null;
            if (runner && runner.game != null) runner.game.Reached(this, runner);
        }

        public void Light()
        {
            if (lit) return;
            lit = true;
            foreach (var f in flags)
            {
                if (!f) continue;
                f.material.SetColor("_BaseColor", Palette.Accent);
                f.material.SetColor("_EmissionColor", Palette.Accent * 0.4f);
                Fx.Sparks(f.bounds.center, Palette.Accent, 8);
            }
        }
    }
}
