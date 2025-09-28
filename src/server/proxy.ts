// TODO: Implement proxy server
// Before we can do that we need to be able to load domains and certificates from the database
// Then we can populate the array of tls objects with the correct cert and key for each domain

const proxyServer = Bun.serve({
  fetch: (request: Request) => new Response("Welcome to Bun!"),
  tls: [{
    cert: Bun.file("cert.pem"),
    key: Bun.file("key.pem"),
    serverName: ""
  }],
});