import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type DependencyList,
  type ReactNode,
} from 'react';
import { createRoot, type Root } from 'react-dom/client';

/**
 * Cria recursos imperativos Three.js dentro de `useEffect` e executa `dispose` somente
 * após o grafo de cena do R3F ter desanexado a instância anterior (`useLayoutEffect` pós-mutação
 * ou cleanup final de unmount). Evita vazamentos em `<React.StrictMode>` e re-upload acidental
 * de geometrias descartadas durante mudanças dinâmicas de qualidade (`useQuality`).
 */
export function useManagedDisposable<T>(
  factory: () => T,
  dispose: (resource: T) => void,
  deps: DependencyList
): T | null {
  const [resource, setResource] = useState<T | null>(null);
  const pendingDisposeRef = useRef<Set<T>>(new Set());
  const disposeFnRef = useRef(dispose);

  useLayoutEffect(() => {
    disposeFnRef.current = dispose;
  }, [dispose]);

  useEffect(() => {
    const pending = pendingDisposeRef.current;
    const created = factory();
    setResource(created);
    return () => {
      pending.add(created);
      setResource((prev) => (prev === created ? null : prev));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useLayoutEffect(() => {
    for (const item of pendingDisposeRef.current) {
      if (item !== resource) {
        pendingDisposeRef.current.delete(item);
        disposeFnRef.current(item);
      }
    }
  }, [resource]);

  useEffect(() => {
    const pending = pendingDisposeRef.current;
    return () => {
      for (const item of pending) {
        pending.delete(item);
        disposeFnRef.current(item);
      }
    };
  }, []);

  return resource;
}

/**
 * Monta um overlay HTML/SVG fora do reconciler Three.js do R3F diretamente em `document.body`,
 * desmontando e removendo o container de forma limpa ao sair da cena.
 */
export function useDomOverlay(active: boolean, content: ReactNode): void {
  const rootRef = useRef<Root | null>(null);
  const hostRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!active || typeof document === 'undefined') {
      return;
    }
    const host = document.createElement('div');
    host.dataset.brainOverlay = '1';
    document.body.appendChild(host);
    const domRoot = createRoot(host);
    hostRef.current = host;
    rootRef.current = domRoot;

    return () => {
      const toUnmount = rootRef.current;
      const toRemove = hostRef.current;
      rootRef.current = null;
      hostRef.current = null;
      queueMicrotask(() => {
        toUnmount?.unmount();
        toRemove?.remove();
      });
    };
  }, [active]);

  useEffect(() => {
    if (active && rootRef.current) {
      rootRef.current.render(content);
    }
  }, [active, content]);
}
