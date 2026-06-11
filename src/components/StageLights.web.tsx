import React, { useEffect } from "react";

const CSS_ID = "stage-lights-styles"

/**
 * 4 conical beams with apexes spread evenly across the viewport.
 * Each beam element is 28vw wide; the clip-path triangle's apex is at
 * (50%, 0), so apex_x = left + 14vw.
 * Target apexes: ~8vw, ~36vw, ~64vw, ~90vw (from left edge of viewport).
 */
const BEAMS: {left: string; duration: string; delay: string}[] = [
  {left: "0vw", duration: "9s", delay: "0s"},
  {left: "25vw", duration: "12s", delay: "-4s"},
  {left: "50vw", duration: "8.5s", delay: "-7s"},
  {left: "75vw", duration: "11s", delay: "-2.5s"},
]

const STAGE_LIGHTS_CSS = `
  @keyframes stageLightSwing {
    0%, 100% { transform: rotate(-10deg); }
    50%       { transform: rotate(10deg);  }
  }

  .stage-lights-root {
    position: fixed;
    inset: 0;
    pointer-events: none;
    z-index: 1;
    overflow: hidden;
  }

  .stage-beam {
    position: absolute;
    top: -6vh;
    width: 28vw;
    height: 100vh;
    transform-origin: 50% 0%;
    clip-path: polygon(50% 0%, 0% 100%, 100% 100%);
    background: linear-gradient(
      180deg,
      rgba(255, 252, 210, 0.07) 0%,
      rgba(255, 252, 205, 0.035) 55%,
      rgba(255, 252, 200, 0.01) 82%,
      transparent 100%
    );
    animation: stageLightSwing ease-in-out infinite;
    will-change: transform;
  }
`

export default function StageLights() {
  useEffect(() => {
    if (document.getElementById(CSS_ID)) {
      return
    }
    const styleEl = document.createElement("style")
    styleEl.id = CSS_ID
    styleEl.textContent = STAGE_LIGHTS_CSS
    document.head.appendChild(styleEl)

    return () => {
      document.getElementById(CSS_ID)?.remove()
    }
  }, [])

  return (
    <div className="stage-lights-root">
      {BEAMS.map((beam, index) => (
        <div
          key={index}
          className="stage-beam"
          style={{
            left: beam.left,
            animationDuration: beam.duration,
            animationDelay: beam.delay,
          }}
        />
      ))}
    </div>
  )
}
