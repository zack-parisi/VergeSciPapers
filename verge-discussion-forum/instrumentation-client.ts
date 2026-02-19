import posthog from "posthog-js"


if (typeof window !== 'undefined' && process.env.NEXT_PUBLIC_POSTHOG_KEY) {
  try {
    posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY, {
      api_host: "/ingest",
      ui_host: "https://us.posthog.com",
      defaults: '2025-05-24',
      capture_exceptions: true,
      debug: process.env.NODE_ENV === "development",
    });
  } catch (error) {
    console.warn('PostHog initialization failed:', error);
  }
} else if (process.env.NODE_ENV === "development") {
  console.log('PostHog not initialized: missing NEXT_PUBLIC_POSTHOG_KEY or running on server');
}
