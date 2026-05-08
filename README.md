# FreshCampaign AI Studio

Plataforma SaaS AI-first para construir campanas visuales listas para publicar en Instagram, X y Facebook.

## Incluye en este MVP

- Analisis de identidad de marca (brand kit + referencias visuales).
- Motor de prompts visuales para multiples formatos (`9:16`, `1:1`, `16:9`).
- Generacion simultanea de 3 direcciones creativas.
- Recomendacion de layout dinamico por formato/plataforma.
- Editor con refinado por lenguaje natural.
- Exportacion base de previews en SVG/PNG.

## Stack

- Next.js 16 + TypeScript + App Router
- Tailwind CSS v4
- API routes para:
  - `POST /api/brand/analyze`
  - `POST /api/design/generate`

## Ejecutar

```bash
npm install
npm run dev
```

## Como conectar IA real

Este MVP usa previews SVG para dejar la arquitectura lista.

Para producir artes finales con modelos reales:

1. Sustituye `renderPreviewDataUrl` en `src/lib/mock-render.ts` por llamadas a proveedor (OpenAI Images, Midjourney API o Stable Diffusion).
2. Conserva `buildVisualPrompts` en `src/lib/prompt-builder.ts` para mantener consistencia de marca.
3. Agrega pipeline de validacion adicional:
   - contraste WCAG sobre tipografia y fondos,
   - area de seguridad del logo,
   - bloqueo de paletas fuera del rango del brand kit.
4. Para export premium, agrega servicio de render de capas (SVG/PDF con objetos separados).

