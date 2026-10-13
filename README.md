# Job Tracker

English | [简体中文](./README.zh-CN.md)

A private, single-user job-search dashboard built with Next.js and Notion. Track applications, progress events, dates, notes, links, and status changes in a focused local-style interface while keeping the source repository free of personal data.

This repository does not include any Notion credentials or personal job application data.
Each deployment uses the owner's own Notion integration and databases.

## 🖥️ Preview

### Dashboard and analytics

![Job Tracker dashboard and analytics](./docs/images/job-tracker-dashboard-demo.png)

> ⚠️ Demo data notice: All company names, job titles, application statuses, dates, and statistics shown in these screenshots are fictional AI-generated demo data created solely to demonstrate the Job Tracker interface and features. They do not represent real job applications.

### Activity and applications

![Job Tracker activity and applications](./docs/images/job-tracker-applications-demo.png)

> The companies and roles shown above are also fictional AI-generated demo data.

## Features

- Create, edit, and delete job applications.
- Import a job screenshot with DeepSeek, review the prefilled fields, and confirm before saving.
- Record progress events and automatically sync the application status.
- View application details, a timeline, filters, pagination, and job-search insights.
- Store data in two connected Notion data sources that you control.
- Protect pages and business APIs with an in-app password login and signed HttpOnly session cookie.

## Tech Stack

- Next.js 16, React 19, TypeScript
- Tailwind CSS 4
- Notion API (`@notionhq/client`)
- System font stack only; builds do not download Google Fonts

## Prerequisites

- Node.js 20 or later
- A Notion workspace where you can create integrations and data sources

## Install and run locally

```bash
git clone <your-fork-or-repository-url>
cd job-tracker
npm install
cp .env.example .env.local
```

Fill in `.env.local` with your own values, then start the app:

```bash
npm run dev
```

Open `http://localhost:3000`. You will be redirected to `/login`; enter the single server-side `JOB_TRACKER_ACCESS_PASSWORD`. No browser-native authentication prompt is used. Without this variable, protected pages and business APIs fail closed.

## AI screenshot import (optional)

Set `DEEPSEEK_API_KEY` in your server environment or local `.env.local`, then restart the app. Configure the same variable in your hosting platform when deploying. Manual entry works without this key.

Choose **+ 新增岗位 → AI 截图识别**, upload one PNG, JPEG, or WebP image (up to 10MB), then start recognition. The server calls [`deepseek-flash`](https://api-docs.deepseek.com/guides/vision) and validates the returned JSON. Screenshots are used in memory for this request and are not saved by Job Tracker. They are sent to DeepSeek, so avoid screenshots containing sensitive information.

Review and edit the existing application form before confirming. Unknown fields stay empty, including the application date. If the status is unknown, select it manually before saving. Low-confidence fields show a light reminder. Recognition never creates a Notion record on its own.

The hosting platform must accept the upload request size; a lower platform request-body limit takes precedence over the app's 10MB limit.

Run `npm test`, `npx tsc --noEmit`, and `npm run build -- --webpack` to check this integration. Tests use generated images and mocked provider/Notion responses; they do not use real credentials or verify live recognition. `tests/ui-ai-test-server.mjs` provides a localhost-only mock proxy for checking the UI against an app on port 3011 configured with a synthetic access password. Log in through the normal `/login` page.

## Notion Template (recommended)

Duplicate the ready-to-use database template into your own Notion workspace:

[Duplicate the Job Tracker Notion Template](https://rapid-acrylic-365.notion.site/Job-Tracker-Notion-Template-3d727236ee1381e9b4f2d98f2be1ebe0?source=copy_link)

The template contains no author's personal job-application data and no Notion token. Every user must create and use their own Notion integration.

1. Duplicate the Notion template into your own workspace.
2. Create your own Notion Integration.
3. Grant the integration access only to the two duplicated databases.
4. Copy the Applications and Progress Data Source IDs.
5. Copy `.env.example` to `.env.local`.
6. Fill in your own Notion token, data source IDs, and a strong access password.
7. Run `npm install` and `npm run dev`.

Do not commit `.env.local` to GitHub.

## Manual Setup and Database Schema Reference

Prefer the template above for a quick start. Use this section if you want to create the Notion data sources yourself or verify their required schema.

1. Create a Notion integration at [Notion integrations](https://www.notion.so/my-integrations) and copy its internal integration token into `NOTION_TOKEN`.
2. Create the **Applications** and **Progress** data sources described below with exactly the same property names and types.
3. Add a relation between the two data sources: `Progress.关联岗位` points to Applications, and the reciprocal Applications property is named `进度记录`.
4. Share both data sources with the integration from step 1.
5. Copy each data source ID into the matching variable in `.env.local`.
6. Choose a unique, strong password for `JOB_TRACKER_ACCESS_PASSWORD` (prefer a randomly generated password or a long random passphrase).

The project uses the following server-only environment variables:

```env
NOTION_TOKEN=your_notion_integration_token
NOTION_APPLICATIONS_DATA_SOURCE_ID=your_applications_data_source_id
NOTION_PROGRESS_DATA_SOURCE_ID=your_progress_data_source_id

JOB_TRACKER_ACCESS_PASSWORD=your_unique_strong_access_password

# Optional: AI screenshot recognition
DEEPSEEK_API_KEY=your_deepseek_api_key
```

## Required Notion data structure

Property names are part of the application contract. If a property name or type differs from the definitions below, the API may not work correctly.

### Applications data source

| Property | Notion type | Purpose |
| --- | --- | --- |
| `岗位标识` | Title | Display title for an application. |
| `公司名称` | Text | Company name. |
| `岗位名称` | Text | Role title. |
| `Base` | Text | Location or base. |
| `投递状态` | Status | Current application status. |
| `日期` | Date | Application date. |
| `备注` | Text | Private notes. |
| `官网链接` | URL | Job or company URL. |
| `JD` | Text / rich_text (optional) | Visible JD text extracted by AI; existing `职位描述`, `岗位描述`, or `Description` rich-text properties can also be reused. |
| `进度记录` | Relation | Reciprocal relation to Progress. |

Use these status options: `未投递`, `已投递`, `测评中`, `已测评`, `笔试中`, `已笔试`, `面试中`, `已挂`, and `收到offer`.

Screenshot import supports file selection, drag-and-drop, and Cmd+V / Ctrl+V image paste for PNG, JPEG, or WebP (up to 10MB). Recognition starts only after clicking the button. Unknown status/date remain null in the AI response, while the editable form defaults to “已投递” and the user's local date. JD publication/update dates are never treated as application dates. Only visible JD text is extracted, preserving line breaks; it stays editable. Normal text paste is unaffected.

Saving a nonempty JD checks the data source schema without changing it. If no supported rich-text property exists, saving stops with a message to add `JD` and retains the form; no application is created and JD is not silently discarded. Clearing JD allows saving through the original flow. Manual entry and the Progress API are unchanged.

### Progress data source

| Property | Notion type | Purpose |
| --- | --- | --- |
| `记录标题` | Title | Display title for a progress record. |
| `关联岗位` | Relation | Relation to one Applications record. |
| `公司名称` | Rollup | Roll up `公司名称` from `关联岗位`. |
| `岗位名称` | Rollup | Roll up `岗位名称` from `关联岗位`. |
| `Base` | Rollup | Roll up `Base` from `关联岗位`. |
| `事件类型` | Select | Event that occurred. |
| `阶段` | Select | Pipeline stage. |
| `事件日期` | Date | Date of the event. |
| `结果` | Select | Event result. |
| `下一步日期` | Date | Follow-up date. |
| `备注` | Text | Private notes. |
| `相关链接` | URL | Relevant URL. |

Use these select options:

- `事件类型`: `投递`, `收到测评`, `完成测评`, `收到笔试`, `完成笔试`, `收到AI面`, `完成AI面`, `收到一面`, `完成一面`, `收到二面`, `完成二面`, `收到三面`, `完成三面`, `收到HR面`, `完成HR面`, `收到Offer`, `淘汰`, `主动放弃`, `流程暂停`, `其他`.
- `阶段`: `投递`, `测评`, `笔试`, `AI面`, `面试`, `HR`, `Offer`.
- `结果`: `流程中`, `待定`, `通过`, `淘汰`, `主动放弃`, `Offer`, `流程终止`, `无结果`.

## Security notes

- Never commit `.env.local`; `.env.example` contains placeholders only and is safe to commit.
- Never use a `NEXT_PUBLIC_` prefix for the Notion token, data source IDs, access password, or DeepSeek key. Such variables are bundled into browser code.
- Grant the Notion integration access only to the two target data sources.
- Deploy production instances over HTTPS; production cookies have `Secure` enabled.
- Use a unique, strong `JOB_TRACKER_ACCESS_PASSWORD` and rotate it if you suspect exposure. This is a shared single-user gate, not a multi-user account system.

### Password login and sessions

Only `/login`, the exact login/logout POST endpoints, and framework static assets are public. Anonymous page requests redirect to `/login`; business APIs return 401 and independently validate the session in every handler. Missing or blank password configuration returns 503 rather than allowing access. No diagnostic auth endpoints are exposed.

The `job_tracker_session` cookie has `HttpOnly`, `SameSite=Lax`, `Path=/`, and a seven-day lifetime; `Secure` is always set in production. Its payload contains a version, issuance/expiry times, and a random nonce, signed with HMAC-SHA-256 using a domain-separated key derived from the current access password. Neither the password nor its hash is stored in the cookie. Password changes invalidate all old signatures once every running instance has the new environment configuration (redeploy/restart as needed). Logout clears the browser cookie; signed cookies are stateless, so a copied/stolen token remains valid until expiry or password rotation.

All login/logout and business mutation requests require an exact same-origin `Origin` header; cross-site/sibling-site Fetch Metadata is rejected. Forwarded host headers are not trusted for this decision. Non-browser API clients must send the session cookie and an `Origin` matching the request URL. Private responses are marked `private, no-store` and `CDN-Cache-Control: no-store`; do not override these with hosting/CDN caching rules.

Login allows at most 10 attempts per 15-minute window per running service instance, including valid and malformed attempts; excess requests return 429 with `Retry-After`. This limit deliberately does not trust client-supplied IP headers. It is in-memory, shared by requests in that instance, and resets on cold starts/restarts. On serverless/multi-instance deployments, add an EdgeOne/hosting-layer global rate-limit rule for `/api/auth/login` to protect against distributed brute force. This app does not provision that rule automatically.

Development (`npm run dev`) supports HTTP localhost cookies. Production uses Secure cookies even on localhost; browsers generally allow localhost as a secure-cookie exception, while non-browser clients may require an HTTPS local test or explicit cookie handling. EdgeOne supports Next.js server functions and private environment variables; configure `JOB_TRACKER_ACCESS_PASSWORD` in Production, redeploy, verify the login flow, and ensure Proxy and route handlers receive the same environment. Runtime integration on a specific production deployment must be checked there.

## Deploy

Deploy to Vercel or any platform that supports Next.js.

1. Create a new project from your fork or repository.
2. Set the Notion token, both data source IDs, and `JOB_TRACKER_ACCESS_PASSWORD` from `.env.example` in the platform's server-side environment settings. `DEEPSEEK_API_KEY` is optional unless screenshot recognition is needed. Do not mark any of these as public variables.
3. Deploy with the standard build command:

   ```bash
   npm run build
   ```

4. Confirm the deployment is served through HTTPS, then open the site and log in using the configured access password. Existing username/password auth variables are no longer used and can be removed from hosting configuration.

For self-hosting, run `npm run build` followed by `npm run start` in an HTTPS-capable environment.
