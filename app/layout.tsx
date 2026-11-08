import type { Metadata } from "next";
import { Courier_Prime, JetBrains_Mono, Press_Start_2P } from "next/font/google";
import { Footer } from "@/components/footer";
import { Nav } from "@/components/nav";
import "./globals.css";

const pixel = Press_Start_2P({
  weight: "400",
  variable: "--f-pixel",
  subsets: ["latin"],
  display: "swap",
});

const jetbrains = JetBrains_Mono({
  variable: "--f-jetbrains",
  subsets: ["latin"],
  display: "swap",
});

const courier = Courier_Prime({
  weight: ["400", "700"],
  variable: "--f-courier",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Arcade Vault · Portal Retro",
  description: "Portal de juegos retro: compite por puntos en el salón de la fama.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="es"
      className={`${pixel.variable} ${jetbrains.variable} ${courier.variable} h-full antialiased`}
    >
      <body>
        <div className="av-bg"></div>
        <div id="root">
          <Nav />
          <main className="av-main">{children}</main>
          <Footer />
        </div>
      </body>
    </html>
  );
}
