'use client';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { usePathname } from 'next/navigation';
export function RouteTransition({ children }: { children: React.ReactNode }) { const path = usePathname(); const reduced = useReducedMotion(); return <AnimatePresence mode="wait" initial={false}><motion.div key={path} initial={reduced ? false : { opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={reduced ? undefined : { opacity: 0, y: -10 }} transition={{ duration: .4, ease: [.22,1,.36,1] }}>{children}</motion.div></AnimatePresence>; }
