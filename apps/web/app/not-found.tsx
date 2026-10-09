import Link from "next/link";

export default function NotFound() {
  return (
    <section className="view" style={{ textAlign: "center", padding: "60px 0" }}>
      <p className="tag">404</p>
      <h1 className="display">This page is not here.</h1>
      <p className="lede" style={{ margin: "0 auto 24px" }}>
        The link may be old, or the code may be mistyped.
      </p>
      <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
        <Link className="btn" href="/home">
          Go to Seedha
        </Link>
        <Link className="btn ghost" href="/link">
          Book a stay
        </Link>
      </div>
    </section>
  );
}
