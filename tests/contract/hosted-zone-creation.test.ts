import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HostedZoneCreationService } from '../../src/lib/services/hosted-zone-creation';
import { Route53ClientService } from '../../src/lib/services/route53-client';
import { DomainModel } from '../../src/lib/models/domain';
import { Database } from 'bun:sqlite';

// Mock Route53ClientService
const mockRoute53Client = {
  createHostedZone: vi.fn()
};

// Mock DomainModel
const mockDomainModel = {
  findByName: vi.fn(),
  create: vi.fn(),
  setHostedZoneId: vi.fn(),
  setDelegationStatus: vi.fn()
};

describe('HostedZoneCreationService - Bug Fix Test', () => {
  let service: HostedZoneCreationService;
  let db: Database;

  beforeEach(() => {
    // Create in-memory database for testing
    db = new Database(':memory:');

    // Create tables
    db.exec(`
      CREATE TABLE domains (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        hosted_zone_id TEXT,
        delegation_status TEXT NOT NULL DEFAULT 'pending',
        zone_created_at TEXT,
        last_synced_at TEXT,
        record_count INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    `);

    // Reset mocks
    vi.clearAllMocks();

    // Setup mock implementations
    mockRoute53Client.createHostedZone.mockResolvedValue({
      hostedZoneId: 'Z123456789',
      nameServers: ['ns1.example.com', 'ns2.example.com']
    });

    mockDomainModel.findByName.mockReturnValue(null); // No existing domain
    mockDomainModel.create.mockReturnValue(1); // Return domain ID

    // Create service with mocks
    service = new HostedZoneCreationService(
      mockRoute53Client as any,
      mockDomainModel as any
    );
  });

  it('should create hosted zone with delegation status remaining pending', async () => {
    const result = await service.createHostedZone({
      domainName: 'test.example.com'
    });

    expect(result.success).toBe(true);
    expect(result.hostedZoneId).toBe('Z123456789');
    expect(result.domainId).toBe(1);

    // Verify Route53 was called
    expect(mockRoute53Client.createHostedZone).toHaveBeenCalledWith(
      'test.example.com',
      'Cloud Router hosted zone for test.example.com'
    );

    // Verify domain was created with delegation_status: 'pending'
    expect(mockDomainModel.create).toHaveBeenCalledWith({
      name: 'test.example.com',
      hosted_zone_id: 'Z123456789',
      delegation_status: 'pending'
    });

    // Critical: Verify that setDelegationStatus('completed') was NOT called
    expect(mockDomainModel.setDelegationStatus).not.toHaveBeenCalledWith(1, 'completed');
  });

  it('should update existing domain without changing delegation status to completed', async () => {
    // Mock existing domain
    const existingDomain = {
      id: 2,
      name: 'existing.example.com',
      hosted_zone_id: null,
      delegation_status: 'pending'
    };

    mockDomainModel.findByName.mockReturnValue(existingDomain);
    mockDomainModel.setHostedZoneId.mockReturnValue(true);

    const result = await service.createHostedZone({
      domainName: 'existing.example.com'
    });

    expect(result.success).toBe(true);

    // Verify existing domain was updated
    expect(mockDomainModel.setHostedZoneId).toHaveBeenCalledWith(
      2,
      'Z123456789',
      expect.any(String)
    );

    // Critical: Verify that setDelegationStatus('completed') was NOT called
    expect(mockDomainModel.setDelegationStatus).not.toHaveBeenCalledWith(2, 'completed');
  });
});
