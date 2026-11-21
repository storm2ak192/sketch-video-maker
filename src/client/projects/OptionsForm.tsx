import { Label } from "@/client/components/ui/label";
import { Input } from "@/client/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/client/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/client/components/ui/select";
import {
  HANDS,
  QUALITIES,
  SKETCH_STYLES,
  type AnimationOptions,
  type HandId,
  type Quality,
  type SketchStyle,
} from "@/lib/animation";

/** The form's values: durations stay text while being typed. */
export interface Draft {
  hand: HandId;
  sketchStyle: SketchStyle;
  sketchSeconds: string;
  fillSeconds: string;
  quality: Quality;
}

export function draftOf(options: AnimationOptions): Draft {
  return {
    ...options,
    sketchSeconds: String(options.sketchSeconds),
    fillSeconds: String(options.fillSeconds),
  };
}

function seconds(value: string, min: number) {
  if (!/^\d+$/.test(value.trim())) return null;
  const n = Number(value);
  return n >= min && n <= 50 ? n : null;
}

/** The options a draft stands for, and what's wrong with it. */
export function readDraft(draft: Draft) {
  const sketchSeconds = seconds(draft.sketchSeconds, 1);
  const fillSeconds = seconds(draft.fillSeconds, 0);
  const errors = {
    sketchSeconds: sketchSeconds === null ? "Between 1 and 50 seconds" : null,
    fillSeconds: fillSeconds === null ? "Between 0 and 50 seconds" : null,
  };
  const options: AnimationOptions | null =
    sketchSeconds !== null && fillSeconds !== null
      ? { ...draft, sketchSeconds, fillSeconds }
      : null;
  return { options, errors };
}

const HAND_ITEMS = [
  { value: "none" as HandId, label: "No hand" },
  ...HANDS.map((h) => ({ value: h.id as HandId, label: h.label })),
];

export function OptionsForm({
  draft,
  onChange,
}: {
  draft: Draft;
  onChange: (draft: Draft) => void;
}) {
  const { errors } = readDraft(draft);
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    onChange({ ...draft, [key]: value });

  return (
    <div className="grid gap-6 sm:grid-cols-2">
      <div className="grid content-start gap-2">
        <Label htmlFor="hand">Hand</Label>
        <Select
          items={HAND_ITEMS}
          value={draft.hand}
          onValueChange={(value) => value !== null && set("hand", value)}
        >
          <SelectTrigger id="hand" className="w-full" data-testid="hand-select">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {HAND_ITEMS.map((item) => (
              <SelectItem key={item.value} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <fieldset className="grid content-start gap-2">
        <legend className="mb-2 text-sm font-medium">Sketch style</legend>
        <RadioGroup
          value={draft.sketchStyle}
          onValueChange={(value) => set("sketchStyle", value as SketchStyle)}
          className="flex flex-wrap gap-4"
        >
          {SKETCH_STYLES.map((style) => (
            <Label
              key={style.id}
              className="flex items-center gap-2 font-normal"
            >
              <RadioGroupItem value={style.id} />
              {style.label}
            </Label>
          ))}
        </RadioGroup>
      </fieldset>

      <SecondsField
        id="sketch-seconds"
        label="Sketch duration"
        value={draft.sketchSeconds}
        min={1}
        error={errors.sketchSeconds}
        onChange={(v) => set("sketchSeconds", v)}
      />
      <SecondsField
        id="fill-seconds"
        label="Colour duration"
        value={draft.fillSeconds}
        min={0}
        error={errors.fillSeconds}
        disabled={draft.sketchStyle === "bw"}
        onChange={(v) => set("fillSeconds", v)}
      />

      <fieldset className="grid content-start gap-2">
        <legend className="mb-2 text-sm font-medium">Quality</legend>
        <RadioGroup
          value={draft.quality}
          onValueChange={(value) => set("quality", value as Quality)}
          className="flex flex-wrap gap-4"
        >
          {(Object.keys(QUALITIES) as Quality[]).map((q) => (
            <Label key={q} className="flex items-center gap-2 font-normal">
              <RadioGroupItem value={q} />
              {QUALITIES[q].label}
            </Label>
          ))}
        </RadioGroup>
      </fieldset>
    </div>
  );
}

function SecondsField({
  id,
  label,
  value,
  min,
  error,
  disabled,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  min: number;
  error: string | null;
  disabled?: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <div className="grid content-start gap-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="flex items-center gap-2">
        <Input
          id={id}
          type="number"
          inputMode="numeric"
          min={min}
          max={50}
          step={1}
          value={value}
          disabled={disabled}
          aria-invalid={error ? true : undefined}
          className="w-24"
          onChange={(event) => onChange(event.target.value)}
        />
        <span className="text-sm text-muted-foreground">seconds</span>
      </div>
      {error && !disabled ? (
        <p className="text-sm text-destructive">{error}</p>
      ) : null}
    </div>
  );
}
