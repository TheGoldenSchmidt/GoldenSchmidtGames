using UnityEngine;

namespace GSG
{
    /// <summary>
    /// An approved base human (docs/approved-character-design.md): Jonas, Amara, Malik, Lena,
    /// Erik or Zoe built from body_m/f.glb, a hairstyle and the shared clips of anims.glb, with
    /// the underwear in the player colour. Prefabs are made by the editor setup; this component
    /// plays the clips (looping states and one-shot actions) and adds squash, lean and blink-free
    /// procedural life on top.
    /// </summary>
    public class Figure : MonoBehaviour
    {
        public static readonly string[] BaseIds = { "rig_jonas", "rig_amara", "rig_malik", "rig_lena", "rig_erik", "rig_zoe" };

        public Animator animator;
        public Transform visual;
        Renderer[] bodies;
        string loop = "", shot = "";
        float shotUntil, squashT = 1f, leanX, leanZ;
        Vector3 lastVelocity;

        /// <summary>Spawns a figure; an unknown or non-human choice falls back to a base human by colour slot (as in the app).</summary>
        public static Figure Spawn(string characterId, int slot, Transform parent)
        {
            string id = System.Array.IndexOf(BaseIds, characterId) >= 0 ? characterId : BaseIds[((slot % BaseIds.Length) + BaseIds.Length) % BaseIds.Length];
            var prefab = Resources.Load<GameObject>("GSG/Figures/" + id);
            GameObject go;
            if (prefab) go = Instantiate(prefab, parent, false);
            else
            {
                // Without the imported kit (should not happen in a build) a plain capsule keeps the game playable.
                go = GameObject.CreatePrimitive(PrimitiveType.Capsule);
                Destroy(go.GetComponent<Collider>());
                go.transform.SetParent(parent, false);
                go.transform.localPosition = Vector3.up * 0.8f; go.transform.localScale = new Vector3(0.6f, 0.8f, 0.6f);
            }
            go.name = "Figur " + id;
            var f = go.GetComponent<Figure>() ?? go.AddComponent<Figure>();
            f.Init(Palette.Player(slot));
            return f;
        }

        void Init(Color player)
        {
            if (!animator) animator = GetComponentInChildren<Animator>();
            if (!visual) visual = transform;
            bodies = GetComponentsInChildren<Renderer>();
            foreach (var r in bodies)
            {
                foreach (var m in r.materials)
                    if (m.HasProperty("_OutfitOn") && m.GetFloat("_OutfitOn") > 0.5f) m.SetColor("_OutfitColor", player);
            }
            Loop("idle");
        }

        public void Loop(string state, float fade = 0.15f, float speed = 1f)
        {
            if (!animator) return;
            animator.speed = speed;
            if (Time.time < shotUntil) { loop = state; return; }
            if (loop == state && shot == "") return;
            loop = state; shot = "";
            animator.CrossFadeInFixedTime(state, fade);
        }

        /// <summary>A one-shot action (jump start, dash, hit, cheer); afterwards the current loop resumes.</summary>
        public void Shot(string state, float seconds, float fade = 0.08f, float speed = 1f, float offset = 0f)
        {
            if (!animator) return;
            animator.speed = speed;
            shot = state; shotUntil = Time.time + seconds;
            animator.CrossFadeInFixedTime(state, fade, 0, offset);
        }

        public void EndShot()
        {
            if (shot == "") return;
            shotUntil = 0f; var l = loop; loop = ""; shot = ""; Loop(l, 0.1f);
        }

        public void Squash() { squashT = 0f; }

        public void SetVisible(bool on) { foreach (var r in bodies) if (r) r.enabled = on; }

        /// <summary>Called by the runner every frame with its world velocity for lean and squash.</summary>
        public void Tick(Vector3 velocity, float dt)
        {
            if (shot != "" && Time.time >= shotUntil) { shot = ""; var l = loop; loop = ""; Loop(l, 0.12f); }
            var accel = (velocity - lastVelocity) / Mathf.Max(dt, 1e-4f);
            lastVelocity = velocity;
            var local = transform.InverseTransformDirection(new Vector3(accel.x, 0f, accel.z));
            leanX = Ease.Damp(leanX, Mathf.Clamp(local.z * 0.35f, -7f, 7f), 8f, dt);
            leanZ = Ease.Damp(leanZ, Mathf.Clamp(-local.x * 0.25f, -5f, 5f), 8f, dt);
            squashT = Mathf.Min(1f, squashT + dt / 0.14f);
            float s = Fx.Reduced ? 0f : (1f - Ease.OutCubic(squashT)) * 0.16f;
            if (visual && visual != transform)
            {
                visual.localRotation = Quaternion.Euler(Fx.Reduced ? 0f : leanX, 0f, Fx.Reduced ? 0f : leanZ);
                visual.localScale = new Vector3(1f + s * 0.6f, 1f - s, 1f + s * 0.6f);
            }
        }
    }
}
