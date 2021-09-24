import axios, { AxiosError } from "axios";
import { createWriteStream } from "fs";
import { JSDOM } from "jsdom";
import * as stream from "stream";
import { promisify } from "util";
import { existsSync, mkdirSync } from "fs";
import { articles } from "./published-articles.js";

const finished = promisify(stream.finished);

const articleNamePairs = articles.map(url => ({
    url,
    name: sanitizeFilename(url.split("/").pop() || url)
}));

articleNamePairs.forEach(getImagesForArticle);
// const url = "https://developer.mongodb.com/quickstart/cheat-sheet";
// const name = sanitizeFilename(url.split("/").pop() || url);
// console.log(url, name);
// getImagesForArticle({url, name});

async function getImagesForArticle({url, name}: {url: string, name: string}) {
    let response;
    try {
        response = await axios.get(url);
    } catch(error) {
        console.error(`Request for article failed for ${url}`);
        console.error((error as AxiosError).message);
        return;
    }

    const dom = new JSDOM(response.data);
    const { document } = dom.window;
    const images = document.querySelectorAll("img");

    let unnamedImagesCounter = 1;
    console.log(`Downloading images for ${name}`);
    for (const img of images) {
        let source = img.attributes.getNamedItem("src")?.value;
        if (!source || source.startsWith("/assets")) {
            continue;
        }

        if (source.startsWith("/")) {
            source = `http://mongodb.com${source}`;
        }

        let filename = img.attributes.getNamedItem("alt")?.value || (unnamedImagesCounter++).toString();
        filename = sanitizeFilename(filename);

        const dir = `./images/${name}`;
        if (!existsSync(dir)){
            mkdirSync(dir, { recursive: true });
        }

        downloadFile(source, `${dir}/${filename}.png`);
    }
}

async function downloadFile(source: string, outputLocation: string) {
    const writeStream = createWriteStream(outputLocation);
    let response;
    try {
        response = await axios.get(source, { responseType: "stream" });
    } catch (error) {
        console.error(`Request for image failed for ${source}, ${outputLocation}`);
        console.error((error as AxiosError).message);
        return;
    }

    response.data.pipe(writeStream);

    return finished(writeStream);
}

function sanitizeFilename(filename: string): string {
    return filename.replace(/[/\\?%*:|"<>]/g, '-').substring(0, 50);
}
