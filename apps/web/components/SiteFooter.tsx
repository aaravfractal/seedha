import Link from "next/link";

const LINKS: [string, string][] = [
  ["/about", "About"],
  ["/faq", "FAQ"],
  ["/contact", "Contact"],
  ["/privacy", "Privacy"],
  ["/terms", "Terms"],
  ["/cookies", "Cookies"],
  ["/data-deletion", "Delete my data"],
  ["/security", "Security"],
];

/** Footer on every page, guest pages included. */
export function SiteFooter() {
  return (
    <footer className="site-footer">
      <nav className="inner" aria-label="About Seedha">
        {LINKS.map(([href, label]) => (
          <Link key={href} href={href}>
            {label}
          </Link>
        ))}
        <span style={{ marginLeft: "auto" }}>Seedha · hackathon prototype · sample data only</span>
      </nav>
    </footer>
  );
}
