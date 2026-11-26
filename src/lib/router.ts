import { useEffect, useState } from "react";

export interface RouteState {
  path: string;
  parts: string[];
  navigate: (to: string, options?: { replace?: boolean }) => void;
}

function readPath(): string {
  const raw = window.location.hash.replace(/^#/, "");
  if (!raw) return "/";
  return raw.startsWith("/") ? raw : `/${raw}`;
}

/** Tiny hash router — invitation links look like `…/#/join/ABC123`. */
export function useRoute(): RouteState {
  const [path, setPath] = useState<string>(readPath);

  useEffect(() => {
    const onChange = () => setPath(readPath());
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);

  const navigate = (to: string, options?: { replace?: boolean }) => {
    const target = `#${to.startsWith("/") ? to : `/${to}`}`;
    if (options?.replace) {
      window.history.replaceState(null, "", target);
      setPath(readPath());
      return;
    }
    if (window.location.hash === target) {
      setPath(readPath());
      return;
    }
    window.location.hash = target;
  };

  return { path, parts: path.split("/").filter(Boolean), navigate };
}
