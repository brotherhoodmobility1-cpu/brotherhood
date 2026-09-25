export default function AgreementText({ text }: { text: string }) {
  const lines = text.split("\n").filter((l) => l.trim());
  return (
    <>
      {lines.map((l, i) =>
        i === 0 ? <h2 key={i}>{l}</h2> : /[\u0900-\u097F]/.test(l)
          ? <p key={i} style={{ fontSize: 14.5, margin: "0 0 14px" }}>{l}</p>
          : <p key={i} style={{ fontSize: 14, margin: "0 0 3px" }}>{l}</p>
      )}
    </>
  );
}
