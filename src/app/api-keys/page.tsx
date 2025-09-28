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
import { Copy, Trash2 } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

interface ApiKey {
  id: number;
  key: string;
  name: string;
  created_at: string;
  revoked_at: string | null;
  last_used_at: string | null;
}

export default function ApiKeysPage() {
  const apiRequest = useApiRequest();
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [showGenerateForm, setShowGenerateForm] = useState(false);
  const [generateName, setGenerateName] = useState("");

  useEffect(() => {
    fetchApiKeys();
  }, []);

  const fetchApiKeys = async () => {
    try {
      const data = await apiRequest("/api_keys");
      setApiKeys(data);
    } catch (error) {
      console.error("Failed to fetch API keys:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const newKey = await apiRequest("/api_keys", {
        method: "POST",
        body: JSON.stringify({ name: generateName }),
      });
      setApiKeys([...apiKeys, newKey]);
      setGenerateName("");
      setShowGenerateForm(false);
    } catch (error) {
      console.error("Failed to generate API key:", error);
    }
  };

  const handleRevoke = async (id: number) => {
    if (!confirm("Are you sure you want to revoke this API key?")) return;
    try {
      await apiRequest(`/api_keys/${id}`, {
        method: "PUT",
        body: JSON.stringify({ revoked: true }),
      });
      fetchApiKeys();
    } catch (error) {
      console.error("Failed to revoke API key:", error);
    }
  };

  const copyToClipboard = async (key: string) => {
    await navigator.clipboard.writeText(key);
    // Show toast notification (implement later)
    alert("API key copied to clipboard!");
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading API keys...</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold">API Keys</h1>
          <Button onClick={() => setShowGenerateForm(true)}>
            Generate New Key
          </Button>
        </div>

        {/* Generate Form */}
        {showGenerateForm && (
          <Card>
            <CardHeader>
              <CardTitle>Generate API Key</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleGenerate} className="space-y-4">
                <div>
                  <Label htmlFor="key-name">Key Name</Label>
                  <Input
                    id="key-name"
                    value={generateName}
                    onChange={(e) => setGenerateName(e.target.value)}
                    placeholder="e.g., Dashboard Access"
                    required
                  />
                </div>
                <div className="flex gap-2">
                  <Button type="submit">Generate</Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setShowGenerateForm(false);
                      setGenerateName("");
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {/* API Keys Table */}
        <Card>
          <CardHeader>
            <CardTitle>API Keys</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Key (last 8 chars)</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Last Used</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {apiKeys.map((key) => (
                  <TableRow key={key.id}>
                    <TableCell className="font-medium">{key.id}</TableCell>
                    <TableCell>{key.name}</TableCell>
                    <TableCell className="font-mono text-sm">
                      <div className="flex items-center gap-2">
                        <span>****-****-****-{key.key.slice(-8)}</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => copyToClipboard(key.key)}
                          title="Copy full key"
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={key.revoked_at ? "destructive" : "default"}
                      >
                        {key.revoked_at ? "Revoked" : "Active"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {new Date(key.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      {key.last_used_at
                        ? new Date(key.last_used_at).toLocaleDateString()
                        : "Never"}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleRevoke(key.id)}
                        disabled={!!key.revoked_at}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        {key.revoked_at ? "Revoked" : "Revoke"}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {apiKeys.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                No API keys found. Generate your first API key to get started.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
