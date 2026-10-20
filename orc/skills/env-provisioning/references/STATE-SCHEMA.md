# State contract — docker-env-state.json

Disclosed from `orc:env-provisioning`. Read at protocol step 9 (write state) and when a consumer reads the state file: the schema, the status enum, the workspace additions, and the host-fallback shape.

## State contract — `docker-env-state.json`

Lives at `.orc/<branch>/files/docker-env-state.json` (workspace-level when context=workspace; per-repo otherwise). `status` enum: `provisioning|ready|partial|failed|fallback|down`.

```json
{
  "schemaVersion": 1, "context": "repo", "status": "ready", "mode": "compose",
  "detectionRung": "existing-compose",
  "project": "orc-myapp-feat-csv-export",
  "composeFiles": ["/abs/path/docker-compose.yml"], "generatedFiles": [],
  "appUrl": "http://localhost:3000",
  "serviceEndpoints": { "app": "http://localhost:3000", "db": "postgres://localhost:5432/app_dev" },
  "services": { "app": {"container": "…-app-1", "port": 3000, "health": "healthy", "status": "running"},
                "db":  {"container": "…-db-1",  "port": 5432, "health": "healthy", "status": "running"} },
  "hostProcesses": [], "volumes": ["orc-myapp-feat-csv-export_db_data"],
  "buildInputsHash": "sha256:…", "reused": false, "bootDurationSec": 41,
  "bootstrappedAt": "…", "lastVerifiedAt": "…", "evidenceDir": ".orc/<branch>/files/env/",
  "teardownCommand": "docker compose -p orc-myapp-feat-csv-export -f /abs/path/docker-compose.yml down",
  "keepVolumesOnDown": true
}
```

Workspace context adds: `workspaceName`, `webSurfaceRepo`, `dependencyOrder` (e.g. `["db","api","ui"]`), `serviceOwners` (service → repo). Host-fallback differs only in `status: "fallback"`, `mode: "host"`, empty `services`, populated `hostProcesses[]` (`{command, pid, cwd, port, logFile}`), `teardownCommand: "kill <pid>"`.
