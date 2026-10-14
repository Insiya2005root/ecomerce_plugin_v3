import React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { BlockRenderer } from './renderer/BlockRenderer';

export interface NextCmsPluginMountContract {
  mount: (element: HTMLElement, context: { block: unknown; isEditing: boolean }) => void;
  unmount: (element: HTMLElement) => void;
}

declare global {
  interface Window {
    __NEXTCMS_PLUGINS__?: Record<string, NextCmsPluginMountContract>;
  }
}

declare const __STOREFRONT_CSS__: string | undefined;

function ensureStorefrontStyles(): void {
  if (typeof document === 'undefined') return;
  const STYLE_ID = 'ecommerce-plugin-storefront-styles';
  if (document.getElementById(STYLE_ID)) return;

  const styleEl = document.createElement('style');
  styleEl.id = STYLE_ID;
  styleEl.setAttribute('data-plugin', 'ecommerce-plugin');
  styleEl.textContent = typeof __STOREFRONT_CSS__ === 'string' ? __STOREFRONT_CSS__ : '';
  document.head.appendChild(styleEl);
}

if (typeof window !== 'undefined') {
  ensureStorefrontStyles();
}

const mountedRoots = new WeakMap<HTMLElement, Root>();

export function mountStorefrontBlock(
  element: HTMLElement,
  context: { block: unknown; isEditing: boolean }
): void {
  if (!element) return;
  ensureStorefrontStyles();

  let root = mountedRoots.get(element);
  if (!root) {
    root = createRoot(element);
    mountedRoots.set(element, root);
  }

  root.render(
    <React.StrictMode>
      <BlockRenderer
        block={context?.block}
        isEditing={Boolean(context?.isEditing)}
      />
    </React.StrictMode>
  );
}

export function unmountStorefrontBlock(element: HTMLElement): void {
  if (!element) return;
  const root = mountedRoots.get(element);
  if (root) {
    root.unmount();
    mountedRoots.delete(element);
  }
}

if (typeof window !== 'undefined') {
  window.__NEXTCMS_PLUGINS__ = window.__NEXTCMS_PLUGINS__ || {};
  window.__NEXTCMS_PLUGINS__['ecommerce-plugin'] = {
    mount: mountStorefrontBlock,
    unmount: unmountStorefrontBlock,
  };
}
