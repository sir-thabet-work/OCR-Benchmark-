import { createContext, useCallback, useContext, useLayoutEffect, useRef, useState } from 'react'

/*
  One shared hover card for the whole page.

  const tip = useTip()
  <button {...tip(() => <TipCard ... />)}>
  <g {...tip(() => <TipCard ... />, (el) => el.querySelector('.mark'))}>

  Shows on mouse hover and on keyboard focus, hides on leave, blur, scroll or Escape.
  On touch screens a tap shows the card at once and a tap anywhere else hides it.
  Placed above the element, flipped below when there is no room, kept inside the viewport.
*/

const TipContext = createContext(() => ({}))
export const useTip = () => useContext(TipContext)

const GAP = 10
const EDGE = 8

export function TooltipProvider({ children }) {
  const [state, setState] = useState(null) // { el, render }
  const [pos, setPos] = useState(null) // { left, top, side, arrow }
  const boxRef = useRef(null)
  const timer = useRef(null)
  const lastTouch = useRef(0)
  const current = useRef(null)
  current.current = state

  const hide = useCallback(() => {
    clearTimeout(timer.current)
    setState(null)
    setPos(null)
  }, [])

  const show = useCallback((el, render, delay) => {
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setState({ el, render }), delay)
  }, [])

  // anchor: optional (element) => element to place the card against, e.g. a chart dot inside a group
  const tip = useCallback(
    (render, anchor) => ({
      // a tap fires mouseenter too; skip the hover delay for it
      onMouseEnter: (e) =>
        show(anchor ? anchor(e.currentTarget) : e.currentTarget, render, Date.now() - lastTouch.current < 800 ? 0 : 90),
      onMouseLeave: hide,
      onFocus: (e) => show(anchor ? anchor(e.currentTarget) : e.currentTarget, render, 0),
      onBlur: hide,
    }),
    [show, hide],
  )

  // place the card once its size is known
  useLayoutEffect(() => {
    if (!state || !boxRef.current) return
    const r = state.el.getBoundingClientRect()
    const box = boxRef.current.getBoundingClientRect()
    const vw = document.documentElement.clientWidth
    const vh = document.documentElement.clientHeight
    const cx = r.left + r.width / 2
    const left = Math.min(Math.max(cx - box.width / 2, EDGE), vw - box.width - EDGE)
    let top = r.top - box.height - GAP
    let side = 'above'
    if (top < EDGE) {
      top = Math.min(r.bottom + GAP, vh - box.height - EDGE)
      side = 'below'
    }
    const arrow = Math.min(Math.max(cx - left, 14), box.width - 14)
    setPos({ left, top, side, arrow })
  }, [state])

  // touch: remember taps, and close the card when the tap lands outside its element
  useLayoutEffect(() => {
    const onTouch = (e) => {
      lastTouch.current = Date.now()
      const s = current.current
      if (s && !s.el.contains(e.target)) hide()
    }
    document.addEventListener('touchstart', onTouch, { passive: true, capture: true })
    return () => document.removeEventListener('touchstart', onTouch, { capture: true })
  }, [hide])

  useLayoutEffect(() => {
    if (!state) return
    const onKey = (e) => e.key === 'Escape' && hide()
    window.addEventListener('scroll', hide, { passive: true, capture: true })
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('scroll', hide, { capture: true })
      window.removeEventListener('keydown', onKey)
    }
  }, [state, hide])

  return (
    <TipContext.Provider value={tip}>
      {children}
      {state && (
        <div
          ref={boxRef}
          className={`tip ${pos ? `tip-in tip-${pos.side}` : ''}`}
          role="tooltip"
          style={pos ? { left: pos.left, top: pos.top, '--arrow': `${pos.arrow}px` } : { left: -9999, top: 0 }}
        >
          {state.render()}
        </div>
      )}
    </TipContext.Provider>
  )
}

/* ---------- building blocks for the card content ---------- */

export function TipCard({ eyebrow, title, badges, children, hint }) {
  return (
    <div className="tip-card">
      {(eyebrow || badges) && (
        <div className="tip-top">
          {eyebrow && <span className="tip-eyebrow">{eyebrow}</span>}
          {badges && <span className="tip-badges">{badges}</span>}
        </div>
      )}
      {title && <div className="tip-title">{title}</div>}
      {children}
      {hint && <div className="tip-hint">{hint}</div>}
    </div>
  )
}

export function TipRows({ rows }) {
  return (
    <dl className="tip-rows">
      {rows.filter(Boolean).map(([k, v, cls]) => (
        <div key={k} className={cls}>
          <dt>{k}</dt>
          <dd>{v}</dd>
        </div>
      ))}
    </dl>
  )
}

export function TipText({ children }) {
  return <p className="tip-text">{children}</p>
}

export function TipFlags({ flags }) {
  const list = flags.filter(Boolean)
  if (!list.length) return null
  return (
    <ul className="tip-flags">
      {list.map(([level, text]) => (
        <li key={text} className={`tip-flag tip-flag-${level}`}>
          {text}
        </li>
      ))}
    </ul>
  )
}
