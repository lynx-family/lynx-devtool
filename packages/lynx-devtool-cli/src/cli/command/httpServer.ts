// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { CliOptions, DEFAULT_STATIC_SERVE_PORT } from '../../config/toolkit';
import { defaultLogger, getConfigItem } from '../../utils';
import compression from 'compression';
import cors from 'cors';
import express, { Express } from 'express';
import fs from 'fs';
import multer from 'multer';
import path from 'path';
import favicon from 'serve-favicon';
import { RES_READY_FLAG, getCurrentChannel } from '../updator/updator';
import * as utils from '../utils';
import * as handler from './handler';
import { getDebugDriver, restartLDTServer } from './toolkit';
import { LDT_DIR } from '../utils';
import { kScopeName, kCliPackageName } from '@lynx-js/lynx-devtool-utils';
const detect = require('detect-port');
const { createProxyMiddleware } = require('http-proxy-middleware');

const disableCacheConfig = {
  etag: false,
  lastModified: false,
  cacheControl: false
};

class HttpServer {
  startPromise: Promise<string> | null = null;
  runningHost: string | null = null;

  // eslint-disable-next-line max-lines-per-function
  start(options?: CliOptions): Promise<string> {
    // If the http server has been started, return to the host directly
    if (this.runningHost) {
      return Promise.resolve(this.runningHost);
    }
    // If the http server is starting, wait for the result after the startup is completed
    if (this.startPromise) {
      return this.startPromise;
    }

    // eslint-disable-next-line max-lines-per-function
    this.startPromise = new Promise<string>(async (resolve, reject) => {
      const port = await detect(DEFAULT_STATIC_SERVE_PORT);
      const host = `http://localhost:${port}`;

      const app = express();
      const filePath = utils.getUploadFilePath();
      const devtoolPath = `${__dirname}/../../../static/devtool`;
      const tracePath = `${__dirname}/../../../static/trace`;

      // Set the save upload file path
      const storage = multer.diskStorage({
        destination: filePath,
        filename(req: Express.Request, file: Express.Multer.File, cb: (error: Error | null, filename: string) => void) {
          const fileName = Buffer.from(file.originalname, 'latin1').toString('utf8');
          cb(null, fileName);
        }
      });
      const upload = multer({
        storage,
        limits: { fileSize: 100 * 1024 * 1024 }
      });

      // static resources
      app.use(upload.single('file'));
      app.use(express.json({ limit: '50mb' }));
      app.use(express.urlencoded({ extended: true, limit: '50mb', parameterLimit: 50000 }));
      app.use(cors());
      app.use(compression());

      app.use('/localResource/file', express.static(filePath));
      app.use('/localResource/devtool', express.static(devtoolPath, disableCacheConfig));
      app.use('/localResource/trace', express.static(tracePath));

      // apis
      app.post('/uploadFileToLocal', (req: any, res: any) => {
        handler.uploadFileToLocal(req, res, host);
      });
      app.get('/renameLocalFile', handler.renameLocalFile);
      app.get('/deleteLocalFile', (req: any, res: any) => {
        handler.deleteLocalFile(req, res);
      });
      app.get('/reconnect', (req: any, res: any) => {
        handler.reconnect(req, res, getDebugDriver());
      });
      app.get('/restartServer', (req: any, res: any) => {
        restartLDTServer().then((success) => {
          const code = success ? 0 : -1;
          const message = success ? 'success' : 'failed';
          res.send({
            code,
            message
          });
        });
      });
      app.get('/queryIntranetIp', (req: any, res: any) => {
        handler.queryIntranetIp(req, res);
      });
      app.get('/lstIdentity', (req: any, res: any) => {
        handler.lstIdentity(req, res);
      });
      app.get('/checkAdb', (req: any, res: any) => {
        handler.checkAdb(req, res);
      });
      app.get('/openUrlExternal', handler.openUrlExternal);
      app.get('/checkExistServer', (req: any, res: any) => {
        handler.checkExistServer(req, res);
      });
      app.get('/getVersion', handler.getLDTVersion);
      app.get('/getGitInfo', handler.getGitInfo);
      app.post('/addEnvLogs', (req: any, res: any) => {
        handler.addEnvLogs(req, res);
      });
      app.post('/uploadEnvLogs', (req: any, res: any) => {
        handler.uploadEnvLogs(req, res);
      });
      app.post('/firstConnectionMade', (req: any, res: any) => {
        handler.firstConnectionMade(req, res);
      });
      app.get('/getConfigItemByKey', (req: any, res: any) => {
        handler.getConfigItemByKey(req, res);
      });
      app.post('/deleteCLI', async (req: any, res: any) => {
        try {
          await handler.deleteCLI(req);
          res.send({ code: 0 });
        } catch (e) {
          res.send({ code: -1, message: e });
        }
      });

      // router
      if (options?.debug === true) {
        // Directly forward the request of the dev server of lynx-devtool-web in the debugging environment
        app.use(
          createProxyMiddleware('/', {
            // starting from node 17, proxy must use 127.0.0.1 instead of localhost
            // https://github.com/chimurai/http-proxy-middleware/issues/705
            target: 'http://127.0.0.1:8080/',
            changeOrigin: false
          })
        );
      } else {
        await this.linkHomePath(app);
      }

      const server = app.listen(port, () => {
        resolve(host);
        this.runningHost = host;
        this.startPromise = null;
      });
      server.on('error', (e) => {
        defaultLogger.error(`start LDT Server error: ${e}`);
        server.close();
        reject(e);
        this.startPromise = null;
      });
    });
    return this.startPromise;
  }

  private async linkHomePath(app: Express) {
    const currentChannel = getCurrentChannel();
    const cliPath = path.resolve(LDT_DIR, currentChannel, kScopeName, kCliPackageName);
    
    defaultLogger.info('=== Debug Info ===');
    defaultLogger.info(`LDT_DIR: ${LDT_DIR}`);
    defaultLogger.info(`currentChannel: ${currentChannel}`);
    defaultLogger.info(`cliPath: ${cliPath}`);
    
    // Set the static resource path
    const staticPath = path.resolve(cliPath, 'dist/static');
    defaultLogger.info(`staticPath: ${staticPath}`);
    defaultLogger.info(`staticPath exists: ${fs.existsSync(staticPath)}`);
    app.use('/static', express.static(path.resolve(cliPath, 'dist/static'), disableCacheConfig));
    
    const cnHomePath = path.resolve(LDT_DIR, currentChannel, kScopeName, kCliPackageName,'dist/static/ldt_home');
    defaultLogger.info(`cnHomePath: ${cnHomePath}`);

    const region = await getConfigItem('region');
    defaultLogger.info(`region: ${region}`);
    let resPath = cnHomePath;
    
    if (fs.existsSync(path.resolve(cnHomePath, RES_READY_FLAG))) {
      resPath = path.resolve(cnHomePath, 'dist');
      defaultLogger.info(`Using CN path: ${resPath}`);
      defaultLogger.info(`CN path exists: ${fs.existsSync(resPath)}`);
    }

    // uninstall former middleware
    for (const layer of app._router.stack) {
      if (layer.__LDTResTag) {
        app._router.stack.splice(app._router.stack.indexOf(layer), 1);
      }
    }

    // handle express router error
    function handleError(res: any, err: any) {
      if (err) {
        defaultLogger.info(`Error handling route: ${err}`);
        const notFoundPath = path.resolve(cliPath, 'dist/static/404/404.html');
        defaultLogger.info(`404 page path: ${notFoundPath}`);
        defaultLogger.info(`404 page exists: ${fs.existsSync(notFoundPath)}`);
        if (fs.existsSync(notFoundPath)) {
          res.sendFile(notFoundPath, disableCacheConfig);
        } else {
          res.send('404 Not Found');
        }
      }
    }

    // Set the static resource route
    app.use(express.static(resPath, disableCacheConfig));

    // Read the route configuration from route.json
    const routePath = path.join(resPath, 'route.json');
    defaultLogger.info(`Route config path: ${routePath}`);
    defaultLogger.info(`Route config exists: ${fs.existsSync(routePath)}`);
    
    if (fs.existsSync(routePath)) {
      const homeRoutes = require(routePath).routes;
      defaultLogger.info(`Loaded routes: ${JSON.stringify(homeRoutes)}`);
      
      // Process specific routes first
      for (let i = homeRoutes.length - 1; i >= 0; i--) {
        const route = homeRoutes[i];
        if (route.urlPath !== '/') {
          app.get(route.urlPath, function (req, res) {
            const filePath = path.join(resPath, route.entryPath);
            defaultLogger.info(`Serving ${req.path} from ${filePath}`);
            res.sendFile(filePath, disableCacheConfig, (err) => {
              handleError(res, err);
            });
          });
        }
      }
      
      // Finally process the wildcard route
      const mainRoute = homeRoutes.find(route => route.urlPath === '/');
      if (mainRoute) {
        app.get('/*', function (req, res) {
          const filePath = path.join(resPath, mainRoute.entryPath);
          defaultLogger.info(`Serving ${req.path} from ${filePath}`);
          res.sendFile(filePath, disableCacheConfig, (err) => {
            handleError(res, err);
          });
        });
      }
    }
  }
}

const httpServer = new HttpServer();
export default httpServer;
