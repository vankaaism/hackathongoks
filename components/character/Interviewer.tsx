export function Interviewer({ speaking = false, amplitude = 0 }: {
  speaking?: boolean;
  amplitude?: number;
}) {
  const frame = !speaking || amplitude < 0.12 ? 0 : amplitude < 0.48 ? 1 : 2;
  return <div className="interviewer-art" aria-hidden="true">
    <div className="cat-avatar-frame" data-frame={frame}/>
  </div>;
}
