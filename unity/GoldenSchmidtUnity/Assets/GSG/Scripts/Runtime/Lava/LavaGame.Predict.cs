using UnityEngine;

namespace GSG.Lava
{
    /// <summary>
    /// Online drawing (both "Unity" and "Unity · Host rechnet"): the own runner moves at once with the
    /// own stick and presses, using the movement values of floorIsLava.ts (the host's LavaRunner uses
    /// the same ones), and is pulled softly towards where the room has it, a little ahead by its speed
    /// because every snapshot is older than the input. How much older is measured: from the moment the
    /// stick starts a run until the room's runner moves that way. Pushes and falls through a hole come
    /// from the room alone. Other runners stay interpolated between the two newest snapshots.
    /// </summary>
    public partial class LavaGame
    {
        // floorIsLava.ts FL in tiles and seconds.
        const float PSpeed = 3.2f, PAir = 1.4f, PInertia = 0.35f, PDiveSpeed = 6.6f, PShoveSpeed = 6f;
        const float PJump = 0.55f, PDive = 0.48f, PProne = 0.45f, PShove = 0.22f, PJumpCooldown = 3f, PShoveCooldown = 2.5f, PDiveCooldown = 3.5f;

        Vector2 ownPos, ownVel, ownStick, prevStick, ownFacing = Vector2.up, moveDir;
        bool ownReady;
        float jumpAt = -99f, diveAt = -99f, shoveAt = -99f, moveStartAt = -1f, lag = 0.15f;
        int jumpFloor;

        /// <summary>A new round, a respawn or the first snapshot: the prediction starts again from the room's position.</summary>
        void ResetPrediction() { ownReady = false; jumpAt = diveAt = shoveAt = -99f; moveStartAt = -1f; }

        /// <summary>Own stick and presses of this frame; starts jumps, dives and shoves at once when the room would allow them.</summary>
        void PredictInput(Vector2 stick, bool jump, bool shove, bool dive, SnapRunner mine, float now)
        {
            ownStick = Vector2.ClampMagnitude(stick, 1f);
            float t = Time.time;
            if (ownStick.magnitude > 0.5f && prevStick.magnitude < 0.2f) { moveStartAt = t; moveDir = ownStick.normalized; }
            prevStick = ownStick;
            if (mine == null || player == null) return;
            bool air = t - jumpAt < PJump || t - diveAt < PDive || now < mine.airUntil || now < mine.dropUntil;
            bool busy = now < mine.slideUntil || now < mine.proneUntil || t - diveAt < PDive + PProne;
            if (dive && !air && !busy && now >= mine.diveReady && t - diveAt > PDiveCooldown)
            {
                if (ownStick.magnitude > 0.2f) ownFacing = ownStick.normalized;
                diveAt = t; shoveAt = -99f;
                Answer(player, "dive");
            }
            else if (shove && !air && !busy && now >= mine.shoveReady && t - shoveAt > PShoveCooldown)
            {
                shoveAt = t;
                Answer(player, "shove");
            }
            else if (jump && !air && now >= mine.proneUntil && t - diveAt > PDive + PProne && now >= mine.jumpReady && t - jumpAt > PJumpCooldown)
            {
                jumpAt = t; jumpFloor = mine.floor;
                Answer(player, "jump");
            }
        }

        /// <summary>True while a press of this device just started the same action (the room's event then plays nothing twice).</summary>
        bool OwnActionShown(string kind)
        {
            float t = Time.time;
            return kind switch { "jump" => t - jumpAt < 1f, "dive" => t - diveAt < 1f, "dash" => t - shoveAt < 1f, _ => false };
        }

        /// <summary>The own runner's field position this frame.</summary>
        Vector2 PredictOwn(SnapRunner s, Vector2 room, float now, float dt)
        {
            float t = Time.time;
            var roomVel = new Vector2(s.vx, s.vy);
            if (!ownReady) { ownPos = room; ownVel = roomVel; ownFacing = new Vector2(s.fx, s.fy).normalized; ownReady = true; }
            bool pushed = now < s.slideUntil, falling = now < s.dropUntil;
            float sinceDive = t - diveAt, sinceShove = t - shoveAt;
            if (pushed || falling)
            {
                // Only the room knows who pushed or where the floor gave way.
                ownPos = Vector2.Lerp(ownPos, room + roomVel * lag, 1f - Mathf.Exp(-14f * dt));
                ownVel = roomVel;
            }
            else
            {
                if (sinceDive < PDive) ownVel = ownFacing * PDiveSpeed;
                else if (sinceDive < PDive + PProne) ownVel *= Mathf.Pow(0.5f, dt * 20f);
                else if (sinceShove < PShove) ownVel = ownFacing * PShoveSpeed;
                else
                {
                    bool air = t - jumpAt < PJump || now < s.airUntil;
                    float k = 1f - Mathf.Pow(1f - PInertia, dt * 20f);
                    ownVel += (ownStick * PSpeed * (air ? PAir : 1f) - ownVel) * k;
                }
                ownPos += ownVel * dt;
                var target = room + roomVel * lag;
                var error = target - ownPos;
                bool action = sinceDive < PDive + PProne || sinceShove < PShove;
                if (error.magnitude > 1.5f) ownPos = Vector2.Lerp(ownPos, target, 0.5f);
                else ownPos += error * (1f - Mathf.Exp(-dt * (action ? 1.5f : 4f)));
                if (ownStick.sqrMagnitude > 0.04f && sinceDive >= PDive + PProne) ownFacing = ownStick.normalized;
            }
            // How far the room lags behind this device: from the start of a run until the room's runner follows.
            if (moveStartAt > 0f)
            {
                if (Vector2.Dot(roomVel, moveDir) > PSpeed * 0.5f) { lag = Mathf.Lerp(lag, Mathf.Clamp(t - moveStartAt, 0.03f, 0.6f), 0.3f); moveStartAt = -1f; }
                else if (t - moveStartAt > 1f) moveStartAt = -1f;
            }
            return ownPos;
        }

        /// <summary>The own height: the local jump or dive arc at once; the room's own arc, arriving later, is not shown a second time.</summary>
        float OwnHeight(SnapRunner s, float now)
        {
            float t = Time.time, floor = FloorY(s.floor);
            if (t - jumpAt < PJump) { float k = (t - jumpAt) / PJump; return Mathf.Max(floor + 4f * JumpHeight * k * (1f - k), Height(s, now)); }
            if (t - diveAt < PDive) { float k = (t - diveAt) / PDive; return Mathf.Max(floor + 4f * DiveHeight * k * (1f - k), Height(s, now)); }
            bool echo = (t - jumpAt < PJump + lag + 0.15f || t - diveAt < PDive + lag + 0.15f) && s.floor == jumpFloor && now >= s.dropUntil;
            return echo ? Mathf.Min(Height(s, now), floor + 0.05f) : Height(s, now);
        }

        /// <summary>The own runner's look this frame (facing, speed for the animation, local action timers).</summary>
        void ApplyOwn(LavaRunner r, SnapRunner s, float now)
        {
            float t = Time.time;
            r.facing = new Vector3(ownFacing.x, 0f, ownFacing.y);
            r.remoteVelocity = new Vector3(ownVel.x, 0f, ownVel.y) * Tile;
            r.grounded = !(t - jumpAt < PJump || t - diveAt < PDive || now < s.dropUntil);
            r.diveUntil = Mathf.Max(r.diveUntil, diveAt + PDive);
            r.proneUntil = Mathf.Max(r.proneUntil, diveAt + PDive + PProne);
            r.shoveUntil = Mathf.Max(r.shoveUntil, shoveAt + PShove);
        }
    }
}
