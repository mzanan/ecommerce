'use client';

import React from "react";
import { usePathname } from "next/navigation";
import Header from "@/components/ecommerce/layout/Header/Header";
import Footer from "@/components/ecommerce/layout/Footer/Footer";
import FloatingCartIcon from "@/components/ecommerce/layout/FloatingCartIcon/FloatingCartIcon";

export default function AppGroupLayout({ 
  children, 
}: { 
  children: React.ReactNode 
}) {
  const pathname = usePathname();
  const isHomePage = pathname === '/';

  return (
    <div className="bg-background relative min-h-screen flex flex-col w-full max-w-[100vw] overflow-x-hidden">
      <Header />
      <main className="relative flex-1 w-full overflow-x-hidden">{children}</main>
      {!isHomePage && <Footer />}
      <FloatingCartIcon />
    </div>
  );
} 