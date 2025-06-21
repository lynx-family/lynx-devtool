#!/usr/bin/env node

// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { Command } from 'commander';
import * as ejs from 'ejs';
import execa from 'execa';
import * as fs from 'fs';
import inquirer from 'inquirer';
import * as path from 'path';

async function createPlugin(pluginName: string, registry?: string) {
  const pluginDir = path.join(process.cwd(), pluginName);

  if (fs.existsSync(pluginDir)) {
    console.error(`Plugin ${pluginName} already exists!`);
    return;
  }

  fs.mkdirSync(pluginDir);
  console.log(`Creating plugin directory: ${pluginDir}`);

  const templateDir = path.join(__dirname, 'template');

  const prompts = [
    {
      type: 'input',
      name: 'packageName',
      message: 'Please enter the npm package name:'
    },
    {
      type: 'input',
      name: 'packageDescription',
      message: 'Please enter the plugin description (for display in plugin market):'
    },
    {
      type: 'input',
      name: 'pluginName',
      message: 'Please enter the plugin name (for display in toolbar):'
    }
  ];

  try {
    const answers = await inquirer.prompt(prompts as any);
    const walkDir = (dir: string, relativePath = '') => {
      fs.readdirSync(dir).forEach((file) => {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        const relativeFilePath = path.join(relativePath, file);
        if (stat.isDirectory()) {
          const outputDirPath = path.join(pluginDir, relativeFilePath);
          fs.mkdirSync(outputDirPath, { recursive: true });
          walkDir(filePath, relativeFilePath);
        } else if (file.endsWith('.ejs')) {
          const outputPath = path.join(pluginDir, relativeFilePath.replace('.ejs', '')); // Remove .ejs extension from output filename
          const outputDir = path.dirname(outputPath);
          fs.mkdirSync(outputDir, { recursive: true });
          ejs.renderFile(
            filePath,
            { ...answers, pluginName, pluginHasView: true, pluginMode: 'radio' },
            (err, result) => {
              if (err) {
                console.error(`Error rendering template ${file}: ${err}`);
                return;
              }
              fs.writeFileSync(outputPath, result);
              console.log(`\t ${outputPath}`);
            }
          );
        }
      });
    };
    console.log('Generating project...');
    walkDir(templateDir);
    console.log('Installing dependencies...');
    await execa('npm', ['install', registry ? '--registry=' + registry : ''], { cwd: pluginDir });
    console.log('Building plugin...');
    await execa('npm', ['run', 'build'], { cwd: pluginDir });
    console.log('Build complete, plugin generated! Path:', pluginDir);
  } catch (e) {
    console.log(e);
  }
}

const program = new Command();

program
  .command('create <pluginName>')
  .option('--registry <registry>', 'npm registry')
  .description('Create a new plugin project')
  .action(async (pluginName: string, options: { registry: string }) => {
    await createPlugin(pluginName, options.registry);
  });

program.parse(process.argv);
