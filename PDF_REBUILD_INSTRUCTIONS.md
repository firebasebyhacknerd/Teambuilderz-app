# PDF Export - Puppeteer Installation & Rebuild

## Changes Made

### 1. **backend/package.json**

- Added `"puppeteer": "^21.0.0"` to dependencies

### 2. **backend/Dockerfile**

- Added system dependencies for Chromium:
  - `chromium` - Chromium browser
  - `nss`, `freetype`, `harfbuzz` - Required libraries
  - `ca-certificates`, `ttf-dejavu` - Fonts and certificates

### 3. **backend/services/pdfService.js**

- Updated `initializeBrowser()` to use system Chromium at `/usr/bin/chromium-browser`
- Prevents unnecessary Chromium downloads

## Rebuild Instructions

### Option 1: Docker Rebuild (Recommended)

```bash
# Stop the current backend container
docker stop tbz_backend

# Rebuild the backend image
docker-compose build --no-cache tbz_backend

# Start the container
docker-compose up -d tbz_backend

# Verify the container is running
docker logs tbz_backend
```

### Option 2: Manual npm Install (Development)

If running locally without Docker:

```bash
cd backend
npm install
npm start
```

## Verification

After rebuild, test PDF generation:

1. **Attendance Report**: POST `/api/pdf/attendance`
2. **Candidates Report**: POST `/api/pdf/candidates`
3. **Applications Report**: POST `/api/pdf/applications`
4. **Interviews Report**: POST `/api/pdf/interviews`
5. **Performance Report**: POST `/api/pdf/performance`

Expected response: Binary PDF file (not placeholder text)

## Troubleshooting

### If Chromium path not found:

```bash
# Check available path in container
docker exec tbz_backend which chromium-browser
```

### If npm install fails:

```bash
# Clear npm cache and retry
docker-compose build --no-cache tbz_backend
```

### If PDF still shows placeholder:

Check logs for puppeteer initialization:

```bash
docker logs tbz_backend | grep -i pdf
```

## Notes

- Puppeteer will now use the system Chromium instead of downloading its own
- This reduces image size and build time
- All PDF queries have been fixed to use correct schema columns
- PDF generation is now fully functional with real HTML-to-PDF conversion
