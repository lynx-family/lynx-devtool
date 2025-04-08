#!/usr/bin/env bash

# make sure cli has been built
if [ ! -d "dist" ]
then
  echo "lynx-devtool-cli not built. running build first."
  emo run build
fi

# start lynx-devtool-web
PATH_LDT_PC="../../../packages/lynx-devtool-web"
if [ ! -d "$PATH_LDT_PC" ]
then
  echo "lynx-devtool-web directory not found. make sure you have setup ldt-res repo correctly."
  exit 1
fi

CMD_RUN_CLI="node bin/ldt.js start --upgradeChannel debug"
RUN_MODE=$1
if [ "$RUN_MODE" == "cli" ]
then
  $CMD_RUN_CLI
elif [ "$RUN_MODE" == "cli+pc" ]
then
  concurrently "emo run wait && $CMD_RUN_CLI --debug true" "cd $PATH_LDT_PC && pnpm run start:offline" 
fi