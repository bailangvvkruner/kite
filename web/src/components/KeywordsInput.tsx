import { useState, type ClipboardEvent, type KeyboardEvent } from "react";
import { XIcon } from "@phosphor-icons/react";

import { useI18n } from "@/i18n";

interface Props {
  id?: string;
  value: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
}

// Commas in either script, and the enumeration comma, separate keywords.
const separators = /[,，、]/;

/** KeywordsInput edits a list of words, each shown as a chip. */
export function KeywordsInput({ id, value, onChange, placeholder }: Props) {
  const { t } = useI18n();
  const [typed, setTyped] = useState("");

  const add = (text: string) => {
    const words = text
      .split(separators)
      .map((word) => word.trim())
      .filter((word) => word !== "");
    const next = [...value];
    for (const word of words) if (!next.includes(word)) next.push(word);
    if (next.length !== value.length) onChange(next);
    setTyped("");
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    // A word being composed with an input method is not finished yet.
    if (event.nativeEvent.isComposing) return;
    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault();
      add(typed);
    } else if (event.key === "Backspace" && typed === "" && value.length > 0) {
      onChange(value.slice(0, -1));
    }
  };

  const onPaste = (event: ClipboardEvent<HTMLInputElement>) => {
    const text = event.clipboardData.getData("text");
    if (!separators.test(text)) return;
    event.preventDefault();
    add(typed + text);
  };

  return (
    <div className="field-surface flex min-h-10 flex-wrap items-center gap-1.5 rounded-md px-1.5 py-1.5 hover:border-input-hover focus-within:border-primary focus-within:ring-[3px] focus-within:ring-field-ring">
      {value.map((word) => (
        <span
          key={word}
          className="inline-flex h-[26px] items-center gap-0.5 rounded-[7px] bg-primary/8 ps-2.5 pe-1 text-[13px] text-primary dark:bg-primary/15 dark:text-[#a9c0f0]"
        >
          {word}
          <button
            type="button"
            aria-label={t("form.removeKeyword", { word })}
            onClick={() => onChange(value.filter((each) => each !== word))}
            className="grid size-[18px] place-items-center rounded-[5px] opacity-60 transition hover:bg-primary/10 hover:opacity-100"
          >
            <XIcon className="size-3" />
          </button>
        </span>
      ))}
      <input
        id={id}
        className="h-[26px] min-w-24 flex-1 bg-transparent px-1.5 text-sm outline-none placeholder:text-muted-foreground/70"
        value={typed}
        placeholder={value.length === 0 ? placeholder : undefined}
        onChange={(event) => {
          const text = event.target.value;
          if (separators.test(text)) add(text);
          else setTyped(text);
        }}
        onKeyDown={onKeyDown}
        onPaste={onPaste}
        onBlur={() => typed.trim() && add(typed)}
      />
    </div>
  );
}
