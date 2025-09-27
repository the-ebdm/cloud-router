import express from "express";
import { createCertificate, getCertificateById, getAllCertificates, updateCertificate, deleteCertificate } from "@/lib/database";

const certificatesRouter = express.Router();

certificatesRouter.post('/', (req, res) => {
  try {
    const id = createCertificate(req.body);
    res.status(201).json({ id });
  } catch (error) {
    res.status(400).json({ error: 'Failed to create certificate' });
  }
});

certificatesRouter.get('/:id', (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) {
    return res.status(400).json({ error: 'Invalid ID' });
  }
  const cert = getCertificateById(id);
  if (!cert) {
    return res.status(404).json({ error: 'Certificate not found' });
  }
  res.json(cert);
});

certificatesRouter.get('/', (req, res) => {
  const certs = getAllCertificates();
  res.json(certs);
});

certificatesRouter.put('/:id', (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) {
    return res.status(400).json({ error: 'Invalid ID' });
  }
  const success = updateCertificate(id, req.body);
  if (!success) {
    return res.status(404).json({ error: 'Certificate not found or no changes' });
  }
  res.json({ message: 'Certificate updated' });
});

certificatesRouter.delete('/:id', (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) {
    return res.status(400).json({ error: 'Invalid ID' });
  }
  const success = deleteCertificate(id);
  if (!success) {
    return res.status(404).json({ error: 'Certificate not found' });
  }
  res.json({ message: 'Certificate deleted' });
});

export default certificatesRouter;
