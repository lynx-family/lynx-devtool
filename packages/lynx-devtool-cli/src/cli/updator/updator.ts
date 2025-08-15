// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/* eslint-disable max-depth */
import fs, { copyFileSync } from "node:fs";
import path from "node:path";
import { defaultLogger } from "../../utils";
import { LDT_DIR, UPDATOR_DEFAULT_CHANNEL } from "../utils";
import { CliOptions } from "../../config";
import {
  kCliPackageName,
  kScopeName,
  kWebPackageName,
} from "@lynx-js/lynx-devtool-utils";
import { app } from "electron";
import asar from "asar";
import { electron } from "node:process";

type Channel = string;

export function getCurrentChannel() {
  return currentChannel;
}

function copyDir(src: string, dest: string) {
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }
  const entries = fs.readdirSync(src);
  for (const entry of entries) {
    const srcPath = path.join(src, entry);
    const destPath = path.join(dest, entry);
    const stat = fs.statSync(srcPath);
    if (stat.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

export const RES_READY_FLAG = "RES_READY_FLAG";

export type UpdateResult = {
  state: boolean;
  url?: string;
  toolkit?: any;
  versionInUse?: string;
};

let currentChannel = UPDATOR_DEFAULT_CHANNEL;

function getLocalDistPath() {
  const bundlePath = getAssetsBundlePath(currentChannel);
  const cliPath = path.resolve(bundlePath);
  
  if (!fs.existsSync(cliPath)) {
    defaultLogger.error(`Looking for CLI at: ${cliPath}`);
    defaultLogger.error(`Current directory: ${process.cwd()}`);
    throw new Error(`CLI directory not found at ${cliPath}`);
  }
  
  return cliPath;
}

function getAssetsBundlePath(channel: Channel, isTmp = false): string {
  return path.resolve(LDT_DIR, channel, kCliPackageName);
}

export async function setupResource(
  assignedBundlePath?: string,
  progressListener?: (progress: number) => void,
  updateType: 0 | 1 = 0
) {
  try {
    // wait app ready
    if (!app.isReady()) {
      await app.whenReady();
    }

    // build the target path

    // ~/.lynx-devtool/3x/@lynx-js/lynx-devtool-cli
    const ldtPath = path.resolve(
      LDT_DIR,
      currentChannel,
      kScopeName,
      kCliPackageName
    );
    const homeCnDir = path.resolve(ldtPath, "dist/static/ldt_home");
    const pluginDir = path.resolve(ldtPath, "dist/static/ldt_home/dist/plugins");

    defaultLogger.info(`ldtPath: ${ldtPath}`);
    
    // ensure the directory exists
    if (!fs.existsSync(ldtPath)) {
      fs.mkdirSync(ldtPath, { recursive: true });
    }

    // check if it's a packaged electron app
    const isPackagedApp = app.isPackaged;

    defaultLogger.info(`app.isReady(): ${app.isReady()}`);
    defaultLogger.info(`app.isPackaged: ${app.isPackaged}`);
    defaultLogger.info(`isPackagedApp: ${isPackagedApp}`);
    defaultLogger.info(`process.resourcesPath: ${process.resourcesPath}`);

    // handle the path in dev mode, must copy the resources from the source code
    if (!isPackagedApp) {

      if (fs.existsSync(pluginDir)) {
        fs.cpSync(pluginDir, path.resolve(ldtPath, "..", 'plugins'), { recursive: true });
      }

      fs.rmSync(ldtPath, { recursive: true, force: true });

      defaultLogger.info(`=== updator: Update dev Static Resources ===`);

      // <devtool>/packages/lynx-devtool-cli
      const debugSourcePath = path.resolve(
        process.cwd(),
        "packages/lynx-devtool-cli"
      );
      const packageJsonPath = path.resolve(
        process.cwd(),
        "packages/lynx-devtool-cli/package.json"
      );

      defaultLogger.info(`debugSourcePath: ${debugSourcePath}`);

      // copy bin directory
      // from <devtool>/packages/lynx-devtool-cli/bin
      // to ~/.lynx-devtool/3x/@lynx-js/lynx-devtool-cli/bin
      if (fs.existsSync(path.resolve(debugSourcePath, "bin"))) {
        copyDir(
          path.resolve(debugSourcePath, "bin"),
          path.resolve(ldtPath, "bin")
        );
      }

      // copy dist directory
      // from <devtool>/packages/lynx-devtool-cli/dist
      // to ~/.lynx-devtool/3x/@lynx-js/lynx-devtool-cli/dist
      if (fs.existsSync(path.resolve(debugSourcePath, "dist"))) {
        copyDir(
          path.resolve(debugSourcePath, "dist"),
          path.resolve(ldtPath, "dist")
        );
      }

      // from <devtool>/packages/lynx-devtool-cli/package.json
      // to ~/.lynx-devtool/3x/@lynx-js/lynx-devtool-cli/package.json
      copyFileSync(packageJsonPath, path.resolve(ldtPath, "package.json"));

      // from <devtool>/dist/lynx-devtool-web
      // to ~/.lynx-devtool/3x/@lynx-js/lynx-devtool-cli/dist/static/ldt_home/dist
      const webSourcePath = path.resolve(
        process.cwd(),
        "dist/lynx-devtool-web"
      );
      const webDestPath = path.resolve(homeCnDir, "dist");

      defaultLogger.info(
        `Copying web resources from ${webSourcePath} to ${webDestPath}`
      );

      if (fs.existsSync(webSourcePath)) {
        copyDir(webSourcePath, webDestPath);
      } else {
        defaultLogger.warn(`Web source path not found: ${webSourcePath}`);
      }

      if (fs.existsSync(path.resolve(ldtPath, "..", 'plugins'))) {
        fs.cpSync(path.resolve(ldtPath, "..", 'plugins'), pluginDir, { recursive: true });
        fs.rmSync(path.resolve(ldtPath, "..", 'plugins'), { recursive: true, force: true });
      }

    } else {
      let resVersion = "",
        resType = "dev";
      const packageJsonPath = path.resolve(ldtPath, "package.json");
      const resFlagPath = path.resolve(homeCnDir, RES_READY_FLAG);
      if (fs.existsSync(packageJsonPath)) {
        const packageJson = fs.readFileSync(packageJsonPath, "utf8");
        const packageJsonObj = JSON.parse(packageJson);
        resVersion = packageJsonObj.version;
      }
      if (fs.existsSync(resFlagPath)) {
        resType = fs.readFileSync(resFlagPath, "utf8"); // 'prod' or 'dev'
      }

      const resourcesPath = (process as any).resourcesPath;
      const asarPath = path.resolve(resourcesPath, "app.asar");

      const innerPackageJson = asar.extractFile(
        asarPath,
        "node_modules/@lynx-js/lynx-devtool-cli/package.json"
      );
      const innerPackageJsonObj = JSON.parse(innerPackageJson.toString());
      const innerVersion = innerPackageJsonObj.version;

      // handle the path in prod mode, extract the resources from the asar, and compare the version
      if (
        (isPackagedApp && resType === "dev") ||
        (isPackagedApp && resType === "prod" && resVersion !== innerVersion)
      ) {
        fs.rmSync(ldtPath, { recursive: true, force: true });

        defaultLogger.info(`=== updator: Update prod Static Resources ===`);
        defaultLogger.info(`isPackagedApp: ${isPackagedApp}`);
        defaultLogger.info(`resType: ${resType}`);
        defaultLogger.info(`innerVersion: ${innerVersion}`);
        defaultLogger.info(`resVersion: ${resVersion}`);
        defaultLogger.info(`resourcesPath: ${resourcesPath}`);
        defaultLogger.info(`asarPath: ${asarPath}`);

        // create a temp directory and extract the asar
        // ~/.lynx-devtool/.temp
        const tempDir = path.resolve(LDT_DIR, ".temp");
        try {
          await asar.extractAll(asarPath, tempDir);

          // copy CLI resources

          // ~/.lynx-devtool/.temp/node_modules/@lynx-js/lynx-devtool-cli
          const tmpCliSourcePath = path.join(
            tempDir,
            "node_modules",
            kScopeName,
            kCliPackageName
          );

          // ~/.lynx-devtool/.temp/node_modules/@lynx-js/lynx-devtool-cli/package.json
          const tmpPackageJsonPath = path.join(
            tmpCliSourcePath,
            "package.json"
          );

          // copy bin directory
          // to ~/.lynx-devtool/3x/@lynx-js/lynx-devtool-cli/bin
          copyDir(
            path.join(tmpCliSourcePath, "bin"),
            path.resolve(ldtPath, "bin")
          );

          // copy dist directory
          // to ~/.lynx-devtool/3x/@lynx-js/lynx-devtool-cli/dist
          copyDir(
            path.join(tmpCliSourcePath, "dist"),
            path.resolve(ldtPath, "dist")
          );

          // from  ~/.lynx-devtool/.temp/node_modules/@lynx-js/lynx-devtool-cli/package.json
          // to ~/.lynx-devtool/3x/@lynx-js/lynx-devtool-cli/package.json
          copyFileSync(
            tmpPackageJsonPath,
            path.resolve(ldtPath, "package.json")
          );

          // copy web resources
          // ~/.lynx-devtool/.temp/node_modules/@lynx-js/lynx-devtool-web/dist
          const tempWebDistPath = path.join(
            tempDir,
            "dist",
            kWebPackageName
          );

          // to ~/.lynx-devtool/3x/@lynx-js/lynx-devtool-cli/dist/static/ldt_home/dist
          copyDir(
            tempWebDistPath,
            path.resolve(ldtPath, "dist/static/ldt_home/dist")
          );
        } catch (error) {
          defaultLogger.error("Error extracting from asar:", error);
          throw error;
        } finally {
          // clean the temp directory
          fs.rmSync(tempDir, { recursive: true, force: true });
        }
      }
    }

    // create the flag file
    if (!fs.existsSync(homeCnDir)) {
      fs.mkdirSync(homeCnDir, { recursive: true });
    }

    // ~/.lynx-devtool/3x/@lynx-js/lynx-devtool-cli/dist/static/ldt_home/RES_READY_FLAG
    fs.writeFileSync(
      path.resolve(homeCnDir, RES_READY_FLAG),
      `${isPackagedApp ? "prod" : "dev"}`
    );

    defaultLogger.info(`homeCnDir: ${homeCnDir}`);

    return true;
  } catch (error) {
    defaultLogger.error("Error in setupResource:", error);
    throw error;
  }
}

export function tryUseChannel(argv?: CliOptions): Promise<UpdateResult> {
  return new Promise<UpdateResult>(async (resolve, reject) => {
    resolve({ state: false });
  });
}
