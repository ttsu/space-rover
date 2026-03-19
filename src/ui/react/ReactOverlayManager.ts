import type { ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";

interface OverlayMountOptions {
  width: number;
  height: number;
}

const OVERLAY_ID = "ui-overlay";

class ReactOverlayManager {
  private root: Root | null = null;
  private overlayEl: HTMLElement | null = null;
  private stageEl: HTMLDivElement | null = null;
  private appEl: HTMLDivElement | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private cleanupResize: (() => void) | null = null;

  mount(node: ReactNode, options: OverlayMountOptions): void {
    const overlayEl = this.getOverlayEl();
    const appEl = this.getAppEl();

    overlayEl.dataset.active = "true";

    if (!this.root) {
      this.root = createRoot(appEl);
    }

    this.applyStageScale(options.width, options.height);
    this.observeResize(options.width, options.height);
    this.root.render(node);
  }

  unmount(): void {
    this.root?.render(null);
    this.overlayEl?.removeAttribute("data-active");
    this.teardownResize();
  }

  private observeResize(width: number, height: number): void {
    this.teardownResize();
    const updateScale = () => this.applyStageScale(width, height);
    updateScale();
    window.addEventListener("resize", updateScale);
    this.cleanupResize = () =>
      window.removeEventListener("resize", updateScale);
    if (typeof ResizeObserver !== "undefined" && this.overlayEl) {
      this.resizeObserver = new ResizeObserver(updateScale);
      this.resizeObserver.observe(this.overlayEl);
    }
  }

  private teardownResize(): void {
    this.cleanupResize?.();
    this.cleanupResize = null;
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
  }

  private applyStageScale(width: number, height: number): void {
    const overlayEl = this.getOverlayEl();
    const stageEl = this.getStageEl();
    const bounds = overlayEl.getBoundingClientRect();
    const scale = Math.min(bounds.width / width, bounds.height / height) || 1;
    stageEl.style.width = `${width}px`;
    stageEl.style.height = `${height}px`;
    stageEl.style.transform = `translate(-50%, -50%) scale(${scale})`;
  }

  private getOverlayEl(): HTMLElement {
    if (!this.overlayEl) {
      const overlayEl = document.getElementById(OVERLAY_ID);
      if (!overlayEl) {
        throw new Error(`Overlay element "#${OVERLAY_ID}" not found`);
      }
      this.overlayEl = overlayEl;
    }
    return this.overlayEl;
  }

  private getStageEl(): HTMLDivElement {
    if (!this.stageEl) {
      const stageEl = document.createElement("div");
      stageEl.className = "ui-overlay-stage";
      this.getOverlayEl().append(stageEl);
      this.stageEl = stageEl;
    }
    return this.stageEl;
  }

  private getAppEl(): HTMLDivElement {
    if (!this.appEl) {
      const appEl = document.createElement("div");
      appEl.className = "ui-overlay-app";
      this.getStageEl().append(appEl);
      this.appEl = appEl;
    }
    return this.appEl;
  }
}

const overlayManager = new ReactOverlayManager();

export function mountReactOverlay(
  node: ReactNode,
  options: OverlayMountOptions
): void {
  overlayManager.mount(node, options);
}

export function unmountReactOverlay(): void {
  overlayManager.unmount();
}
