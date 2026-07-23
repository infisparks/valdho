import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "First Option Agency | Turn Clicks into Real Appointments & Sales",
  description: "We help Doctors, Manufacturers, IT Companies & Growing Businesses generate real buyers on autopilot through high-converting revenue systems.",
  keywords: "growth agency, appointment generation, patient lead system, performance marketing, B2B sales funnel",
  openGraph: {
    title: "First Option Agency - Turn Clicks into Real Appointments & Sales",
    description: "Predictable growth. Serious inquiries. Real revenue for Doctors, Manufacturers, IT Companies & Retailers.",
    type: "website",
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
      <body className="min-h-full bg-[#08080a] text-slate-100 font-sans selection:bg-amber-500 selection:text-slate-950 flex flex-col items-center justify-start">
        {children}
      </body>
    </html>
  );
}
