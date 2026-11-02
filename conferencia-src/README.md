# Cubômetro standalone

The React UI uses the existing AlinyFlow Supabase session and records adapter.

Build with esbuild 0.28.2, React / React DOM 19.2.6 and lucide-react 1.31.0:

```sh
esbuild conferencia-src/entry.tsx --bundle --format=esm --target=es2022 --jsx=automatic --minify --outfile=conferencia.bundle.js
```

The public Supabase client initialization is retained in conferencia-client.js. No service-role credentials are shipped.
