"use client";

import { Component, type ReactNode } from "react";

/** Shows `fallback` (a procedural model) if a 3D model fails to load. */
export class ModelBoundary extends Component<
  { fallback: ReactNode; children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    console.warn("Model failed to load; using the procedural fallback.", error);
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}
