// SPDX-License-Identifier: MIT
/** Static chart frame for the landing page. Rings, ticks, and lit nodes. */
export function ChartMark() {
  const rings = [46, 78, 112];
  const ticks = Array.from({ length: 72 }, (_, index) => {
    const major = index % 6 === 0;
    const angle = (index * 5 * Math.PI) / 180;
    const outer = 132;
    const inner = outer - (major ? 8 : 4);
    return {
      major,
      x1: Math.sin(angle) * inner,
      y1: -Math.cos(angle) * inner,
      x2: Math.sin(angle) * outer,
      y2: -Math.cos(angle) * outer,
    };
  });
  const nodes = [
    { angle: 20, ring: 112 },
    { angle: 80, ring: 78 },
    { angle: 160, ring: 112 },
    { angle: 250, ring: 46 },
    { angle: 310, ring: 78 },
  ];
  return (
    <div className="chart-card">
      <svg viewBox="-160 -160 320 320" role="img" aria-label="Chart of lit nodes">
        <circle className="stroke" r="132" />
        {rings.map((radius) => (
          <circle key={radius} className="stroke faint" r={radius} />
        ))}
        {ticks.map((tick) => (
          <line
            key={`${tick.x2}:${tick.y2}`}
            className={tick.major ? "stroke" : "stroke faint"}
            x1={tick.x1}
            y1={tick.y1}
            x2={tick.x2}
            y2={tick.y2}
          />
        ))}
        {nodes.map((node) => {
          const angle = (node.angle * Math.PI) / 180;
          return (
            <circle
              key={`${node.angle}:${node.ring}`}
              className="lit-node"
              cx={Math.sin(angle) * node.ring}
              cy={-Math.cos(angle) * node.ring}
              r="3.5"
            />
          );
        })}
      </svg>
      <p>Lit nodes stay on this device</p>
    </div>
  );
}
