"use client";

import DashboardLayout from "@/components/dashboard-layout";
import { useApiRequest } from "@/app/api-context";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

interface Request {
  id: number;
  domain: string;
  path: string;
  method: string;
  status_code: number;
  response_time: number;
  timestamp: string;
  user_agent: string;
}

export default function RequestsPage() {
  const apiRequest = useApiRequest();
  const [requests, setRequests] = useState<Request[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState("24h"); // last 24h, 7d, 30d

  useEffect(() => {
    fetchRequests();
  }, [selectedPeriod]);

  const fetchRequests = async () => {
    try {
      const data = await apiRequest(`/requests?period=${selectedPeriod}`);
      setRequests(data);
    } catch (error) {
      console.error("Failed to fetch requests:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading requests...</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold">Requests</h1>
          <div className="flex gap-2">
            <Button
              variant={selectedPeriod === "24h" ? "default" : "outline"}
              onClick={() => setSelectedPeriod("24h")}
            >
              24h
            </Button>
            <Button
              variant={selectedPeriod === "7d" ? "default" : "outline"}
              onClick={() => setSelectedPeriod("7d")}
            >
              7d
            </Button>
            <Button
              variant={selectedPeriod === "30d" ? "default" : "outline"}
              onClick={() => setSelectedPeriod("30d")}
            >
              30d
            </Button>
          </div>
        </div>

        {/* Visualizations Placeholder */}
        <Card>
          <CardHeader>
            <CardTitle>Request Analytics</CardTitle>
            <p className="text-muted-foreground">
              Charts and graphs will show request trends, error rates, and top
              endpoints.
            </p>
          </CardHeader>
          <CardContent>
            <div className="h-64 bg-muted rounded-md flex items-center justify-center">
              <p className="text-muted-foreground">
                Chart placeholder - Total requests: {requests.length}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Requests Table */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Requests</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Domain</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead>Path</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Response Time</TableHead>
                  <TableHead>Timestamp</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {requests.slice(0, 50).map((request) => (
                  <TableRow key={request.id}>
                    <TableCell className="font-medium">{request.id}</TableCell>
                    <TableCell>{request.domain}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{request.method}</Badge>
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate">
                      {request.path}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          request.status_code >= 400 ? "destructive" : "default"
                        }
                      >
                        {request.status_code}
                      </Badge>
                    </TableCell>
                    <TableCell>{request.response_time}ms</TableCell>
                    <TableCell>
                      {new Date(request.timestamp).toLocaleString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {requests.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                No requests found. Traffic will appear here as it comes in.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
