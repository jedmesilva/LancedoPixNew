import { defineConfig, type InputTransformerFn } from "orval";
import path from "path";

const root = path.resolve(__dirname, "..", "..");
const adminClientSrc = path.resolve(
  root,
  "artifacts",
  "lance-admin",
  "src",
);
const adminApiZodSrc = path.resolve(
  root,
  "artifacts",
  "api-server",
  "src",
  "routes",
  "admin",
  "generated",
);

const titleTransformer: InputTransformerFn = (config) => {
  config.info ??= {};
  config.info.title = "AdminApi";
  return config;
};

export default defineConfig({
  "lance-admin-client": {
    input: {
      target: "./admin-openapi.yaml",
      override: { transformer: titleTransformer },
    },
    output: {
      workspace: adminClientSrc,
      target: "generated",
      client: "react-query",
      mode: "split",
      baseUrl: "/api/admin",
      clean: true,
      prettier: true,
      override: {
        query: { version: 5 },
        fetch: { includeHttpResponseReturnType: false },
        mutator: {
          path: path.resolve(adminClientSrc, "custom-fetch.ts"),
          name: "customFetch",
        },
      },
    },
  },
  "lance-admin-zod": {
    input: {
      target: "./admin-openapi.yaml",
      override: { transformer: titleTransformer },
    },
    output: {
      workspace: adminApiZodSrc,
      client: "zod",
      target: "generated",
      schemas: { path: "generated/types", type: "typescript" },
      mode: "split",
      clean: true,
      prettier: true,
      override: {
        zod: {
          version: 3,
          coerce: {
            query: ["boolean", "number", "string"],
            param: ["boolean", "number", "string"],
            body: ["bigint", "date"],
            response: ["bigint", "date"],
          },
        },
        useDates: true,
        useBigInt: true,
      },
    },
  },
});
