import React from 'react'

export type StarterIcon = React.ComponentType<React.SVGProps<SVGSVGElement>>

type Shape = readonly [tag: 'path' | 'circle' | 'rect', attrs: Record<string, string>]

function createMark(displayName: string, shapes: readonly Shape[]): StarterIcon {
  const Mark: StarterIcon = (props) =>
    React.createElement(
      'svg',
      {
        width: 16,
        height: 16,
        viewBox: '0 0 16 16',
        fill: 'none',
        stroke: 'currentColor',
        strokeWidth: 1.2,
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
        'aria-hidden': 'true',
        ...props
      },
      shapes.map(([tag, attrs], index) => React.createElement(tag, { key: index, ...attrs }))
    )
  Mark.displayName = displayName
  return Mark
}

/** Explain: a bulb, lit by an idea. */
export const ExplainMark = createMark('ExplainMark', [
  ['path', { d: 'M5.5 11.5v-1.25c0-.55-.3-1-.75-1.5a4.25 4.25 0 1 1 6.5 0c-.45.5-.75.95-.75 1.5v1.25z' }],
  ['path', { d: 'M6.5 13.5h3' }]
])

/** Solve: the root sign over an unknown. */
export const SolveMark = createMark('SolveMark', [
  ['path', { d: 'M1.5 8.5h1.75l2.25 5 3.25-11h5.75' }],
  ['path', { d: 'M10 6.5l3.5 4.5M13.5 6.5 10 11' }]
])

/** Practice: a list of items, one done, one to do. */
export const PracticeMark = createMark('PracticeMark', [
  ['path', { d: 'M2.25 4.25l1.5 1.5 2.75-3' }],
  ['rect', { x: '2.5', y: '9.5', width: '4', height: '4', rx: '1.25' }],
  ['path', { d: 'M9.5 4.5h4.5M9.5 11.5h4.5' }]
])

/** Plan: a folded map, the way laid out in panels. */
export const PlanMark = createMark('PlanMark', [
  ['path', { d: 'M1.5 4.25 5.5 2.5l5 1.75 4-1.75V12l-4 1.75L5.5 12l-4 1.75z' }],
  ['path', { d: 'M5.5 2.5V12M10.5 4.25v9.5' }]
])

/** Research: a page under the glass. */
export const ResearchMark = createMark('ResearchMark', [
  ['path', { d: 'M6.5 14.5h-3a1 1 0 0 1-1-1v-11a1 1 0 0 1 1-1h7a1 1 0 0 1 1 1v4.5' }],
  ['path', { d: 'M5 4.5h4M5 7.5h2.5' }],
  ['circle', { cx: '11', cy: '11', r: '2.5' }],
  ['path', { d: 'M12.85 12.85 14.5 14.5' }]
])

/** Explore / Compass: Ideas for you */
export const ExploreNextMark = createMark('ExploreNextMark', [
  ['circle', { cx: '8', cy: '8', r: '6.5' }],
  ['path', { d: 'M11.2 4.8 9.1 9.1 6.9 6.9z' }],
  ['path', { d: 'M4.8 11.2l2.1-4.3 2.2 2.2z' }]
])

