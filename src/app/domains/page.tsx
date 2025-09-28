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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface Domain {
  id: number;
  name: string;
  created_at: string;
  updated_at: string;
  // Add other domain fields as needed
}

export default function DomainsPage() {
  const apiRequest = useApiRequest();
  const [domains, setDomains] = useState<Domain[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingDomain, setEditingDomain] = useState<Domain | null>(null);
  const [formData, setFormData] = useState({ name: "" });

  useEffect(() => {
    fetchDomains();
  }, []);

  const fetchDomains = async () => {
    try {
      const data = await apiRequest("/domains");
      setDomains(data);
    } catch (error) {
      console.error("Failed to fetch domains:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiRequest("/domains", {
        method: "POST",
        body: JSON.stringify(formData),
      });
      setFormData({ name: "" });
      setShowCreateForm(false);
      fetchDomains();
    } catch (error) {
      console.error("Failed to create domain:", error);
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingDomain) return;
    try {
      await apiRequest(`/domains/${editingDomain.id}`, {
        method: "PUT",
        body: JSON.stringify(formData),
      });
      setFormData({ name: "" });
      setEditingDomain(null);
      fetchDomains();
    } catch (error) {
      console.error("Failed to update domain:", error);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to delete this domain?")) return;
    try {
      await apiRequest(`/domains/${id}`, {
        method: "DELETE",
      });
      fetchDomains();
    } catch (error) {
      console.error("Failed to delete domain:", error);
    }
  };

  const startEdit = (domain: Domain) => {
    setEditingDomain(domain);
    setFormData({ name: domain.name });
  };

  const cancelEdit = () => {
    setEditingDomain(null);
    setFormData({ name: "" });
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading domains...</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div>
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">Domains</h1>
          <Button onClick={() => setShowCreateForm(true)}>Add Domain</Button>
        </div>

        {/* Create Form */}
        {showCreateForm && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Create Domain</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCreate} className="space-y-4">
                <div>
                  <Label htmlFor="name">Domain Name</Label>
                  <Input
                    type="text"
                    id="name"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    placeholder="example.com"
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
                      setFormData({ name: "" });
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
        {editingDomain && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Edit Domain</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleUpdate} className="space-y-4">
                <div>
                  <Label htmlFor="edit-name">Domain Name</Label>
                  <Input
                    type="text"
                    id="edit-name"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
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

        {/* Domains List */}
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Domain Name</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Updated</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {domains.map((domain) => (
                <TableRow key={domain.id}>
                  <TableCell className="font-medium">{domain.id}</TableCell>
                  <TableCell>{domain.name}</TableCell>
                  <TableCell>
                    {new Date(domain.created_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    {new Date(domain.updated_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => startEdit(domain)}
                      >
                        Edit
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleDelete(domain.id)}
                      >
                        Delete
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {domains.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              No domains found. Create your first domain to get started.
            </div>
          )}
        </Card>
      </div>
    </DashboardLayout>
  );
}
