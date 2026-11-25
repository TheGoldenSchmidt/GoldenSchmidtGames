using UnityEngine;

namespace GSG.Lava
{
    /// <summary>
    /// A runner on the temple floors: rigid-body capsule with the Floor is Lava moves
    /// (shared/matches/floorIsLava.ts FL, scaled from tiles to metres): inertia, jump over small
    /// gaps (every 3 s), a flat dive over two slabs (every 3.5 s, then a moment on the belly) and a
    /// shove that sends others sliding (every 2.5 s). Holes are real: a runner drops through to
    /// the floor below; under the bottom floor waits the lava.
    /// </summary>
    [RequireComponent(typeof(Rigidbody), typeof(CapsuleCollider))]
    public class LavaRunner : MonoBehaviour
    {
        public const float Tile = 1.5f;
        public float speed = 3.2f * Tile, airFactor = 1.4f, inertia = 0.35f, gravity = 26f;
        public float jumpTime = 0.55f, jumpCooldown = 3f;
        public float diveTime = 0.48f, diveSpeed = 6.6f * Tile, proneTime = 0.45f, diveCooldown = 3.5f;
        public float shoveTime = 0.22f, shoveSpeed = 6f * Tile, shoveCooldown = 2.5f, knock = 6.5f * Tile, slideTime = 0.35f, slide = 0.92f;
        public float radius = 0.4f, height = 1.6f;

        public string displayName;
        public int slot;
        public bool isPlayer;
        public Figure figure;
        public bool alive;
        public float outAt;
        public float points;
        public string pushedBy; public float pushedAt = -99f;

        // Intent for this step (player stick or bot decision) and button presses.
        public Vector2 stick;
        public bool wantJump, wantShove, wantDive;

        public float jumpReady, shoveReady, diveReady, invulnUntil;
        public float shoveUntil, slideUntil, diveUntil, proneUntil;
        public Vector3 facing = Vector3.forward;
        public bool grounded;
        public float lastLand;

        Rigidbody body;
        CapsuleCollider capsule;
        bool wasGrounded;
        float faceYaw;

        public Rigidbody Body => body;

        /// <summary>Online: placed from the room's snapshots, no physics body of its own.</summary>
        public bool remote;
        public Vector3 remoteVelocity;

        public void Remote()
        {
            remote = true;
            body.isKinematic = true;
            body.interpolation = RigidbodyInterpolation.None;
            body.detectCollisions = false;
            capsule.enabled = false;
        }

        void Awake()
        {
            body = GetComponent<Rigidbody>();
            capsule = GetComponent<CapsuleCollider>();
            body.useGravity = false;
            body.mass = 60f;
            body.interpolation = RigidbodyInterpolation.Interpolate;
            body.collisionDetectionMode = CollisionDetectionMode.ContinuousSpeculative;
            body.constraints = RigidbodyConstraints.FreezeRotation;
            capsule.radius = radius; capsule.height = height; capsule.center = new Vector3(0f, height / 2f, 0f);
            capsule.sharedMaterial = new PhysicsMaterial("Glatt") { dynamicFriction = 0f, staticFriction = 0f, frictionCombine = PhysicsMaterialCombine.Minimum, bounciness = 0f };
            gameObject.layer = 2;
        }

        public void Place(Vector3 at, Vector3 face, float time, float grace)
        {
            gameObject.SetActive(true);
            body.isKinematic = false;
            transform.position = at; body.position = at;
            body.linearVelocity = Vector3.zero;
            facing = face; faceYaw = Mathf.Atan2(face.x, face.z) * Mathf.Rad2Deg;
            if (figure) figure.transform.rotation = Quaternion.Euler(0f, faceYaw, 0f);
            alive = true; outAt = 0f; pushedBy = null; pushedAt = -99f;
            jumpReady = shoveReady = diveReady = time;
            invulnUntil = time + grace;
            shoveUntil = slideUntil = diveUntil = proneUntil = 0f;
            stick = Vector2.zero; wantJump = wantShove = wantDive = false;
            figure?.SetVisible(true);
            figure?.EndShot();
            figure?.Loop("idle", 0f);
        }

        public bool Airborne => !grounded;
        public bool Prone(float t) => t < proneUntil && t >= diveUntil;

        /// <summary>One fixed step. Returns the event name if something worth answering happened.</summary>
        public string Step(float t, float dt, Rect bounds)
        {
            if (!alive) return null;
            string evt = null;
            var v = body.linearVelocity;
            wasGrounded = grounded;
            grounded = Physics.SphereCast(transform.position + Vector3.up * (radius + 0.05f), radius * 0.9f, Vector3.down, out _, 0.18f, ~(1 << 2), QueryTriggerInteraction.Ignore) && v.y <= 0.5f;
            if (grounded && !wasGrounded) { lastLand = t; evt = "land"; }

            var input = new Vector3(stick.x, 0f, stick.y);
            float mag = Mathf.Min(1f, input.magnitude);
            if (mag > 0.2f && t >= proneUntil) facing = input / Mathf.Max(mag, 1e-3f);

            // Presses: dive, shove and jump only from the ground, each with its cooldown.
            bool busy = t < slideUntil || t < proneUntil;
            if (wantDive && grounded && t >= diveReady && !busy)
            {
                diveUntil = t + diveTime; proneUntil = t + diveTime + proneTime; diveReady = t + diveCooldown; shoveUntil = 0f;
                v.y = gravity * diveTime * 0.5f * 0.55f;
                evt = "dive";
            }
            else if (wantShove && grounded && t >= shoveReady && !busy)
            {
                shoveUntil = t + shoveTime; shoveReady = t + shoveCooldown;
                evt = "shove";
            }
            else if (wantJump && grounded && t >= jumpReady && t >= proneUntil)
            {
                v.y = gravity * jumpTime * 0.5f; jumpReady = t + jumpCooldown;
                grounded = false;
                evt = "jump";
            }
            wantJump = wantShove = wantDive = false;

            var h = new Vector3(v.x, 0f, v.z);
            float steps = dt * 20f; // the web rules use 20 Hz steps
            if (t < diveUntil) h = facing * diveSpeed;
            else if (t < proneUntil) h *= Mathf.Pow(0.5f, steps);
            else if (t < slideUntil) h *= Mathf.Pow(slide, steps);
            else if (t < shoveUntil) h = facing * shoveSpeed;
            else
            {
                float k = 1f - Mathf.Pow(1f - inertia, steps);
                h += (input * speed * (grounded ? 1f : airFactor) - h) * k;
            }
            if (grounded && v.y <= 0f) v.y = 0f; else v.y -= gravity * dt;
            body.linearVelocity = new Vector3(h.x, v.y, h.z);

            // Start protection: the edge holds for a moment.
            if (t < invulnUntil)
            {
                var p = body.position;
                p.x = Mathf.Clamp(p.x, bounds.xMin + radius, bounds.xMax - radius);
                p.z = Mathf.Clamp(p.z, bounds.yMin + radius, bounds.yMax - radius);
                body.position = p;
            }
            return evt;
        }

        public void Knock(Vector3 dir, string by, float t)
        {
            body.linearVelocity = new Vector3(dir.x * knock, body.linearVelocity.y, dir.z * knock);
            slideUntil = t + slideTime; pushedBy = by; pushedAt = t;
            figure?.Shot("hit", 0.4f, 0.04f, 1.3f);
        }

        public void Out(float t)
        {
            alive = false; outAt = t;
            body.linearVelocity = Vector3.zero;
            body.isKinematic = true;
            figure?.SetVisible(false);
        }

        void Update()
        {
            if (!figure || !alive) return;
            float t = Time.time;
            faceYaw = Mathf.LerpAngle(faceYaw, Mathf.Atan2(facing.x, facing.z) * Mathf.Rad2Deg, 1f - Mathf.Exp(-14f * Time.deltaTime));
            figure.transform.rotation = Quaternion.Euler(0f, faceYaw, 0f);
            var v = remote ? remoteVelocity : body.linearVelocity; var h = new Vector3(v.x, 0f, v.z);
            if (t < diveUntil) figure.Loop("slide", 0.08f);
            else if (t < proneUntil) figure.Loop("slide", 0.1f);
            else if (t < shoveUntil) figure.Loop("push", 0.05f, 1.6f);
            else if (!grounded) figure.Loop("air", 0.12f);
            else if (h.magnitude < 0.4f) figure.Loop("idle", 0.2f);
            else figure.Loop(h.magnitude < 3.6f ? "jog" : "sprint", 0.15f, Mathf.Clamp(h.magnitude / 4f, 0.8f, 1.3f));
            figure.Tick(h, Time.deltaTime);
        }
    }
}
