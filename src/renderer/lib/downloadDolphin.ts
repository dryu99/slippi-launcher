import fs from "fs-extra";
import path from "path";
import { remote } from "electron";
import { download } from "common/download";
import AdmZip from "adm-zip";
import { fetchPlayKey } from "./playkey";

const NETPLAY_PATH = path.join(remote.app.getPath("userData"), "netplay");

function getPlayKeyPath(): string {
  switch (process.platform) {
    case "win32":
      return path.join(NETPLAY_PATH, "user.json");
    default:
      throw new Error(`Unsupported OS: ${process.platform}`);
  }
}

export async function checkDolphinUpdates(): Promise<any> {
  console.log("Checking for netplay update");
  const res = await downloadLatestNetplay();
  console.log("Downloading user playkey");
  const playKey = await fetchPlayKey();
  const keyPath = getPlayKeyPath();
  const contents = JSON.stringify(playKey, null, 2);
  await fs.writeFile(keyPath, contents);
  console.log(`Wrote: ${contents} to ${keyPath}`);
  return res;
}

async function getLatestNetplayAsset(): Promise<any> {
  const owner = "project-slippi";
  const repo = "Ishiiruka";
  const release = await getLatestRelease(owner, repo);
  const asset = release.assets.find((a: any) => matchesPlatform(a.name));
  if (!asset) {
    throw new Error("Could not fetch latest release");
  }
  return asset;
}

async function getLatestRelease(owner: string, repo: string): Promise<any> {
  const url = `https://api.github.com/repos/${owner}/${repo}/releases/latest`;
  const res = await fetch(url);
  const data = await res.json();
  return data;
}

function matchesPlatform(releaseName: string): boolean {
  switch (process.platform) {
    case "win32":
      return releaseName.endsWith("Win.zip");
    case "darwin":
      return releaseName.endsWith("Mac.zip");
    case "linux":
      return releaseName.endsWith(".AppImage");
    default:
      return false;
  }
}

async function downloadLatestNetplay() {
  const asset = await getLatestNetplayAsset();
  const downloadLocation = path.join(remote.app.getPath("temp"), asset.name);
  if (!fs.existsSync(downloadLocation)) {
    console.log(
      `Downloading ${asset.browser_download_url} to ${downloadLocation}`
    );
    await download(asset.browser_download_url, downloadLocation, console.log);
    console.log(
      `Successfully downloaded ${asset.browser_download_url} to ${downloadLocation}`
    );
  } else {
    console.log(`${downloadLocation} already exists. Skipping download.`);
  }
  const extractToLocation = remote.app.getPath("userData");
  const zip = new AdmZip(downloadLocation);
  const zipEntries = zip.getEntries();

  console.log(`Extracting to: ${extractToLocation}, and renaming to netplay`);
  zip.extractAllTo(extractToLocation, true);
  const oldPath = path.join(extractToLocation, "FM-Slippi");
  const newPath = NETPLAY_PATH;
  if (await fs.pathExists(newPath)) {
    console.log(`${newPath} already exists. Deleting...`);
    await fs.remove(newPath);
  }
  await fs.rename(oldPath, newPath);
  return zipEntries;
}
