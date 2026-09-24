export default function Empty({ text }: { text: string }) {
  return (
    <div className="empty">
      <div className="scimg eimg" aria-hidden="true" />
      <span>{text}</span>
    </div>
  );
}
