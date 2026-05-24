type Props = {
  size?: number;
  withWordmark?: boolean;
  onDark?: boolean;
};

/**
 * Quoted brand mark — "Q" whose tail is a quotation-mark comma.
 * Faithful TSX port of brand/logos/mark-q-quote.svg.
 */
export function LogoMark({ size = 28, onDark = false }: Pick<Props, "size" | "onDark">) {
  const fill = onDark ? "#ffffff" : "#3b3fbf";
  const stroke = onDark ? "#3b3fbf" : "#ffffff";

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      style={{ display: "block" }}
      aria-label="Quoted"
      role="img"
    >
      <rect x="0" y="0" width="32" height="32" rx="7" fill={fill} />
      <circle cx="15" cy="15" r="7.5" fill="none" stroke={stroke} strokeWidth="2.4" />
      <path
        d="M19.2 18.4 c0.9 0.9 1.2 2.1 0.9 3.3 c-0.3 1.2 -1.1 2 -2.3 2.6"
        fill="none"
        stroke={stroke}
        strokeWidth="2.4"
        strokeLinecap="round"
      />
      <circle cx="20.2" cy="19.4" r="1.6" fill={fill} />
    </svg>
  );
}

export function Logo({ size = 28, withWordmark = true, onDark = false }: Props) {
  return (
    <span className="inline-flex items-center gap-[9px]" aria-label="Quoted">
      <LogoMark size={size} onDark={onDark} />
      {withWordmark ? (
        <span
          className={`font-semibold leading-none tracking-[-0.015em] ${onDark ? "text-white" : "text-ink"}`}
          style={{ fontSize: Math.round(size * 0.62) }}
        >
          Quoted
        </span>
      ) : null}
    </span>
  );
}
