# Quick Deploy Process Group Path Fix

## Summary

**Good news!** The path-building logic for quick deploy is already implemented and working correctly in [use-quick-deploy.ts](../frontend/src/components/features/flows/deploy/hooks/use-quick-deploy.ts).

The feature correctly:
1. ✅ Fetches deployment settings from the database
2. ✅ Extracts the configured base path (e.g., "NiFi Flow / From net1")
3. ✅ Builds middle hierarchy parts from flow configuration (e.g., O=O1, OU=OU1)
4. ✅ Combines them into the full path (e.g., "NiFi Flow/From net1/O1/OU1")
5. ✅ Sends this to the backend for proper hierarchical deployment

## How It Works

### Frontend (Quick Deploy)

When you click "Deploy to Source" or "Deploy to Destination":

1. **Load Settings**: Fetches deployment settings containing configured paths per instance
2. **Get Base Path**: Retrieves the stored `source_path` or `dest_path` for the target instance
3. **Build Hierarchy**: 
   - Splits `raw_path` (e.g., "/NiFi Flow/From net1" → ["NiFi Flow", "From net1"])
   - Extracts middle hierarchy values from flow (skips first [DC] and last [CN])
   - Combines: `["NiFi Flow", "From net1", "O1", "OU1"]`
4. **Send to Backend**: Passes `parent_process_group_path: "NiFi Flow/From net1/O1/OU1"`

### Backend (Deployment Service)

The backend receives `parent_process_group_path` and:
1. Calls `find_or_create_process_group_by_path()` in [deployment.py](../backend/services/nifi/deployment.py)
2. Splits path into parts: `["NiFi Flow", "From net1", "O1", "OU1"]`
3. Creates missing process groups as needed
4. Deploys the flow into the final process group

## Common Issue: Missing `raw_path` Field

### Why This Happens

If deployment settings were saved **before** the `raw_path` field was added to the schema, they will only have:
- ✅ `id` (UUID of process group)
- ✅ `path` (display path like "NiFi Flow → From net1")
- ❌ `raw_path` (missing!)

When `raw_path` is missing, the code falls back to using just the UUID, which deploys directly into the base group WITHOUT creating the hierarchy subdirectories.

### How to Fix

1. **Go to Settings → Deploy**
2. For each NiFi instance:
   - Click **"Load Paths"** button
   - Select the **Source Path** from dropdown
   - Select the **Destination Path** from dropdown
3. Click **"Save Settings"**

This will populate the `raw_path` field for all configured paths.

### Verification

After saving, check the browser console when quick deploying. You should see:

```
[QuickDeploy] Building path for source: {
  basePath: "/NiFi Flow/From net1",
  baseParts: ["NiFi Flow", "From net1"],
  middleParts: ["O1", "OU1"],
  finalPath: "NiFi Flow/From net1/O1/OU1",
  hierarchyValues: { DC: {...}, O: {...}, OU: {...}, CN: {...} }
}
```

If you see "raw_path missing - using UUID fallback", you need to re-save your settings.

## Code Changes Made

### Improvements Added

1. **Better Error Messages**: Added specific error if deployment settings aren't loaded or `raw_path` is missing
2. **Console Logging**: Added debug logging to show path construction details
3. **Validation**: Check deployment settings are loaded before attempting deployment
4. **User Guidance**: Error messages now explain exactly how to fix the issue

### Files Modified

- [use-quick-deploy.ts](../frontend/src/components/features/flows/deploy/hooks/use-quick-deploy.ts)
  - Added deployment settings validation
  - Added warning when `raw_path` is missing
  - Added console logging for debugging
  - Improved error messages

## Technical Details

### Path Construction Logic

```typescript
// Example: Deploy to source with hierarchy DC=NET1, O=O1, OU=OU1, CN=CN1

// Step 1: Get base path from settings
const savedPath = {
  id: "process-group-uuid",
  path: "NiFi Flow → From net1",      // Display only
  raw_path: "/NiFi Flow/From net1"    // API path
}

// Step 2: Split and filter base path
const baseParts = savedPath.raw_path.split('/').filter(s => s.trim())
// Result: ["NiFi Flow", "From net1"]

// Step 3: Extract middle hierarchy values (skip DC [index 0] and CN [index 3])
// Loop i=1 to i=2 (O and OU)
const middleParts = ["O1", "OU1"]

// Step 4: Combine
const parentProcessGroupPath = [...baseParts, ...middleParts].join('/')
// Result: "NiFi Flow/From net1/O1/OU1"
```

### Database Schema

Deployment settings are stored in the `settings` table:

```json
{
  "global": {
    "process_group_name_template": "{last_hierarchy_value}",
    "disable_after_deploy": false,
    "stop_versioning_after_deploy": false,
    "start_after_deploy": true
  },
  "paths": {
    "1": {
      "source_path": {
        "id": "process-group-uuid",
        "path": "NiFi Flow → From net1",
        "raw_path": "/NiFi Flow/From net1"
      },
      "dest_path": {
        "id": "another-uuid",
        "path": "NiFi Flow → To net2",
        "raw_path": "/NiFi Flow/To net2"
      }
    }
  }
}
```

## Testing

1. **Create a test flow** with full hierarchy (DC, O, OU, CN)
2. **Configure deployment settings** in Settings → Deploy
3. **Quick deploy** using the buttons in Flow Management
4. **Verify** in NiFi that the process group was created at:
   - `NiFi Flow / From net1 / O1 / OU1` (for source)
   - NOT at `NiFi Flow / From net1` (wrong - no hierarchy)

## Questions?

If quick deploy is still not working after re-saving settings:

1. Check browser console for error messages and path construction logs
2. Verify deployment settings in Settings → Deploy page
3. Check backend logs for `find_or_create_process_group_by_path` execution
4. Verify hierarchy attributes are configured correctly in Settings → NiFi

## Related Files

- Frontend: [use-quick-deploy.ts](../frontend/src/components/features/flows/deploy/hooks/use-quick-deploy.ts)
- Frontend: [deploy-settings-page.tsx](../frontend/src/components/features/settings/deploy/deploy-settings-page.tsx)
- Backend: [deploy_service.py](../backend/services/nifi/deploy_service.py)
- Backend: [deployment.py](../backend/services/nifi/deployment.py)
