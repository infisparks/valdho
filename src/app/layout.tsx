import type { Metadata } from "next";
import "./globals.css";

const siteDomain = "https://firstoptionagency.vercel.app";
const ogImageUrl = `${siteDomain}/firstoption/whatsapp_thumbanil.png`;

export const metadata: Metadata = {
  metadataBase: new URL(siteDomain),
  title: "First Option Agency | Turn Clicks into Real Appointments & Sales",
  description:
    "We help Doctors, Manufacturers, IT Companies & Growing Businesses generate real buyers on autopilot through high-converting revenue systems.",
  keywords:
    "growth agency, appointment generation, patient lead system, performance marketing, B2B sales funnel",
  openGraph: {
    title: "First Option Agency | Turn Clicks into Real Appointments & Sales",
    description:
      "Predictable growth. Serious inquiries. Real revenue for Doctors, Manufacturers, IT Companies & Retailers.",
    url: siteDomain,
    siteName: "First Option Agency",
    images: [
      {
        url: ogImageUrl,
        width: 1200,
        height: 630,
        alt: "First Option Agency - Turn Clicks into Real Appointments & Sales",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "First Option Agency | Turn Clicks into Real Appointments & Sales",
    description:
      "Predictable growth. Serious inquiries. Real revenue for Doctors, Manufacturers, IT Companies & Retailers.",
    images: [ogImageUrl],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="scroll-smooth h-full antialiased">
      <head>
        {/* Open Graph / WhatsApp Social Preview Tags */}
        <meta property="og:type" content="website" />
        <meta property="og:url" content={siteDomain} />
        <meta property="og:site_name" content="First Option Agency" />
        <meta
          property="og:title"
          content="First Option Agency | Turn Clicks into Real Appointments & Sales"
        />
        <meta
          property="og:description"
          content="Predictable growth. Serious inquiries. Real revenue for Doctors, Manufacturers, IT Companies & Retailers."
        />
        <meta property="og:image" content={ogImageUrl} />
        <meta property="og:image:secure_url" content={ogImageUrl} />
        <meta property="og:image:type" content="image/png" />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />

        {/* Twitter Card Meta Tags */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta
          name="twitter:title"
          content="First Option Agency | Turn Clicks into Real Appointments & Sales"
        />
        <meta
          name="twitter:description"
          content="Predictable growth. Serious inquiries. Real revenue for Doctors, Manufacturers, IT Companies & Retailers."
        />
        <meta name="twitter:image" content={ogImageUrl} />

        {/* Google Fonts: Plus Jakarta Sans */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:ital,wght@0,300;0,400;0,500;0,600;0,700;0,800;0,900;1,400;1,700&display=swap"
          rel="stylesheet"
        />

        {/* FontAwesome Icons */}
        <link
          rel="stylesheet"
          href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css"
          integrity="sha512-iecdLmaskl7CVkqkXNQ/ZH/XLlvWZOJyj7Yy7tcenmpD1ypASozpmT/E0iPtmFIB46ZmdtAc9eNBvH0H/ZpiBw=="
          crossOrigin="anonymous"
          referrerPolicy="no-referrer"
        />
      </head>
      <body className="w-full min-h-full bg-[#08080a] text-slate-100 font-sans selection:bg-amber-500 selection:text-slate-950">
        {children}
      </body>
    </html>
  );
}
