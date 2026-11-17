import "@fontsource/pixelify-sans/400.css";
import "@fontsource/pixelify-sans/500.css";
import "@fontsource/pixelify-sans/600.css";
import "@fontsource/pixelify-sans/700.css";
import "@fontsource/silkscreen/400.css";
import "./style.css";
import { loadDigitFont } from "./fonts";
import { App } from "./ui/app";

loadDigitFont();
const app = new App();
void app.start();
