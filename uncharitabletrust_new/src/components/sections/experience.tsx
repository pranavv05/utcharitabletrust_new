'use client';
import { useRef } from 'react';
import { useReveal } from '@/hooks/use-reveal';
export function Experience({children}:{children:React.ReactNode}){const scope=useRef<HTMLDivElement>(null);useReveal(scope);return <div ref={scope} className="experience">{children}</div>;}
