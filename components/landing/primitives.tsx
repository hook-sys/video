// Visual building blocks of the landing page, in the style of a 3D brand film:
// glossy gradient spheres, frosted glass panels and floating UI windows.

type Tone = "blue" | "violet" | "pink" | "coral";

export function Sphere({ size, tone = "violet", className = "", style }: { size: number; tone?: Tone; className?: string; style?: React.CSSProperties }) {
  return <span aria-hidden="true" className={`lp-sphere lp-sphere-${tone} ${className}`} style={{ width: size, height: size, ...style }} />;
}

export function UiWindow({ w, h, variant = "blue", className = "", style, children }: { w: number; h: number; variant?: "blue" | "glass" | "light"; className?: string; style?: React.CSSProperties; children?: React.ReactNode }) {
  return (
    <div aria-hidden="true" className={`lp-window lp-window-${variant} ${className}`} style={{ width: w, height: h, ...style }}>
      <div className="lp-window-bar">
        <i />
        <i />
        <i />
      </div>
      {children ?? (
        <div className="lp-window-body">
          <span className="lp-block lp-block-a" />
          <span className="lp-block lp-block-b" />
          <span className="lp-line" />
          <span className="lp-line lp-line-short" />
        </div>
      )}
    </div>
  );
}
