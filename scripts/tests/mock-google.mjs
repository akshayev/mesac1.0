// Test-only stand-in for the Google APIs used by scripts/drive-index.mjs and scripts/sheet-sync.mjs.
// Not shipped: nothing under src/ imports it. Started by scripts/tests/realpath.test.mjs.
//
// Drive v3 (base URL = `${url}/drive/v3`):
//   GET /files?q='<folderId>' in parents&key=...      paginated (2 items per page, nextPageToken)
//   GET /files/<id>?alt=media&key=...                 file bytes
// Sheets: GET /sheets/<tab>.csv                        configurable status/body per tab
//
// Every request is recorded in `requests` so tests can check query strings and headers.

import { createServer } from "node:http";

const MB = 1024 * 1024;
const FOLDER = "application/vnd.google-apps.folder";
const PDF = "application/pdf";

/** Ids reused from scripts/fixtures/drive-sample.json so fixture and crawl output can be compared. */
export const IDS = {
  root: "ROOTfolder000001",
  thermalNov2021: "1M6LYe8EM_TwnN3VSuo2hhMwJmZI2_wta", // small PDF, mirrored
  thermalJan2023: "1sfqxp6wbhARpQUntqKhFbd1Nfg9ZC6oI", // listed as 25 MB, never downloaded
  quota: "QUOTAfile0000001", // download answers 403 downloadQuotaExceeded
  keyed: "RKFILE00000001", // needs its resource key header to download
  googleDoc: "DOCfile00000001",
  shortcut: "SHORTCUT0000001",
  dataBook: "DBFILE000000001", // hidden kind (reference), must never be downloaded
  thermalFolder: "FOLDERthermal01", // needs its resource key header to list
};

export const RESOURCE_KEYS = {
  [IDS.thermalFolder]: "rk-thermal-folder",
  [IDS.keyed]: "rk-keyed-file",
};

function defaultTree() {
  const f = (id, name, extra = {}) => ({
    id,
    name,
    mimeType: PDF,
    size: "85051",
    modifiedTime: "2025-01-01T00:00:00.000Z",
    owners: [{ emailAddress: "mesacusatacademy@gmail.com" }],
    ...extra,
  });
  const dir = (id, name, extra = {}) => ({ id, name, mimeType: FOLDER, ...extra });
  return {
    [IDS.root]: [dir("FOLDERs1to8x01", "S1-8")],
    FOLDERs1to8x01: [dir("FOLDERsem5xx01", "S5"), dir("FOLDERsem7xx01", "S7")],
    FOLDERsem5xx01: [dir("FOLDERpyq5xx01", "PYQ")],
    FOLDERpyq5xx01: [
      dir(IDS.thermalFolder, "Thermal Engineering", {
        resourceKey: RESOURCE_KEYS[IDS.thermalFolder],
      }),
    ],
    [IDS.thermalFolder]: [dir("FOLDERscheme201", "2019 scheme")],
    FOLDERscheme201: [
      f(IDS.thermalNov2021, "Thermal Engineering 2021 Nov (2019 Ad).pdf"),
      f(IDS.thermalJan2023, "Thermal Engineering 2023 Janu  (2019 Ad).pdf", {
        size: String(25 * MB),
      }),
      f(IDS.quota, "Thermal Engineering 2022 Sept (2019 Ad).pdf"),
      f(IDS.keyed, "Thermal Engineering 2024 June (2019 Ad).pdf", {
        resourceKey: RESOURCE_KEYS[IDS.keyed],
      }),
      {
        id: IDS.googleDoc,
        name: "Thermal notes",
        mimeType: "application/vnd.google-apps.document",
      },
      {
        id: IDS.shortcut,
        name: "Shortcut to papers",
        mimeType: "application/vnd.google-apps.shortcut",
      },
      f("../../etc/evil", "Evil.pdf"),
    ],
    FOLDERsem7xx01: [dir("FOLDERdatabook1", "Data Book")],
    FOLDERdatabook1: [f(IDS.dataBook, "Refrigeration Data Book.pdf", { size: "1000" })],
  };
}

/**
 * options.apiKey     key every Drive request must carry (400 keyInvalid otherwise)
 * options.empty      the root folder is empty
 * options.broken     an extra folder whose listing always returns 500
 */
export async function startMockGoogle(options = {}) {
  const tree = defaultTree();
  if (options.empty) tree[IDS.root] = [];
  if (options.broken) {
    tree[IDS.root].push({ id: "FOLDERbroken001", name: "Broken", mimeType: FOLDER });
  }

  const state = {
    tree,
    /** Listings that fail once before succeeding: folderId -> HTTP status */
    failOnce: new Map([
      ["FOLDERpyq5xx01", 403],
      ["FOLDERsem5xx01", 500],
    ]),
    alwaysFail: new Set(options.broken ? ["FOLDERbroken001"] : []),
    downloads: new Map(), // id -> count of successful downloads
    sheets: {}, // tab -> { status, body, type }
  };
  const requests = [];

  const send = (res, status, body, type = "application/json") => {
    res.writeHead(status, { "content-type": type });
    res.end(typeof body === "string" || Buffer.isBuffer(body) ? body : JSON.stringify(body));
  };
  const driveError = (res, status, reason) =>
    send(res, status, { error: { code: status, errors: [{ reason }], message: reason } });

  const findFile = (id) =>
    Object.values(state.tree)
      .flat()
      .find((x) => x.id === id);
  const hasResourceKey = (req, id) =>
    String(req.headers["x-goog-drive-resource-keys"] ?? "")
      .split(",")
      .includes(`${id}/${RESOURCE_KEYS[id]}`);

  const server = createServer((req, res) => {
    const url = new URL(req.url, "http://mock");
    requests.push({
      method: req.method,
      path: url.pathname,
      query: Object.fromEntries(url.searchParams),
      headers: { ...req.headers },
    });

    // ---- Sheets ----
    const sheet = /^\/sheets\/([a-z]+)\.csv$/.exec(url.pathname);
    if (sheet) {
      const cfg = state.sheets[sheet[1]];
      if (!cfg) return send(res, 404, "not found", "text/plain");
      return send(res, cfg.status ?? 200, cfg.body ?? "", cfg.type ?? "text/csv");
    }

    // ---- Drive ----
    if (!url.pathname.startsWith("/drive/v3/")) return send(res, 404, "not found", "text/plain");
    if (options.apiKey && url.searchParams.get("key") !== options.apiKey) {
      return driveError(res, 400, "keyInvalid");
    }

    if (url.pathname === "/drive/v3/files") {
      const parent = /'([^']+)' in parents/.exec(url.searchParams.get("q") ?? "")?.[1];
      if (state.alwaysFail.has(parent)) return driveError(res, 500, "backendError");
      if (!parent || !(parent in state.tree)) return driveError(res, 404, "notFound");
      if (state.failOnce.has(parent)) {
        const status = state.failOnce.get(parent);
        state.failOnce.delete(parent);
        return driveError(res, status, status === 403 ? "rateLimitExceeded" : "backendError");
      }
      if (RESOURCE_KEYS[parent] && !hasResourceKey(req, parent)) {
        return driveError(res, 404, "notFound");
      }
      const all = state.tree[parent];
      const start = Number(url.searchParams.get("pageToken") || 0);
      const page = all.slice(start, start + 2);
      const body = { files: page };
      if (start + 2 < all.length) body.nextPageToken = String(start + 2);
      return send(res, 200, body);
    }

    const media = /^\/drive\/v3\/files\/([^/]+)$/.exec(url.pathname);
    if (media && url.searchParams.get("alt") === "media") {
      const id = decodeURIComponent(media[1]);
      const file = findFile(id);
      if (!file || file.mimeType === FOLDER) return driveError(res, 404, "notFound");
      if (id === IDS.quota) return driveError(res, 403, "downloadQuotaExceeded");
      if (RESOURCE_KEYS[id] && !hasResourceKey(req, id)) return driveError(res, 404, "notFound");
      state.downloads.set(id, (state.downloads.get(id) ?? 0) + 1);
      return send(res, 200, `%PDF-1.4\n% mock ${id} ${file.modifiedTime}\n%%EOF\n`, PDF);
    }

    return driveError(res, 404, "notFound");
  });

  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const { port } = server.address();
  const url = `http://127.0.0.1:${port}`;
  return {
    url,
    driveBase: `${url}/drive/v3`,
    sheetUrl: (tab) => `${url}/sheets/${tab}.csv`,
    state,
    requests,
    close: () => new Promise((r) => server.close(r)),
  };
}
