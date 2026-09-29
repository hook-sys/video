"use client";

import { useEffect } from "react";

// The browser's Back from a video page goes to the dashboard (not back into
// the create form): a marked copy of this entry is pushed on top; stepping
// back off it lands on the unmarked one, which forwards to /dashboard.
export function BackToDashboard() {
  useEffect(() => {
    const path = window.location.pathname;
    if (!window.history.state?.__mbTop) window.history.pushState({ ...window.history.state, __mbTop: true }, "", window.location.href);
    // A full load: the router's own popstate handling would override a soft navigation.
    const onPop = () => {
      if (window.location.pathname === path && !window.history.state?.__mbTop) window.location.replace("/dashboard");
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);
  return null;
}
