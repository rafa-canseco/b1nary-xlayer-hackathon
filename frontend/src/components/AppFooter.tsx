function XIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

export function AppFooter() {
  return (
    <footer className="border-t border-[var(--border)] px-6 py-6 mt-auto">
      <div className="mx-auto max-w-6xl flex items-center justify-between">
        <span className="text-xs text-[var(--text-secondary)] opacity-50 font-mono">
          © {new Date().getFullYear()} b1nary
        </span>
        <div className="flex items-center gap-4">
          <a
            href="https://docs.b1nary.app"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-[var(--text-secondary)] opacity-50 hover:opacity-100 transition-opacity"
          >
            Docs
          </a>
          <a
            href="https://x.com/b1naryapp"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="b1nary on X"
            className="text-[var(--text-secondary)] opacity-50 hover:opacity-100 transition-opacity"
          >
            <XIcon className="w-4 h-4" />
          </a>
        </div>
      </div>
    </footer>
  );
}
