import { defineRailway, project, service, volume, preserve } from "railway/iac";

// One dedicated FeedFix environment. Preview with `railway config plan`.
export default defineRailway(() => {
  const data = volume("feedfix-data", { region: "us-west2", sizeMB: 1024 });
  const web = service("feedfix", {
    build: { builder: "DOCKERFILE", dockerfilePath: "Dockerfile" },
    healthcheck: "/api/health",
    healthcheckTimeout: 60,
    replicas: { "us-west2": 1 },
    deploy: {
      sleepApplication: false,
      requiredMountPath: "/data",
      overlapSeconds: 0,
      restartPolicyType: "ON_FAILURE",
      restartPolicyMaxRetries: 10,
    },
    volumeMounts: { "/data": data },
    env: {
      NODE_ENV: "production",
      TEMP_STORE_DIR: "/data/feedfix",
      USAGE_LOG_PATH: "/data/metrics/usage.json",
      FILE_TTL_MINUTES: "59",
      MAX_UPLOAD_MB: "25",
      PAYMENT_MODE: "stripe",
      STRIPE_PRICE_AMOUNT: "499",
      ANALYTICS_ENABLED: "true",
      APP_URL: preserve(),
      STRIPE_SECRET_KEY: preserve(),
      STRIPE_WEBHOOK_SECRET: preserve(),
      SCHEMA_PATH: preserve(),
      ALLOW_SYNTHETIC_FIXTURES: preserve(),
      TRUSTED_IP_HEADER: preserve(),
    },
  });
  return project("feedfix", { resources: [web, data] });
});
