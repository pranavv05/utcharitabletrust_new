'use client';
import {useLayoutEffect} from 'react';
export function PublicTheme(){useLayoutEffect(()=>{document.documentElement.dataset.theme='light'},[]);return null}
