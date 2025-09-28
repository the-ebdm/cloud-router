"use client";

import { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useApi } from "@/app/api-context";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const navigation = [
  { name: "Dashboard", href: "/", icon: "🏠" },
  { name: "Domains", href: "/domains", icon: "🌐" },
  { name: "Routes", href: "/routes", icon: "🛣️" },
  { name: "Services", href: "/services", icon: "⚙️" },
  { name: "Health Checks", href: "/health-checks", icon: "❤️" },
  { name: "Certificates", href: "/certificates", icon: "🔒" },
  { name: "Requests", href: "/requests", icon: "📊" },
  { name: "API Keys", href: "/api-keys", icon: "🔑" },
];

interface DashboardLayoutProps {
  children: ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const pathname = usePathname();
  const { apiKey, setApiKey } = useApi();

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Sidebar */}
      <div className="w-64 bg-white shadow-lg">
        <div className="flex flex-col h-full">
          {/* Logo/Header */}
          <div className="flex items-center justify-center h-16 px-4 bg-blue-600">
            <h1 className="text-xl font-bold text-white">Cloud Router</h1>
          </div>

          {/* API Key Input */}
          <div className="p-4 border-b space-y-2">
            <Label htmlFor="apiKey">API Key</Label>
            <Input
              type="password"
              id="apiKey"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Enter your API key"
            />
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-4 py-4 space-y-2">
            {navigation.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                    isActive
                      ? "bg-blue-100 text-blue-700"
                      : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                  }`}
                >
                  <span className="mr-3">{item.icon}</span>
                  {item.name}
                </Link>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <main className="flex-1 overflow-auto p-6">{children}</main>
      </div>
    </div>
  );
}
