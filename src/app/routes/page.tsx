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

interface Route {
  id: number;
  domain_id: number;
  service_id: number;
  path_pattern: string;
  http_methods: string[]; // e.g., ['GET', 'POST']
  created_at: string;
  updated_at: string;
}

interface FormData {
  domain_id: string;
  service_id: string;
  path_pattern: string;
  http_methods: string[];
}

export default function RoutesPage() {
  const apiRequest = useApiRequest();
  const [routes, setRoutes] = useState<Route[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingRoute, setEditingRoute] = useState<Route | null>(null);
  const [formData, setFormData] = useState<FormData>({
    domain_id: "",
    service_id: "",
    path_pattern: "",
    http_methods: ["GET"],
  });

  useEffect(() => {
    fetchRoutes();
  }, []);

  const fetchRoutes = async () => {
    try {
      const data = await apiRequest("/routes");
      setRoutes(data);
    } catch (error) {
      console.error("Failed to fetch routes:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiRequest("/routes", {
        method: "POST",
        body: JSON.stringify(formData),
      });
      setFormData({
        domain_id: "",
        service_id: "",
        path_pattern: "",
        http_methods: ["GET"],
      });
      setShowCreateForm(false);
      fetchRoutes();
    } catch (error) {
      console.error("Failed to create route:", error);
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRoute) return;
    try {
      await apiRequest(`/routes/${editingRoute.id}`, {
        method: "PUT",
        body: JSON.stringify(formData),
      });
      setFormData({
        domain_id: "",
        service_id: "",
        path_pattern: "",
        http_methods: ["GET"],
      });
      setEditingRoute(null);
      fetchRoutes();
    } catch (error) {
      console.error("Failed to update route:", error);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to delete this route?")) return;
    try {
      await apiRequest(`/routes/${id}`, { method: "DELETE" });
      fetchRoutes();
    } catch (error) {
      console.error("Failed to delete route:", error);
    }
  };

  const startEdit = (route: Route) => {
    setEditingRoute(route);
    setFormData({
      domain_id: route.domain_id.toString(),
      service_id: route.service_id.toString(),
      path_pattern: route.path_pattern,
      http_methods: route.http_methods,
    });
  };

  const cancelEdit = () => {
    setEditingRoute(null);
    setFormData({
      domain_id: "",
      service_id: "",
      path_pattern: "",
      http_methods: ["GET"],
    });
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading routes...</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div>
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">Routes</h1>
          <Button onClick={() => setShowCreateForm(true)}>Add Route</Button>
        </div>

        {/* Create Form */}
        {showCreateForm && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Create Route</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCreate} className="space-y-4">
                <div>
                  <Label htmlFor="domain_id">Domain ID</Label>
                  <Input
                    id="domain_id"
                    type="number"
                    value={formData.domain_id}
                    onChange={(e) =>
                      setFormData({ ...formData, domain_id: e.target.value })
                    }
                    placeholder="1"
                    required
                  />
                </div>
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
                  <Label htmlFor="path_pattern">Path Pattern</Label>
                  <Input
                    id="path_pattern"
                    value={formData.path_pattern}
                    onChange={(e) =>
                      setFormData({ ...formData, path_pattern: e.target.value })
                    }
                    placeholder="/api/*"
                    required
                  />
                </div>
                <div>
                  <Label>HTTP Methods</Label>
                  <div className="flex gap-2 mt-2">
                    {["GET", "POST", "PUT", "DELETE"].map((method) => (
                      <label key={method} className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={formData.http_methods.includes(method)}
                          onChange={(e) => {
                            const newMethods = e.target.checked
                              ? [...formData.http_methods, method]
                              : formData.http_methods.filter(
                                  (m) => m !== method
                                );
                            setFormData({
                              ...formData,
                              http_methods: newMethods,
                            });
                          }}
                          className="rounded"
                        />
                        {method}
                      </label>
                    ))}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button type="submit">Create</Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setShowCreateForm(false);
                      setFormData({
                        domain_id: "",
                        service_id: "",
                        path_pattern: "",
                        http_methods: ["GET"],
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
        {editingRoute && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Edit Route</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleUpdate} className="space-y-4">
                <div>
                  <Label htmlFor="edit-domain_id">Domain ID</Label>
                  <Input
                    id="edit-domain_id"
                    type="number"
                    value={formData.domain_id}
                    onChange={(e) =>
                      setFormData({ ...formData, domain_id: e.target.value })
                    }
                    required
                  />
                </div>
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
                  <Label htmlFor="edit-path_pattern">Path Pattern</Label>
                  <Input
                    id="edit-path_pattern"
                    value={formData.path_pattern}
                    onChange={(e) =>
                      setFormData({ ...formData, path_pattern: e.target.value })
                    }
                    required
                  />
                </div>
                <div>
                  <Label>HTTP Methods</Label>
                  <div className="flex gap-2 mt-2">
                    {["GET", "POST", "PUT", "DELETE"].map((method) => (
                      <label key={method} className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={formData.http_methods.includes(method)}
                          onChange={(e) => {
                            const newMethods = e.target.checked
                              ? [...formData.http_methods, method]
                              : formData.http_methods.filter(
                                  (m) => m !== method
                                );
                            setFormData({
                              ...formData,
                              http_methods: newMethods,
                            });
                          }}
                          className="rounded"
                        />
                        {method}
                      </label>
                    ))}
                  </div>
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

        {/* Routes List */}
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Domain ID</TableHead>
                <TableHead>Service ID</TableHead>
                <TableHead>Path Pattern</TableHead>
                <TableHead>Methods</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {routes.map((route) => (
                <TableRow key={route.id}>
                  <TableCell className="font-medium">{route.id}</TableCell>
                  <TableCell>{route.domain_id}</TableCell>
                  <TableCell>{route.service_id}</TableCell>
                  <TableCell>{route.path_pattern}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {route.http_methods.map((method) => (
                        <span
                          key={method}
                          className="text-xs bg-primary/10 text-primary px-2 py-1 rounded"
                        >
                          {method}
                        </span>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>
                    {new Date(route.created_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => startEdit(route)}
                      >
                        Edit
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleDelete(route.id)}
                      >
                        Delete
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {routes.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              No routes found. Create your first route to get started.
            </div>
          )}
        </Card>
      </div>
    </DashboardLayout>
  );
}
