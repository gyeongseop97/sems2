# SEMS 2

Sewon ESG Management System 2 is a working MVP for collecting, reviewing, and aggregating ESG activity data across Sewon affiliates and sites.

## Included in this version

- Integrated ESG performance dashboard
- Monthly Scope 1, 2, and 3 activity-data collection
- Automatic emissions calculation (`activity data × emission factor ÷ 1,000`)
- Evidence-file linkage and missing-evidence indicators
- Draft, review pending, rejected, and confirmed workflow states
- Affiliate and site collection-progress tracking
- GHG inventory and 2030 reduction-target overview
- ESG evidence-request tracker
- ESG metric catalogue and collection progress
- Emission-factor settings view
- CSV export of filtered activity data
- Responsive desktop and mobile navigation
- Browser-local demo-data persistence

## Current data model

This first version is a frontend MVP. New or edited activity records are stored in the current browser through `localStorage`. The sample records are fictional demonstration data and do not represent actual Sewon performance.

For production use, replace browser storage with the company database and connect:

1. employee and department authentication;
2. SQL Server activity-data, evidence, workflow, and audit-log tables;
3. internal file storage for evidence;
4. role-based approval and period closing;
5. SAP, utility-bill, and other source-system interfaces.

## Run locally

Requirements: Node.js 22.13 or later.

```bash
npm ci
npm run dev
```

Production validation:

```bash
npm run lint
npm test
```

## Main source files

- `app/page.tsx`: product screens, interactions, and demo data
- `app/globals.css`: responsive SEMS visual system
- `app/layout.tsx`: Korean document metadata

## Recommended next implementation phase

- SQL Server schema and stored procedures
- Login and affiliate/site/department permissions
- Evidence upload and immutable audit history
- Submission, review, rejection, confirmation, and period-lock workflow
- Excel bulk-upload validation
- Production emission-factor version management
- Scope 3 category expansion and reporting exports

## Data and security

Do not commit credentials, real employee data, confidential ESG evidence, API tokens, or production database connection strings. Configure production secrets only in the approved internal deployment environment.
