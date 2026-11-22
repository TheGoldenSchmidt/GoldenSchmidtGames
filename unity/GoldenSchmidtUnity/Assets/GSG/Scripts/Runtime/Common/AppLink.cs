using System;
using UnityEngine;

namespace GSG
{
    /// <summary>
    /// Parameters handed over by the app in the iframe address (?figur=rig_amara&amp;ruhig=1):
    /// the chosen figure and the reduced-motion preference of the phone.
    /// </summary>
    public static class AppLink
    {
        public static string Param(string key, string fallback = "")
        {
            var url = Application.absoluteURL;
            if (string.IsNullOrEmpty(url)) return fallback;
            int q = url.IndexOf('?');
            if (q < 0) return fallback;
            var query = url.Substring(q + 1);
            int hash = query.IndexOf('#');
            if (hash >= 0) query = query.Substring(0, hash);
            foreach (var pair in query.Split('&'))
            {
                var kv = pair.Split('=');
                if (kv.Length == 2 && kv[0] == key) return Uri.UnescapeDataString(kv[1]);
            }
            return fallback;
        }

        public static string Figure => Param("figur", "rig_jonas");
        public static bool ReducedMotion => Param("ruhig") == "1";

        public static void Apply()
        {
            Fx.Reduced = ReducedMotion;
            Hud.DebugInput = Param("debug") == "1";
            Application.targetFrameRate = 60;
        }
    }
}
