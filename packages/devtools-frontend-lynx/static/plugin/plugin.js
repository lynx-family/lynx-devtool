import * as UI from "../ui/legacy/legacy.js";
import {
  registerPlugin,
  postMessage,
  addEventListener,
  logExpression,
} from "./pluginLoader.js";

const urlParams = new URLSearchParams(window.location.search);
const hdtVersion = urlParams.get('hdtVersion');

window.postPluginMessage = postMessage;
window.addPluginEventListener = addEventListener;
window.logPluginExpression = logExpression;
window.registerPlugins = () => {
  const listener = (event) => {
    if (event.data?.type !== "inject_data") {
      return;
    }
    Object.assign(window, {
      info: event.data.content?.info,
    });
    window.removeEventListener("message", listener);

    // dynamic plugins
    const plugins = (event.data.content?.plugins).filter((plugin)=> {
      return !(plugin?.disable ?? false);
    }) ?? [];
    const pluginCount = plugins.length;
    if (pluginCount > 0) {
      plugins.forEach(({ url, _id, name, location }, idx) => {
        registerPlugin(
          {
            name,
            title: name,
            id: _id,
            url,
            location,
            commandPrompt: "Show " + name,
            tags: "Develop",
            order: 200 + idx,
            type: "All",
          },
          undefined,
          false
        );
      });
    }
  };

  window.addEventListener("message", listener);
  console.log('talisk### postMessage', window.parent);
  window.parent.postMessage(
    {
      type: "iframe_init",
    },
    "*"
  );
};
