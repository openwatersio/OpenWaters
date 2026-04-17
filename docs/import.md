# Import

Import markers, routes, and tracks from GPX files, zip archives, folders, or Garmin/Navionics data exports.

## Supported formats

| Format                 | What gets imported                                                    |
| ---------------------- | --------------------------------------------------------------------- |
| `.gpx` file            | Waypoints, routes, tracks                                             |
| `.zip` file            | Each `.gpx` and Navionics `.json` inside is imported                  |
| Folder                 | Recursively finds and imports `.gpx`, `.json`, and `.zip` files       |
| Navionics `mobile.zip` | Markers (JSON), routes (GPX), and tracks (GPX) from the Navionics app |

## How to import

There are two ways to import:

**From within the app:**

1. Open the main menu and tap **Import**.
2. Choose **Choose File** (for a single file or zip) or **Choose Folder** (for a directory of GPX files).

**From other apps (share sheet):**

Open a `.gpx` or `.zip` file in the iOS Files app, Safari, Mail, or any app that supports sharing, then choose **Open in Open Waters**. The app will open and begin importing automatically.

**During and after import:**

- You can dismiss the sheet, leave the app, or even force quit — the import will automatically resume where it left off the next time you open the app.
- Re-open the Import screen at any time to check progress or view results.
- Tap any imported record to navigate to it on the chart.
- Tap **Cancel Import** to stop a running import. Already-imported items are kept.
- Tap **Start New Import** when you're done to clear the results and import more.

## GPX compatibility

Open Waters imports standard [GPX 1.1](https://www.topografix.com/GPX/1/1/) files:

- `<wpt>` elements become **markers** (with name, description, and icon if present).
- `<rte>` elements with `<rtept>` points become **routes**.
- `<trk>` elements with `<trkseg>/<trkpt>` points become **tracks**.
- Timestamps (`<time>`) are optional. Tracks without timestamps import fine but won't show duration or speed stats.
- Speed and course from `<extensions>` are preserved when present.
- Points with invalid coordinates (outside ±90/±180) are silently skipped.
- Multiple segments (`<trkseg>`) within a single `<trk>` are flattened into one track.

## Importing from Garmin / Navionics

If you use the Navionics Boating app, you can export all your data through Garmin and import it into Open Waters.

### Request your data from Garmin

1. From a web browser, go to [Garmin Account Data Management](https://www.garmin.com/account/datamanagement/).
2. Sign in (if not already signed in).
3. Select **Export Your Data**.
4. Select **Request Data Export**.

Your request will be submitted and a download link will be emailed to you. Links are typically sent within 48 hours but can take up to 30 days.

### Import your Navionics data

The Garmin export is a large zip file containing data from all Garmin services. Your Navionics data is inside the `NAVIONICS/` folder.

1. Download and unzip the Garmin export on your computer or device.
2. Find the file `NAVIONICS/mobile.zip` inside the export.
3. Transfer `mobile.zip` to your iOS device (via AirDrop, iCloud Drive, Files app, etc.).
4. In Open Waters, go to **Import** and select `mobile.zip`.

The import will process:

- **Markers** — all your saved Navionics waypoints
- **Routes** — all your planned routes
- **Tracks** — all your recorded tracks

Depending on how much data you have, this may take a while for large collections.

## Duplicate detection

Importing the same file twice is safe — duplicates are automatically detected and skipped:

- **Markers** — skipped if the name and coordinates match an existing marker.
- **Routes** — skipped if the name, first/last points, and point count match an existing route.
- **Tracks** — skipped if the start and end timestamps match an existing track. For tracks without timestamps, the first and last recorded positions are compared instead.

Skipped records appear in the import summary marked as "Duplicate — skipped."

## Resumable imports

When you start an import, files are first copied into the app's local storage. If the app is closed or interrupted mid-import, the remaining files are automatically picked up and processed the next time you open the app. The import screen will reappear showing progress.

If the app is backgrounded during an import, iOS may grant additional processing time to continue importing in the background.

## Errors

If individual files within a zip or folder fail to parse, the import continues with the remaining files. Errors are shown in the import summary.
