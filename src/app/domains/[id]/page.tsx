"use client";

import DashboardLayout from "@/components/dashboard-layout";
import { useApiRequest } from "@/app/api-context";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
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

interface DNSRecord {
  id?: number;
  name: string;
  type: string;
  value: string;
  ttl: number;
  priority?: number;
  weight?: number;
  source?: string;
  createdAt?: string;
  updatedAt?: string;
}

export default function DomainDetailPage() {
  const apiRequest = useApiRequest();
  const params = useParams();
  const id = params?.id as string;

  const [domainName, setDomainName] = useState<string>("");
  const [records, setRecords] = useState<DNSRecord[]>([]);
  const [services, setServices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<DNSRecord | null>(null);
  const [selectedServiceId, setSelectedServiceId] = useState<number | null>(
    null
  );
  const [routePath, setRoutePath] = useState<string>("");
  const [isDedicatedSubdomain, setIsDedicatedSubdomain] = useState(true);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    fetchDomain();
    fetchServices();
  }, [id]);

  const fetchDomain = async () => {
    try {
      const domain = await apiRequest(`/domains/${id}`);
      setDomainName(domain.name);

      // DNS records are included in the domain response
      if (domain.dnsRecords) {
        setRecords(domain.dnsRecords);
      }
    } catch (e) {
      console.error("Failed to load domain", e);
    } finally {
      setLoading(false);
    }
  };

  const fetchServices = async () => {
    try {
      const s = await apiRequest(`/services`);
      setServices(s || []);
    } catch (e) {
      console.error("Failed to load services", e);
    }
  };

  const computePathFromRecord = (recordName: string, domain: string) => {
    const rn = recordName.replace(/\.$/, "");
    const d = domain.replace(/\.$/, "");
    if (rn === d) return "/";
    if (rn.endsWith(`.${d}`)) {
      return rn.slice(0, rn.length - d.length - 1); // subdomain label(s)
    }
    return rn; // fallback to full name
  };

  const openCreateDialogForRecord = (rec: DNSRecord) => {
    setSelectedRecord(rec);
    setRoutePath(computePathFromRecord(rec.name, domainName));
    setShowCreateDialog(true);
  };

  const handleCreateRoute = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRecord || !selectedServiceId) return;
    try {
      const payload = {
        domain_id: Number(id),
        service_id: Number(selectedServiceId),
        path: routePath,
        is_active: true,
        is_dedicated_subdomain: isDedicatedSubdomain,
        is_path: false,
      };
      await apiRequest(`/routes`, {
        method: "POST",
        body: JSON.stringify(payload),
      });
      setShowCreateDialog(false);
      // Optionally navigate to routes or refresh UI
      alert("Route created");
    } catch (err) {
      console.error("Failed to create route", err);
      alert("Failed to create route: " + String(err));
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading records...</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div>
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold">Domain: {domainName}</h1>
          <div>
            <Button
              onClick={() => {
                setLoading(true);
                fetchDomain();
              }}
            >
              Refresh Records
            </Button>
          </div>
        </div>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Route53 Records</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Value</TableHead>
                  <TableHead>TTL</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {records.map((r, idx) => (
                  <TableRow key={r.id || idx}>
                    <TableCell className="font-medium">{r.name}</TableCell>
                    <TableCell>{r.type}</TableCell>
                    <TableCell>{r.value}</TableCell>
                    <TableCell>{r.ttl}</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openCreateDialogForRecord(r)}
                        >
                          Create Route
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {records.length === 0 && (
              <div className="text-center py-6 text-muted-foreground">
                No records found for this hosted zone.
              </div>
            )}
          </CardContent>
        </Card>

        {/* Create Route Dialog */}
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Route from DNS Record</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreateRoute} className="space-y-4">
              <div>
                <Label>Record</Label>
                <Input readOnly value={selectedRecord?.name || ""} />
              </div>
              <div>
                <Label>Service</Label>
                <select
                  className="w-full p-2 border rounded"
                  value={selectedServiceId ?? ""}
                  onChange={(e) => setSelectedServiceId(Number(e.target.value))}
                >
                  <option value="">-- select service --</option>
                  {services.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label>Route Path</Label>
                <Input
                  value={routePath}
                  onChange={(e) => setRoutePath(e.target.value)}
                />
                <p className="text-sm text-gray-500 mt-1">
                  For subdomain routes this should be the subdomain label (e.g.{" "}
                  <code>www</code>), use <code>/</code> for apex.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <input
                  id="dedicated"
                  type="checkbox"
                  checked={isDedicatedSubdomain}
                  onChange={(e) => setIsDedicatedSubdomain(e.target.checked)}
                />
                <Label htmlFor="dedicated">Treat as dedicated subdomain</Label>
              </div>
              <div className="flex gap-2">
                <Button type="submit">Create Route</Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowCreateDialog(false)}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
