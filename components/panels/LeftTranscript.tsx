import { useState } from "react";
import { AlignLeft, ChevronLeft, ChevronRight } from "lucide-react";
import { flagKey, flagLabels, type Flag } from "@/lib/analyzers/heuristics";
import { useSession, type Mark, type PreparedSession } from "@/lib/store";
import type { TranscriptWord } from "@/lib/stt/deepgramClient";
import { formatTime } from "./RightStats";

function Words({ words, flags = [], select }: { words: TranscriptWord[]; flags?: Flag[]; select?: (flag: Flag) => void }) {
  return words.map((word, index) => {
    const flag = flags.filter(flag => flag.startWord <= index && flag.endWord >= index)
      .reduce<Flag | undefined>((top, next) => !top || (next.severity ?? next.weight) > (top.severity ?? top.weight) ? next : top, undefined);
    return <span key={index} data-word={word.isFinal ? index : undefined}>{" "}{flag ? <button type="button" data-category={flag.category} data-severity={flag.severity ?? flag.weight}
      title={flag.explanation} onClick={() => select?.(flag)}>{word.text}</button> : <span className={word.isFinal ? undefined : "interim"}>{word.text}</span>}</span>;
  });
}

export function LeftTranscript({ question, session, selected, select }: {
  question: string;
  session: PreparedSession | null;
  selected?: Flag;
  select: (flag?: Flag) => void;
}) {
  const { turns, current, interim, flags, liveFlags, analyses, flagStatus, setFlagStatus, marks, markSpan } = useSession();
  const [selection, setSelection] = useState<Mark>();
  function captureSelection(question: number) {
    const range = window.getSelection();
    if (!range || range.isCollapsed) { setSelection(undefined); return; }
    const find = (node: Node | null) => (node instanceof Element ? node : node?.parentElement)?.closest<HTMLElement>("[data-word]");
    const first = find(range.anchorNode);
    const last = find(range.focusNode);
    if (!first || !last || first.closest("[data-answer]") !== last.closest("[data-answer]") ||
      first.closest<HTMLElement>("[data-answer]")?.dataset.answer !== String(question)) {
      setSelection(undefined);
      return;
    }
    const indexes = [Number(first.dataset.word), Number(last.dataset.word)].sort((a,b) => a-b);
    setSelection({ question, startWord: indexes[0], endWord: indexes[1] });
  }
  const visibleTurns = current ? [...turns, current] : turns;
  const allFlags = [...flags, ...liveFlags].filter(flag => flagStatus[flagKey(flag)] !== "dismissed");
  const selectedIndex = selected ? allFlags.findIndex(flag => flagKey(flag) === flagKey(selected)) : -1;
  const categories = ["Fluency", "Clarity", "Evidence", "Consistency", "Composure"];

  return <section className="panel transcript" aria-label="Transcript" id="transcript">
    <header><AlignLeft size={17}/><h2>Transcript</h2></header>
    <div className="transcript-body">
      {session && visibleTurns.length > 0 ? visibleTurns.map(turn => <div className="transcript-turn" key={turn.question}>
        <p className="speaker">Ms. Alina</p>
        <p>{session.plan.questions[turn.question]?.text}</p>
        {(turn.words.length > 0 || (turn === current && interim.length > 0)) && <>
          <p className="speaker">You <time>{formatTime((turn.words[0] ?? interim[0]).startMs)}</time></p>
          <p data-answer={turn.question} onMouseUp={() => captureSelection(turn.question)} onKeyUp={() => captureSelection(turn.question)}><Words words={turn.words} flags={allFlags.filter(flag => flag.question === turn.question)} select={select}/>
            {turn === current && <Words words={interim}/>}</p>
          {selection?.question === turn.question && <button className="preview-link mark-review" type="button" onMouseDown={event => event.preventDefault()} onClick={() => {
            markSpan(selection); setSelection(undefined); window.getSelection()?.removeAllRanges();
          }}>Mark for review</button>}
          {marks.some(mark => mark.question === turn.question) && <p className="muted"><small>{marks.filter(mark => mark.question === turn.question).length} marked for review</small></p>}
        </>}
        {selected?.question === turn.question && <article className="feedback-card" aria-label="Suggestion">
          <strong>{flagLabels[selected.type]}</strong>
          <p>{selected.explanation}</p>
          <p className="suggestion">{selected.suggestion}</p>
          <div className="feedback-actions">
            <button type="button" onClick={() => { setFlagStatus(flagKey(selected), "got_it"); select(); }}>Got it</button>
            <button type="button" onClick={() => { setFlagStatus(flagKey(selected), "dismissed"); select(); }}>Dismiss</button>
            <button type="button" aria-label="Previous suggestion" disabled={selectedIndex < 1} onClick={() => select(allFlags[selectedIndex - 1])}><ChevronLeft size={17}/></button>
            <button type="button" aria-label="Next suggestion" disabled={selectedIndex < 0 || selectedIndex >= allFlags.length - 1} onClick={() => select(allFlags[selectedIndex + 1])}><ChevronRight size={17}/></button>
          </div>
        </article>}
        {!!analyses[turn.question]?.next_time.length && <aside className="next-time">
          <strong>Next time</strong>
          <ul>{analyses[turn.question].next_time.map(tip => <li key={tip}>{tip}</li>)}</ul>
        </aside>}
      </div>) : <>
        <p className="speaker">Ms. Alina <time>00:00</time></p>
        <p>{question}</p>
        <p className="muted">Your answers will appear here during the interview.</p>
      </>}
    </div>
    <ul className="category-counts">
      {categories.map(category => <li key={category}><span data-category={category}>{category}</span><strong>{allFlags.filter(flag => flag.category === category).length}</strong></li>)}
    </ul>
  </section>;
}
