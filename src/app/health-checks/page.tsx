"use client";

import DashboardLayout from "@/components/dashboard-layout";
import { useApiRequest } from "@/app/api-context";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

interface HealthCheck {
  id: number;
  service_id: number;
  url: string;
  interval: number; // seconds
  timeout: number; // seconds
  status: "healthy" | "unhealthy" | "unknown";
  created_at: string;
  updated_at: string;
}

interface HealthCheckInvocation {
  id: number;
  health_check_id: number;
  status_code: number;
  response_time: number;
  timestamp: string;
  success: boolean;
}

export default function HealthChecksPage() {
  const apiRequest = useApiRequest();
  const [healthChecks, setHealthChecks] = useState<HealthCheck[]>([]);
  const [invocations, setInvocations] = useState<HealthCheckInvocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingCheck, setEditingCheck] = useState<HealthCheck | null>(null);
  const [formData, setFormData] = useState({
    service_id: "",
    url: "",
    interval: "60",
    timeout: "5",
  });
  const [selectedCheckId, setSelectedCheckId] = useState<number | null>(null);

  useEffect(() => {
    fetchHealthChecks();
  }, []);

  const fetchHealthChecks = async () => {
    try {
      const data = await apiRequest("/health_checks");
      setHealthChecks(data);
    } catch (error) {
      console.error("Failed to fetch health checks:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchInvocations = async (checkId: number) => {
    try {
      const data = await apiRequest(
        `/health_check_invocations?health_check_id=${checkId}`
      );
      setInvocations(data);
    } catch (error) {
      console.error("Failed to fetch invocations:", error);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiRequest("/health_checks", {
        method: "POST",
        body: JSON.stringify(formData),
      });
      setFormData({ service_id: "", url: "", interval: "60", timeout: "5" });
      setShowCreateForm(false);
      fetchHealthChecks();
    } catch (error) {
      console.error("Failed to create health check:", error);
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCheck) return;
    try {
      await apiRequest(`/health_checks/${editingCheck.id}`, {
        method: "PUT",
        body: JSON.stringify(formData),
      });
      setFormData({ service_id: "", url: "", interval: "60", timeout: "5" });
      setEditingCheck(null);
      fetchHealthChecks();
    } catch (error) {
      console.error("Failed to update health check:", error);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to delete this health check?")) return;
    try {
      await apiRequest(`/health_checks/${id}`, { method: "DELETE" });
      fetchHealthChecks();
    } catch (error) {
      console.error("Failed to delete health check:", error);
    }
  };

  const startEdit = (check: HealthCheck) => {
    setEditingCheck(check);
    setFormData({
      service_id: check.service_id.toString(),
      url: check.url,
      interval: check.interval.toString(),
      timeout: check.timeout.toString(),
    });
  };

  const cancelEdit = () => {
    setEditingCheck(null);
    setFormData({ service_id: "", url: "", interval: "60", timeout: "5" });
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading health checks...</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold">Health Checks</h1>
          <Button onClick={() => setShowCreateForm(true)}>
            Add Health Check
          </Button>
        </div>

        {/* Create Form */}
        {showCreateForm && (
          <Card>
            <CardHeader>
              <CardTitle>Create Health Check</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCreate} className="space-y-4">
                <div>
                  <Label htmlFor="service_id">Service ID</Label>
                  <Input
                    id="service_id"
                    type="number"
                    value={formData.service_id}
                    onChange={(e) =>
                      setFormData({ ...formData, service_id: e.target.value })
                    }
                    placeholder="1"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="url">Health Check URL</Label>
                  <Input
                    id="url"
                    type="url"
                    value={formData.url}
                    onChange={(e) =>
                      setFormData({ ...formData, url: e.target.value })
                    }
                    placeholder="http://service.example.com/health"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="interval">Interval (seconds)</Label>
                  <Input
                    id="interval"
                    type="number"
                    value={formData.interval}
                    onChange={(e) =>
                      setFormData({ ...formData, interval: e.target.value })
                    }
                    placeholder="60"
                    min="10"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="timeout">Timeout (seconds)</Label>
                  <Input
                    id="timeout"
                    type="number"
                    value={formData.timeout}
                    onChange={(e) =>
                      setFormData({ ...formData, timeout: e.target.value })
                    }
                    placeholder="5"
                    min="1"
                    max="30"
                    required
                  />
                </div>
                <div className="flex gap-2">
                  <Button type="submit">Create</Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setShowCreateForm(false);
                      setFormData({
                        service_id: "",
                        url: "",
                        interval: "60",
                        timeout: "5",
                      });
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Edit Form */}
        {editingCheck && (
          <Card>
            <CardHeader>
              <CardTitle>Edit Health Check</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleUpdate} className="space-y-4">
                <div>
                  <Label htmlFor="edit-service_id">Service ID</Label>
                  <Input
                    id="edit-service_id"
                    type="number"
                    value={formData.service_id}
                    onChange={(e) =>
                      setFormData({ ...formData, service_id: e.target.value })
                    }
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="edit-url">Health Check URL</Label>
                  <Input
                    id="edit-url"
                    type="url"
                    value={formData.url}
                    onChange={(e) =>
                      setFormData({ ...formData, url: e.target.value })
                    }
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="edit-interval">Interval (seconds)</Label>
                  <Input
                    id="edit-interval"
                    type="number"
                    value={formData.interval}
                    onChange={(e) =>
                      setFormData({ ...formData, interval: e.target.value })
                    }
                    min="10"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="edit-timeout">Timeout (seconds)</Label>
                  <Input
                    id="edit-timeout"
                    type="number"
                    value={formData.timeout}
                    onChange={(e) =>
                      setFormData({ ...formData, timeout: e.target.value })
                    }
                    min="1"
                    max="30"
                    required
                  />
                </div>
                <div className="flex gap-2">
                  <Button type="submit">Update</Button>
                  <Button type="button" variant="outline" onClick={cancelEdit}>
                    Cancel
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Health Checks List */}
        <Card>
          <CardHeader>
            <CardTitle>Health Checks</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Service ID</TableHead>
                  <TableHead>URL</TableHead>
                  <TableHead>Interval</TableHead>
                  <TableHead>Timeout</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {healthChecks.map((check) => (
                  <TableRow key={check.id}>
                    <TableCell className="font-medium">{check.id}</TableCell>
                    <TableCell>{check.service_id}</TableCell>
                    <TableCell className="max-w-[200px] truncate">
                      <a
                        href={check.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline"
                      >
                        {check.url}
                      </a>
                    </TableCell>
                    <TableCell>{check.interval}s</TableCell>
                    <TableCell>{check.timeout}s</TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          check.status === "healthy"
                            ? "default"
                            : check.status === "unhealthy"
                            ? "destructive"
                            : "secondary"
                        }
                      >
                        {check.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {new Date(check.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedCheckId(check.id);
                            fetchInvocations(check.id);
                          }}
                        >
                          View Invocations
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => startEdit(check)}
                        >
                          Edit
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleDelete(check.id)}
                        >
                          Delete
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {healthChecks.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                No health checks found. Create your first health check to get
                started.
              </div>
            )}
          </CardContent>
        </Card>

        {/* Invocations Table */}
        {selectedCheckId && (
          <Card>
            <CardHeader>
              <CardTitle>Recent Invocations</CardTitle>
              <Button
                onClick={() => setSelectedCheckId(null)}
                variant="outline"
              >
                Back to Health Checks
              </Button>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>Status Code</TableHead>
                    <TableHead>Response Time</TableHead>
                    <TableHead>Success</TableHead>
                    <TableHead>Timestamp</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invocations.map((inv) => (
                    <TableRow key={inv.id}>
                      <TableCell>{inv.id}</TableCell>
                      <TableCell>{inv.status_code}</TableCell>
                      <TableCell>{inv.response_time}ms</TableCell>
                      <TableCell>
                        <Badge
                          variant={inv.success ? "default" : "destructive"}
                        >
                          {inv.success ? "Success" : "Failed"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {new Date(inv.timestamp).toLocaleString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {invocations.length === 0 && (
                <div className="text-center py-12 text-muted-foreground">
                  No invocations yet. The health check will start running soon.
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
