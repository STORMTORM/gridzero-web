# Site Visit Workflow Architecture (GridZero Web)

This document describes the workflow-driven feature architecture of the GridZero solar CAD editor. The project is organized directly around the **Site Visit Workflow** stages, making it easy to understand, maintain, debug, and extend.

---

## Workspace Directory Structure

All features are organized flatly under `src/features/` according to the site visit workflow sequence:

```text
src/features/
    dashboard/          # Step 1: Projects Cockpit & Workspace Dashboard
    customer/           # Step 2: Customer Profile & Discom Form Intake
    roof/               # Step 3: 2D Roof Boundaries Mapping
    obstructions/       # Step 4: 2D/3D Obstructions & Clearances
    placement/          # Step 5: Solar Module Grid Placement & Sizing
    snapshots/          # Step 6: Proposal Cover & Shadow Path Capture
    proposal/           # Step 7: Equipment & Financial Pricing Models
    shared/             # Shared hooks, types, constants, and global API layer
```

---

## Stage-by-Stage Flow & Lifecycle Data

For every stage of the workflow, this section answers the key questions:
1. **Which API does this stage call?**
2. **What does this stage load?**
3. **What does this stage edit?**
4. **What does this stage save?**
5. **What data does the next stage consume?**

---

### 1. Dashboard Stage
* **Owner**: `src/features/dashboard/`
* **API Endpoints**: `GET /visit/all` & `DELETE /visit/{id}`
* **Loads**: The list of all registered site visits (projects).
* **Edits**: Search query filter, dashboard pagination state, and project creation options.
* **Saves**: Creation of a new workspace coordinate snapshot via `POST /visit/file/upload` in `NewProjectModal`.
* **Next Stage Consumes**: The generated `sitevisit_id` is passed in routing to navigate to the customer step.

---

### 2. Customer Details Stage
* **Owner**: `src/features/customer/`
* **API Endpoints**: `GET /visit/map/{id}` & `POST /visit/map/save`
* **Loads**: Existing customer info, sanctioned electrical load, discom details, and location coordinates.
* **Edits**: Client intake parameters (billing name, utility rates, monthly tariff, peak consumption).
* **Saves**: Form values mapping directly to the database record.
* **Next Stage Consumes**: Sanctioned load capacity and location metrics are loaded into the design workspace for auto-sizing.

---

### 3. Roof Mapping Stage
* **Owner**: `src/features/roof/`
* **API Endpoints**: `GET /visit/3d/{id}` & `POST /visit/roof/create`
* **Loads**: The satellite image bounds and existing structural layout.
* **Edits**: Roof polygon vertices (in meters) and parapet height/setback safety buffer dimensions.
* **Saves**: Roof boundaries and parapet walls.
* **Next Stage Consumes**: Active roof zones (`RoofData[]`) constrain where panels and obstructions can be placed.

---

### 4. Obstructions Stage
* **Owner**: `src/features/obstructions/`
* **API Endpoints**: `GET /visit/3d/{id}` & `POST /visit/objects/create`
* **Loads**: Previously placed chimneys, trees, skylights, water tanks, and custom polygon obstruction shapes.
* **Edits**: Type, model scale height, width, rotation angle, base elevation (z_init), and roof-snapping constraints.
* **Saves**: The array of active scene obstacles (`LocalObject[]`).
* **Next Stage Consumes**: Panel placements are restricted by obstruction bounds to prevent array collisions.

---

### 5. Panel Placement Stage
* **Owner**: `src/features/placement/`
* **API Endpoints**: `GET /visit/selection/info/{id}` & `POST /visit/panels/create`
* **Loads**: Solar panel spec dimensions and active target capacity panel count.
* **Edits**: Placed panel grid structures (`PlacedPanelGroup[]`), table rotation angles, tilt, and middle pillar layouts.
* **Saves**: Panel group parameters and coordinates.
* **Next Stage Consumes**: Completed 3D module layout model is used to render simulated shadows for snapshots.

---

### 6. Snapshots Stage
* **Owner**: `src/features/snapshots/`
* **API Endpoints**: `GET /visit/snapshots/{id}` & `POST /visit/file/upload` (for image files)
* **Loads**: Existing cover frames and shadow maps.
* **Edits**: Active 3D WebGL viewport angle, camera zoom, sun height time dial.
* **Saves**: 4 high-fidelity hourly shadow maps (8 AM, 11 AM, 2 PM, 5 PM) and cover preview.
* **Next Stage Consumes**: Captured images are embedded into the PDF proposal output document.

---

### 7. Proposal Pricing Stage
* **Owner**: `src/features/shared/` & `src/pages/project/Pricing.tsx`
* **API Endpoints**: `GET /visit/proposal/{id}`, `POST /visit/proposal/save`, and `PUT /auth/profile`
* **Loads**: DC system sizing metrics, financial terms, discounts, and payment terms milestones.
* **Edits**: System pricing base cost, GST, subsidies, scaffolding fees, and payment milestone splits.
* **Saves**: Finalized system commercial pricing.
* **Next Stage Consumes**: Financial paybacks, lifetime carbon offsets, and payment schedule are compiled into the PDF report proposal.

---

## Shared Central Core

All state syncing and central operations are housed under `src/features/shared/`:
* **siteVisitApi.ts**: Wraps all `axios` endpoints into a structured class/object. No components interact with direct axios imports.
* **queryKeys.ts**: Centralizes React Query query keys (`["projects"]`, `["project", id]`, `["design", id]`) for clean, predictable cache invalidation.
* **useAutoSave.ts**: Handles silent background design auto-saving using React Query mutations, eliminating visual UI lag or reload blinkers.
