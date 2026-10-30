import React, {
  useState,
  useEffect,
  useLayoutEffect,
  useMemo,
  useCallback,
  useRef,
  useReducer,
  useContext,
  createContext,
  memo,
  forwardRef,
  Suspense,
  startTransition,
} from "react";

// Scope handed to every live-editable snippet. Covers every hook/API the
// deep-dive docs actually reference (see grep of *.md), nothing speculative.
export const liveScope = {
  React,
  useState,
  useEffect,
  useLayoutEffect,
  useMemo,
  useCallback,
  useRef,
  useReducer,
  useContext,
  createContext,
  memo,
  forwardRef,
  Suspense,
  startTransition,
};
