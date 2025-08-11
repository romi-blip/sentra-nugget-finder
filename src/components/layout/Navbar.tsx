import { Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";

const navItems = [
  { to: "/", label: "Home" },
  { to: "/kb", label: "Knowledge Base" },
  { to: "/chat", label: "Chat" },
];

export const Navbar = ({ onOpenSettings }: { onOpenSettings?: () => void }) => {
  const { pathname } = useLocation();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 4);
    onScroll();
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className={`sticky top-0 z-40 backdrop-blur supports-[backdrop-filter]:bg-background/80 ${scrolled ? "border-b" : ""}`}>
      <nav className="mx-auto max-w-7xl px-4 py-3 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2 font-semibold">
          <span className="inline-flex h-6 w-6 rounded-md bg-gradient-to-br from-brand to-brand-2" aria-hidden />
          <span>Sentra GTM Assistant</span>
        </Link>
        <div className="flex items-center gap-6">
          <ul className="hidden sm:flex items-center gap-1 text-sm">
            {navItems.map((i) => (
              <li key={i.to}>
                <Link
                  to={i.to}
                  className={`px-3 py-2 rounded-md transition-colors ${
                    pathname === i.to
                      ? "bg-secondary text-secondary-foreground"
                      : "hover:bg-accent hover:text-accent-foreground"
                  }`}
                >
                  {i.label}
                </Link>
              </li>
            ))}
          </ul>
          <Button variant="hero" size="sm" onClick={onOpenSettings}>Settings</Button>
        </div>
      </nav>
    </header>
  );
};

export default Navbar;
