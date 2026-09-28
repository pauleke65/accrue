/** A real public endpoint for Accrue's digital-work acceptance demo. */
export default {
  fetch(request) {
    if (new URL(request.url).pathname !== "/health")
      return Response.json({ error: "Not found" }, { status: 404 });
    return Response.json({ status: "ready", service: "accrue-demo-api" });
  },
};
