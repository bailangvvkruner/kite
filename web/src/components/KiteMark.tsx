/**
 * The mark, drawn rather than fetched so it paints with whatever holds it.
 *
 * The stroke repeats the fill deliberately: that is what rounds the corners of
 * the three shapes. It is the same geometry as docs/assets/logo.svg, kept in
 * step by hand because the alternative -- fetching the file -- would make the
 * rail wait on a request to draw its own header. On dark pages it takes the
 * lighter blue of the website's logo-dark.svg.
 *
 * tight crops the box to the drawing, so the mark can be lined up by its
 * visible edges; size it by height and let the width follow.
 */
export function KiteMark({ className = "size-6", tight = false }: { className?: string; tight?: boolean }) {
  return (
    <svg
      viewBox={tight ? "7.5 12 49 39.5" : "0 0 64 64"}
      className={`shrink-0 text-[#4A77D6] dark:text-[#8FB0FF] ${className}`}
      aria-hidden
    >
      <g
        fill="currentColor"
        stroke="currentColor"
        strokeWidth="5"
        strokeLinejoin="round"
        transform={tight ? undefined : "translate(32 32) scale(0.82) translate(-32 -32)"}
      >
        <path d="M10 14.5 L27 21 L27 30 L10 23.5 Z" />
        <path d="M10 32 L27 38.5 L27 49 L10 42.5 Z" />
        <path d="M37 21 L54 14.5 L54 42.5 L37 49 Z" />
      </g>
    </svg>
  );
}
