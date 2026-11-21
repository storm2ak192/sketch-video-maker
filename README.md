# Sketch Video Maker

Upload a picture and get a video of a hand sketching it on a whiteboard, then shading or colouring it in. Pick the hand, the style, the timing and the resolution, preview it, and download the video.

Inspired by https://speedpaint.co

Built with [oss.new](https://oss.new) for [EveryApp](https://github.com/every-app/every-app).

## Features

- Upload a JPG or PNG (up to 10 MB) to start a project, then rename, open or delete your projects.
- Choose a drawn hand or none, a black & white, gray or colour style, sketch and colour durations, and 720p or 1080p.
- Preview the drawing animation in the browser with play, pause and restart.
- Export the animation as a video, then download or delete each export.

Left out: accounts and sign-in, which your Gateway handles; plans and payments; editor plugins; public sharing links; a trained drawing model (strokes are traced from the picture's edges).

## Setup

No secrets or settings. It uses a D1 database and an R2 bucket, which the deploy creates (R2 must be enabled on the Cloudflare account once).

```sh
pnpm install
pnpm dev          # run locally behind the dev Gateway
pnpm test         # unit tests
pnpm run deploy   # deploy to your Gateway
```

The checks in `checks/` run against a packaged release through the oss.new runtime. Deploying to a real Gateway was not part of those checks.

## Limitations

- Videos are recorded in your browser in real time, so an export takes as long as the video, and the tab must stay open and visible meanwhile.
- The video format depends on the browser: WebM in most, MP4 where the browser records it. Some players show no length for WebM files from browsers.
- Each member sees only their own projects. Admins can list and delete everyone's projects through `/api/projects?all=1` and `DELETE /api/projects/<id>`, not in the pages.
