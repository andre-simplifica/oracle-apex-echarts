import { lstat, readdir } from "node:fs/promises";
import { relative, resolve } from "node:path";

const SKIP_DIRECTORIES = new Set([".git", "node_modules", "dist", "build", ".cache"]);

export async function repositoryFiles(root) {
  const result = [];
  async function visit(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      if (entry.isDirectory() && SKIP_DIRECTORIES.has(entry.name)) continue;
      const path = resolve(directory, entry.name);
      const metadata = await lstat(path);
      if (metadata.isSymbolicLink()) throw new Error(`Symbolic link is not allowed: ${relative(root, path)}`);
      if (metadata.isDirectory()) await visit(path);
      else if (metadata.isFile()) result.push(relative(root, path).replaceAll("\\", "/"));
    }
  }
  await visit(root);
  return result.sort();
}
