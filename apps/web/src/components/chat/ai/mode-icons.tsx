import React from 'react'
import { Clapperboard, type LucideProps } from 'lucide-react'

export interface ModeIconProps extends React.SVGProps<SVGSVGElement> {
  size?: number
  className?: string
}

/** Skills as DeepTutor needs them: a hand of cards, the front one lit. */
export function SkillDeckIcon({ size = 18, className, ...props }: ModeIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      {...props}
    >
      <path d="M8.75 6.5V5.25a2 2 0 0 1 2-2h7.5a2 2 0 0 1 2 2V15.5a2 2 0 0 1-2 2h-1.5" />
      <rect x="3.75" y="6.5" width="12.75" height="14.25" rx="2.25" className="dt-duo" />
      <path
        d="M10.1 10.6c.3 1.6 1.25 2.55 2.85 2.85-1.6.3-2.55 1.25-2.85 2.85-.3-1.6-1.25-2.55-2.85-2.85 1.6-.3 2.55-1.25 2.85-2.85z"
        className="dt-duo-solid"
      />
    </svg>
  )
}

/** Every connected service: Dito at the hub, each service on its own branch. */
export function ConnectorHubIcon({ size = 18, className, ...props }: ModeIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      {...props}
    >
      <circle cx="12" cy="12.6" r="2.1" className="dt-duo-solid" />
      <circle cx="12" cy="4.2" r="2.3" className="dt-duo" />
      <circle cx="4.7" cy="16.8" r="2.3" className="dt-duo" />
      <circle cx="19.3" cy="16.8" r="2.3" className="dt-duo" />
      <path d="M12 10.1V6.9M9.85 13.85l-3.1 1.8M14.15 13.85l3.1 1.8" />
    </svg>
  )
}

/** Solve: stairs climbed one step at a time, the answer flagged at the top. */
export function SolveStepsIcon({ size = 20, className, ...props }: ModeIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      {...props}
    >
      <path d="M3 21v-4h6v-4h6V9h6v12z" className="dt-duo" />
      <path d="M17.25 9V3.5" />
      <path d="M17.25 3.5 21.5 5.4l-4.25 1.9z" className="dt-duo-solid" />
    </svg>
  )
}

/** Ask Questions: chat bubble with a question mark and solid dot. */
export function AskBackIcon({ size = 20, className, ...props }: ModeIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      {...props}
    >
      <path
        d="M5.5 3h13A2.5 2.5 0 0 1 21 5.5V15a2.5 2.5 0 0 1-2.5 2.5H12l-4.5 3.5v-3.5h-2A2.5 2.5 0 0 1 3 15V5.5A2.5 2.5 0 0 1 5.5 3z"
        className="dt-duo"
      />
      <path
        d="M9.65 8.35a2.35 2.35 0 1 1 3.525 2.035c-.72.42-1.175.9-1.175 1.6"
        strokeWidth="1.8"
      />
      <circle cx="12" cy="14.45" r="0.95" className="dt-duo-solid" stroke="none" />
    </svg>
  )
}

/** Quiz: a sheet checked as it is answered — one mark right, one open circle. */
export function QuizSheetIcon({ size = 20, className, ...props }: ModeIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      {...props}
    >
      <rect x="4" y="2.75" width="16" height="18.5" rx="3" className="dt-duo" />
      <path d="m7.25 9 1.6 1.6 3.15-3.35" strokeWidth="1.9" />
      <path d="M14.25 9h2.5" />
      <circle cx="9.4" cy="15.25" r="1.75" />
      <path d="M14.25 15.25h2.5" />
    </svg>
  )
}

/** Research: a magnifying lens with a sparkling 4-point star accent. */
export function ResearchLensIcon({ size = 20, className, ...props }: ModeIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      {...props}
    >
      <circle cx="10.5" cy="10.5" r="7.25" className="dt-duo" />
      <path d="m15.75 15.75 5 5" strokeWidth="2" />
      <path
        d="M10.5 6.4c.4 2.15 1.55 3.3 3.7 3.7-2.15.4-3.3 1.55-3.7 3.7-.4-2.15-1.55-3.3-3.7-3.7 2.15-.4 3.3-1.55 3.7-3.7z"
        className="dt-duo-solid"
        strokeLinejoin="round"
      />
    </svg>
  )
}

/** Visualize: a pie with one share drawn out and lit. */
export function VisualizeRingIcon({ size = 20, className, ...props }: ModeIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      {...props}
    >
      <path d="M11 5a8 8 0 1 0 8 8h-8z" className="dt-duo" />
      <path d="M13 3v8h8a8 8 0 0 0-8-8z" className="dt-duo-solid" />
    </svg>
  )
}

/** Video Lesson: clapperboard icon. */
export function VideoLessonIcon({ size = 20, className, ...props }: ModeIconProps) {
  return <Clapperboard size={size} className={className} strokeWidth={1.5} {...(props as LucideProps)} />
}

/** Audio Overview: a recording, voices rising and falling. */
export function AudioVoicesIcon({ size = 20, className, ...props }: ModeIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      {...props}
    >
      <rect x="2.5" y="4.75" width="19" height="14.5" rx="7.25" className="dt-duo" />
      <path d="M7 10.75v2.5M9.5 8.5v7M12 9.75v4.5M14.5 8v8M17 10.5v3" strokeWidth="1.8" />
    </svg>
  )
}

/** Math Animator: a curve set going with a play triangle. */
export function MathMotionIcon({ size = 20, className, ...props }: ModeIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      {...props}
    >
      <rect x="2.75" y="4.5" width="18.5" height="15" rx="3" className="dt-duo" />
      <path d="M5.75 12c1.25-3.5 2.5-3.5 3.75 0s2.5 3.5 3.75 0" />
      <path d="M15.75 9.6v4.8l3.75-2.4z" className="dt-duo-solid" strokeLinejoin="round" />
    </svg>
  )
}
