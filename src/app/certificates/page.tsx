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

interface Certificate {
  id: number;
  domain_id: number;
  common_name: string;
  status: "active" | "pending" | "expired" | "revoked";
  expiry_date: string;
  created_at: string;
}

export default function CertificatesPage() {
  const apiRequest = useApiRequest();
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingCert, setEditingCert] = useState<Certificate | null>(null);
  const [formData, setFormData] = useState({ domain_id: "" });

  useEffect(() => {
    fetchCertificates();
  }, []);

  const fetchCertificates = async () => {
    try {
      const data = await apiRequest("/certificates");
      setCertificates(data);
    } catch (error) {
      console.error("Failed to fetch certificates:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiRequest("/certificates", {
        method: "POST",
        body: JSON.stringify(formData),
      });
      setFormData({ domain_id: "" });
      setShowCreateForm(false);
      fetchCertificates();
    } catch (error) {
      console.error("Failed to create certificate:", error);
    }
  };

  const handleProvision = async (id: number) => {
    try {
      await apiRequest(`/certificates/${id}/provision`, { method: "POST" });
      fetchCertificates();
    } catch (error) {
      console.error("Failed to provision certificate:", error);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to delete this certificate?")) return;
    try {
      await apiRequest(`/certificates/${id}`, { method: "DELETE" });
      fetchCertificates();
    } catch (error) {
      console.error("Failed to delete certificate:", error);
    }
  };

  const startEdit = (cert: Certificate) => {
    setEditingCert(cert);
    setFormData({ domain_id: cert.domain_id.toString() });
  };

  const cancelEdit = () => {
    setEditingCert(null);
    setFormData({ domain_id: "" });
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading certificates...</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div>
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">Certificates</h1>
          <Button onClick={() => setShowCreateForm(true)}>
            Add Certificate
          </Button>
        </div>

        {/* Create Form */}
        {showCreateForm && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Create Certificate</CardTitle>
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
                <div className="flex gap-2">
                  <Button type="submit">Create</Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setShowCreateForm(false);
                      setFormData({ domain_id: "" });
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
        {editingCert && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Edit Certificate</CardTitle>
            </CardHeader>
            <CardContent>
              <form className="space-y-4">
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
                <div className="flex gap-2">
                  <Button onClick={() => handleProvision(editingCert.id)}>
                    Provision
                  </Button>
                  <Button variant="outline" onClick={cancelEdit}>
                    Cancel
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Certificates List */}
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Domain ID</TableHead>
                <TableHead>Common Name</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Expiry Date</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {certificates.map((cert) => (
                <TableRow key={cert.id}>
                  <TableCell className="font-medium">{cert.id}</TableCell>
                  <TableCell>{cert.domain_id}</TableCell>
                  <TableCell>{cert.common_name}</TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        cert.status === "active"
                          ? "default"
                          : cert.status === "expired" ||
                            cert.status === "revoked"
                          ? "destructive"
                          : "secondary"
                      }
                    >
                      {cert.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {new Date(cert.expiry_date).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    {new Date(cert.created_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => startEdit(cert)}
                      >
                        Edit
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleDelete(cert.id)}
                      >
                        Delete
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {certificates.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              No certificates found. Create your first certificate to get
              started.
            </div>
          )}
        </Card>
      </div>
    </DashboardLayout>
  );
}
