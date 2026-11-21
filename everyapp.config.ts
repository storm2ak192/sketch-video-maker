import { defineEveryApp } from "@every-app/sdk";

export default defineEveryApp({
  id: "sketch-video-maker",
  name: "Sketch Video Maker",
  description:
    "Turn a picture into a video of a hand drawing it, then colouring it in.",
  icon: "/icon.svg",
  access: "everyone",
  resources: {
    d1: ["DB"],
    r2: ["files"],
  },
});
