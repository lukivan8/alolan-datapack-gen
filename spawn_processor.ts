import { walk } from "https://deno.land/std/fs/mod.ts";

interface HeldItem {
  itemID: string;
  percentChance: number;
}

interface SpawnCondition {
  times?: string[];
  stringBiomes?: string[];
  maxY?: number;
}

interface SpawnInfo {
  spec: string;
  stringLocationTypes: string[];
  minLevel?: number;
  maxLevel?: number;
  level?: number;
  typeID: string;
  heldItems?: HeldItem[];
  condition: SpawnCondition;
  rarity: number;
  tags?: string[];
  interval?: string;
}

interface SpawnFile {
  id: string;
  spawnInfos: SpawnInfo[];
}

const loadNameList = async (filename: string): Promise<Set<string>> => {
  const text = await Deno.readTextFile(`.\\assets\\${filename}`);
  return new Set(
    text.split("\n").map((line) => line.trim()).filter((line) =>
      line.length > 0
    ).map((name) => name.toLowerCase()),
  );
};

const loadBiomedPokemon = async (
  filename: string,
): Promise<Map<string, string[]>> => {
  const text = await Deno.readTextFile(`.\\assets\\${filename}`);
  const pokemon = new Map<string, string[]>();
  text.split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .forEach((line) => {
      const [pokemon_name, ...biomes] = line.split(" ");
      pokemon.set(pokemon_name.toLowerCase(), biomes);
    });
  return pokemon;
};

const emptySpawn: SpawnFile = {
  id: "",
  spawnInfos: [],
};

const alolanTemplate = (name: string, spawnInfos: SpawnInfo[]): SpawnFile => ({
  id: name,
  spawnInfos: spawnInfos.filter((info) =>
    info.spec.toLowerCase().includes("form:alolan")
  ),
});

const ultraBeastOverworldTemplate = (
  originalSpawnInfo: SpawnInfo,
): SpawnInfo => ({
  ...originalSpawnInfo,
  tags: ["legendary"],
  interval: "legendary",
  condition: {
    times: ["NIGHT"],
    stringBiomes: ["all"],
  },
  rarity: 1.0,
});

const legendaryUltraSpaceTemplate = (
  originalSpawnInfo: SpawnInfo,
  ultraBiomes: string[],
): SpawnInfo => ({
  ...originalSpawnInfo,
  condition: {
    stringBiomes: ultraBiomes,
  },
  rarity: 0.5,
});

const megaUltraSpaceTemplate = (
  originalSpawnInfo: SpawnInfo,
  ultraBiomes: string[],
): SpawnInfo => ({
  ...originalSpawnInfo,
  condition: {
    stringBiomes: ultraBiomes,
  },
  rarity: 10.0,
});

async function processSpawnFile(
  filePath: string,
  ultraBeasts: Set<string>,
  legendaries: Map<string, string[]>,
  megaPokemon: Map<string, string[]>,
) {
  if (
    filePath.includes("\\npcs\\") ||
    filePath.includes("headbutt\\loot") ||
    filePath.includes("forage\\loot") ||
    filePath.includes("fishing\\loot") ||
    filePath.includes("rocksmash\\loot")
  ) {
    return;
  }

  try {
    const content = await Deno.readTextFile(filePath);
    const spawn = JSON.parse(content) as SpawnFile;
    const pokemonName = spawn.id.split(" ")[0].toLowerCase();
    const relativePath = filePath.replace("input\\spawning\\", "");
    const outputPath = `output\\spawning\\${relativePath}`;
    const outputDir = outputPath.substring(0, outputPath.lastIndexOf("\\"));
    await Deno.mkdir(outputDir, { recursive: true });

    let newContent: SpawnFile;

    if (ultraBeasts.has(pokemonName)) {
      const originalSpawnInfo = spawn.spawnInfos[0];
      newContent = {
        id: spawn.id,
        spawnInfos: [
          ...spawn.spawnInfos,
          ultraBeastOverworldTemplate(originalSpawnInfo),
        ],
      };
    } else if (legendaries.has(pokemonName)) {
      const ultraBiomes = legendaries.get(pokemonName)!;
      const originalSpawnInfo = spawn.spawnInfos[0];
      newContent = {
        id: spawn.id,
        spawnInfos: [
          legendaryUltraSpaceTemplate(originalSpawnInfo, ultraBiomes),
        ],
      };
    } else if (megaPokemon.has(pokemonName)) {
      const ultraBiomes = megaPokemon.get(pokemonName)!;
      const originalSpawnInfo = spawn.spawnInfos[0];
      const ultraSpaceSpawn = megaUltraSpaceTemplate(
        originalSpawnInfo,
        ultraBiomes,
      );

      if (allowedPokemon.has(pokemonName)) {
        newContent = {
          id: spawn.id,
          spawnInfos: [
            ...spawn.spawnInfos,
            ultraSpaceSpawn,
          ],
        };
      } else {
        newContent = {
          id: spawn.id,
          spawnInfos: [ultraSpaceSpawn],
        };
      }
    } else if (!allowedPokemon.has(pokemonName)) {
      newContent = { ...emptySpawn, id: spawn.id };
    } else if (alolanForms.has(pokemonName)) {
      newContent = alolanTemplate(spawn.id, spawn.spawnInfos);
    } else {
      return;
    }

    await Deno.writeTextFile(
      outputPath,
      JSON.stringify(newContent, null, 2),
    );
    console.log(`Processed: ${relativePath}`);
  } catch (error) {
    console.error(`Error processing ${filePath}:`, error);
  }
}

const [allowedPokemon, alolanForms, ultraBeasts, legendaries, megaPokemon] =
  await Promise.all([
    loadNameList("natdex.txt"),
    loadNameList("alolan_forms.txt"),
    loadNameList("ultra_beasts.txt"),
    loadBiomedPokemon("legendaries.txt"),
    loadBiomedPokemon("mega.txt"),
  ]);

for await (
  const entry of walk(".\\input\\spawning", {
    match: [/\.set\.json$/],
    skip: [
      /\/npcs\//,
      /\\headbutt\\loot/,
      /\\forage\\loot/,
      /\\fishing\\loot/,
      /\\rocksmash\\loot/,
    ],
  })
) {
  if (entry.isFile) {
    await processSpawnFile(entry.path, ultraBeasts, legendaries, megaPokemon);
  }
}

console.log("Processing complete!");
