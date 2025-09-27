# Cloud Router

## The Problem

I have lots of services running on my home network that I want to be able to access from anywhere. At the moment, I have a manually configured nginx reverse proxy that I can't be bothered to maintain. I tried setting up an ingress controller tainted to a cloud node on my kubernetes cluster but it keeps being funny about networking. I also want this to be agnostic to the underlying infrastructure.

## Feature Set

- [ ] CLI tool to configure the router
- [ ] Connect to Tailscale
- [ ] Dashboard for viewing and configuring domains and routes
- [ ] DNS will be handled by Route53, the service will create hosted zones if needs be
- [ ] Automatically provision certificates from Let's Encrypt
- [ ] Reverse proxy each request from domain to the correct service, storing the requests in a database
- [ ] Visualise the incoming requests and responses
- [ ] Provide health checks for the services
- [ ] Alert users if a service is down
