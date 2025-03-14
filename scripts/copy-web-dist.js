const fs = require("fs");
const path = require("path");
const src = path.join("packages", "lynx-devtool-web", "dist");
const dest = path.join("dist", "lynx-devtool-web");
if (!fs.existsSync(dest)) {
  fs.mkdirSync(dest, { recursive: true });
}
const copyDir = function (s, d) {
  const files = fs.readdirSync(s);
  files.forEach((file) => {
    const spath = path.join(s, file);
    const dpath = path.join(d, file);
    if (fs.statSync(spath).isDirectory()) {
      if (!fs.existsSync(dpath)) {
        fs.mkdirSync(dpath, { recursive: true });
      }
      copyDir(spath, dpath);
    } else {
      fs.copyFileSync(spath, dpath);
    }
  });
};
copyDir(src, dest);
console.log("Web dist copied successfully.");
