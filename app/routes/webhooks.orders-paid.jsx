// Redundant webhook endpoint. Consolidated into app/routes/webhooks.tsx
export const action = async () => {
  return new Response("Consolidated into webhooks.tsx", { status: 410 });
};
