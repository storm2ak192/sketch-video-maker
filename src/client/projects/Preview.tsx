import { Pause, Play, RotateCcw } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Button } from "@/client/components/ui/button";
import {
  Renderer,
  phaseAt,
  type Phase,
  type Scene,
} from "@/client/sketch/player";
import {
  formatSeconds,
  totalSeconds,
  type AnimationOptions,
} from "@/lib/animation";

/** The animation on a board, with play, pause and restart. */
export function Preview({
  scene,
  options,
  actions,
}: {
  scene: Scene | null;
  options: AnimationOptions;
  actions?: ReactNode;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const renderer = useRef<Renderer | null>(null);
  const clock = useRef({ offset: 0, startedAt: 0 });
  const frame = useRef(0);
  const [playing, setPlaying] = useState(false);
  const [phase, setPhase] = useState<Phase | "loading">("loading");
  const [time, setTime] = useState(0);
  const [run, setRun] = useState(0);
  const total = totalSeconds(options);

  // A new picture or new options: back to the finished picture, stopped.
  useEffect(() => {
    if (!scene || !canvas.current) return;
    cancelAnimationFrame(frame.current);
    renderer.current = new Renderer(canvas.current, scene, options);
    renderer.current.renderFinal();
    clock.current = { offset: 0, startedAt: 0 };
    setPlaying(false);
    setPhase("ready");
    setTime(0);
  }, [scene, options]);

  useEffect(() => {
    if (!playing) return;
    clock.current.startedAt = performance.now();
    let shown = -1;
    const tick = () => {
      const t = Math.min(
        total,
        clock.current.offset +
          (performance.now() - clock.current.startedAt) / 1000,
      );
      renderer.current?.render(t);
      const now = phaseAt(options, t);
      if (Math.floor(t * 4) !== shown || now === "done") {
        shown = Math.floor(t * 4);
        setTime(t);
        setPhase(now);
      }
      if (now === "done") {
        clock.current.offset = total;
        setPlaying(false);
        return;
      }
      frame.current = requestAnimationFrame(tick);
    };
    frame.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame.current);
  }, [playing, run, options, total]);

  function pause() {
    clock.current.offset = Math.min(
      total,
      clock.current.offset +
        (performance.now() - clock.current.startedAt) / 1000,
    );
    setPlaying(false);
  }

  function play() {
    if (phase === "done" || phase === "ready") {
      clock.current.offset = 0;
      renderer.current?.render(0);
      setPhase("sketch");
      setTime(0);
    }
    setPlaying(true);
  }

  function restart() {
    clock.current.offset = 0;
    renderer.current?.render(0);
    setPhase("sketch");
    setTime(0);
    setRun((n) => n + 1);
    setPlaying(true);
  }

  return (
    <div className="space-y-3">
      <div className="overflow-hidden rounded-xl border border-border bg-muted">
        <canvas
          ref={canvas}
          data-testid="preview"
          data-phase={phase}
          aria-label="Animation preview"
          className="block aspect-video w-full"
        />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {playing ? (
          <Button variant="outline" onClick={pause}>
            <Pause data-icon="inline-start" />
            Pause
          </Button>
        ) : (
          <Button variant="outline" onClick={play} disabled={!scene}>
            <Play data-icon="inline-start" />
            Play
          </Button>
        )}
        <Button variant="outline" onClick={restart} disabled={!scene}>
          <RotateCcw data-icon="inline-start" />
          Restart
        </Button>
        <span
          className="ml-1 text-sm text-muted-foreground tabular-nums"
          data-testid="preview-time"
        >
          {formatSeconds(phase === "ready" ? 0 : time)} / {formatSeconds(total)}
        </span>
        {actions ? <div className="ml-auto">{actions}</div> : null}
      </div>
    </div>
  );
}
