export default function WelcomeZoom({ title }: { title: string }) {
  return (
    <div id="zoom" aria-hidden="true">
      <div className="zroad" />
      <div className="zsc scimgF"><i className="zflare" /></div>
      <div className="zt">{title}<small>Brotherhood Mobility</small></div>
    </div>
  );
}
