// One toon family for the whole frame (course, temple, figures): two crisp light bands,
// palette-tinted shadows, a soft rim, optional screen-space face borders on box faces,
// object-space patterns (checker, scrolling chevrons, hazard stripes) and the outfit mask
// of the approved base humans (underwear in the player colour, like the three.js figures).
Shader "GSG/Toon"
{
    Properties
    {
        _BaseColor ("Grundfarbe", Color) = (1,1,1,1)
        _BaseMap ("Textur", 2D) = "white" {}
        _ShadowTint ("Schattenton", Color) = (0.42,0.36,0.72,1)
        _RimColor ("Kantenlicht", Color) = (1,0.93,0.82,1)
        _RimPower ("Kantenlicht Staerke", Range(0,1)) = 0.22
        [HDR] _EmissionColor ("Leuchten", Color) = (0,0,0,1)
        _EdgeColor ("Konturfarbe", Color) = (0.14,0.07,0.25,1)
        _EdgeWidth ("Konturbreite px (0 = aus)", Range(0,4)) = 0
        _Pattern ("Muster 0 aus 1 Karo 2 Pfeile 3 Streifen", Float) = 0
        _PatternColor ("Musterfarbe (Alpha = Staerke)", Color) = (0,0,0,0.08)
        _PatternScale ("Musterabstand m", Float) = 1
        _Scroll ("Musterlauf m/s", Float) = 0
        _OutfitMap ("Kleidungsmaske", 2D) = "black" {}
        _OutfitColor ("Spielerfarbe", Color) = (0.9,0.36,0.4,1)
        _OutfitOn ("Maske aktiv", Float) = 0
    }

    SubShader
    {
        Tags { "RenderType"="Opaque" "RenderPipeline"="UniversalPipeline" "Queue"="Geometry" }

        HLSLINCLUDE
        #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Core.hlsl"

        CBUFFER_START(UnityPerMaterial)
            float4 _BaseColor;
            float4 _BaseMap_ST;
            float4 _ShadowTint;
            float4 _RimColor;
            float _RimPower;
            float4 _EmissionColor;
            float4 _EdgeColor;
            float _EdgeWidth;
            float _Pattern;
            float4 _PatternColor;
            float _PatternScale;
            float _Scroll;
            float4 _OutfitColor;
            float _OutfitOn;
        CBUFFER_END
        ENDHLSL

        Pass
        {
            Name "ToonForward"
            Tags { "LightMode"="UniversalForward" }
            Cull Back
            ZWrite On

            HLSLPROGRAM
            #pragma vertex Vert
            #pragma fragment Frag
            #pragma multi_compile _ _MAIN_LIGHT_SHADOWS _MAIN_LIGHT_SHADOWS_CASCADE _MAIN_LIGHT_SHADOWS_SCREEN
            #pragma multi_compile_fragment _ _SHADOWS_SOFT _SHADOWS_SOFT_LOW _SHADOWS_SOFT_MEDIUM _SHADOWS_SOFT_HIGH
            #pragma multi_compile_fog
            #pragma multi_compile_instancing
            #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Lighting.hlsl"

            TEXTURE2D(_BaseMap); SAMPLER(sampler_BaseMap);
            TEXTURE2D(_OutfitMap); SAMPLER(sampler_OutfitMap);

            struct Attributes
            {
                float4 positionOS : POSITION;
                float3 normalOS : NORMAL;
                float2 uv : TEXCOORD0;
                UNITY_VERTEX_INPUT_INSTANCE_ID
            };

            struct Varyings
            {
                float4 positionCS : SV_POSITION;
                float3 positionWS : TEXCOORD0;
                float3 normalWS : TEXCOORD1;
                float2 uv : TEXCOORD2;
                float3 patternPos : TEXCOORD3;
                float fog : TEXCOORD4;
                UNITY_VERTEX_INPUT_INSTANCE_ID
            };

            Varyings Vert(Attributes input)
            {
                Varyings o;
                UNITY_SETUP_INSTANCE_ID(input);
                UNITY_TRANSFER_INSTANCE_ID(input, o);
                VertexPositionInputs p = GetVertexPositionInputs(input.positionOS.xyz);
                o.positionCS = p.positionCS;
                o.positionWS = p.positionWS;
                o.normalWS = TransformObjectToWorldNormal(input.normalOS);
                o.uv = input.uv;
                // Object space in metres: patterns stay on moving obstacles.
                float3 scale = float3(length(UNITY_MATRIX_M._m00_m10_m20), length(UNITY_MATRIX_M._m01_m11_m21), length(UNITY_MATRIX_M._m02_m12_m22));
                o.patternPos = input.positionOS.xyz * scale;
                o.fog = ComputeFogFactor(p.positionCS.z);
                return o;
            }

            float PatternMask(float3 p)
            {
                float s = max(_PatternScale, 0.01);
                if (_Pattern < 0.5) return 0;
                if (_Pattern < 1.5) { float2 c = floor(p.xz / s); return fmod(abs(c.x + c.y), 2.0); }
                if (_Pattern < 2.5) { float z = (p.z - _Time.y * _Scroll) / s + abs(p.x) / s * 0.6; return step(0.5, frac(z)); }
                return step(0.5, frac((p.x + p.z + p.y) / s));
            }

            half4 Frag(Varyings i) : SV_Target
            {
                UNITY_SETUP_INSTANCE_ID(i);
                float2 uv = TRANSFORM_TEX(i.uv, _BaseMap);
                half4 tex = SAMPLE_TEXTURE2D(_BaseMap, sampler_BaseMap, uv);
                half3 albedo = tex.rgb * _BaseColor.rgb;

                // Outfit mask: masked areas take the player colour, keeping the fabric's shading.
                half shade = dot(albedo, half3(0.299, 0.587, 0.114));
                half mask = SAMPLE_TEXTURE2D(_OutfitMap, sampler_OutfitMap, i.uv).r * _OutfitOn;
                albedo = lerp(albedo, _OutfitColor.rgb * (0.55 + 0.9 * shade), mask);

                albedo = lerp(albedo, _PatternColor.rgb, PatternMask(i.patternPos) * _PatternColor.a);

                float3 n = normalize(i.normalWS);
                Light light = GetMainLight(TransformWorldToShadowCoord(i.positionWS));
                float ndl = saturate(dot(n, light.direction));
                float lit = ndl * light.shadowAttenuation;
                float band = smoothstep(0.08, 0.13, lit) * 0.78 + smoothstep(0.62, 0.67, lit) * 0.22;
                half3 lightCol = lerp(_ShadowTint.rgb, light.color.rgb, band);
                half3 ambient = SampleSH(n) * 0.35;
                half3 color = albedo * (lightCol + ambient);

                float3 viewDir = normalize(GetWorldSpaceViewDir(i.positionWS));
                float rim = pow(1.0 - saturate(dot(n, viewDir)), 4.0) * _RimPower * (0.35 + 0.65 * band);
                color += _RimColor.rgb * rim;

                // Comic border along the face edges of box meshes, constant width on screen.
                if (_EdgeWidth > 0.01)
                {
                    float2 w = max(fwidth(i.uv), 1e-5) * _EdgeWidth;
                    float2 d = min(i.uv, 1.0 - i.uv);
                    float2 e = smoothstep(w * 0.6, w * 1.4, d);
                    color = lerp(_EdgeColor.rgb, color, e.x * e.y);
                }

                color += _EmissionColor.rgb;
                color = MixFog(color, i.fog);
                return half4(color, 1);
            }
            ENDHLSL
        }

        Pass
        {
            Name "ShadowCaster"
            Tags { "LightMode"="ShadowCaster" }
            ZWrite On
            ZTest LEqual
            ColorMask 0
            Cull Back

            HLSLPROGRAM
            #pragma vertex ShadowVert
            #pragma fragment ShadowFrag
            #pragma multi_compile_instancing
            #pragma multi_compile_vertex _ _CASTING_PUNCTUAL_LIGHT_SHADOW
            #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Shadows.hlsl"

            float3 _LightDirection;
            float3 _LightPosition;

            struct Attributes { float4 positionOS : POSITION; float3 normalOS : NORMAL; UNITY_VERTEX_INPUT_INSTANCE_ID };
            struct Varyings { float4 positionCS : SV_POSITION; };

            Varyings ShadowVert(Attributes input)
            {
                Varyings o;
                UNITY_SETUP_INSTANCE_ID(input);
                float3 positionWS = TransformObjectToWorld(input.positionOS.xyz);
                float3 normalWS = TransformObjectToWorldNormal(input.normalOS);
                #if _CASTING_PUNCTUAL_LIGHT_SHADOW
                    float3 lightDir = normalize(_LightPosition - positionWS);
                #else
                    float3 lightDir = _LightDirection;
                #endif
                float4 positionCS = TransformWorldToHClip(ApplyShadowBias(positionWS, normalWS, lightDir));
                #if UNITY_REVERSED_Z
                    positionCS.z = min(positionCS.z, UNITY_NEAR_CLIP_VALUE);
                #else
                    positionCS.z = max(positionCS.z, UNITY_NEAR_CLIP_VALUE);
                #endif
                o.positionCS = positionCS;
                return o;
            }

            half4 ShadowFrag(Varyings i) : SV_Target { return 0; }
            ENDHLSL
        }

        Pass
        {
            Name "DepthOnly"
            Tags { "LightMode"="DepthOnly" }
            ZWrite On
            ColorMask R
            Cull Back

            HLSLPROGRAM
            #pragma vertex DepthVert
            #pragma fragment DepthFrag
            #pragma multi_compile_instancing

            struct Attributes { float4 positionOS : POSITION; UNITY_VERTEX_INPUT_INSTANCE_ID };
            struct Varyings { float4 positionCS : SV_POSITION; };

            Varyings DepthVert(Attributes input)
            {
                Varyings o;
                UNITY_SETUP_INSTANCE_ID(input);
                o.positionCS = TransformObjectToHClip(input.positionOS.xyz);
                return o;
            }

            half DepthFrag(Varyings i) : SV_Target { return i.positionCS.z; }
            ENDHLSL
        }

        Pass
        {
            Name "DepthNormals"
            Tags { "LightMode"="DepthNormals" }
            ZWrite On
            Cull Back

            HLSLPROGRAM
            #pragma vertex NormalsVert
            #pragma fragment NormalsFrag
            #pragma multi_compile_instancing

            struct Attributes { float4 positionOS : POSITION; float3 normalOS : NORMAL; UNITY_VERTEX_INPUT_INSTANCE_ID };
            struct Varyings { float4 positionCS : SV_POSITION; float3 normalWS : TEXCOORD0; };

            Varyings NormalsVert(Attributes input)
            {
                Varyings o;
                UNITY_SETUP_INSTANCE_ID(input);
                o.positionCS = TransformObjectToHClip(input.positionOS.xyz);
                o.normalWS = TransformObjectToWorldNormal(input.normalOS);
                return o;
            }

            half4 NormalsFrag(Varyings i) : SV_Target { return half4(normalize(i.normalWS), 0.0); }
            ENDHLSL
        }
    }
    FallBack Off
}
