using UnityEngine;

namespace GSG.Parcours
{
    /// <summary>
    /// The runner of the Unity parcours: a rigid-body capsule with the movement values of the
    /// online parcours (shared/matches/parcours.ts PC): run, buffered jump with coyote time,
    /// dive (once per jump, then a moment on the belly), duck under high bars, hold on to edges
    /// and pull up, get knocked by bars and pushers. Unlike the web version the world reacts
    /// physically: seesaws tilt under the runner's weight, doors burst into tumbling shards.
    /// </summary>
    [RequireComponent(typeof(Rigidbody), typeof(CapsuleCollider))]
    public class ParcoursRunner : MonoBehaviour
    {
        [Header("Bewegung (wie PC in parcours.ts)")]
        public float run = 6.4f, duckSpeed = 2.8f, groundControl = 16f, airControl = 4f, diveControl = 0.7f;
        public float gravity = 26f, jumpSpeed = 9f, coyote = 0.12f, buffer = 0.16f;
        public float dive = 9.6f, diveUp = 4.2f, airDiveUp = 2.6f, proneTime = 0.45f;
        public float hangMin = 0.9f, hangMax = 2.15f, hangDrop = 1.55f, hangMaxTime = 4f, climbTime = 0.62f;
        public float radius = 0.35f, height = 1.6f, duckHeight = 0.9f, hitGuard = 0.8f;

        public enum Pose { Run, Air, Dive, Prone, Hang, Climb, Stun, Done, Frozen }
        public Pose pose = Pose.Frozen;
        public ParcoursGame game;
        public Figure figure;
        public CameraRig rig;

        Rigidbody body;
        CapsuleCollider capsule;
        Transform model;
        float jumpAt = -9f, diveAt = -9f, lastGround = -9f, until, guardUntil, face, faceVisual, landedAt;
        bool airDive, duck, grounded, grab;
        Vector3 move, drift, lastGust, groundVelocity, groundPoint;
        Rigidbody groundBody;
        // Hanging and climbing.
        Collider hangCollider;
        Vector3 hangNormal, hangPoint, climbFrom;
        float hangTop, hangSince;
        int mask;

        public bool IsDiving => pose == Pose.Dive;
        public Vector3 Heading => Quaternion.Euler(0f, face, 0f) * Vector3.forward;
        public Vector3 Velocity => body ? body.linearVelocity : Vector3.zero;

        void Awake()
        {
            body = GetComponent<Rigidbody>();
            capsule = GetComponent<CapsuleCollider>();
            body.useGravity = false;
            body.interpolation = RigidbodyInterpolation.Interpolate;
            body.collisionDetectionMode = CollisionDetectionMode.ContinuousSpeculative;
            body.constraints = RigidbodyConstraints.FreezeRotation;
            body.mass = 60f;
            capsule.radius = radius;
            SetHeight(height);
            capsule.sharedMaterial = new PhysicsMaterial("Glatt") { dynamicFriction = 0f, staticFriction = 0f, frictionCombine = PhysicsMaterialCombine.Minimum, bounciness = 0f };
            gameObject.layer = 2; // Ignore Raycast: own probes never hit the runner
            mask = ~(1 << 2);
        }

        public void Attach(Figure f)
        {
            figure = f;
            model = f.transform;
        }

        void SetHeight(float h)
        {
            capsule.height = h;
            capsule.center = new Vector3(0f, h / 2f, 0f);
        }

        // ---- input (frame rate) -------------------------------------------------------------

        void Update()
        {
            var hud = Hud.Instance;
            if (hud && pose != Pose.Frozen && pose != Pose.Done)
            {
                if (hud.Pressed("a")) jumpAt = Time.time;
                if (hud.Pressed("b")) diveAt = Time.time;
                duck = hud.Held("duck");
                grab = hud.Held("grab");
                move = rig ? rig.Relative(hud.Stick) : new Vector3(hud.Stick.x, 0f, hud.Stick.y);
                if (rig) rig.Swipe(hud.Look);
            }
            else { move = Vector3.zero; duck = grab = false; }
            Animate(Time.deltaTime);
        }

        // ---- simulation (fixed step) ---------------------------------------------------------

        void FixedUpdate()
        {
            float t = Time.time, dt = Time.fixedDeltaTime;
            var v = body.linearVelocity;
            var gust = drift; drift = Vector3.zero;
            if (pose == Pose.Frozen || pose == Pose.Done || pose == Pose.Climb || pose == Pose.Hang) lastGust = Vector3.zero;

            switch (pose)
            {
                case Pose.Frozen:
                case Pose.Done:
                    Probe(v);
                    var stop = Vector3.Lerp(new Vector3(v.x, 0f, v.z), new Vector3(groundVelocity.x, 0f, groundVelocity.z), 1f - Mathf.Exp(-8f * dt));
                    body.linearVelocity = new Vector3(stop.x, grounded ? groundVelocity.y : v.y - gravity * dt, stop.z);
                    return;
                case Pose.Climb:
                    Climb(t);
                    return;
                case Pose.Hang:
                    Hang(t);
                    return;
            }

            bool wasGrounded = grounded;
            Probe(v);
            if (grounded) lastGround = t;
            if ((pose == Pose.Prone || pose == Pose.Stun) && t >= until) pose = grounded ? Pose.Run : Pose.Air;

            // Landing.
            if (grounded && !wasGrounded && v.y <= groundVelocity.y + 0.5f)
            {
                if (pose == Pose.Dive) { pose = Pose.Prone; until = t + proneTime; figure?.Loop("slide", 0.08f); }
                else if (pose == Pose.Air) pose = Pose.Run;
                airDive = false;
                if (t - landedAt > 0.2f) { Sfx.Play("land", 0.7f); Fx.Dust(transform.position, Palette.Paper, 5); figure?.Squash(); figure?.EndShot(); }
                landedAt = t;
            }
            if (!grounded && pose == Pose.Run && t - lastGround > coyote) pose = Pose.Air;

            // Ducking only on the ground while running; stand up only with room above.
            bool wantDuck = duck && grounded && pose == Pose.Run;
            if (wantDuck && capsule.height > duckHeight) SetHeight(duckHeight);
            else if (!wantDuck && capsule.height < height && HasHeadroom()) SetHeight(height);
            bool ducking = capsule.height < height - 0.01f;

            // Wind is a drift on top of the runner's own motion, never accumulated into it.
            var horizontal = new Vector3(v.x, 0f, v.z) - lastGust;
            var carried = new Vector3(groundVelocity.x, 0f, groundVelocity.z);
            var rel = horizontal - (grounded ? carried : Vector3.zero);
            float mag = Mathf.Min(1f, move.magnitude);
            if (pose == Pose.Run || pose == Pose.Air)
            {
                float speed = ducking ? duckSpeed : run;
                float k = 1f - Mathf.Exp(-(grounded ? groundControl : airControl) * dt);
                rel += (move * speed - rel) * k;
                if (mag > 0.2f) face = Mathf.Atan2(move.x, move.z) * Mathf.Rad2Deg;

                // Buffered jump, with a little grace after leaving an edge.
                if (t - jumpAt <= buffer && pose == Pose.Run && (grounded || t - lastGround <= coyote) && !ducking)
                {
                    v.y = jumpSpeed + Mathf.Max(0f, groundVelocity.y);
                    grounded = false; groundBody = null; pose = Pose.Air; jumpAt = -9f; lastGround = -9f;
                    Sfx.Play("jump", 0.8f);
                    figure?.Shot("jumpStart", 0.35f, 0.06f, 1.6f, 0.1f);
                }
                // Dive: a flat lunge forward, once per jump.
                if (t - diveAt <= buffer && !airDive)
                {
                    bool fromGround = grounded;
                    var dir = Heading;
                    rel = dir * dive;
                    v.y = fromGround ? diveUp : Mathf.Max(v.y, airDiveUp);
                    pose = Pose.Dive; airDive = true; diveAt = -9f; grounded = false; groundBody = null;
                    if (ducking) SetHeight(height);
                    Sfx.Play("dive");
                    figure?.Shot("dash", 0.5f, 0.05f, 1.2f);
                    Fx.Dust(transform.position, Palette.Paper, 4);
                }
            }
            else if (pose == Pose.Dive)
            {
                float k = 1f - Mathf.Exp(-diveControl * dt);
                rel += (move * dive - rel) * k * 0.3f;
            }
            else if (grounded)
            {
                rel *= Mathf.Exp(-6f * dt);
            }

            // Edges: grab while airborne (button or stick into the wall), or from the ground with the button.
            if ((pose == Pose.Air || pose == Pose.Dive) && v.y < 3f && (grab || mag > 0.3f) && TryHang(t)) return;
            if (pose == Pose.Run && grounded && grab && mag > 0.3f && TryHang(t)) return;

            lastGust = gust * (grounded ? 1f : 1.3f);
            var result = rel + (grounded ? carried : Vector3.zero) + lastGust;
            if (grounded && pose != Pose.Air && pose != Pose.Dive && v.y <= groundVelocity.y + 0.5f)
            {
                // Stick to the ground (and follow it up and down).
                float gap = transform.position.y - groundPoint.y;
                v.y = groundVelocity.y - Mathf.Clamp(gap / dt, 0f, 4f);
            }
            else v.y -= gravity * dt;

            // Weight on loose ground (seesaws): press down where the runner stands.
            if (grounded && groundBody && !groundBody.isKinematic)
                groundBody.AddForceAtPosition(Vector3.down * body.mass * gravity * 0.55f, groundPoint, ForceMode.Force);

            body.linearVelocity = new Vector3(result.x, v.y, result.z);

            if (game) game.CheckFall(this);
        }

        void Probe(Vector3 v)
        {
            grounded = false; groundBody = null; groundVelocity = Vector3.zero;
            var origin = transform.position + Vector3.up * (radius + 0.1f);
            if (v.y > 3f + 0.01f) return;
            if (Physics.SphereCast(origin, radius * 0.92f, Vector3.down, out var hit, 0.34f, mask, QueryTriggerInteraction.Ignore) && hit.normal.y > 0.55f)
            {
                float distance = origin.y - radius * 0.92f - hit.point.y;
                if (distance > 0.22f && pose == Pose.Air) return;
                grounded = true;
                groundPoint = hit.point;
                groundBody = hit.rigidbody;
                var platform = hit.collider.GetComponentInParent<IPlatform>();
                if (platform != null) groundVelocity = platform.VelocityAt(hit.point);
                else if (groundBody) groundVelocity = groundBody.GetPointVelocity(hit.point);
            }
        }

        bool HasHeadroom()
        {
            var bottom = transform.position + Vector3.up * (radius + 0.05f);
            var top = transform.position + Vector3.up * (height - radius);
            return !Physics.CheckCapsule(bottom + Vector3.up * 0.3f, top, radius * 0.9f, mask, QueryTriggerInteraction.Ignore);
        }

        bool TryHang(float t)
        {
            var dir = move.sqrMagnitude > 0.09f ? move.normalized : Heading;
            var chest = transform.position + Vector3.up * 1.1f;
            if (!Physics.SphereCast(chest - dir * 0.1f, 0.18f, dir, out var wall, radius + 0.45f, mask, QueryTriggerInteraction.Ignore)) return false;
            if (Mathf.Abs(wall.normal.y) > 0.3f) return false;
            var n = new Vector3(wall.normal.x, 0f, wall.normal.z).normalized;
            var probe = wall.point - n * 0.15f + Vector3.up * (hangMax + 0.5f);
            if (!Physics.Raycast(probe, Vector3.down, out var top, hangMax + 1.2f, mask, QueryTriggerInteraction.Ignore)) return false;
            if (top.collider != wall.collider && top.normal.y < 0.7f) return false;
            float above = top.point.y - transform.position.y;
            if (above < hangMin || above > hangMax) return false;
            // Room on top for the runner.
            var standAt = top.point - n * (radius + 0.15f);
            if (Physics.CheckCapsule(standAt + Vector3.up * (radius + 0.08f), standAt + Vector3.up * (height - radius), radius * 0.85f, mask, QueryTriggerInteraction.Ignore)) return false;
            hangCollider = top.collider; hangNormal = n; hangTop = top.point.y; hangSince = t;
            hangPoint = new Vector3(wall.point.x, 0f, wall.point.z) + n * (radius + 0.02f);
            pose = Pose.Hang;
            body.isKinematic = true;
            transform.position = new Vector3(hangPoint.x, hangTop - hangDrop, hangPoint.z);
            face = Mathf.Atan2(-n.x, -n.z) * Mathf.Rad2Deg;
            airDive = false;
            Sfx.Play("thud", 0.4f);
            figure?.Loop("hang", 0.08f);
            return true;
        }

        void Hang(float t)
        {
            bool into = Vector3.Dot(move, -hangNormal) > 0.3f;
            bool gone = !hangCollider || !hangCollider.enabled;
            if (gone || (!grab && !into) || t - hangSince > hangMaxTime) { LetGo(hangNormal * 1.2f); return; }
            if (t - jumpAt <= buffer || into)
            {
                pose = Pose.Climb; hangSince = t; jumpAt = -9f;
                climbFrom = transform.position;
                Sfx.Play("whoosh", 0.5f);
                figure?.Shot("climb", climbTime + 0.1f, 0.06f, 1.9f);
            }
        }

        void Climb(float t)
        {
            if (!hangCollider || !hangCollider.enabled) { LetGo(hangNormal * 1.2f); return; }
            float k = (t - hangSince) / climbTime;
            var edge = hangPoint - hangNormal * (radius + 0.02f);
            var onTop = edge - hangNormal * (radius + 0.12f);
            Vector3 p;
            if (k < 0.7f) p = Vector3.Lerp(climbFrom, new Vector3(hangPoint.x, hangTop, hangPoint.z), GSG.Ease.InOutSine(k / 0.7f));
            else p = Vector3.Lerp(new Vector3(hangPoint.x, hangTop, hangPoint.z), new Vector3(onTop.x, hangTop, onTop.z), (k - 0.7f) / 0.3f);
            body.MovePosition(p);
            if (k >= 1f)
            {
                body.isKinematic = false;
                transform.position = new Vector3(onTop.x, hangTop + 0.02f, onTop.z);
                body.linearVelocity = Vector3.zero;
                pose = Pose.Run; grounded = true; lastGround = t;
                figure?.EndShot();
            }
        }

        void LetGo(Vector3 push)
        {
            body.isKinematic = false;
            body.linearVelocity = push;
            pose = Pose.Air;
            figure?.Loop("air", 0.1f);
        }

        // ---- external pushes -----------------------------------------------------------------

        public void AddDrift(Vector3 v) { drift += v; }

        /// <summary>Knocked by a bar or pusher: flung, briefly without control.</summary>
        public void Knock(Vector3 velocity, float stun, bool big = false)
        {
            if (pose == Pose.Done || pose == Pose.Frozen || Time.time < guardUntil) return;
            guardUntil = Time.time + hitGuard;
            if (pose == Pose.Hang || pose == Pose.Climb) body.isKinematic = false;
            if (capsule.height < height) SetHeight(height);
            body.linearVelocity = velocity;
            pose = Pose.Stun; until = Time.time + stun; grounded = false; airDive = false;
            Sfx.Play("hit");
            figure?.Shot("hit", stun, 0.04f, 1.2f);
            Fx.Sparks(transform.position + Vector3.up, Palette.Accent, big ? 14 : 8);
            Fx.Shake(big ? 0.7f : 0.35f);
            if (big) Fx.HitStop(0.07f);
        }

        /// <summary>A soft bounce back (a door that stays shut).</summary>
        public void Bounce(Vector3 velocity)
        {
            if (pose == Pose.Hang || pose == Pose.Climb) return;
            body.linearVelocity = velocity + Vector3.up * 2f;
            pose = Pose.Stun; until = Time.time + 0.3f;
        }

        public void Respawn(Vector3 at, float yaw)
        {
            body.isKinematic = false;
            SetHeight(height);
            transform.position = at;
            body.position = at;
            body.linearVelocity = Vector3.zero;
            face = faceVisual = yaw;
            pose = Pose.Run; airDive = false; jumpAt = diveAt = -9f; guardUntil = Time.time + 0.6f; lastGust = Vector3.zero;
            if (model) model.rotation = Quaternion.Euler(0f, yaw, 0f);
            figure?.EndShot(); figure?.Loop("idle", 0f);
        }

        public void Freeze() { pose = Pose.Frozen; }
        public void Release() { if (pose == Pose.Frozen) pose = Pose.Run; }
        public void Celebrate() { pose = Pose.Done; figure?.Loop("cheer", 0.15f); }

        // ---- animation -------------------------------------------------------------------------

        void Animate(float dt)
        {
            if (!figure) return;
            faceVisual = Mathf.LerpAngle(faceVisual, face, 1f - Mathf.Exp(-14f * dt));
            if (model) model.rotation = Quaternion.Euler(0f, faceVisual, 0f);
            var v = body.linearVelocity;
            var rel = new Vector3(v.x - groundVelocity.x, 0f, v.z - groundVelocity.z);
            float speed = rel.magnitude;
            switch (pose)
            {
                case Pose.Run:
                    if (capsule.height < height - 0.01f) figure.Loop(speed > 0.5f ? "crouchWalk" : "crouch", 0.12f);
                    else if (speed < 0.4f) figure.Loop("idle", 0.2f);
                    else if (speed < 4.6f) figure.Loop("jog", 0.15f, Mathf.Clamp(speed / 3.6f, 0.7f, 1.3f));
                    else figure.Loop("sprint", 0.15f, Mathf.Clamp(speed / 6.4f, 0.8f, 1.25f));
                    break;
                case Pose.Air: figure.Loop("air", 0.15f); break;
                case Pose.Dive: figure.Loop("slide", 0.15f); break;
                case Pose.Prone: figure.Loop("slide", 0.1f); break;
                case Pose.Hang: figure.Loop("hang", 0.08f); break;
                case Pose.Stun: figure.Loop("air", 0.2f); break;
                case Pose.Done: figure.Loop("cheer", 0.2f); break;
                case Pose.Frozen: figure.Loop("idle", 0.2f); break;
            }
            figure.Tick(rel, dt);
        }
    }
}
