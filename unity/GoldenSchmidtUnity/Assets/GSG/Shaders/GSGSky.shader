// Palette sky: three-stop gradient with a soft sun glow, replaces the template skybox.
Shader "GSG/Sky"
{
    Properties
    {
        _Top ("Oben", Color) = (0.11,0.14,0.4,1)
        _Horizon ("Horizont", Color) = (0.98,0.62,0.66,1)
        _Bottom ("Unten", Color) = (0.12,0.09,0.3,1)
        _SunColor ("Sonne", Color) = (1,0.9,0.7,1)
        _SunSize ("Sonnenschein", Range(1,200)) = 24
    }

    SubShader
    {
        Tags { "Queue"="Background" "RenderType"="Background" "PreviewType"="Skybox" "RenderPipeline"="UniversalPipeline" }
        Cull Off ZWrite Off

        Pass
        {
            HLSLPROGRAM
            #pragma vertex Vert
            #pragma fragment Frag
            #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Core.hlsl"
            #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Lighting.hlsl"

            CBUFFER_START(UnityPerMaterial)
                float4 _Top;
                float4 _Horizon;
                float4 _Bottom;
                float4 _SunColor;
                float _SunSize;
            CBUFFER_END

            struct Attributes { float4 positionOS : POSITION; };
            struct Varyings { float4 positionCS : SV_POSITION; float3 dir : TEXCOORD0; };

            Varyings Vert(Attributes input)
            {
                Varyings o;
                o.positionCS = TransformObjectToHClip(input.positionOS.xyz);
                o.dir = input.positionOS.xyz;
                return o;
            }

            half4 Frag(Varyings i) : SV_Target
            {
                float3 d = normalize(i.dir);
                float up = saturate(d.y), down = saturate(-d.y);
                half3 c = lerp(_Horizon.rgb, _Top.rgb, pow(up, 0.55));
                c = lerp(c, _Bottom.rgb, pow(down, 0.6));
                float sun = pow(saturate(dot(d, _MainLightPosition.xyz)), _SunSize);
                c += _SunColor.rgb * sun * 0.8;
                return half4(c, 1);
            }
            ENDHLSL
        }
    }
    FallBack Off
}
