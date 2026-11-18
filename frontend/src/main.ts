import "@fontsource/pixelify-sans/400.css";
import "@fontsource/pixelify-sans/500.css";
import "@fontsource/pixelify-sans/600.css";
import "@fontsource/pixelify-sans/700.css";
import "@fontsource-variable/atkinson-hyperlegible-next/wght.css";
import "./style.css";
import { loadDigitFont } from "./fonts";
import { App } from "./ui/app";
import { setFavicon } from "./ui/dom";

loadDigitFont();
setFavicon();
const app = new App();
void app.start();
