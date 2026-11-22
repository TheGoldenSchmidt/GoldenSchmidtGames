// Molten surfaces: lava under the temple and the green goo of the course. Unlit HDR colour
// from two scrolling value-noise layers, so bloom picks up the bright veins.
Shader "GSG/Glow"
{
    Properties
    {
        [HDR] _HotColor ("Heiss", Color) = (4,1.6,0.35,1)
        _CrustColor ("Kruste", Color) = (0.45,0.06,0.03,1)
        _Scale ("Noise-Groesse m", Float) = 3
        _Flow ("Fliessen", Vector) = (0.12,0.05,0,0)
        _Contrast ("Kontrast", Range(0.5,4)) = 1.8
    }

    SubShader
    {
        Tags { "RenderType"="Opaque" "RenderPipeline"="UniversalPipeline" "Queue"="Geometry" }

        Pass
        {
            Name "Glow"
            Tags { "LightMode"="UniversalForward" }

            HLSLPROGRAM
            #pragma vertex Vert
            #pragma fragment Frag
            #pragma multi_compile_fog
            #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Core.hlsl"

            CBUFFER_START(UnityPerMaterial)
                float4 _HotColor;
                float4 _CrustColor;
                float _Scale;
                float4 _Flow;
                float _Contrast;
            CBUFFER_END

            struct Attributes { float4 positionOS : POSITION; };
            struct Varyings { float4 positionCS : SV_POSITION; float3 positionWS : TEXCOORD0; float fog : TEXCOORD1; };

            float Hash(float2 p) { p = frac(p * float2(123.34, 456.21)); p += dot(p, p + 45.32); return frac(p.x * p.y); }
            float Noise(float2 p)
            {
                float2 i = floor(p), f = frac(p);
                float2 u = f * f * (3.0 - 2.0 * f);
                return lerp(lerp(Hash(i), Hash(i + float2(1, 0)), u.x), lerp(Hash(i + float2(0, 1)), Hash(i + float2(1, 1)), u.x), u.y);
            }

            Varyings Vert(Attributes input)
            {
                Varyings o;
                VertexPositionInputs p = GetVertexPositionInputs(input.positionOS.xyz);
                o.positionCS = p.positionCS;
                o.positionWS = p.positionWS;
                o.fog = ComputeFogFactor(p.positionCS.z);
                return o;
            }

            half4 Frag(Varyings i) : SV_Target
            {
                float2 p = i.positionWS.xz / max(_Scale, 0.01);
                float t = _Time.y;
                float a = Noise(p + _Flow.xy * t);
                float b = Noise(p * 2.3 - _Flow.yx * t * 1.7 + a);
                float heat = saturate(pow(saturate(a * 0.6 + b * 0.55), _Contrast) * 1.6);
                float pulse = 0.85 + 0.15 * sin(t * 1.7 + a * 6.0);
                half3 color = lerp(_CrustColor.rgb, _HotColor.rgb * pulse, heat);
                return half4(MixFog(color, i.fog), 1);
            }
            ENDHLSL
        }
    }
    FallBack Off
}
