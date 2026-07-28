"use client";

import React, { useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import CircuitAnimation from '@/components/CircuitAnimation';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, userData, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading) {
      if (!user) {
        router.push(`/login?redirect=${encodeURIComponent(pathname)}`);
      } else if (userData && userData.role !== "admin" && userData.role !== "super_admin") {
        router.push("/");
      }
    }
  }, [user, userData, loading, router, pathname]);

  // Loading state wrapper
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0B0510] text-white">
        <div className="text-center">
          <div className="h-12 w-12 animate-spin rounded-full border-t-2 border-b-2 border-neonPurple mx-auto"></div>
          <p className="mt-4 text-zinc-400">Đang tải cấu hình quản trị...</p>
        </div>
      </div>
    );
  }

  // Not logged in or not admin - return blank during redirection
  if (!user || (userData && userData.role !== "admin" && userData.role !== "super_admin")) {
    return null;
  }

  return (
    <div className="flex flex-col min-h-screen bg-[#0B0510] text-zinc-100 relative overflow-hidden">
      {/* Ảnh nền Mạch Điện Não Bộ */}
      <div className="absolute inset-0 bg-[url('/circuit-bg.jpg')] bg-cover bg-center bg-fixed opacity-10 pointer-events-none"></div>
      
      {/* Hiệu ứng tia điện */}
      <div className="absolute inset-0 opacity-20 pointer-events-none">
         <CircuitAnimation />
      </div>

      <Header />
      <div className="flex flex-1 max-w-7xl w-full mx-auto p-4 md:px-8 gap-6 relative">
        {/* Sidebar Navigation */}
        <aside className="w-64 hidden md:block shrink-0 border-r border-zinc-800 pr-6 py-6">
          <div className="space-y-6">
            <div>
              <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-3">Hệ Thống Admin</h2>
              <nav className="flex flex-col gap-1">
                <Link href="/admin" className="flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg hover:bg-zinc-900 transition">
                  📊 Thống kê Tổng quan
                </Link>
                <Link href="/admin/products" className="flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg hover:bg-zinc-900 transition">
                  📦 Quản lý Sản phẩm & Combo
                </Link>
                <Link href="/admin/tiers" className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-emerald-400 rounded-lg hover:bg-zinc-900 transition">
                  💎 Gói Thành Viên (Tiers)
                </Link>
                <Link href="/admin/orders" className="flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg hover:bg-zinc-900 transition">
                  💳 Giao dịch & Đơn hàng
                </Link>
                <Link href="/admin/users" className="flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg hover:bg-zinc-900 transition">
                  👥 Quản lý Người dùng
                </Link>
                <Link href="/admin/settings" className="flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg hover:bg-zinc-900 transition">
                  ⚙️ Cấu hình Hệ thống
                </Link>
              </nav>
            </div>
            <div className="border-t border-zinc-800 pt-6">
              <Link href="/hub" className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-purple-400 rounded-lg hover:bg-zinc-900 transition">
                ⚡ Quay về Hub
              </Link>
            </div>
          </div>
        </aside>

        {/* Content Body */}
        <main className="flex-1 py-6">
          {/* Mobile quick navigation navigation bar */}
          <div className="md:hidden flex gap-2 overflow-x-auto pb-4 mb-4 border-b border-zinc-800">
            <Link href="/admin" className="px-3 py-1.5 text-xs font-semibold whitespace-nowrap bg-zinc-900 rounded-lg hover:bg-zinc-800">
              📊 Thống kê
            </Link>
            <Link href="/admin/products" className="px-3 py-1.5 text-xs font-semibold whitespace-nowrap bg-zinc-900 rounded-lg hover:bg-zinc-800">
              📦 Sản phẩm
            </Link>
            <Link href="/admin/tiers" className="px-3 py-1.5 text-xs font-semibold whitespace-nowrap bg-zinc-900 text-emerald-400 rounded-lg hover:bg-zinc-800">
              💎 Gói Tiers
            </Link>
            <Link href="/admin/orders" className="px-3 py-1.5 text-xs font-semibold whitespace-nowrap bg-zinc-900 rounded-lg hover:bg-zinc-800">
              💳 Giao dịch
            </Link>
            <Link href="/admin/users" className="px-3 py-1.5 text-xs font-semibold whitespace-nowrap bg-zinc-900 rounded-lg hover:bg-zinc-800">
              👥 Người dùng
            </Link>
            <Link href="/admin/settings" className="px-3 py-1.5 text-xs font-semibold whitespace-nowrap bg-zinc-900 rounded-lg hover:bg-zinc-800">
              ⚙️ Cấu hình
            </Link>
          </div>
          {children}
        </main>
      </div>
      <div className="relative">
        <Footer />
      </div>
    </div>
  );
}
