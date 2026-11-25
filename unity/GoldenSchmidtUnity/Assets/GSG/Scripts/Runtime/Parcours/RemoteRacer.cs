using UnityEngine;

namespace GSG.Parcours
{
    /// <summary>
    /// Online: a racer of the room's parcours (shared/matches/parcours.ts) drawn from its snapshots.
    /// No physics of its own: position, facing, pose and duck come from the room; between two
    /// snapshots it is interpolated, after a respawn it jumps. The pose picks the same animations
    /// as <see cref="ParcoursRunner"/>.
    /// </summary>
    public class RemoteRacer : MonoBehaviour
    {
        public Figure figure;
        public Seat seat;
        public string Pose { get; private set; } = "run";
        public bool Ducking { get; private set; }
        public bool Grounded { get; private set; } = true;
        public Vector3 Heading => Quaternion.Euler(0f, face, 0f) * Vector3.forward;

        Vector3 prev, cur, velocity;
        float face, faceVisual;
        bool shown = true, placed;

        /// <summary>A new snapshot of this racer (field metres: x sideways, y up, z forward; face in radians).</summary>
        public void Set(Vector3 at, Vector3 v, float faceRadians, string pose, bool duck, bool grounded)
        {
            // A respawn (or the first snapshot) jumps instead of sliding across the course.
            bool jump = !placed || (at - cur).sqrMagnitude > 9f;
            prev = jump ? at : cur;
            cur = at;
            velocity = v;
            face = faceRadians * Mathf.Rad2Deg;
            if (jump) { transform.position = at; faceVisual = face; }
            placed = true;
            if (Pose != pose && pose == "done") figure?.Loop("cheer", 0.15f);
            Pose = pose; Ducking = duck; Grounded = grounded;
            bool visible = pose != "out";
            if (visible != shown) { shown = visible; figure?.SetVisible(visible); }
        }

        /// <summary>One frame between the last two snapshots (alpha 0 = previous, 1 = newest).</summary>
        public void Draw(float alpha, float dt)
        {
            if (!placed) return;
            transform.position = Vector3.Lerp(prev, cur, alpha);
            if (!figure) return;
            faceVisual = Mathf.LerpAngle(faceVisual, face, 1f - Mathf.Exp(-14f * dt));
            figure.transform.rotation = Quaternion.Euler(0f, faceVisual, 0f);
            var rel = new Vector3(velocity.x, 0f, velocity.z);
            float speed = rel.magnitude;
            switch (Pose)
            {
                case "run":
                    if (Ducking) figure.Loop(speed > 0.5f ? "crouchWalk" : "crouch", 0.12f);
                    else if (speed < 0.4f) figure.Loop("idle", 0.2f);
                    else if (speed < 4.6f) figure.Loop("jog", 0.15f, Mathf.Clamp(speed / 3.6f, 0.7f, 1.3f));
                    else figure.Loop("sprint", 0.15f, Mathf.Clamp(speed / 6.4f, 0.8f, 1.25f));
                    break;
                case "air": case "stun": figure.Loop("air", 0.15f); break;
                case "dive": case "prone": figure.Loop("slide", 0.12f); break;
                case "hang": case "climb": figure.Loop("hang", 0.08f); break;
                case "done": figure.Loop("cheer", 0.2f); break;
            }
            figure.Tick(rel, dt);
        }
    }
}
