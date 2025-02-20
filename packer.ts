import { copy, emptyDir } from "https://deno.land/std/fs/mod.ts";
import {
    BlobReader,
    BlobWriter,
    TextReader,
    ZipWriter,
} from "https://deno.land/x/zipjs/index.js";

const DATAPACK_PATH = "../alola_spawns";
const OUTPUT_PATH = "./output/spawning";

async function addDirectory(
    path: string,
    zipPath: string,
    zipWriter: ZipWriter<Blob>,
) {
    for await (const entry of Deno.readDir(path)) {
        const fullPath = `${path}/${entry.name}`;
        const fullZipPath = `${zipPath}/${entry.name}`;

        if (entry.isDirectory) {
            await addDirectory(fullPath, fullZipPath, zipWriter);
        } else {
            const content = await Deno.readTextFile(fullPath);
            await zipWriter.add(fullZipPath, new TextReader(content));
        }
    }
}

async function main() {
    try {
        const spawningPath = `${DATAPACK_PATH}/data/pixelmon/spawning`;
        await emptyDir(spawningPath);

        await copy(OUTPUT_PATH, spawningPath, { overwrite: true });
        console.log("Spawning files copied successfully");

        const blobWriter = new BlobWriter("application/zip");
        const zipWriter = new ZipWriter(blobWriter);

        const mcmetaContent = await Deno.readTextFile(
            `${DATAPACK_PATH}/pack.mcmeta`,
        );
        await zipWriter.add("pack.mcmeta", new TextReader(mcmetaContent));

        await addDirectory(`${DATAPACK_PATH}/data`, "data", zipWriter);

        await zipWriter.close();
        const zipBlob = await blobWriter.getData();

        const arrayBuffer = await zipBlob.arrayBuffer();
        await Deno.writeFile("alola_spawns.zip", new Uint8Array(arrayBuffer));

        console.log("Zip file created successfully");
    } catch (error) {
        console.error("Error:", error);
    }
}

main();
