// Liveness only: this endpoint does not claim database readiness.
export function GET() {
  return Response.json({ status: 'ok', service: 'sidequest-content' });
}
