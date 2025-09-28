"use client";

import DashboardLayout from "@/components/dashboard-layout";
import { useApi, useApiRequest } from "@/app/api-context";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface Stats {
  domains: number;
  routes: number;
  services: number;
  healthChecks: number;
  certificates: number;
  apiKeys: number;
  requests: number;
}

export default function Dashboard() {
  const { apiKey } = useApi();
  const apiRequest = useApiRequest();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!apiKey) {
      setLoading(false);
      return;
    }

    const fetchStats = async () => {
      try {
        const [
          domains,
          routes,
          services,
          healthChecks,
          certificates,
          apiKeys,
          requests,
        ] = await Promise.all([
          apiRequest("/domains"),
          apiRequest("/routes"),
          apiRequest("/services"),
          apiRequest("/health_checks"),
          apiRequest("/certificates"),
          apiRequest("/api_keys"),
          apiRequest("/requests"),
        ]);

        setStats({
          domains: Array.isArray(domains) ? domains.length : 0,
          routes: Array.isArray(routes) ? routes.length : 0,
          services: Array.isArray(services) ? services.length : 0,
          healthChecks: Array.isArray(healthChecks) ? healthChecks.length : 0,
          certificates: Array.isArray(certificates) ? certificates.length : 0,
          apiKeys: Array.isArray(apiKeys) ? apiKeys.length : 0,
          requests: Array.isArray(requests) ? requests.length : 0,
        });
      } catch (error) {
        console.error("Failed to fetch stats:", error);
      } finally {
        setLoading(false);
      }
    };

    if (stats === null) {
      fetchStats();
    }
  }, [apiKey, apiRequest]);

  if (!apiKey) {
    return (
      <DashboardLayout>
        <div className="text-center py-12">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">
            Welcome to Cloud Router
          </h1>
          <p className="text-gray-600 mb-8">
            Please enter your API key in the sidebar to get started.
          </p>
          <div className="text-sm text-gray-500">
            Use the CLI to create an API key if you don't have one yet.
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div>
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Dashboard</h1>

        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading dashboard...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            <StatCard title="Domains" value={stats?.domains || 0} icon="🌐" />
            <StatCard title="Routes" value={stats?.routes || 0} icon="🛣️" />
            <StatCard title="Services" value={stats?.services || 0} icon="⚙️" />
            <StatCard
              title="Health Checks"
              value={stats?.healthChecks || 0}
              icon="❤️"
            />
            <StatCard
              title="Certificates"
              value={stats?.certificates || 0}
              icon="🔒"
            />
            <StatCard title="API Keys" value={stats?.apiKeys || 0} icon="🔑" />
            <StatCard title="Requests" value={stats?.requests || 0} icon="📊" />
          </div>
        )}

        <div className="mt-12">
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">
            Quick Actions
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <ActionCard
              title="Add Domain"
              description="Configure a new domain for routing"
              href="/domains"
              action="Create"
            />
            <ActionCard
              title="Add Service"
              description="Register a new backend service"
              href="/services"
              action="Create"
            />
            <ActionCard
              title="Add Route"
              description="Set up routing rules"
              href="/routes"
              action="Create"
            />
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

function StatCard({
  title,
  value,
  icon,
}: {
  title: string;
  value: number;
  icon: string;
}) {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center">
          <div className="text-2xl mr-4">{icon}</div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p className="text-3xl font-bold">{value}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ActionCard({
  title,
  description,
  href,
  action,
}: {
  title: string;
  description: string;
  href: string;
  action: string;
}) {
  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground mb-4">{description}</p>
        <Button asChild>
          <a href={href}>{action}</a>
        </Button>
      </CardContent>
    </Card>
  );
}
