import {
  defineRailway,
  project,
  service,
  volume,
  preserve,
  github,
} from "railway/iac";

// One dedicated FeedFix environment. Preview with `railway config plan`.
export default defineRailway(() => {
  const data = volume("feedfix-data", { region: "us-west2", sizeMB: 1024 });
  const web = service("feedfix", {
    source: github("Nubiaris-Public/FeedFix", { branch: "master" }),
    build: { builder: "DOCKERFILE", dockerfilePath: "Dockerfile" },
    healthcheck: "/api/health",
    healthcheckTimeout: 60,
    domains: ["feedfix.app"],
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
      APP_URL: "https://feedfix.app",
      SEO_INDEXABLE: "true",
      GOOGLE_SITE_VERIFICATION: preserve(),
      STRIPE_SECRET_KEY: preserve(),
      STRIPE_WEBHOOK_SECRET: preserve(),
      SCHEMA_PATH: preserve(),
      ALLOW_SYNTHETIC_FIXTURES: preserve(),
      TRUSTED_IP_HEADER: preserve(),
    },
  });
  return project("feedfix", { resources: [web, data] });
});
