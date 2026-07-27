export const FB_PIXEL_ID =
  process.env.NEXT_PUBLIC_FACEBOOK_PIXEL_ID || "1307016724814793";

declare global {
  interface Window {
    fbq: any;
    _fbq: any;
  }
}

// https://developers.facebook.com/docs/facebook-pixel/advanced/
export const pageview = () => {
  if (typeof window !== "undefined" && window.fbq) {
    window.fbq("track", "PageView");
  }
};

// Track standard Meta Pixel events (e.g. 'Lead', 'CompleteRegistration', 'Schedule', 'Contact')
export const event = (name: string, options: Record<string, any> = {}) => {
  if (typeof window !== "undefined" && window.fbq) {
    window.fbq("track", name, options);
  }
};

// Track custom Meta Pixel events
export const customEvent = (name: string, options: Record<string, any> = {}) => {
  if (typeof window !== "undefined" && window.fbq) {
    window.fbq("trackCustom", name, options);
  }
};
