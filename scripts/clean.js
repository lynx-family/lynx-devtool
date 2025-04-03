const fs = require("fs");
const path = require("path");
const rimraf = require("rimraf");
const paths = ["dist"];
try {
  paths.forEach((p) => rimraf.sync(p));
  console.log("Cleaned successfully.");
} catch (e) {
  console.error(e);
}
